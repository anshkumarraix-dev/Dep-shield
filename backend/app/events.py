"""Server-Sent Events (SSE) event bus per scan.

Owner: Ansh.
Features:
- Thread-safe / asyncio-safe pub-sub per scan_id
- Full history replay for late-subscribing clients
- Safe stream termination on 'done' or 'error'
- Shared Emit helper factory for ActivityEvents
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from pydantic import BaseModel

from .models import ActivityEvent, Emit

logger = logging.getLogger(__name__)


def _serialize(data: Any) -> str:
    if isinstance(data, BaseModel):
        return data.model_dump_json()
    if isinstance(data, (dict, list)):
        return json.dumps(data, default=str)
    return str(data)


class ScanChannel:
    def __init__(self, scan_id: str) -> None:
        self.scan_id = scan_id
        self.history: list[dict[str, str]] = []
        self.subscribers: set[asyncio.Queue] = set()
        self.closed: bool = False
        self._lock = asyncio.Lock()

    async def publish(self, event_name: str, data: Any) -> None:
        async with self._lock:
            payload = {
                "event": event_name,
                "data": _serialize(data),
            }
            self.history.append(payload)

            if event_name in ("done", "error"):
                self.closed = True

            # Fan out to all active subscriber queues
            dead_queues = []
            for q in self.subscribers:
                try:
                    q.put_nowait(payload)
                except (asyncio.QueueFull, RuntimeError):
                    dead_queues.append(q)

            for dq in dead_queues:
                self.subscribers.discard(dq)

    async def subscribe(self) -> AsyncGenerator[dict[str, str], None]:
        # 1. Replay historical events
        async with self._lock:
            past_events = list(self.history)
            already_closed = self.closed
            q: asyncio.Queue = asyncio.Queue()
            if not already_closed:
                self.subscribers.add(q)

        # Yield all past events
        for event in past_events:
            yield event
            if event["event"] in ("done", "error"):
                return

        if already_closed:
            return

        # 2. Yield live events
        try:
            while True:
                item = await q.get()
                yield item
                if item["event"] in ("done", "error"):
                    break
        finally:
            async with self._lock:
                self.subscribers.discard(q)


class EventBus:
    def __init__(self) -> None:
        self.channels: dict[str, ScanChannel] = {}
        self._bus_lock = asyncio.Lock()

    async def get_or_create_channel(self, scan_id: str) -> ScanChannel:
        async with self._bus_lock:
            if scan_id not in self.channels:
                self.channels[scan_id] = ScanChannel(scan_id)
            return self.channels[scan_id]

    async def publish(self, scan_id: str, event_name: str, data: Any) -> None:
        channel = await self.get_or_create_channel(scan_id)
        await channel.publish(event_name, data)

    async def subscribe(self, scan_id: str) -> AsyncGenerator[dict[str, str], None]:
        channel = await self.get_or_create_channel(scan_id)
        async for event in channel.subscribe():
            yield event


event_bus = EventBus()


def make_emitter(scan_id: str) -> Emit:
    """Create an Emit callable for external operations emitting ActivityEvents."""

    async def _emit(activity: ActivityEvent) -> None:
        if activity.scan_id is None:
            activity.scan_id = scan_id
        await event_bus.publish(scan_id, "activity", activity)

    return _emit
