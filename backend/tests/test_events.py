"""Tests for backend/app/events.py."""
import asyncio

import pytest
from app.events import EventBus, make_emitter
from app.models import ActivityEvent


@pytest.mark.asyncio
async def test_event_bus_live_stream():
    bus = EventBus()
    received = []

    async def listener():
        async for event in bus.subscribe("scan-1"):
            received.append(event)

    task = asyncio.create_task(listener())
    await asyncio.sleep(0.01)

    await bus.publish("scan-1", "progress", {"done": 1, "total": 2})
    await bus.publish("scan-1", "finding", {"id": "f1"})
    await bus.publish("scan-1", "done", {"status": "complete"})

    await asyncio.wait_for(task, timeout=2.0)
    assert len(received) == 3
    assert received[0]["event"] == "progress"
    assert received[1]["event"] == "finding"
    assert received[2]["event"] == "done"


@pytest.mark.asyncio
async def test_event_bus_late_subscriber_replay():
    bus = EventBus()

    # Publish events before subscriber exists
    await bus.publish("scan-2", "activity", {"action": "query", "status": "ok"})
    await bus.publish("scan-2", "done", {"status": "complete"})

    received = []
    async for event in bus.subscribe("scan-2"):
        received.append(event)

    assert len(received) == 2
    assert received[0]["event"] == "activity"
    assert received[1]["event"] == "done"


@pytest.mark.asyncio
async def test_make_emitter():
    bus = EventBus()
    events = []

    async def listener():
        async for e in bus.subscribe("scan-3"):
            events.append(e)

    task = asyncio.create_task(listener())
    await asyncio.sleep(0.01)

    emit = make_emitter("scan-3")
    # Patch global bus or use make_emitter with the global bus
    from app import events as events_module
    old_bus = events_module.event_bus
    events_module.event_bus = bus
    try:
        act = ActivityEvent(api="search", action="query", target="pkg", status="start")
        await emit(act)
        await bus.publish("scan-3", "done", {})
        await asyncio.wait_for(task, timeout=2.0)
        assert len(events) == 2
        assert events[0]["event"] == "activity"
    finally:
        events_module.event_bus = old_bus
