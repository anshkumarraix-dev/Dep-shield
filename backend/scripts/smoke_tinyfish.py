"""Manual smoke test for the TinyFish integration. Run from the repo root (PowerShell):

    python backend\\scripts\\smoke_tinyfish.py                 # wallet + live search + fetch + replay search (free)
    python backend\\scripts\\smoke_tinyfish.py --agent         # + 1 Agent run (costs credits)
    python backend\\scripts\\smoke_tinyfish.py --monitor       # + create 1 Monitor and run it (costs credits)
    python backend\\scripts\\smoke_tinyfish.py --research      # + 1 deep Research run (costs credits, takes minutes)

Saves fetched pages to backend/fixtures/pages/ so Aman can test the classifier on REAL text.
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

from app import tinyfish_client as tf  # noqa: E402

PAGES_DIR = ROOT / "backend" / "fixtures" / "pages"


async def emit(e):
    ms = f"{e.latency_ms}ms" if e.latency_ms is not None else ""
    print(f"   [{e.api:<8}] {e.action:<14} {e.status:<6} {ms:<8} {e.target[:60]} {e.detail}")


async def main(args):
    print("== wallet")
    try:
        print("   balance:", await tf.wallet_balance())
    except Exception as exc:  # noqa: BLE001
        print("   FAILED:", type(exc).__name__, exc)
        print("   Check TINYFISH_API_KEY in .env (no quotes, no spaces).")
        return

    print("\n== LIVE search + fetch: event-stream@3.3.6")
    sources = await tf.search_signals("event-stream", "3.3.6", scan_id="smoke", emit=emit)
    for s in sources:
        print(f"   {s.source_type:<12} {s.published_at and s.published_at.date()} {s.url}")
    pages = await tf.fetch_pages(sources[:2], scan_id="smoke", emit=emit)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    for p in pages:
        name = re.sub(r"[^a-z0-9]+", "-", p.url.lower())[:60].strip("-") + ".txt"
        (PAGES_DIR / name).write_text(f"URL: {p.url}\nTITLE: {p.title}\n\n{p.text}", encoding="utf-8")
        print(f"   saved {name} ({len(p.text)} chars): {p.text[:120]!r}")

    print("\n== REPLAY search (before 2018-11-25): what did the web say before the advisory?")
    old = await tf.search_signals("event-stream", "3.3.6", before_date="2018-11-25", scan_id="smoke", emit=emit)
    for s in old:
        print(f"   {s.source_type:<12} {s.published_at and s.published_at.date()} {s.url}")
    if not old:
        print("   (no results: the replay would fall back to fetching known URLs directly)")

    if args.agent:
        print("\n== AGENT (1 run): github issues scan")
        items = await tf.agent_scan_issues("https://github.com/dominictarr/event-stream/issues", scan_id="smoke", emit=emit)
        print(json.dumps([i.model_dump() for i in items][:5], indent=2))
    if args.monitor:
        print("\n== MONITOR: create + run now")
        mid = await tf.create_topic_monitor("event-stream", scan_id="smoke", emit=emit)
        print("   monitor id:", mid or "(skipped)")
        if mid:
            print("  ", json.dumps(await tf.run_monitor_now(mid, scan_id="smoke", emit=emit))[:500])
    if args.research:
        print("\n== RESEARCH (deep): this takes minutes")
        r = await tf.research_report("Was event-stream 3.3.6 compromised and what was the impact? Cite sources.", scan_id="smoke", emit=emit)
        print("   run:", r.run_id, "| sources:", len(r.sources))
        print("  ", r.summary[:600])

    print("\n== wallet after:", await tf.wallet_balance())


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", action="store_true")
    ap.add_argument("--monitor", action="store_true")
    ap.add_argument("--research", action="store_true")
    asyncio.run(main(ap.parse_args()))
