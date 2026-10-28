"""
TinyFish client with strict budget gate and request accounting.
Enforces hard caps, zero uncounted retries, and fail-closed live execution.
"""

from __future__ import annotations

import asyncio
import datetime
from datetime import timezone
import os
import time
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union, TYPE_CHECKING

# Attempt imports from shared application modules; fallback gracefully if not yet pushed
try:
    from app.db import reserve_tinyfish_request  # type: ignore
except ImportError:
    try:
        from backend.app.db import reserve_tinyfish_request  # type: ignore
    except ImportError:
        reserve_tinyfish_request = None

if TYPE_CHECKING:
    from app.models import (
        ActivityEvent,
        Emit,
        IssueItem,
        PageContent,
        ResearchResult,
        Source,
        SourceType,
    )
else:
    try:
        from app.models import (
            ActivityEvent,
            Emit,
            IssueItem,
            PageContent,
            ResearchResult,
            Source,
            SourceType,
        )
    except ImportError:
        from backend.app.models import (
            ActivityEvent,
            Emit,
            IssueItem,
            PageContent,
            ResearchResult,
            Source,
            SourceType,
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
        op = details.get("operation", "system")
        api = op if op in ("search", "fetch", "agent", "monitor", "research") else "system"
        if "cache" in event_type:
            status = "cached"
        elif "success" in event_type:
            status = "ok"
        elif "error" in event_type or "failure" in event_type or "timeout" in event_type:
            status = "error"
        else:
            status = "start"

        detail_msg = details.get("error") or details.get("cache_key") or f"{event_type}: {op}"
        event = ActivityEvent(
            api=api,
            action=str(op),
            status=status,
            target=str(details.get("cache_key", op))[:100],
            detail=str(detail_msg)[:200],
        )
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
        if self.reserve_fn is None:
            raise LedgerUnavailableError(
                f"Durable ledger 'reserve_tinyfish_request' is required for live calls but not available. "
                f"Failing closed for operation '{operation}'."
            )

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


# ---------------------------------------------------------------------------
# Module-level client instance and helpers
# ---------------------------------------------------------------------------
_module_client: Optional[TinyFishClient] = None


def get_module_client() -> TinyFishClient:
    """Returns or lazily creates a module-level TinyFishClient (env-based, ledger-gated)."""
    global _module_client
    if _module_client is None:
        _module_client = TinyFishClient()
    return _module_client


def set_module_client(client: Optional[TinyFishClient]) -> None:
    """Sets or clears the module-level client (used for testing and dependency injection)."""
    global _module_client
    _module_client = client


def _matches_host(hostname: str | None, domain: str) -> bool:
    """Checks whether hostname equals domain or is a subdomain of domain."""
    if not hostname:
        return False
    h = hostname.lower()
    d = domain.lower()
    return h == d or h.endswith("." + d)


def _classify_source_url(url: str) -> SourceType:
    """Maps a URL to its appropriate SourceType category."""
    try:
        parse_target = url if "://" in url else f"https://{url}"
        parsed = urllib.parse.urlparse(parse_target)
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").lower()
    except Exception:
        host = ""
        path = ""

    u = url.lower()
    if _matches_host(host, "github.com") and "/issues" in path:
        return "github_issue"
    if (
        "advisory" in path
        or "ghsa-" in u
        or "cve-" in u
        or _matches_host(host, "snyk.io")
        or _matches_host(host, "osv.dev")
    ):
        return "advisory"
    if (
        _matches_host(host, "ycombinator.com")
        or _matches_host(host, "reddit.com")
        or _matches_host(host, "stackoverflow.com")
        or "forum" in path
        or host.startswith("forum.")
    ):
        return "forum"
    if (
        _matches_host(host, "bleepingcomputer.com")
        or _matches_host(host, "thehackernews.com")
        or "news" in path
        or host.startswith("news.")
    ):
        return "news"
    if (
        _matches_host(host, "medium.com")
        or _matches_host(host, "substack.com")
        or "blog" in path
        or host.startswith("blog.")
    ):
        return "blog"
    if "changelog" in path or "release" in path:
        return "changelog"
    return "other"


# ===========================================================================
# Contract functions matching AGENTS.md shared contracts
# ===========================================================================

async def search_signals(
    package: str,
    version: str,
    *,
    before_date: str | None = None,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[Source]:
    """
    Search public web sources for security signals and advisories.
    Contract from AGENTS.md:
    search_signals(package: str, version: str, *, before_date: str | None = None,
                   scan_id: str | None = None, emit: Emit | None = None) -> list[Source]

    - At most 2 Search queries per package.
    - before_date is only a query filter/hint and does not guarantee a complete historical web snapshot.
    - Returns empty list on BudgetExceeded / LiveCallsDisabled / Ledger errors without raising.
    """
    # Note: before_date is only a query filter/hint and does not guarantee
    # a verified, complete historical web snapshot.
    target = f'"{package}" security advisory'
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="search",
                action="query",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    sources: list[Source] = []
    seen_urls: set[str] = set()

    # Up to 2 queries per package
    queries = [
        f'"{package}" security OR exploit OR advisory',
        f'"{package}" "{version}" OR vulnerability',
    ]

    try:
        for q in queries[:MAX_SEARCHES_PER_PACKAGE]:
            kw: Dict[str, Any] = {}
            if before_date:
                kw["before_date"] = before_date
            res = await client.search(q, **kw)

            raw_results = None
            if isinstance(res, dict):
                raw_results = res.get("results") or res.get("data")
            else:
                raw_results = getattr(res, "results", None) or getattr(res, "data", None)

            if isinstance(raw_results, list):
                for item in raw_results:
                    url = None
                    title = ""
                    snippet = ""
                    pub_date_str = None

                    if isinstance(item, dict):
                        url = item.get("url") or item.get("final_url")
                        title = item.get("title") or ""
                        snippet = item.get("snippet") or item.get("description") or ""
                        pub_date_str = item.get("date") or item.get("published_date")
                    else:
                        url = getattr(item, "url", None) or getattr(item, "final_url", None)
                        title = getattr(item, "title", "") or ""
                        snippet = getattr(item, "snippet", "") or getattr(item, "description", "") or ""
                        pub_date_str = getattr(item, "date", None) or getattr(item, "published_date", None)

                    if not url or not isinstance(url, str):
                        continue
                    url = url.strip()
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    # Extract hostname only for domain
                    parsed_domain = ""
                    try:
                        parsed_domain = urllib.parse.urlparse(url).netloc.lower()
                    except Exception:
                        parsed_domain = ""

                    # Parse published_at only if really provided
                    published_at = None
                    if pub_date_str and isinstance(pub_date_str, str):
                        try:
                            published_at = datetime.datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
                        except Exception:
                            published_at = None

                    src_type = _classify_source_url(url)

                    sources.append(
                        Source(
                            url=url,
                            title=str(title)[:200],
                            domain=parsed_domain,
                            source_type=src_type,
                            published_at=published_at,
                            fetched_at=datetime.datetime.now(timezone.utc),
                            snippet=str(snippet)[:300],
                            discovered_by="search",
                        )
                    )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="search",
                    action="query",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail=f"Found {len(sources)} sources",
                )
            )
        return sources

    except (BudgetExceededError, LiveCallsDisabledError, LedgerUnavailableError, TinyFishTimeoutError, TinyFishError, Exception) as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        err_msg = str(exc)[:200]
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="search",
                    action="query",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=err_msg,
                )
            )
        return []


async def fetch_pages(
    sources: list[Source],
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[PageContent]:
    """
    Fetch evidence page contents for given sources.
    Contract from AGENTS.md:
    fetch_pages(sources: list[Source], *, scan_id: str | None = None,
                emit: Emit | None = None) -> list[PageContent]

    - One batch Fetch for at most the given sources.
    - Text is treated as untrusted and truncated.
    - Returns empty list on BudgetExceeded / LiveCallsDisabled / Ledger errors without raising.
    """
    if not sources:
        return []

    target = f"{len(sources)} URLs"
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="fetch",
                action="get_contents",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    urls = [s.url for s in sources if s.url]
    if not urls:
        return []

    try:
        res = await client.fetch(urls=urls)

        raw_results = None
        if isinstance(res, dict):
            raw_results = res.get("results") or res.get("data")
        else:
            raw_results = getattr(res, "results", None) or getattr(res, "data", None)

        if not isinstance(raw_results, list):
            if isinstance(res, dict) and ("url" in res or "text" in res):
                raw_results = [res]
            else:
                raw_results = []

        source_by_url = {s.url: s for s in sources}
        pages: list[PageContent] = []

        for item in raw_results:
            u = None
            text = ""
            title = ""
            pub_date = None

            if isinstance(item, dict):
                u = item.get("url") or item.get("final_url")
                text = item.get("text") or item.get("content") or item.get("markdown") or ""
                title = item.get("title") or ""
                pub_date = item.get("published_date") or item.get("date")
            else:
                u = getattr(item, "url", None) or getattr(item, "final_url", None)
                text = getattr(item, "text", "") or getattr(item, "content", "") or getattr(item, "markdown", "") or ""
                title = getattr(item, "title", "") or ""
                pub_date = getattr(item, "published_date", None) or getattr(item, "date", None)

            if not u:
                continue

            matching_source = source_by_url.get(u)
            if not title and matching_source:
                title = matching_source.title

            parsed_pub_date = None
            if pub_date and isinstance(pub_date, str):
                try:
                    parsed_pub_date = datetime.datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                except Exception:
                    parsed_pub_date = None
            elif matching_source:
                parsed_pub_date = matching_source.published_at

            clean_text = str(text)[:20000]

            pages.append(
                PageContent(
                    url=u,
                    title=str(title)[:200],
                    text=clean_text,
                    fetched_at=datetime.datetime.now(timezone.utc),
                    published_at=parsed_pub_date,
                    discovered_by="fetch",
                )
            )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="fetch",
                    action="get_contents",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail=f"Fetched {len(pages)} pages",
                )
            )
        return pages

    except (BudgetExceededError, LiveCallsDisabledError, LedgerUnavailableError, TinyFishTimeoutError, TinyFishError, Exception) as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        err_msg = str(exc)[:200]
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="fetch",
                    action="get_contents",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=err_msg,
                )
            )
        return []


async def agent_scan_issues(
    issues_url: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[IssueItem]:
    """
    Run selective agent scan against a repository issues URL.
    Contract from AGENTS.md:
    agent_scan_issues(issues_url: str, *, scan_id: str | None = None,
                      emit: Emit | None = None) -> list[IssueItem]
    """
    target = issues_url[:100]
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="agent",
                action="run",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    try:
        goal = f"Scan repository issues at {issues_url} for security signals, malicious code, or backdoors."
        res = await client.run_agent(goal=goal, url=issues_url)

        items: list[IssueItem] = []
        raw_issues = None
        if isinstance(res, dict):
            raw_issues = res.get("issues") or res.get("result", {}).get("issues")
        else:
            result_obj = getattr(res, "result", None)
            if isinstance(result_obj, dict):
                raw_issues = result_obj.get("issues")
            else:
                raw_issues = getattr(res, "issues", None)

        if isinstance(raw_issues, list):
            for raw in raw_issues:
                if isinstance(raw, dict):
                    t = raw.get("title", "")
                    u = raw.get("url", "")
                    o = raw.get("opened", "")
                    s = raw.get("snippet", "")
                else:
                    t = getattr(raw, "title", "")
                    u = getattr(raw, "url", "")
                    o = getattr(raw, "opened", "")
                    s = getattr(raw, "snippet", "")
                if t or u:
                    items.append(
                        IssueItem(
                            title=str(t)[:200],
                            url=str(u)[:500],
                            opened=str(o)[:50],
                            snippet=str(s)[:300],
                        )
                    )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="agent",
                    action="run",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail=f"Found {len(items)} issues",
                )
            )
        return items

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="agent",
                    action="run",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=str(exc)[:200],
                )
            )
        return []


async def create_topic_monitor(
    package: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> str:
    """
    Create a topic monitor for a package.
    Contract from AGENTS.md:
    create_topic_monitor(package: str, *, scan_id: str | None = None,
                         emit: Emit | None = None) -> str
    """
    target = package[:100]
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="monitor",
                action="create_monitor",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    try:
        res = await client.create_monitor(
            type="search",
            config={"query": f"{package} security advisory"},
        )
        monitor_id = getattr(res, "id", None)
        if monitor_id is None and isinstance(res, dict):
            monitor_id = res.get("id") or res.get("monitor", {}).get("id")
        if monitor_id is None:
            monitor_id = str(res)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="create_monitor",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail=f"Created monitor {monitor_id}",
                )
            )
        return str(monitor_id)

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="create_monitor",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=str(exc)[:200],
                )
            )
        return ""


async def run_monitor_now(
    monitor_id: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> dict:
    """
    Run a monitor on demand.
    Contract from AGENTS.md:
    run_monitor_now(monitor_id: str, *, scan_id: str | None = None,
                    emit: Emit | None = None) -> dict
    """
    target = monitor_id[:100]
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="monitor",
                action="run_monitor",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    try:
        res = await client.run_monitor(monitor_id=monitor_id)
        out: dict = {}
        if isinstance(res, dict):
            out = res
        elif hasattr(res, "model_dump"):
            out = res.model_dump(mode="json")
        else:
            out = {"monitor_id": monitor_id, "result": str(res)}

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="run_monitor",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail="Monitor run completed",
                )
            )
        return out

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="run_monitor",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=str(exc)[:200],
                )
            )
        return {"error": str(exc)[:200], "monitor_id": monitor_id}


async def pause_topic_monitor(
    monitor_id: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> bool:
    """
    Pause a topic monitor. Surfaces failure by returning False.
    Contract from AGENTS.md:
    pause_topic_monitor(monitor_id: str, *, scan_id: str | None = None,
                        emit: Emit | None = None) -> bool
    """
    target = f"pause:{monitor_id}"[:100]
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="monitor",
                action="run",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    try:
        await client.pause_monitor(monitor_id=monitor_id)
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="run",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail="Monitor paused",
                )
            )
        return True

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="monitor",
                    action="run",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=str(exc)[:200],
                )
            )
        return False


async def research_report(
    query: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> ResearchResult:
    """
    Run selective research on a query.
    Contract from AGENTS.md:
    research_report(query: str, *, scan_id: str | None = None,
                    emit: Emit | None = None) -> ResearchResult
    """
    target = query[:100]
    start_time = time.perf_counter()
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="research",
                action="run_research",
                target=target,
                status="start",
            )
        )

    client = get_module_client()
    try:
        res = await client.run_research(query=query)

        run_id = getattr(res, "research_run_id", None) or getattr(res, "id", "")
        if isinstance(res, dict):
            run_id = res.get("research_run_id") or res.get("id") or ""
        run_id = str(run_id)

        summary = ""
        dr = getattr(res, "deep_result", None)
        if dr:
            summary = dr.get("result", "") if isinstance(dr, dict) else getattr(dr, "result", "")
        elif hasattr(res, "summary"):
            summary = getattr(res, "summary", "")
        elif isinstance(res, dict):
            deep_res = res.get("deep_result")
            if isinstance(deep_res, dict):
                summary = deep_res.get("result", "")
            else:
                summary = res.get("summary", "")

        if not summary:
            summary = f"Research report completed for query: {query}"

        sources: list[Source] = []
        evidence = getattr(res, "evidence", None)
        if isinstance(res, dict) and evidence is None:
            evidence = res.get("evidence")

        if isinstance(evidence, list):
            for ev in evidence:
                u = ev.get("url") if isinstance(ev, dict) else getattr(ev, "url", None)
                t = ev.get("title") if isinstance(ev, dict) else getattr(ev, "title", "")
                snip = ""
                claims = ev.get("claims") if isinstance(ev, dict) else getattr(ev, "claims", None)
                if isinstance(claims, list) and claims:
                    first_claim = claims[0]
                    snip = first_claim.get("snippet", "") if isinstance(first_claim, dict) else getattr(first_claim, "snippet", "")
                if u:
                    domain = ""
                    try:
                        domain = urllib.parse.urlparse(u).netloc.lower()
                    except Exception:
                        domain = ""
                    sources.append(
                        Source(
                            url=u,
                            title=str(t or "")[:200],
                            domain=domain,
                            snippet=str(snip)[:300],
                            source_type="advisory",
                            discovered_by="research",
                        )
                    )

        result = ResearchResult(
            run_id=run_id,
            summary=str(summary)[:5000],
            sources=sources,
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="research",
                    action="run_research",
                    target=target,
                    status="ok",
                    latency_ms=elapsed_ms,
                    detail="Research completed",
                )
            )
        return result

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        err_msg = str(exc)[:200]
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="research",
                    action="run_research",
                    target=target,
                    status="error",
                    latency_ms=elapsed_ms,
                    detail=err_msg,
                )
            )
        return ResearchResult(
            run_id="",
            summary=f"Research unavailable: {err_msg}",
            sources=[],
        )

