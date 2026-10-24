"""Unit and concurrency tests for db.py and the atomic TinyFish budget ledger."""
import os
import tempfile
import threading

import pytest
from app import db
from app.models import Finding, Scan


@pytest.fixture
def temp_db(monkeypatch):
    """Fixture providing an isolated temporary database for each test."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = f.name
    db.set_db_path(temp_path)
    yield temp_path
    if os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except OSError:
            pass


def test_cache_ttl(temp_db):
    assert db.cache_get("k1") is None
    db.cache_set("k1", {"foo": "bar"}, ttl_s=2)
    assert db.cache_get("k1") == {"foo": "bar"}

    # Expired cache
    db.cache_set("k2", {"expired": True}, ttl_s=-1)
    assert db.cache_get("k2") is None


def test_usage_counter(temp_db):
    assert db.usage_get("op1") == 0
    assert db.usage_incr("op1") == 1
    assert db.usage_incr("op1") == 2
    assert db.usage_get("op1") == 2
    assert db.usage_get("op2") == 0


def test_tinyfish_ledger_development_cap(temp_db):
    # Reserve up to cap 48
    for i in range(1, 49):
        allowed, total, dev = db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)
        assert allowed is True
        assert total == i
        assert dev == i

    # 49th request in development stage must be rejected
    allowed, total, dev = db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)
    assert allowed is False
    assert total == 48
    assert dev == 48


def test_tinyfish_ledger_final_demo_cap(temp_db):
    # Simulate switching to final_demo after 48 development requests
    for _ in range(48):
        db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)

    # In final_demo, can use remaining 16 requests up to 64
    for i in range(49, 65):
        allowed, total, dev = db.reserve_tinyfish_request("final_demo", development_cap=48, total_cap=64)
        assert allowed is True
        assert total == i
        assert dev == 48

    # 65th request rejected
    allowed, total, dev = db.reserve_tinyfish_request("final_demo", development_cap=48, total_cap=64)
    assert allowed is False
    assert total == 64


def test_tinyfish_ledger_restart_persistence(temp_db):
    # Reserve 10 requests
    for _ in range(10):
        db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)

    # Re-initialize pointing to same DB file (simulating process restart)
    db.set_db_path(temp_db)
    total, dev, _demo = db.get_tinyfish_usage()
    assert total == 10
    assert dev == 10

    # Next reservation starts at 11
    allowed, total, dev = db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)
    assert allowed is True
    assert total == 11
    assert dev == 11


def test_tinyfish_ledger_concurrency(temp_db):
    """Multiple threads reserving concurrently must never over-allocate or produce inconsistent counts."""
    target_count = 30
    results = []

    def worker():
        res = db.reserve_tinyfish_request("development", development_cap=48, total_cap=64)
        results.append(res)

    threads = [threading.Thread(target=worker) for _ in range(target_count)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == target_count
    allowed_count = sum(1 for r in results if r[0] is True)
    assert allowed_count == target_count

    total, dev, _demo = db.get_tinyfish_usage()
    assert total == target_count
    assert dev == target_count


def test_scan_and_findings_persistence(temp_db):
    scan = Scan(
        id="scan-123",
        status="running",
        mode="upload",
        packages_total=2,
        packages_done=1,
    )
    db.create_scan(scan)

    fetched = db.get_scan("scan-123")
    assert fetched is not None
    assert fetched.id == "scan-123"
    assert fetched.packages_total == 2
    assert fetched.packages_done == 1

    db.update_scan("scan-123", status="done", packages_done=2)
    updated = db.get_scan("scan-123")
    assert updated.status == "done"
    assert updated.packages_done == 2

    # Save finding
    finding = Finding(
        id="f-1",
        scan_id="scan-123",
        package="express",
        version="4.18.2",
        dep_path=["app", "express@4.18.2"],
        direct=True,
        status="WATCH",
        severity="medium",
        confidence=0.65,
        summary="Synthetic test finding",
        reasoning="Single source reported advisory",
    )
    db.save_finding(finding)

    findings = db.get_findings("scan-123")
    assert len(findings) == 1
    assert findings[0].id == "f-1"
    assert findings[0].package == "express"

    single = db.get_finding("scan-123", "f-1")
    assert single is not None
    assert single.version == "4.18.2"

    # Dependency graph
    db.save_dependency_graph("scan-123", [{"id": "app"}], [{"source": "app", "target": "express"}])
    nodes, edges = db.get_dependency_graph("scan-123")
    assert len(nodes) == 1
    assert len(edges) == 1
