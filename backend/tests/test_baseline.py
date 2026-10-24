"""
Unit tests for baseline security and metadata lookups (OSV and npm).
Uses mocked httpx.AsyncClient; strictly no network calls.
"""

import asyncio
import sys
import types
from unittest.mock import AsyncMock, MagicMock
from dataclasses import dataclass
import httpx
import pytest

# Try importing from app.baseline first, fallback to backend.app.baseline
try:
    from app.baseline import (
        _osv_lookup as osv_lookup,
        _npm_metadata as npm_metadata,
        osv_lookup as contract_osv_lookup,
        npm_metadata as contract_npm_metadata,
        OsvResult,
        NpmInfo,
        ActivityEvent,
        TtlCache,
        validate_name_and_version,
        _load_models,
        _FallbackNpmInfo,
    )
except ImportError:
    from backend.app.baseline import (
        _osv_lookup as osv_lookup,
        _npm_metadata as npm_metadata,
        osv_lookup as contract_osv_lookup,
        npm_metadata as contract_npm_metadata,
        OsvResult,
        NpmInfo,
        ActivityEvent,
        TtlCache,
        validate_name_and_version,
        _load_models,
        _FallbackNpmInfo,
    )


# ---------------------------------------------------------------------------
# OSV Tests
# ---------------------------------------------------------------------------

def test_osv_success_with_ids():
    """OSV returns 200 with vulnerabilities: in_osv=True, deduplicated IDs, no error."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={
                    "vulns": [
                        {"id": "GHSA-1111"},
                        {"id": "GHSA-2222"},
                        {"id": "GHSA-1111"},  # duplicate
                    ]
                },
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("lodash", "4.17.15", client=mock_client, cache={})
        assert res.in_osv is True
        assert res.ids == ["GHSA-1111", "GHSA-2222"]
        assert res.truncated is False
        assert res.error is None
        assert mock_client.post.await_count == 1

    asyncio.run(run())


def test_osv_success_empty_result():
    """OSV returns 200 with {} or empty vulns: in_osv=False, ids=[]."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("react", "18.2.0", client=mock_client, cache={})
        assert res.in_osv is False
        assert res.ids == []
        assert res.error is None

        # Also test explicit empty list
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"vulns": []},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )
        res2 = await osv_lookup("react", "18.2.0", client=mock_client, cache={})
        assert res2.in_osv is False
        assert res2.ids == []
        assert res2.error is None

    asyncio.run(run())


@pytest.mark.parametrize("vulns_val", ["", {}, 0, "some_string", None])
def test_osv_invalid_vulns_type(vulns_val):
    """If 'vulns' is any non-list type (string, dict, int, null-like), return in_osv=None with 'Unexpected 'vulns' type'."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"vulns": vulns_val},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("pkg-invalid-vulns", "1.0.0", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error == "Unexpected 'vulns' type"

    asyncio.run(run())


def test_osv_error_shaped_200_body():
    """A 200 body that has 'code' or 'message' and no 'vulns' is in_osv=None."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"code": 3, "message": "Invalid query parameters"},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("pkg-error-200", "1.0.0", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "Invalid query parameters" in res.error

    asyncio.run(run())


def test_osv_vulns_list_without_usable_ids():
    """A non-empty vulns list with no usable string ids (e.g. [1, 2]) is in_osv=None with an error, not True."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"vulns": [1, 2]},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("pkg-bad-ids", "1.0.0", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "no valid string IDs" in res.error

    asyncio.run(run())


def test_osv_timeout_failure():
    """OSV timeout gives in_osv=None and error set (never clean)."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Connection timed out"))

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "timed out" in res.error.lower()

    asyncio.run(run())


def test_osv_connection_error():
    """OSV network/connection error gives in_osv=None and error set."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            side_effect=httpx.RequestError("DNS resolution failed", request=httpx.Request("POST", "https://api.osv.dev/v1/query"))
        )

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "connection error" in res.error.lower()

    asyncio.run(run())


def test_osv_http_500_failure():
    """OSV 500 error gives in_osv=None and error set."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                500,
                text="Internal Server Error",
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "500" in res.error

    asyncio.run(run())


def test_osv_http_429_rate_limit():
    """OSV 429 rate limit gives in_osv=None and error set."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                429,
                text="Rate Limit Exceeded",
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "429" in res.error

    asyncio.run(run())


def test_osv_malformed_json():
    """OSV returns non-JSON content: in_osv=None and error set."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                content=b"<gateway>malformed json</gateway>",
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None
        assert "json" in res.error.lower()

    asyncio.run(run())


def test_osv_unexpected_json_shape():
    """OSV returns unexpected JSON types (list instead of dict)."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json=["unexpected", "array"],
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("express", "4.18.2", client=mock_client, cache={})
        assert res.in_osv is None
        assert res.error is not None

    asyncio.run(run())


def test_osv_next_page_token():
    """OSV response contains next_page_token: returns IDs and sets truncated=True without looping."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={
                    "vulns": [{"id": "GHSA-page1-1"}, {"id": "GHSA-page1-2"}],
                    "next_page_token": "token_for_page_2",
                },
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )

        res = await osv_lookup("page-pkg", "1.0.0", client=mock_client, cache={})
        assert res.in_osv is True
        assert res.ids == ["GHSA-page1-1", "GHSA-page1-2"]
        assert res.truncated is True
        assert res.error is None
        # Must make only 1 request, no looping
        assert mock_client.post.await_count == 1

    asyncio.run(run())


# ---------------------------------------------------------------------------
# npm Metadata Tests
# ---------------------------------------------------------------------------

def test_npm_success():
    """npm metadata returns found=True, latest, deprecated, maintainer_count, publish_date."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)

        async def mock_get(url, **kwargs):
            if "dist-tags" in url:
                return httpx.Response(200, json={"latest": "2.0.0"}, request=httpx.Request("GET", url))
            return httpx.Response(
                200,
                json={
                    "name": "example-pkg",
                    "version": "1.0.0",
                    "deprecated": "This package version is deprecated",
                    "maintainers": [{"name": "alice"}, {"name": "bob"}],
                    "time": "2024-05-15T12:00:00Z",
                },
                request=httpx.Request("GET", url),
            )

        mock_client.get = AsyncMock(side_effect=mock_get)

        res = await npm_metadata("example-pkg", "1.0.0", client=mock_client, cache={})
        assert res.found is True
        assert res.latest == "2.0.0"
        assert res.deprecated == "This package version is deprecated"
        assert res.maintainer_count == 2
        assert res.publish_date == "2024-05-15T12:00:00Z"
        assert res.error is None

    asyncio.run(run())


def test_npm_do_not_cache_when_latest_is_none():
    """Do not cache an npm result when the dist-tags lookup failed (latest is None)."""
    async def run():
        cache = TtlCache()
        mock_client = MagicMock(spec=httpx.AsyncClient)

        # Version doc succeeds, but dist-tags fails with 500
        async def mock_get(url, **kwargs):
            if "dist-tags" in url:
                return httpx.Response(500, text="Server Error", request=httpx.Request("GET", url))
            return httpx.Response(
                200,
                json={"name": "no-latest-pkg", "version": "1.0.0", "maintainers": []},
                request=httpx.Request("GET", url),
            )

        mock_client.get = AsyncMock(side_effect=mock_get)

        res1 = await npm_metadata("no-latest-pkg", "1.0.0", client=mock_client, cache=cache)
        assert res1.found is True
        assert res1.latest is None

        # Verify not cached
        assert cache.get("npm:no-latest-pkg@1.0.0") is None

        # Second call must make HTTP requests again
        res2 = await npm_metadata("no-latest-pkg", "1.0.0", client=mock_client, cache=cache)
        assert res2.found is True
        assert mock_client.get.await_count == 4  # 2 requests * 2 calls

    asyncio.run(run())


def test_npm_404_not_found():
    """npm 404 returns found=False with error=None (clean absence)."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            return_value=httpx.Response(
                404,
                text="version not found: 99.0.0",
                request=httpx.Request("GET", "https://registry.npmjs.org/pkg/99.0.0"),
            )
        )

        res = await npm_metadata("pkg", "99.0.0", client=mock_client, cache={})
        assert res.found is False
        assert res.error is None

    asyncio.run(run())


def test_npm_timeout():
    """npm timeout returns found=None with error set."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("npm registry timeout"))

        res = await npm_metadata("pkg", "1.0.0", client=mock_client, cache={})
        assert res.found is None
        assert res.error is not None
        assert "timed out" in res.error.lower()

    asyncio.run(run())


def test_npm_scoped_package_encoding():
    """Scoped packages (@scope/pkg) must URL-encode the slash as @scope%2Fpkg."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"name": "@types/node", "version": "20.0.0", "maintainers": []},
                request=httpx.Request("GET", "https://registry.npmjs.org/@types%2Fnode/20.0.0"),
            )
        )

        res = await npm_metadata("@types/node", "20.0.0", client=mock_client, cache={})
        assert res.found is True

        # Check requested URL encoding
        first_call_url = mock_client.get.call_args_list[0][0][0]
        assert "https://registry.npmjs.org/@types%2Fnode/20.0.0" == first_call_url

    asyncio.run(run())


# ---------------------------------------------------------------------------
# Input Validation & Cache Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "bad_name,bad_version",
    [
        ("", "1.0.0"),
        (" ", "1.0.0"),
        ("lodash", ""),
        ("lodash", " "),
        ("bad name", "1.0.0"),
        ("lodash", "1.0.0 beta"),
        ("bad\x00pkg", "1.0.0"),
        ("lodash", "1.0.0\n"),
        ("../traversal", "1.0.0"),
        ("lodash", "../../etc/passwd"),
        ("a" * 250, "1.0.0"),
        ("lodash", "1." + "0" * 200),
    ],
)
def test_input_validation_makes_no_http_requests(bad_name, bad_version):
    """Bad names and versions return an error result without making any HTTP request."""
    async def run():
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock()
        mock_client.get = AsyncMock()

        # OSV lookup
        osv_res = await osv_lookup(bad_name, bad_version, client=mock_client, cache={})
        assert osv_res.in_osv is None
        assert osv_res.error is not None
        assert mock_client.post.await_count == 0

        # npm metadata
        npm_res = await npm_metadata(bad_name, bad_version, client=mock_client, cache={})
        assert npm_res.found is None
        assert npm_res.error is not None
        assert mock_client.get.await_count == 0

    asyncio.run(run())


def test_cache_hits_and_no_error_caching():
    """Cache returns stored result with 0 HTTP calls; errors are NEVER cached."""
    async def run():
        cache = TtlCache()
        mock_client = MagicMock(spec=httpx.AsyncClient)

        # 1. OSV Success caching
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"vulns": [{"id": "GHSA-test"}]},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )
        res1 = await osv_lookup("cached-pkg", "1.0.0", client=mock_client, cache=cache)
        assert res1.in_osv is True
        assert mock_client.post.await_count == 1

        # Second call hits cache (0 additional HTTP calls)
        res2 = await osv_lookup("cached-pkg", "1.0.0", client=mock_client, cache=cache)
        assert res2.in_osv is True
        assert mock_client.post.await_count == 1
        assert res1 == res2

        # 2. OSV Error is NEVER cached
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                500,
                text="Server Error",
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )
        err1 = await osv_lookup("err-pkg", "1.0.0", client=mock_client, cache=cache)
        assert err1.in_osv is None
        assert err1.error is not None
        assert mock_client.post.await_count == 1

        # Calling again MUST make another network attempt (not cached)
        err2 = await osv_lookup("err-pkg", "1.0.0", client=mock_client, cache=cache)
        assert err2.in_osv is None
        assert mock_client.post.await_count == 2

    asyncio.run(run())


def test_activity_events_emitted():
    """Both functions emit ActivityEvents tagged 'osv' or 'npm' with target, status and latency."""
    async def run():
        events = []
        mock_client = MagicMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"vulns": []},
                request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
            )
        )
        mock_client.get = AsyncMock(
            return_value=httpx.Response(
                404,
                text="Not Found",
                request=httpx.Request("GET", "https://registry.npmjs.org/ev-pkg/1.0.0"),
            )
        )

        await osv_lookup("ev-pkg", "1.0.0", client=mock_client, activity_log=events, cache={})
        await npm_metadata("ev-pkg", "1.0.0", client=mock_client, activity_log=events, cache={})

        assert len(events) == 2

        # OSV event
        osv_ev = events[0]
        assert osv_ev.event_type == "osv"
        assert osv_ev.details["target"] == "ev-pkg@1.0.0"
        assert osv_ev.details["status"] == "clean"
        assert "latency_ms" in osv_ev.details

        # npm event
        npm_ev = events[1]
        assert npm_ev.event_type == "npm"
        assert npm_ev.details["target"] == "ev-pkg@1.0.0"
        assert npm_ev.details["status"] == "not_found"
        assert "latency_ms" in npm_ev.details

    asyncio.run(run())


# ---------------------------------------------------------------------------
# Partial Import Fallback Test
# ---------------------------------------------------------------------------

def test_partial_import_fallback(monkeypatch):
    """Import OsvResult, NpmInfo and ActivityEvent one by one; fallback only for missing names."""
    # Create a mock module that contains OsvResult and ActivityEvent, but lacks NpmInfo
    mock_models = types.ModuleType("app.models")

    @dataclass
    class CustomSharedOsvResult:
        name: str
        version: str

    @dataclass
    class CustomSharedActivityEvent:
        event_type: str

    mock_models.OsvResult = CustomSharedOsvResult
    mock_models.ActivityEvent = CustomSharedActivityEvent
    # NpmInfo is intentionally omitted

    monkeypatch.setitem(sys.modules, "app.models", mock_models)

    # Invoke _load_models() directly
    loaded_osv, loaded_npm, loaded_event = _load_models()

    # OsvResult and ActivityEvent came from the module
    assert loaded_osv is CustomSharedOsvResult
    assert loaded_event is CustomSharedActivityEvent
    # NpmInfo fell back to local fallback dataclass
    assert loaded_npm is _FallbackNpmInfo
