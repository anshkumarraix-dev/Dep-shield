"""Integration tests for FastAPI endpoints and mock scan flow."""
import asyncio
import io
import json

import pytest
from app import db
from app.main import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture(autouse=True)
def clean_db(tmp_path):
    """Use isolated temporary DB for integration tests."""
    temp_db_path = str(tmp_path / "test_api.db")
    db.set_db_path(temp_db_path)
    yield


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["use_stubs"] is True
        assert data["tinyfish_live_enabled"] is False


@pytest.mark.asyncio
async def test_replay_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/replay")
        assert resp.status_code == 200
        cases = resp.json()
        assert isinstance(cases, list)
        assert len(cases) >= 1
        assert "id" in cases[0]
        assert "as_of_date" in cases[0]


@pytest.mark.asyncio
async def test_scan_upload_and_flow():
    lockfile_content = json.dumps({
        "name": "integration-demo",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "integration-demo",
                "dependencies": {
                    "event-stream": "3.3.6",
                    "debug": "2.6.9",
                    "lodash": "4.17.21"
                }
            },
            "node_modules/event-stream": {
                "version": "3.3.6",
                "dependencies": {"flatmap-stream": "0.1.1"}
            },
            "node_modules/flatmap-stream": {
                "version": "0.1.1"
            },
            "node_modules/debug": {
                "version": "2.6.9"
            },
            "node_modules/lodash": {
                "version": "4.17.21"
            }
        }
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upload scan
        files = {"lockfile": ("package-lock.json", io.BytesIO(lockfile_content.encode("utf-8")), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 200
        scan_id = resp.json()["scan_id"]
        assert scan_id.startswith("scan_")

        # 2. Allow background scan to complete
        for _ in range(30):
            await asyncio.sleep(0.1)
            scan_resp = await client.get(f"/api/scans/{scan_id}")
            assert scan_resp.status_code == 200
            scan_data = scan_resp.json()["scan"]
            if scan_data["status"] in ("done", "error"):
                break

        assert scan_data["status"] == "done"
        assert scan_data["packages_done"] >= 1

        # 3. Check findings
        findings = scan_resp.json()["findings"]
        assert len(findings) >= 1
        finding_statuses = {f["status"] for f in findings}
        # In our mock rules, event-stream produces HIGH, debug produces WATCH
        assert "HIGH" in finding_statuses or "WATCH" in finding_statuses

        # 4. Check dependencies graph
        dep_resp = await client.get(f"/api/scans/{scan_id}/dependencies")
        assert dep_resp.status_code == 200
        graph = dep_resp.json()
        assert len(graph["nodes"]) >= 3
        assert len(graph["edges"]) >= 1

        # 5. Trigger Deep Research on first finding
        first_finding_id = findings[0]["id"]
        res_resp = await client.post(f"/api/scans/{scan_id}/research/{first_finding_id}")
        assert res_resp.status_code == 200
        updated_finding = res_resp.json()
        assert updated_finding["research_summary"] is not None


@pytest.mark.asyncio
async def test_replay_scan():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/replay/event-stream-2018")
        assert resp.status_code == 200
        scan_id = resp.json()["scan_id"]

        for _ in range(30):
            await asyncio.sleep(0.1)
            scan_resp = await client.get(f"/api/scans/{scan_id}")
            if scan_resp.json()["scan"]["status"] in ("done", "error"):
                break

        assert scan_resp.json()["scan"]["status"] == "done"


@pytest.mark.asyncio
async def test_monitor_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create
        create_resp = await client.post("/api/monitors", json={"package": "test-pkg"})
        assert create_resp.status_code == 200
        mon_id = create_resp.json()["monitor_id"]

        # Run
        run_resp = await client.post(f"/api/monitors/{mon_id}/run")
        assert run_resp.status_code == 200
        assert run_resp.json()["status"] == "ok"

        # Pause
        pause_resp = await client.post(f"/api/monitors/{mon_id}/pause")
        assert pause_resp.status_code == 200
        assert pause_resp.json()["paused"] is True
