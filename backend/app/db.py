"""SQLite database persistence & durable TinyFish budget ledger.

Owner: Ansh.
Implements:
- Scans, findings, dependency graphs persistence
- TTL Cache (cache_get, cache_set)
- Usage counters (usage_get, usage_incr)
- Atomic, durable TinyFish request ledger (reserve_tinyfish_request)
- Fail-closed behavior on database error
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import settings
from .models import Finding, Scan

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_current_db_path: str | None = None


def get_db_path() -> str:
    if _current_db_path:
        return _current_db_path
    return settings.db_path


def set_db_path(path: str) -> None:
    global _current_db_path
    _current_db_path = path
    init_db(path)


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    target = db_path or get_db_path()
    # Ensure directory exists if not in-memory
    if target != ":memory:":
        Path(target).resolve().parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(target, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_db(db_path: str | None = None) -> None:
    """Initialize SQLite schema if not already created."""
    target = db_path or get_db_path()
    with _lock:
        conn = get_connection(target)
        try:
            with conn:
                # 1. Scans
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS scans (
                        id TEXT PRIMARY KEY,
                        status TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        replay_case TEXT,
                        as_of_date TEXT,
                        created_at TEXT NOT NULL,
                        packages_total INTEGER NOT NULL DEFAULT 0,
                        packages_done INTEGER NOT NULL DEFAULT 0,
                        error TEXT
                    );
                    """
                )

                # 2. Findings
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS findings (
                        id TEXT PRIMARY KEY,
                        scan_id TEXT NOT NULL,
                        package TEXT NOT NULL,
                        version TEXT NOT NULL,
                        finding_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (scan_id) REFERENCES scans(id)
                    );
                    """
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);"
                )

                # 3. Dependency Graphs
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dependency_graphs (
                        scan_id TEXT PRIMARY KEY,
                        graph_json TEXT NOT NULL,
                        FOREIGN KEY (scan_id) REFERENCES scans(id)
                    );
                    """
                )

                # 4. TTL Cache
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cache (
                        key TEXT PRIMARY KEY,
                        value_json TEXT NOT NULL,
                        expires_at REAL NOT NULL
                    );
                    """
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);"
                )

                # 5. Usage Counters (daily/general)
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS usage_counters (
                        name TEXT PRIMARY KEY,
                        count INTEGER NOT NULL DEFAULT 0
                    );
                    """
                )

                # 6. Atomic Durable TinyFish Request Ledger (Never resets at midnight)
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tinyfish_ledger (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        total_used INTEGER NOT NULL DEFAULT 0,
                        development_used INTEGER NOT NULL DEFAULT 0,
                        final_demo_used INTEGER NOT NULL DEFAULT 0,
                        updated_at REAL NOT NULL
                    );
                    """
                )
                # Seed single ledger row if absent
                conn.execute(
                    """
                    INSERT OR IGNORE INTO tinyfish_ledger (id, total_used, development_used, final_demo_used, updated_at)
                    VALUES (1, 0, 0, 0, ?);
                    """,
                    (time.time(),),
                )
        finally:
            conn.close()


# Ensure DB initialized on module load
try:
    init_db()
except (sqlite3.Error, OSError) as _e:
    logger.warning("Initial DB setup failed, will retry on first call: %s", _e)


# ---------------------------------------------------------------------------
# Durable TinyFish Request Ledger
# ---------------------------------------------------------------------------


def reserve_tinyfish_request(
    stage: str, development_cap: int = 48, total_cap: int = 64
) -> tuple[bool, int, int]:
    """Atomic and durable budget governor.

    Returns: (allowed: bool, total_used: int, development_used: int)
    Fails closed: if DB fails, returns (False, -1, -1).
    """
    with _lock:
        try:
            conn = get_connection()
            try:
                # Use IMMEDIATE transaction to lock exclusively before reading
                conn.execute("BEGIN IMMEDIATE;")
                cur = conn.cursor()
                cur.execute(
                    "SELECT total_used, development_used, final_demo_used FROM tinyfish_ledger WHERE id = 1;"
                )
                row = cur.fetchone()
                if not row:
                    cur.execute(
                        """
                        INSERT INTO tinyfish_ledger (id, total_used, development_used, final_demo_used, updated_at)
                        VALUES (1, 0, 0, 0, ?);
                        """,
                        (time.time(),),
                    )
                    total_used = 0
                    development_used = 0
                    final_demo_used = 0
                else:
                    total_used = row["total_used"]
                    development_used = row["development_used"]
                    final_demo_used = row["final_demo_used"]

                now = time.time()
                allowed = False

                if stage == "development":
                    if development_used < development_cap and total_used < total_cap:
                        total_used += 1
                        development_used += 1
                        cur.execute(
                            """
                            UPDATE tinyfish_ledger
                            SET total_used = ?, development_used = ?, updated_at = ?
                            WHERE id = 1;
                            """,
                            (total_used, development_used, now),
                        )
                        allowed = True
                elif stage == "final_demo":
                    if total_used < total_cap:
                        total_used += 1
                        final_demo_used += 1
                        cur.execute(
                            """
                            UPDATE tinyfish_ledger
                            SET total_used = ?, final_demo_used = ?, updated_at = ?
                            WHERE id = 1;
                            """,
                            (total_used, final_demo_used, now),
                        )
                        allowed = True
                else:
                    # Unknown/unapproved stage: reject for safety
                    allowed = False

                conn.commit()
                return (allowed, total_used, development_used)
            except (sqlite3.Error, OSError) as e:
                conn.rollback()
                logger.error("Ledger transaction failed: %s", e)
                return (False, -1, -1)
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as outer_e:
            logger.error("Ledger connection failed: %s", outer_e)
            return (False, -1, -1)


def get_tinyfish_usage() -> tuple[int, int, int]:
    """Return (total_used, development_used, final_demo_used)."""
    with _lock:
        try:
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT total_used, development_used, final_demo_used FROM tinyfish_ledger WHERE id = 1;"
                )
                row = cur.fetchone()
                if row:
                    return (row["total_used"], row["development_used"], row["final_demo_used"])
                return (0, 0, 0)
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as e:
            logger.error("Failed to read tinyfish usage: %s", e)
            return (-1, -1, -1)


# ---------------------------------------------------------------------------
# TTL Cache
# ---------------------------------------------------------------------------


def cache_get(key: str) -> dict | None:
    """Get unexpired JSON value from cache."""
    with _lock:
        try:
            conn = get_connection()
            try:
                now = time.time()
                cur = conn.cursor()
                cur.execute(
                    "SELECT value_json FROM cache WHERE key = ? AND expires_at > ?;",
                    (key, now),
                )
                row = cur.fetchone()
                if row:
                    return json.loads(row["value_json"])
                return None
            finally:
                conn.close()
        except (sqlite3.Error, OSError, json.JSONDecodeError) as e:
            logger.error("Cache get error for key %s: %s", key, e)
            return None


def cache_set(key: str, value: dict, ttl_s: int) -> None:
    """Set JSON value in cache with TTL in seconds."""
    with _lock:
        try:
            conn = get_connection()
            try:
                expires_at = time.time() + ttl_s
                val_json = json.dumps(value, default=str)
                with conn:
                    conn.execute(
                        """
                        INSERT INTO cache (key, value_json, expires_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(key) DO UPDATE SET
                            value_json = excluded.value_json,
                            expires_at = excluded.expires_at;
                        """,
                        (key, val_json, expires_at),
                    )
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as e:
            logger.error("Cache set error for key %s: %s", key, e)


# ---------------------------------------------------------------------------
# Usage Counters
# ---------------------------------------------------------------------------


def usage_get(name: str) -> int:
    """Get general counter value."""
    with _lock:
        try:
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT count FROM usage_counters WHERE name = ?;", (name,))
                row = cur.fetchone()
                if row:
                    return row["count"]
                return 0
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as e:
            logger.error("usage_get error for %s: %s", name, e)
            return 0


def usage_incr(name: str) -> int:
    """Atomically increment and return new counter value."""
    with _lock:
        try:
            conn = get_connection()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute(
                        """
                        INSERT INTO usage_counters (name, count) VALUES (?, 1)
                        ON CONFLICT(name) DO UPDATE SET count = count + 1;
                        """,
                        (name,),
                    )
                    cur.execute("SELECT count FROM usage_counters WHERE name = ?;", (name,))
                    return cur.fetchone()["count"]
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as e:
            logger.error("usage_incr error for %s: %s", name, e)
            return 0


# ---------------------------------------------------------------------------
# Scans & Findings Persistence
# ---------------------------------------------------------------------------


def create_scan(scan: Scan) -> None:
    with _lock:
        conn = get_connection()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO scans (id, status, mode, replay_case, as_of_date, created_at, packages_total, packages_done, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        scan.id,
                        scan.status,
                        scan.mode,
                        scan.replay_case,
                        scan.as_of_date,
                        scan.created_at.isoformat(),
                        scan.packages_total,
                        scan.packages_done,
                        scan.error,
                    ),
                )
        finally:
            conn.close()


def get_scan(scan_id: str) -> Scan | None:
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM scans WHERE id = ?;", (scan_id,))
            row = cur.fetchone()
            if not row:
                return None
            return Scan(
                id=row["id"],
                status=row["status"],
                mode=row["mode"],
                replay_case=row["replay_case"],
                as_of_date=row["as_of_date"],
                created_at=datetime.fromisoformat(row["created_at"]),
                packages_total=row["packages_total"],
                packages_done=row["packages_done"],
                error=row["error"],
            )
        finally:
            conn.close()


def update_scan(scan_id: str, **kwargs: Any) -> None:
    if not kwargs:
        return
    with _lock:
        conn = get_connection()
        try:
            fields = []
            values = []
            for k, v in kwargs.items():
                fields.append(f"{k} = ?")
                if isinstance(v, datetime):
                    values.append(v.isoformat())
                else:
                    values.append(v)
            values.append(scan_id)
            sql = f"UPDATE scans SET {', '.join(fields)} WHERE id = ?;"
            with conn:
                conn.execute(sql, tuple(values))
        finally:
            conn.close()


def save_finding(finding: Finding) -> None:
    with _lock:
        conn = get_connection()
        try:
            finding_json = finding.model_dump_json()
            with conn:
                conn.execute(
                    """
                    INSERT INTO findings (id, scan_id, package, version, finding_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        finding_json = excluded.finding_json;
                    """,
                    (
                        finding.id,
                        finding.scan_id,
                        finding.package,
                        finding.version,
                        finding_json,
                        finding.created_at.isoformat(),
                    ),
                )
        finally:
            conn.close()


def get_findings(scan_id: str) -> list[Finding]:
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT finding_json FROM findings WHERE scan_id = ? ORDER BY created_at ASC;",
                (scan_id,),
            )
            rows = cur.fetchall()
            return [Finding.model_validate_json(r["finding_json"]) for r in rows]
        finally:
            conn.close()


def get_finding(scan_id: str, finding_id: str) -> Finding | None:
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT finding_json FROM findings WHERE scan_id = ? AND id = ?;",
                (scan_id, finding_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return Finding.model_validate_json(row["finding_json"])
        finally:
            conn.close()


def save_dependency_graph(scan_id: str, nodes: list[dict], edges: list[dict]) -> None:
    with _lock:
        conn = get_connection()
        try:
            graph_data = json.dumps({"nodes": nodes, "edges": edges})
            with conn:
                conn.execute(
                    """
                    INSERT INTO dependency_graphs (scan_id, graph_json)
                    VALUES (?, ?)
                    ON CONFLICT(scan_id) DO UPDATE SET graph_json = excluded.graph_json;
                    """,
                    (scan_id, graph_data),
                )
        finally:
            conn.close()


def get_dependency_graph(scan_id: str) -> tuple[list[dict], list[dict]] | None:
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT graph_json FROM dependency_graphs WHERE scan_id = ?;",
                (scan_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            data = json.loads(row["graph_json"])
            return (data.get("nodes", []), data.get("edges", []))
        finally:
            conn.close()
