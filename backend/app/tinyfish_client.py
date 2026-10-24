"""
TinyFish client with strict budget gate and request accounting.
Enforces hard caps, zero uncounted retries, and fail-closed live execution.
"""

from __future__ import annotations

import asyncio
import datetime
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

# Attempt imports from shared application modules; fallback gracefully if not yet pushed
try:
    from app.db import reserve_tinyfish_request  # type: ignore
except ImportError:
    try:
        from backend.app.db import reserve_tinyfish_request  # type: ignore
    except ImportError:
        reserve_tinyfish_request = None

try:
    from app.models import ActivityEvent as _ActivityEvent  # type: ignore
    if "event_type" not in getattr(_ActivityEvent, "model_fields", {}) and not hasattr(_ActivityEvent, "event_type"):
        raise ImportError("ActivityEvent lacks event_type")
    ActivityEvent = _ActivityEvent
except (ImportError, AttributeError):
    try:
        from backend.app.models import ActivityEvent as _ActivityEvent  # type: ignore
        if "event_type" not in getattr(_ActivityEvent, "model_fields", {}) and not hasattr(_ActivityEvent, "event_type"):
            raise ImportError("ActivityEvent lacks event_type")
        ActivityEvent = _ActivityEvent
    except (ImportError, AttributeError):
        @dataclass
        class ActivityEvent:
            event_type: str
            details: Dict[str, Any] = field(default_factory=dict)
            timestamp: str = field(
                default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
            )


# Budget & Safety Constants
DEFAULT_DEV_CAP = 48
DEFAULT_TOTAL_CAP = 64
DEFAULT_STAGE = "development"
REQUEST_COST_USD = 0.25

DEFAULT_TIMEOUT_SEC = 30.0
AGENT_TIMEOUT_SEC = 120.0
RESEARCH_QUEUE_TIMEOUT_SEC = 120.0

OPERATION_TIMEOUTS: Dict[str, float] = {
    "agent_run": AGENT_TIMEOUT_SEC,
    "research_queue": RESEARCH_QUEUE_TIMEOUT_SEC,
}

MAX_RESEARCH_POLLS = 3
MAX_SEARCHES_PER_PACKAGE = 2
MAX_ANALYZED_PACKAGES_PER_SCAN = 4


class TinyFishError(Exception):
    """Base exception for TinyFish client operations."""
    pass


class LiveCallsDisabledError(TinyFishError):
    """Raised when an outbound live request is blocked because TINYFISH_LIVE_ENABLED != 1."""
    pass


class LedgerUnavailableError(TinyFishError):
    """Raised when live calls are enabled but durable request ledger is unavailable (fail closed)."""
    pass


class BudgetExceededError(TinyFishError):
    """Raised when the budget cap for the current stage has been reached."""
    pass


class TinyFishTimeoutError(TinyFishError):
    """Raised when an outbound request exceeds its allocated timeout."""
    pass


class MonitorPauseError(TinyFishError):
    """Raised when demo monitor was created but immediate pause failed."""
    def __init__(self, monitor_id: str, message: str):
        super().__init__(f"Monitor '{monitor_id}': {message}")
        self.monitor_id = monitor_id


_DEFAULT_RESERVE_FN = object()


class TinyFishClient:
    """
    Budget-gated TinyFish client wrapper.
    Ensures:
      - 0 uncounted retries (AsyncTinyFish max_retries=0, raises if unsupported)
      - Cache hits cost 0 units
      - 1 unit reserved in ledger before any outbound request via _call
      - Unpacks (allowed, total_used, development_used) tuple and tolerates plain bool
      - Fail closed if ledger is unavailable for live calls (_check_live_gate)
      - Hard caps (48 dev / 64 total)
      - Max 3 polls for research; stops early on COMPLETED/FAILED/CANCELLED/TIMED_OUT
      - Demo monitor reserves 2 units up front; does not create if second reservation refused
      - wallet_balance never called automatically
      - Per-operation timeouts: 120s for agent_run/research_queue, 30s for rest
      - No skip_reservation parameter on _call or public methods
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        stage: Optional[str] = None,
        dev_cap: int = DEFAULT_DEV_CAP,
        total_cap: int = DEFAULT_TOTAL_CAP,
        timeout: float = DEFAULT_TIMEOUT_SEC,
        reserve_fn: Any = _DEFAULT_RESERVE_FN,
        sdk_client: Optional[Any] = None,
        live_enabled: Optional[bool] = None,
        cache: Optional[Dict[str, Any]] = None,
        total_used: int = 0,
        development_used: int = 0,
    ):
        self.api_key = api_key or os.getenv("TINYFISH_API_KEY")
        self.stage = stage or os.getenv("TINYFISH_BUDGET_STAGE", DEFAULT_STAGE)
        self.dev_cap = dev_cap
        self.total_cap = total_cap
        self.timeout = timeout
        if reserve_fn is not _DEFAULT_RESERVE_FN:
            self.reserve_fn = reserve_fn
        else:
            self.reserve_fn = reserve_tinyfish_request
        self._sdk_client = sdk_client
        if live_enabled is not None:
            self.live_enabled = live_enabled
        else:
            self.live_enabled = os.getenv("TINYFISH_LIVE_ENABLED", "0") == "1"
        self.cache: Dict[str, Any] = cache if cache is not None else {}
        self.activity_log: List[ActivityEvent] = []
        self.total_used = total_used
        self.development_used = development_used

    def get_sdk_client(self) -> Any:
        """Returns or lazily initializes the AsyncTinyFish client with max_retries=0."""
        if self._sdk_client is not None:
            return self._sdk_client

        from tinyfish import AsyncTinyFish

        try:
            self._sdk_client = AsyncTinyFish(
                api_key=self.api_key,
                max_retries=0,
                timeout=self.timeout,
            )
        except TypeError as exc:
            raise RuntimeError(
                "Installed TinyFish SDK does not support 'max_retries=0'. "
                "Refusing to run without guaranteed retry suppression."
            ) from exc
        return self._sdk_client

    def _record_event(self, event_type: str, details: Dict[str, Any]) -> ActivityEvent:
        event = ActivityEvent(event_type=event_type, details=details)
        self.activity_log.append(event)
        return event

    def _check_live_gate(self, operation: str) -> None:
        """
        Validates that live calls are enabled and durable ledger is present.
        Raises LiveCallsDisabledError or LedgerUnavailableError if conditions are not met.
        """
        if not self.live_enabled:
            raise LiveCallsDisabledError(
                f"Live TinyFish calls disabled (TINYFISH_LIVE_ENABLED != 1). Blocked call to '{operation}'."
            )

        if self.reserve_fn is None:
            raise LedgerUnavailableError(
                f"Durable ledger 'reserve_tinyfish_request' is required for live calls but not available. "
                f"Failing closed for operation '{operation}'."
            )

    def _reserve_budget(self, operation: str) -> None:
        """
        Runs live gate check, then reserves 1 request unit from the ledger.
        Fails closed if live calls are disabled, ledger is missing, or budget is exceeded.
        Supports (allowed, total_used, development_used) tuple and plain bool.
        """
        self._check_live_gate(operation)

        try:
            res = self.reserve_fn(self.stage, self.dev_cap, self.total_cap)
        except Exception as exc:
            raise BudgetExceededError(f"Ledger reservation call failed: {exc}") from exc

        if isinstance(res, tuple):
            allowed = bool(res[0])
            if len(res) >= 2:
                self.total_used = int(res[1])
            if len(res) >= 3:
                self.development_used = int(res[2])
        else:
            allowed = bool(res)
            if allowed:
                self.total_used += 1
                if self.stage == "development":
                    self.development_used += 1

        if not allowed:
            raise BudgetExceededError(
                f"TinyFish budget cap exceeded for stage '{self.stage}' "
                f"(dev_cap={self.dev_cap}, total_cap={self.total_cap}). Call to '{operation}' rejected."
            )

    async def _execute(
        self,
        operation: str,
        api_func: Callable[..., Any],
        cache_key: Optional[str] = None,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Shared outbound execution runner: logs attempt event, enforces per-operation timeout,
        logs success/timeout/failure, and stores cache hits.
        """
        # 1. Log attempt
        self._record_event(
            "tinyfish_request_attempt",
            {"operation": operation, "stage": self.stage},
        )

        # 2. Outbound call with operation-specific timeout (120s for agent_run/research_queue, 30s default)
        op_timeout = timeout if timeout is not None else OPERATION_TIMEOUTS.get(operation, self.timeout)

        try:
            result = await asyncio.wait_for(api_func(**kwargs), timeout=op_timeout)
            self._record_event(
                "tinyfish_request_success",
                {"operation": operation},
            )
            if cache_key is not None:
                self.cache[cache_key] = result
            return result
        except asyncio.TimeoutError as exc:
            self._record_event(
                "tinyfish_request_timeout",
                {"operation": operation, "timeout": op_timeout},
            )
            raise TinyFishTimeoutError(
                f"TinyFish operation '{operation}' timed out after {op_timeout}s"
            ) from exc
        except Exception as exc:
            self._record_event(
                "tinyfish_request_failure",
                {"operation": operation, "error": str(exc)},
            )
            raise

    async def _call(
        self,
        operation: str,
        api_func: Callable[..., Any],
        cache_key: Optional[str] = None,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Executes a single TinyFish operation with cache check, live gate check, budget reservation,
        and execution. ALWAYS reserves exactly 1 unit (no skip_reservation bypass).
        """
        # 1. Cache check - cache hit reserves 0 units and bypasses live check
        if cache_key is not None and cache_key in self.cache:
            self._record_event(
                "tinyfish_cache_hit",
                {"operation": operation, "cache_key": cache_key},
            )
            return self.cache[cache_key]

        # 2. Live gate check & budget reservation (ALWAYS reserves exactly 1 unit)
        self._check_live_gate(operation)
        self._reserve_budget(operation)

        # 3. Outbound call
        return await self._execute(operation, api_func, cache_key=cache_key, timeout=timeout, **kwargs)

    async def _call_prepaid(
        self,
        operation: str,
        api_func: Callable[..., Any],
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Private execution for pre-reserved operations (used only by run_demo_monitor helpers).
        Runs _check_live_gate and _execute, but does NOT reserve another unit.
        """
        self._check_live_gate(operation)
        return await self._execute(operation, api_func, cache_key=None, timeout=timeout, **kwargs)

    # 1. Search (30s timeout)
    async def search(self, query: str, timeout: Optional[float] = None, **kwargs: Any) -> Any:
        """Performs a search query with caching and budget gate."""
        cache_key = f"search:{query.strip().lower()}"
        sdk = self.get_sdk_client()
        return await self._call("search", sdk.search.query, cache_key=cache_key, timeout=timeout, query=query, **kwargs)

    # 2. Fetch (30s timeout)
    async def fetch(self, urls: Union[str, List[str]], timeout: Optional[float] = None, **kwargs: Any) -> Any:
        """Fetches page contents for one or more URLs with caching and budget gate."""
        if isinstance(urls, str):
            target_urls = [urls]
            cache_key = f"fetch:{urls.strip()}"
        else:
            target_urls = urls
            cache_key = f"fetch:{','.join(sorted(urls))}"

        sdk = self.get_sdk_client()
        return await self._call("fetch", sdk.fetch.get_contents, cache_key=cache_key, timeout=timeout, urls=target_urls, **kwargs)

    # 3. Agent (120s timeout)
    async def run_agent(
        self,
        goal: str,
        url: str = "https://example.com",
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Runs an autonomous agent task with budget gate (120s timeout)."""
        sdk = self.get_sdk_client()
        return await self._call("agent_run", sdk.agent.run, timeout=timeout, goal=goal, url=url, **kwargs)

    # 4. Monitor create / run / pause (public methods have NO skip_reservation parameter)
    async def create_monitor(
        self,
        type: str = "search",
        config: Optional[Dict[str, Any]] = None,
        schedule_cron: str = "0 0 * * *",
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Creates a monitor with budget gate (30s timeout)."""
        if "skip_reservation" in kwargs:
            raise TypeError("create_monitor() got an unexpected keyword argument 'skip_reservation'")
        sdk = self.get_sdk_client()
        cfg = config if config is not None else {}
        return await self._call(
            "monitor_create",
            sdk.monitors.create,
            timeout=timeout,
            type=type,
            config=cfg,
            schedule_cron=schedule_cron,
            **kwargs,
        )

    async def run_monitor(self, monitor_id: str, timeout: Optional[float] = None, **kwargs: Any) -> Any:
        """Runs a monitor on demand with budget gate (30s timeout)."""
        sdk = self.get_sdk_client()
        return await self._call("monitor_run", sdk.monitors.run, timeout=timeout, monitor_id=monitor_id, **kwargs)

    async def pause_monitor(
        self,
        monitor_id: str,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Pauses a monitor with budget gate (30s timeout)."""
        if "skip_reservation" in kwargs:
            raise TypeError("pause_monitor() got an unexpected keyword argument 'skip_reservation'")
        sdk = self.get_sdk_client()
        return await self._call(
            "monitor_pause",
            sdk.monitors.pause,
            timeout=timeout,
            monitor_id=monitor_id,
            **kwargs,
        )

    async def pause_topic_monitor(
        self,
        monitor_id: str,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Explicit alias for pausing a topic monitor."""
        if "skip_reservation" in kwargs:
            raise TypeError("pause_topic_monitor() got an unexpected keyword argument 'skip_reservation'")
        return await self.pause_monitor(
            monitor_id=monitor_id,
            timeout=timeout,
            **kwargs,
        )

    # Private prepaid monitor helpers (used ONLY by run_demo_monitor via _call_prepaid)
    async def _create_monitor_prepaid(
        self,
        type: str = "search",
        config: Optional[Dict[str, Any]] = None,
        schedule_cron: str = "0 0 * * *",
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Creates a monitor when budget was already reserved up front. Calls _call_prepaid."""
        sdk = self.get_sdk_client()
        cfg = config if config is not None else {}
        return await self._call_prepaid(
            "monitor_create",
            sdk.monitors.create,
            timeout=timeout,
            type=type,
            config=cfg,
            schedule_cron=schedule_cron,
            **kwargs,
        )

    async def _pause_monitor_prepaid(
        self,
        monitor_id: str,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Pauses a monitor when budget was already reserved up front. Calls _call_prepaid."""
        sdk = self.get_sdk_client()
        return await self._call_prepaid(
            "monitor_pause",
            sdk.monitors.pause,
            timeout=timeout,
            monitor_id=monitor_id,
            **kwargs,
        )

    async def run_demo_monitor(
        self,
        type: str = "search",
        config: Optional[Dict[str, Any]] = None,
        schedule_cron: str = "0 0 * * *",
        **kwargs: Any,
    ) -> Any:
        """
        Creates a monitor for demo purposes and immediately pauses it so no recurring billing occurs.
        Reserves its two units up front (two reservations before calling create).
        If the second reservation is refused, does not create the monitor.
        If pause fails, raises MonitorPauseError including the monitor_id.
        Uses _create_monitor_prepaid and _pause_monitor_prepaid.
        """
        # 1. Reserve 1st unit (for create) up front
        self._reserve_budget("demo_monitor_create")
        # 2. Reserve 2nd unit (for pause) up front
        self._reserve_budget("demo_monitor_pause")

        # Both reservations succeeded up front; create monitor using prepaid helper
        monitor = await self._create_monitor_prepaid(
            type=type,
            config=config,
            schedule_cron=schedule_cron,
            **kwargs,
        )
        monitor_id = getattr(monitor, "id", None)
        if monitor_id is None and isinstance(monitor, dict):
            monitor_id = monitor.get("id")
        if monitor_id is None:
            monitor_id = str(monitor)

        # Immediately pause monitor using prepaid helper
        try:
            await self._pause_monitor_prepaid(monitor_id)
        except Exception as exc:
            raise MonitorPauseError(
                monitor_id,
                f"Immediate pause failed after creation: {exc}"
            ) from exc

        return monitor

    # 5. Research queue (120s timeout) & polling (30s timeout, max 3 polls)
    async def queue_research(self, query: str, timeout: Optional[float] = None, **kwargs: Any) -> Any:
        """Queues a research task with budget gate (120s timeout)."""
        sdk = self.get_sdk_client()
        return await self._call("research_queue", sdk.research.queue, timeout=timeout, query=query, **kwargs)

    async def poll_research(self, run_id: str, timeout: Optional[float] = None) -> Any:
        """Polls status of a research task (1 request unit, 30s timeout)."""
        sdk = self.get_sdk_client()
        return await self._call("research_poll", sdk.research.get, timeout=timeout, run_id=run_id)

    async def run_research(
        self,
        query: str,
        max_polls: int = MAX_RESEARCH_POLLS,
        poll_interval: float = 0.05,
        **kwargs: Any,
    ) -> Any:
        """
        Runs research: 1 queue request + up to 3 poll requests.
        Normalizes status and stops on COMPLETED, FAILED, CANCELLED, TIMED_OUT,
        or when max_polls (capped at 3) is reached.
        """
        run_res = await self.queue_research(query=query, **kwargs)
        run_id = getattr(run_res, "id", None)
        if run_id is None and isinstance(run_res, dict):
            run_id = run_res.get("id")
        if run_id is None:
            run_id = str(run_res)

        poll_limit = min(max_polls, MAX_RESEARCH_POLLS)
        last_result = run_res
        polls = 0

        while polls < poll_limit:
            polls += 1
            last_result = await self.poll_research(run_id=run_id)
            raw_status = getattr(last_result, "status", None)
            if raw_status is None and isinstance(last_result, dict):
                raw_status = last_result.get("status")

            normalized_status = str(getattr(raw_status, "value", raw_status)).upper()
            if normalized_status in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
                break
            if polls < poll_limit and poll_interval > 0:
                await asyncio.sleep(poll_interval)

        return last_result

    # 6. Wallet - NEVER called automatically
    async def wallet_balance(self, timeout: Optional[float] = None) -> Any:
        """
        Retrieves wallet balance.
        Must NEVER be called automatically or in background loops.
        """
        sdk = self.get_sdk_client()
        return await self._call("wallet_balance", sdk.wallet.get, timeout=timeout)


# ---------------------------------------------------------------------------
# Module-level cache helpers (for compatibility with classifier and tests)
# ---------------------------------------------------------------------------
_mem_cache: dict[str, Any] = {}


def cache_get(key: str) -> Optional[Any]:
    return _mem_cache.get(key)


def cache_set(key: str, val: Any, ttl_s: int = 3600) -> None:
    _mem_cache[key] = val

