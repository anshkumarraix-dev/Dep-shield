"""
Offline tests for TinyFish client and budget guard.
Uses mocked SDK and fake ledger; strictly no network calls.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Try importing from app.tinyfish_client first, fallback to backend.app.tinyfish_client
try:
    from app.tinyfish_client import (
        TinyFishClient,
        TinyFishError,
        BudgetExceededError,
        LiveCallsDisabledError,
        LedgerUnavailableError,
        TinyFishTimeoutError,
        MonitorPauseError,
        DEFAULT_DEV_CAP,
        DEFAULT_TOTAL_CAP,
        AGENT_TIMEOUT_SEC,
        RESEARCH_QUEUE_TIMEOUT_SEC,
        DEFAULT_TIMEOUT_SEC,
    )
except ImportError:
    from backend.app.tinyfish_client import (
        TinyFishClient,
        TinyFishError,
        BudgetExceededError,
        LiveCallsDisabledError,
        LedgerUnavailableError,
        TinyFishTimeoutError,
        MonitorPauseError,
        DEFAULT_DEV_CAP,
        DEFAULT_TOTAL_CAP,
        AGENT_TIMEOUT_SEC,
        RESEARCH_QUEUE_TIMEOUT_SEC,
        DEFAULT_TIMEOUT_SEC,
    )


class FakeLedger:
    """Fake ledger simulating reserve_tinyfish_request returning (allowed, total_used, development_used)."""

    def __init__(self, dev_cap: int = 48, total_cap: int = 64, initial_count: int = 0):
        self.dev_cap = dev_cap
        self.total_cap = total_cap
        self.count = initial_count
        self.reservations = []

    def reserve(self, stage: str, development_cap: int, total_cap: int):
        self.reservations.append((stage, development_cap, total_cap))
        cap = development_cap if stage == "development" else total_cap
        if self.count >= cap:
            return (False, self.count, self.count if stage == "development" else 0)
        self.count += 1
        dev_used = self.count if stage == "development" else 0
        return (True, self.count, dev_used)


def create_mock_sdk():
    sdk = MagicMock()
    sdk.search.query = AsyncMock(return_value={"results": ["pkg1"]})
    sdk.fetch.get_contents = AsyncMock(return_value={"contents": "<html>safe</html>"})
    sdk.agent.run = AsyncMock(return_value={"agent": "done"})
    sdk.monitors.create = AsyncMock(return_value=MagicMock(id="mon_test_123"))
    sdk.monitors.run = AsyncMock(return_value={"run": "started"})
    sdk.monitors.pause = AsyncMock(return_value={"status": "paused"})
    sdk.research.queue = AsyncMock(return_value=MagicMock(id="res_test_456"))
    sdk.research.get = AsyncMock(return_value=MagicMock(id="res_test_456", status="running"))
    sdk.wallet.get = AsyncMock(return_value={"balance": 16.0})
    return sdk


def test_outbound_methods_reserve_exactly_one_unit():
    """Prove each outbound method reserves exactly one unit in the ledger."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        # 1. Search
        await client.search("test-package")
        assert ledger.count == 1
        assert mock_sdk.search.query.await_count == 1

        # 2. Fetch
        await client.fetch("https://npmjs.com/package/test-package")
        assert ledger.count == 2
        assert mock_sdk.fetch.get_contents.await_count == 1

        # 3. Agent
        await client.run_agent("audit repo", url="https://github.com/test/repo")
        assert ledger.count == 3
        assert mock_sdk.agent.run.await_count == 1

        # 4. Monitor create
        await client.create_monitor(topic="test-package")
        assert ledger.count == 4
        assert mock_sdk.monitors.create.await_count == 1

        # 5. Monitor run
        await client.run_monitor("mon_test_123")
        assert ledger.count == 5
        assert mock_sdk.monitors.run.await_count == 1

        # 6. Monitor pause
        await client.pause_topic_monitor("mon_test_123")
        assert ledger.count == 6
        assert mock_sdk.monitors.pause.await_count == 1

        # 7. Wallet balance
        await client.wallet_balance()
        assert ledger.count == 7
        assert mock_sdk.wallet.get.await_count == 1

        # Each call passed the stage and caps correctly
        assert len(ledger.reservations) == 7
        for stage, dev_cap, total_cap in ledger.reservations:
            assert stage == "development"
            assert dev_cap == DEFAULT_DEV_CAP
            assert total_cap == DEFAULT_TOTAL_CAP

    asyncio.run(run())


def test_reserve_tuple_rejection_and_zero_sdk_calls():
    """1. Test fake returning (False, 64, 48): assert BudgetExceededError and zero SDK calls."""
    async def run():
        mock_sdk = create_mock_sdk()
        fake_ledger_fn = MagicMock(return_value=(False, 64, 48))

        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=fake_ledger_fn,
            live_enabled=True,
        )

        with pytest.raises(BudgetExceededError, match="budget cap exceeded"):
            await client.search("blocked-pkg")

        # Zero SDK calls made
        assert mock_sdk.search.query.await_count == 0
        fake_ledger_fn.assert_called_once_with("development", DEFAULT_DEV_CAP, DEFAULT_TOTAL_CAP)
        # Usage tracking updated
        assert client.total_used == 64
        assert client.development_used == 48

    asyncio.run(run())


def test_reserve_plain_bool_tolerance():
    """1b. Verify plain bool return value from ledger is still tolerated."""
    async def run():
        mock_sdk = create_mock_sdk()
        fake_ledger_fn = MagicMock(return_value=True)

        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=fake_ledger_fn,
            live_enabled=True,
        )

        await client.search("pkg-ok")
        assert mock_sdk.search.query.await_count == 1
        assert client.total_used == 1
        assert client.development_used == 1

    asyncio.run(run())


def test_cache_hits_reserve_zero():
    """Prove cache hits reserve zero request units."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        # First call reserves 1 unit
        res1 = await client.search("cached-pkg")
        assert ledger.count == 1
        assert mock_sdk.search.query.await_count == 1

        # Second identical call hits cache: 0 units reserved, 0 SDK calls
        res2 = await client.search("cached-pkg")
        assert ledger.count == 1
        assert mock_sdk.search.query.await_count == 1
        assert res1 == res2

        # Fetch caching
        await client.fetch("https://example.com/spec")
        assert ledger.count == 2
        assert mock_sdk.fetch.get_contents.await_count == 1

        await client.fetch("https://example.com/spec")
        assert ledger.count == 2
        assert mock_sdk.fetch.get_contents.await_count == 1

    asyncio.run(run())


def test_failures_still_count():
    """Prove failures and timeouts still consume the reservation unit."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        mock_sdk.search.query = AsyncMock(side_effect=RuntimeError("Remote 500 error"))
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        with pytest.raises(RuntimeError, match="Remote 500 error"):
            await client.search("fail-query")

        # The reservation already happened before the failure occurred
        assert ledger.count == 1

        # Test timeout failure still counts
        mock_sdk.fetch.get_contents = AsyncMock(side_effect=asyncio.TimeoutError())
        client_fast = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
            timeout=0.01,
        )
        with pytest.raises(TinyFishTimeoutError):
            await client_fast.fetch("https://slow-site.com", timeout=0.01)

        # Count incremented again despite timeout
        assert ledger.count == 2

    asyncio.run(run())


def test_cap_rejects_before_any_call_is_made():
    """Prove that reaching the cap rejects BEFORE any SDK call is attempted."""
    async def run():
        # Start at dev_cap=48 (budget exhausted)
        ledger = FakeLedger(dev_cap=48, initial_count=48)
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        with pytest.raises(BudgetExceededError, match="budget cap exceeded"):
            await client.search("blocked-query")

        # Verify SDK was NEVER called
        assert mock_sdk.search.query.await_count == 0
        # Ledger was checked
        assert len(ledger.reservations) == 1
        # Count remains capped
        assert ledger.count == 48

    asyncio.run(run())


def test_no_hidden_retry():
    """Prove that AsyncTinyFish is initialized with max_retries=0 so no SDK retries bypass ledger."""
    client = TinyFishClient(api_key="fake-test-key")
    sdk = client.get_sdk_client()
    max_retries = getattr(sdk, "_max_retries", getattr(sdk, "max_retries", None))
    assert max_retries == 0


def test_unsupported_max_retries_raises():
    """5. Prove client raises RuntimeError instead of falling back when max_retries is unsupported."""
    with patch("tinyfish.AsyncTinyFish", side_effect=TypeError("unexpected keyword 'max_retries'")):
        client = TinyFishClient(api_key="fake-test-key")
        with pytest.raises(RuntimeError, match="does not support 'max_retries=0'"):
            client.get_sdk_client()


def test_research_stops_after_three_polls():
    """Prove research queues once and stops after at most three status polls if pending."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        mock_sdk.research.get = AsyncMock(return_value=MagicMock(id="res_1", status="RUNNING"))
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        res = await client.run_research("vulnerability in foo", max_polls=3, poll_interval=0.001)

        # 1 queue request + exactly 3 polls = 4 requests
        assert ledger.count == 4
        assert mock_sdk.research.queue.await_count == 1
        assert mock_sdk.research.get.await_count == 3
        assert res.status == "RUNNING"

    asyncio.run(run())


def test_research_poll_completed_stops_early():
    """2. Add a test where poll 1 returns COMPLETED and assert exactly 1 poll and 2 total units."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        mock_poll_res = MagicMock(id="res_comp_123", status="completed")
        mock_sdk.research.get = AsyncMock(return_value=mock_poll_res)

        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        res = await client.run_research("fast query", max_polls=3, poll_interval=0.001)

        # Exactly 1 queue + 1 poll = 2 total units
        assert ledger.count == 2
        assert mock_sdk.research.queue.await_count == 1
        assert mock_sdk.research.get.await_count == 1
        assert res.id == "res_comp_123"

    asyncio.run(run())


def test_skip_reservation_raises_typeerror():
    """
    Passing skip_reservation=True to create_monitor / pause_monitor / pause_topic_monitor
    raises TypeError and makes zero SDK calls (with live_enabled=False and reserve_fn=None).
    """
    async def run():
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=None,
            live_enabled=False,
        )

        # 1. create_monitor
        with pytest.raises(TypeError, match="unexpected keyword argument 'skip_reservation'"):
            await client.create_monitor(type="search", skip_reservation=True)
        assert mock_sdk.monitors.create.await_count == 0

        # 2. pause_monitor
        with pytest.raises(TypeError, match="unexpected keyword argument 'skip_reservation'"):
            await client.pause_monitor("mon_test", skip_reservation=True)
        assert mock_sdk.monitors.pause.await_count == 0

        # 3. pause_topic_monitor
        with pytest.raises(TypeError, match="unexpected keyword argument 'skip_reservation'"):
            await client.pause_topic_monitor("mon_test", skip_reservation=True)
        assert mock_sdk.monitors.pause.await_count == 0

    asyncio.run(run())


@pytest.mark.parametrize(
    "method_name,call_args",
    [
        ("search", {"query": "test", "skip_reservation": True}),
        ("fetch", {"urls": "https://example.com", "skip_reservation": True}),
        ("run_agent", {"goal": "test goal", "skip_reservation": True}),
        ("run_monitor", {"monitor_id": "mon_123", "skip_reservation": True}),
        ("queue_research", {"query": "test query", "skip_reservation": True}),
        ("poll_research", {"run_id": "res_123", "skip_reservation": True}),
        ("create_monitor", {"type": "search", "skip_reservation": True}),
        ("pause_monitor", {"monitor_id": "mon_123", "skip_reservation": True}),
        ("pause_topic_monitor", {"monitor_id": "mon_123", "skip_reservation": True}),
        ("wallet_balance", {"skip_reservation": True}),
    ],
)
def test_skip_reservation_never_bypasses_ledger_parametrized(method_name, call_args):
    """
    3. Parametrized test for all 10 outbound methods:
    Passing skip_reservation=True must NOT skip the ledger.
    Either it raises TypeError (with zero SDK calls) or produces exactly 1 reservation.
    """
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        func = getattr(client, method_name)
        try:
            await func(**call_args)
        except TypeError:
            # Assert zero SDK calls in the TypeError case
            assert mock_sdk.search.query.await_count == 0
            assert mock_sdk.fetch.get_contents.await_count == 0
            assert mock_sdk.agent.run.await_count == 0
            assert mock_sdk.monitors.create.await_count == 0
            assert mock_sdk.monitors.run.await_count == 0
            assert mock_sdk.monitors.pause.await_count == 0
            assert mock_sdk.research.queue.await_count == 0
            assert mock_sdk.research.get.await_count == 0
            assert mock_sdk.wallet.get.await_count == 0
        else:
            # If accepted into kwargs, it MUST NOT have skipped the ledger
            assert ledger.count == 1

    asyncio.run(run())


def test_demo_monitor_raises_live_calls_disabled():
    """With live_enabled=False, run_demo_monitor raises LiveCallsDisabledError before any SDK call."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=False,
        )

        with pytest.raises(LiveCallsDisabledError, match="Live TinyFish calls disabled"):
            await client.run_demo_monitor(type="search")

        # Zero SDK calls made and zero reservations
        assert mock_sdk.monitors.create.await_count == 0
        assert mock_sdk.monitors.pause.await_count == 0
        assert ledger.count == 0

    asyncio.run(run())


def test_demo_monitor_raises_ledger_unavailable():
    """With reserve_fn=None and live_enabled=True, run_demo_monitor raises LedgerUnavailableError before any SDK call."""
    async def run():
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=None,
            live_enabled=True,
        )

        with pytest.raises(LedgerUnavailableError, match="Durable ledger.*required"):
            await client.run_demo_monitor(type="search")

        assert mock_sdk.monitors.create.await_count == 0
        assert mock_sdk.monitors.pause.await_count == 0

    asyncio.run(run())


def test_demo_monitor_refuses_when_less_than_two_units():
    """4a. run_demo_monitor: reserves two units up front; if second reservation refused, monitor is not created."""
    async def run():
        # Dev cap 48, initial_count = 47 -> 1st reservation succeeds (takes unit 48),
        # 2nd reservation is refused (exceeds cap 48).
        ledger = FakeLedger(dev_cap=48, initial_count=47)
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        with pytest.raises(BudgetExceededError, match="budget cap exceeded"):
            await client.run_demo_monitor(type="search", config={"query": "test"})

        # Second reservation was refused up front, so monitor was NOT created
        assert mock_sdk.monitors.create.await_count == 0
        # Exactly 2 reservation attempts were made by the public ledger function
        assert len(ledger.reservations) == 2

    asyncio.run(run())


def test_demo_monitor_pause_failure_includes_monitor_id():
    """4b. run_demo_monitor: if pause fails, raise an error that includes the monitor_id."""
    async def run():
        ledger = FakeLedger(dev_cap=48, initial_count=0)
        mock_sdk = create_mock_sdk()
        mock_sdk.monitors.create = AsyncMock(return_value=MagicMock(id="mon_fail_pause_888"))
        mock_sdk.monitors.pause = AsyncMock(side_effect=RuntimeError("Pause endpoint returned 502"))

        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        with pytest.raises(MonitorPauseError) as exc_info:
            await client.run_demo_monitor(type="search", config={"query": "test"})

        # Ensure monitor_id is included in the error message and attribute
        assert "mon_fail_pause_888" in str(exc_info.value)
        assert exc_info.value.monitor_id == "mon_fail_pause_888"
        assert mock_sdk.monitors.create.await_count == 1
        # 2 units were reserved up front
        assert ledger.count == 2

    asyncio.run(run())


def test_monitor_paused_after_demo_operation_success():
    """4. Prove successful demo monitor operation reserves exactly 2 units in total, creates, and pauses."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        mock_sdk.monitors.create = AsyncMock(return_value=MagicMock(id="demo_mon_999"))
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        mon = await client.run_demo_monitor(type="search", config={"query": "demo"})
        assert mon.id == "demo_mon_999"

        # Exactly 2 reservations made in total
        assert ledger.count == 2
        assert mock_sdk.monitors.create.await_count == 1
        mock_sdk.monitors.pause.assert_awaited_once_with(monitor_id="demo_mon_999")

    asyncio.run(run())


def test_per_operation_timeouts():
    """3. Verify per-operation timeouts: 120s for agent_run and research_queue, 30s for the rest."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=True,
        )

        with patch("asyncio.wait_for", wraps=asyncio.wait_for) as mock_wait_for:
            # 1. agent_run -> 120s
            await client.run_agent("test goal")
            _, kwargs = mock_wait_for.call_args
            assert kwargs.get("timeout") == AGENT_TIMEOUT_SEC

            # 2. research_queue -> 120s
            await client.queue_research("test query")
            _, kwargs = mock_wait_for.call_args
            assert kwargs.get("timeout") == RESEARCH_QUEUE_TIMEOUT_SEC

            # 3. search -> 30s
            await client.search("test search")
            _, kwargs = mock_wait_for.call_args
            assert kwargs.get("timeout") == DEFAULT_TIMEOUT_SEC

    asyncio.run(run())


def test_missing_ledger_refuses_live_call():
    """Prove client fails closed if reserve_fn is None when live calls are enabled."""
    async def run():
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=None,  # Missing ledger
            live_enabled=True,
        )

        with pytest.raises(LedgerUnavailableError, match="Durable ledger.*required"):
            await client.search("fail-closed-test")

        assert mock_sdk.search.query.await_count == 0

    asyncio.run(run())


def test_live_calls_disabled_by_default():
    """Prove client refuses live calls when TINYFISH_LIVE_ENABLED != 1."""
    async def run():
        ledger = FakeLedger()
        mock_sdk = create_mock_sdk()
        client = TinyFishClient(
            sdk_client=mock_sdk,
            reserve_fn=ledger.reserve,
            live_enabled=False,  # default / safe mode
        )

        with pytest.raises(LiveCallsDisabledError, match="Live TinyFish calls disabled"):
            await client.search("live-blocked-query")

        assert ledger.count == 0
        assert mock_sdk.search.query.await_count == 0


# =====================================================================
# Smoke Script & Socket Blocking Offline Tests
# =====================================================================
import json
from pathlib import Path
import socket
import sys

try:
    from scripts import smoke_tinyfish
except ImportError:
    from backend.scripts import smoke_tinyfish


@pytest.fixture(autouse=True)
def block_network_sockets(monkeypatch):
    """Blocks real socket connect and getaddrinfo calls during offline tests."""
    orig_connect = socket.socket.connect
    orig_socketpair = getattr(socket, "socketpair", None)

    def blocked_connect(self, *args, **kwargs):
        raise RuntimeError("Real socket connect blocked during offline test")

    def blocked_gai(*args, **kwargs):
        raise RuntimeError("Real DNS getaddrinfo blocked during offline test")

    def safe_socketpair(*args, **kwargs):
        saved = socket.socket.connect
        socket.socket.connect = orig_connect
        try:
            return orig_socketpair(*args, **kwargs)
        finally:
            socket.socket.connect = saved

    if orig_socketpair is not None:
        monkeypatch.setattr(socket, "socketpair", safe_socketpair)
    monkeypatch.setattr(socket.socket, "connect", blocked_connect)
    monkeypatch.setattr(socket, "getaddrinfo", blocked_gai)


def test_smoke_dry_run_zero_calls_and_reservations(capsys):
    """Dry run (no flags) makes zero SDK calls and zero ledger reservations."""
    code = smoke_tinyfish.main([])
    assert code == 0
    captured = capsys.readouterr()
    assert "DRY RUN" in captured.out
    assert "Zero network requests will be made" in captured.out
    assert "Maximum units this mode could spend: 0" in captured.out
    assert "Units used so far: total_used=0, development_used=0" in captured.out


def test_smoke_refuses_without_confirm_spend(monkeypatch, capsys):
    """--search-fetch without --confirm-spend is refused with exit 2 before any calls."""
    mock_sdk = create_mock_sdk()
    ledger = FakeLedger()
    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    code = smoke_tinyfish.main(["--search-fetch"], client=client)
    assert code == 2
    assert ledger.count == 0
    assert mock_sdk.search.query.await_count == 0
    assert mock_sdk.fetch.get_contents.await_count == 0
    captured = capsys.readouterr()
    assert "Refused: --confirm-spend flag is required" in captured.out


def test_smoke_refuses_when_live_disabled(monkeypatch, capsys):
    """With --confirm-spend but TINYFISH_LIVE_ENABLED=0 is refused with exit 2, zero calls."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "0")
    mock_sdk = create_mock_sdk()
    ledger = FakeLedger()
    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=False)

    code = smoke_tinyfish.main(["--search-fetch", "--confirm-spend"], client=client)
    assert code == 2
    assert ledger.count == 0
    assert mock_sdk.search.query.await_count == 0
    captured = capsys.readouterr()
    assert "Refused: TINYFISH_LIVE_ENABLED != 1" in captured.out


def test_smoke_refuses_when_no_ledger(monkeypatch, capsys):
    """With live enabled but no ledger is refused with exit 2, zero calls."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(smoke_tinyfish, "get_ledger_function", lambda: None)

    code = smoke_tinyfish.main(["--search-fetch", "--confirm-spend"])
    assert code == 2
    captured = capsys.readouterr()
    assert "Refused: Ledger function" in captured.out


def test_smoke_refuses_non_interactive_stdin(monkeypatch, capsys):
    """Non-interactive stdin is refused with exit 2, zero calls."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(smoke_tinyfish, "get_ledger_function", lambda: lambda *a, **k: (True, 1, 1))
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False)

    code = smoke_tinyfish.main(["--search-fetch", "--confirm-spend"])
    assert code == 2
    captured = capsys.readouterr()
    assert "Refused: Non-interactive stdin" in captured.out


def test_smoke_refuses_wrong_confirmation_text(monkeypatch, capsys):
    """Wrong confirmation text is refused with exit 2, zero calls."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(smoke_tinyfish, "get_ledger_function", lambda: lambda *a, **k: (True, 1, 1))
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "spend 2 units")

    code = smoke_tinyfish.main(["--search-fetch", "--confirm-spend"])
    assert code == 2
    captured = capsys.readouterr()
    assert "Refused: Confirmation text did not match 'SPEND 2 UNITS'" in captured.out


def test_smoke_allowed_mocked_client_reserves_exactly_two_units(monkeypatch, tmp_path):
    """Allowed path: exactly 1 search and 1 fetch, exactly 2 ledger reservations, at most 2 URLs fetched."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "SPEND 2 UNITS")

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    mock_sdk.search.query = AsyncMock(return_value={
        "results": [
            {"url": "https://example.com/one"},
            {"url": "https://example.com/two"},
            {"url": "https://example.com/three"},
        ]
    })
    mock_sdk.fetch.get_contents = AsyncMock(return_value={
        "results": [
            {"url": "https://example.com/one", "text": "Content of page one"},
            {"url": "https://example.com/two", "text": "Content of page two"},
        ]
    })

    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    code = smoke_tinyfish.main(
        ["--search-fetch", "--confirm-spend"],
        client=client,
        fixtures_dir=tmp_path,
    )

    assert code == 0
    assert mock_sdk.search.query.await_count == 1
    assert mock_sdk.fetch.get_contents.await_count == 1
    fetch_call_args = mock_sdk.fetch.get_contents.call_args
    assert fetch_call_args is not None
    fetched_urls = fetch_call_args.kwargs.get("urls") or fetch_call_args.args[0]
    assert len(fetched_urls) == 2
    assert fetched_urls == ["https://example.com/one", "https://example.com/two"]
    assert ledger.count == 2
    assert len(ledger.reservations) == 2


def test_smoke_unsafe_urls_never_fetched(monkeypatch, tmp_path):
    """Unsafe URLs (http, localhost, 127.0.0.1, private IPs, over-long) are never fetched."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "SPEND 2 UNITS")

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    mock_sdk.search.query = AsyncMock(return_value={
        "results": [
            {"url": "http://insecure-http.com/pkg"},
            {"url": "https://localhost:8080/admin"},
            {"url": "https://127.0.0.1/secret"},
            {"url": "https://192.168.1.1/router"},
            {"url": "https://10.0.0.1/internal"},
            {"url": "https://" + ("x" * 505) + ".com"},
            {"url": "https://valid-safe-advisory.com/report"},
        ]
    })
    mock_sdk.fetch.get_contents = AsyncMock(return_value={
        "results": [
            {"url": "https://valid-safe-advisory.com/report", "text": "Safe advisory content"}
        ]
    })

    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    code = smoke_tinyfish.main(
        ["--search-fetch", "--confirm-spend"],
        client=client,
        fixtures_dir=tmp_path,
    )

    assert code == 0
    assert mock_sdk.fetch.get_contents.await_count == 1
    fetch_call_args = mock_sdk.fetch.get_contents.call_args
    fetched_urls = fetch_call_args.kwargs.get("urls") or fetch_call_args.args[0]
    assert fetched_urls == ["https://valid-safe-advisory.com/report"]


def test_smoke_api_key_redacted_in_stdout_and_stderr(monkeypatch, capsys):
    """The API key value never appears in stdout or stderr."""
    secret_key = "tf_live_secret_test_key_xyz987654321"
    monkeypatch.setenv("TINYFISH_API_KEY", secret_key)
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "0")

    code = smoke_tinyfish.main([])
    assert code == 0
    captured = capsys.readouterr()
    assert secret_key not in captured.out
    assert secret_key not in captured.err
    assert "API key present: yes" in captured.out

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    client = TinyFishClient(api_key=secret_key, sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=False)
    code = smoke_tinyfish.main(["--search-fetch"], client=client)
    assert code == 2
    captured = capsys.readouterr()
    assert secret_key not in captured.out
    assert secret_key not in captured.err


def test_smoke_fixtures_content_and_filename_hashing(monkeypatch, tmp_path):
    """Fixture files contain only url, fetched_at and truncated text, and filename contains no part of URL."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "SPEND 2 UNITS")

    target_url = "https://advisories.example.org/npm/vuln-9999"
    long_text = "Vulnerability description text. " * 1000

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    mock_sdk.search.query = AsyncMock(return_value={
        "results": [{"url": target_url}]
    })
    mock_sdk.fetch.get_contents = AsyncMock(return_value={
        "results": [{"url": target_url, "text": long_text}]
    })

    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    code = smoke_tinyfish.main(
        ["--search-fetch", "--confirm-spend"],
        client=client,
        fixtures_dir=tmp_path,
    )

    assert code == 0
    saved_files = list(tmp_path.glob("*.json"))
    assert len(saved_files) == 1
    fixture_file = saved_files[0]

    assert "advisories" not in fixture_file.name
    assert "example" not in fixture_file.name
    assert "vuln" not in fixture_file.name
    assert "9999" not in fixture_file.name
    assert fixture_file.name.endswith(".json")

    with open(fixture_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert set(data.keys()) == {"url", "fetched_at", "text"}
    assert data["url"] == target_url
    assert "T" in data["fetched_at"]
    assert len(data["text"]) <= 20000


def test_smoke_imports_from_repo_root_and_backend():
    """Script imports work from both repo root and backend/."""
    try:
        import backend.scripts.smoke_tinyfish as sm_root
        assert hasattr(sm_root, "main")
        assert hasattr(sm_root, "async_main")
        assert hasattr(sm_root, "is_safe_url")
    except ImportError:
        import scripts.smoke_tinyfish as sm_backend
        assert hasattr(sm_backend, "main")
        assert hasattr(sm_backend, "async_main")
        assert hasattr(sm_backend, "is_safe_url")


# --- Adversarial Tests (Step D) ---

def test_smoke_adversarial_javascript_and_file_urls():
    """Adversarial test: javascript: and file: URLs must never be considered safe or fetched."""
    assert not smoke_tinyfish.is_safe_url("javascript:alert(document.cookie)")
    assert not smoke_tinyfish.is_safe_url("file:///etc/passwd")
    assert not smoke_tinyfish.is_safe_url("data:text/html;base64,PHNjcmlwdD4=")
    assert not smoke_tinyfish.is_safe_url("ftp://ftp.example.com/file")


def test_smoke_adversarial_integer_and_octal_ips():
    """Adversarial test: integer, octal and IPv6 IP representations are rejected."""
    assert not smoke_tinyfish.is_safe_url("https://2130706433/path")
    assert not smoke_tinyfish.is_safe_url("https://0177.0.0.1/path")
    assert not smoke_tinyfish.is_safe_url("https://[::ffff:127.0.0.1]/path")
    assert not smoke_tinyfish.is_safe_url("https://[2001:db8::1]/path")


def test_smoke_adversarial_credentials_in_url():
    """Adversarial test: URLs containing embedded credentials are rejected."""
    assert not smoke_tinyfish.is_safe_url("https://admin:pass@example.com/secret")
    assert not smoke_tinyfish.is_safe_url("https://user@example.com/secret")


def test_smoke_adversarial_missing_fields_and_unexpected_shapes(monkeypatch, tmp_path):
    """Adversarial test: weird search/fetch shapes (None, ints, empty dicts, missing fields) don't crash."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "SPEND 2 UNITS")

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    mock_sdk.search.query = AsyncMock(return_value={
        "results": [None, 12345, {}, {"title": "no url here"}, {"url": "https://valid.com/page"}]
    })
    mock_sdk.fetch.get_contents = AsyncMock(return_value={
        "results": [{"url": "https://valid.com/page", "text": None}]
    })

    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    code = smoke_tinyfish.main(
        ["--search-fetch", "--confirm-spend"],
        client=client,
        fixtures_dir=tmp_path,
    )

    assert code == 0
    saved_files = list(tmp_path.glob("*.json"))
    assert len(saved_files) == 1


def test_smoke_adversarial_query_over_200_chars(monkeypatch):
    """Adversarial test: query with > 200 chars is refused with exit 2 before any call."""
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr("builtins.input", lambda prompt: "SPEND 2 UNITS")

    ledger = FakeLedger()
    mock_sdk = create_mock_sdk()
    client = TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)

    long_query = "a" * 201
    code = smoke_tinyfish.main(
        ["--search-fetch", "--confirm-spend", "--query", long_query],
        client=client,
    )

    assert code == 2
    assert ledger.count == 0
    assert mock_sdk.search.query.await_count == 0

