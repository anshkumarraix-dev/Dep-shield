"""
Baseline security and package metadata lookups (OSV and npm).
Performs free, unmetered external lookups with strict validation, fail-safe unknown
semantics, in-memory TTL caching, and ActivityEvent emission.
"""

from __future__ import annotations

import asyncio
import datetime
import time
import urllib.parse
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import httpx

# ---------------------------------------------------------------------------
# Fallback dataclasses
# ---------------------------------------------------------------------------

@dataclass
class _FallbackOsvResult:
    name: str
    version: str
    in_osv: Optional[bool] = None  # True (vulns found), False (clean), None (unknown / error)
    ids: List[str] = field(default_factory=list)
    truncated: bool = False
    error: Optional[str] = None


@dataclass
class _FallbackNpmInfo:
    name: str
    version: str
    found: Optional[bool] = None  # True (found), False (404), None (unknown / error)
    latest: Optional[str] = None
    deprecated: Optional[str] = None
    maintainer_count: int = 0
    publish_date: Optional[str] = None
    error: Optional[str] = None


@dataclass
class _FallbackActivityEvent:
    event_type: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


def _load_models() -> Tuple[type, type, type]:
    """
    Imports OsvResult, NpmInfo, and ActivityEvent from app.models (or backend.app.models)
    one name at a time, falling back to local dataclasses only for missing names.
    """
    # 1. OsvResult
    osv_cls = None
    try:
        from app.models import OsvResult as _OsvResult  # type: ignore
        osv_cls = _OsvResult
    except (ImportError, AttributeError):
        try:
            from backend.app.models import OsvResult as _OsvResult  # type: ignore
            osv_cls = _OsvResult
        except (ImportError, AttributeError):
            pass
    if osv_cls is not None and "vuln_ids" in getattr(osv_cls, "model_fields", {}):
        osv_cls = None
    if osv_cls is None:
        osv_cls = _FallbackOsvResult

    # 2. NpmInfo
    npm_cls = None
    try:
        from app.models import NpmInfo as _NpmInfo  # type: ignore
        npm_cls = _NpmInfo
    except (ImportError, AttributeError):
        try:
            from backend.app.models import NpmInfo as _NpmInfo  # type: ignore
            npm_cls = _NpmInfo
        except (ImportError, AttributeError):
            pass
    if npm_cls is not None and "found" not in getattr(npm_cls, "model_fields", {}) and not hasattr(npm_cls, "found"):
        npm_cls = None
    if npm_cls is None:
        npm_cls = _FallbackNpmInfo

    # 3. ActivityEvent
    event_cls = None
    try:
        from app.models import ActivityEvent as _ActivityEvent  # type: ignore
        event_cls = _ActivityEvent
    except (ImportError, AttributeError):
        try:
            from backend.app.models import ActivityEvent as _ActivityEvent  # type: ignore
            event_cls = _ActivityEvent
        except (ImportError, AttributeError):
            pass
    if event_cls is not None and "api" in getattr(event_cls, "model_fields", {}):
        event_cls = None
    if event_cls is None:
        event_cls = _FallbackActivityEvent

    return osv_cls, npm_cls, event_cls


OsvResult, NpmInfo, ActivityEvent = _load_models()

# Global capped event tracking (at most 500 entries)
GLOBAL_BASELINE_EVENTS: deque[ActivityEvent] = deque(maxlen=500)


def _create_activity_event(
    event_type: str,
    target: str,
    status: str,
    latency_ms: float,
    details: Optional[Dict[str, Any]] = None,
    activity_log: Optional[List[ActivityEvent]] = None,
) -> ActivityEvent:
    """
    Constructs an ActivityEvent in a single location for easy adaptation to shared models.
    Assumed fields:
      - event_type: str ('osv' or 'npm')
      - details: dict containing 'target' (name@version), 'status', 'latency_ms', etc.
      - timestamp: ISO-8601 UTC string
    """
    event_details: Dict[str, Any] = {
        "target": target,
        "status": status,
        "latency_ms": round(latency_ms, 2),
    }
    if details:
        event_details.update(details)

    event = ActivityEvent(
        event_type=event_type,
        details=event_details,
    )
    GLOBAL_BASELINE_EVENTS.append(event)
    if activity_log is not None:
        activity_log.append(event)
    return event


# Validation Helpers
MAX_NAME_LEN = 214
MAX_VERSION_LEN = 128


def validate_name_and_version(name: Any, version: Any) -> Optional[str]:
    """
    Validates package name and version string.
    Returns None if valid, or a concise error message if invalid.
    Rejects empty values, non-strings, whitespace, control characters, '..', and over-long inputs.
    """
    if not isinstance(name, str) or not isinstance(version, str):
        return "Package name and version must be strings"

    if not name or not name.strip():
        return "Package name cannot be empty"
    if not version or not version.strip():
        return "Version cannot be empty"

    if len(name) > MAX_NAME_LEN:
        return f"Package name exceeds maximum length ({MAX_NAME_LEN})"
    if len(version) > MAX_VERSION_LEN:
        return f"Version exceeds maximum length ({MAX_VERSION_LEN})"

    # Reject whitespace
    if any(c.isspace() for c in name):
        return "Package name cannot contain whitespace"
    if any(c.isspace() for c in version):
        return "Version cannot contain whitespace"

    # Reject control characters (0-31, 127)
    if any(ord(c) < 32 or ord(c) == 127 for c in name):
        return "Package name cannot contain control characters"
    if any(ord(c) < 32 or ord(c) == 127 for c in version):
        return "Version cannot contain control characters"

    # Reject path traversal / directory escaping sequences
    if ".." in name:
        return "Package name cannot contain '..'"
    if ".." in version:
        return "Version cannot contain '..'"

    return None


# Simple in-memory TTL cache
class TtlCache:
    """In-memory TTL cache for baseline lookups."""

    def __init__(self, default_ttl: float = 300.0, max_entries: int = 1000):
        self.default_ttl = default_ttl
        self.max_entries = max_entries
        self._store: Dict[str, Tuple[float, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        expires_at, val = self._store[key]
        if time.time() > expires_at:
            del self._store[key]
            return None
        return val

    def set(self, key: str, val: Any, ttl: Optional[float] = None) -> None:
        now = time.time()
        # Clean expired keys if table grows large
        if len(self._store) >= self.max_entries:
            expired_keys = [k for k, (exp, _) in self._store.items() if now > exp]
            for k in expired_keys:
                del self._store[k]
            if len(self._store) >= self.max_entries:
                oldest_key = next(iter(self._store))
                del self._store[oldest_key]

        expiry = now + (ttl if ttl is not None else self.default_ttl)
        self._store[key] = (expiry, val)


GLOBAL_BASELINE_CACHE = TtlCache()
DEFAULT_TIMEOUT_SEC = 15.0


# 1. OSV Lookup
async def osv_lookup(
    name: str,
    version: str,
    client: Optional[httpx.AsyncClient] = None,
    cache: Optional[Union[Dict[str, Any], TtlCache]] = None,
    activity_log: Optional[List[ActivityEvent]] = None,
) -> OsvResult:
    """
    Queries the OSV API (https://api.osv.dev/v1/query) for known npm vulnerabilities.
    Never raises exceptions.
    - 200 with non-empty vulns and valid string IDs -> in_osv=True, ids=[...]
    - 200 with missing vulns or empty list -> in_osv=False, ids=[]
    - Error / timeout / invalid response / non-list vulns -> in_osv=None (UNKNOWN), error="..."
    """
    target = f"{name}@{version}"
    start_time = time.time()

    try:
        # 1. Validate inputs before building URL or request
        val_err = validate_name_and_version(name, version)
        if val_err:
            _create_activity_event("osv", target, "invalid_input", 0.0, {"error": val_err}, activity_log)
            return OsvResult(name=str(name), version=str(version), in_osv=None, error=val_err)

        cache_obj = cache if cache is not None else GLOBAL_BASELINE_CACHE
        cache_key = f"osv:{name}@{version}"

        # 2. Check cache (only successful results are stored)
        cached = cache_obj.get(cache_key) if hasattr(cache_obj, "get") else cache_obj.get(cache_key)
        if cached is not None:
            _create_activity_event("osv", target, "cache_hit", 0.0, None, activity_log)
            return cached

        url = "https://api.osv.dev/v1/query"
        payload = {
            "package": {
                "name": name,
                "ecosystem": "npm",
            },
            "version": version,
        }

        async def _do_post(c: httpx.AsyncClient) -> httpx.Response:
            return await c.post(url, json=payload, timeout=DEFAULT_TIMEOUT_SEC)

        try:
            if client is not None:
                resp = await _do_post(client)
            else:
                async with httpx.AsyncClient() as local_client:
                    resp = await _do_post(local_client)
        except httpx.TimeoutException:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"OSV request timed out ({DEFAULT_TIMEOUT_SEC}s)"
            _create_activity_event("osv", target, "timeout", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)
        except httpx.RequestError as exc:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"OSV connection error: {exc}"
            _create_activity_event("osv", target, "connection_error", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)
        except Exception as exc:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"OSV request error: {exc}"
            _create_activity_event("osv", target, "error", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

        latency = (time.time() - start_time) * 1000.0

        # 3. Handle non-200 HTTP responses
        if resp.status_code != 200:
            err_msg = f"OSV returned HTTP {resp.status_code}"
            _create_activity_event("osv", target, f"http_{resp.status_code}", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

        # 4. Parse JSON safely
        try:
            data = resp.json()
        except Exception as exc:
            err_msg = f"Invalid JSON response from OSV: {exc}"
            _create_activity_event("osv", target, "malformed_json", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

        if not isinstance(data, dict):
            err_msg = "Unexpected JSON structure from OSV (expected dict)"
            _create_activity_event("osv", target, "unexpected_shape", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

        # 5. Error-shaped 200 body check: has "code" or "message" and no "vulns" -> error
        if "vulns" not in data and ("code" in data or "message" in data):
            err_msg = str(data.get("message") or f"OSV error response (code {data.get('code')})")[:300]
            _create_activity_event("osv", target, "error_response", latency, {"error": err_msg}, activity_log)
            return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

        truncated = bool(data.get("next_page_token"))

        # 6. Parse "vulns"
        if "vulns" in data:
            vulns = data["vulns"]
            # Non-list type (string, dict, int, null-like) is unexpected
            if not isinstance(vulns, list):
                err_msg = "Unexpected 'vulns' type"
                _create_activity_event("osv", target, "unexpected_shape", latency, {"error": err_msg}, activity_log)
                return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

            # Empty list -> clean
            if len(vulns) == 0:
                result = OsvResult(
                    name=name,
                    version=version,
                    in_osv=False,
                    ids=[],
                    truncated=truncated,
                    error=None,
                )
                _create_activity_event("osv", target, "clean", latency, {"in_osv": False}, activity_log)
                if hasattr(cache_obj, "set"):
                    cache_obj.set(cache_key, result)
                else:
                    cache_obj[cache_key] = result
                return result

            # Non-empty list -> extract usable string IDs
            raw_ids: List[str] = []
            for item in vulns:
                if isinstance(item, dict) and "id" in item and isinstance(item["id"], str) and item["id"].strip():
                    raw_ids.append(item["id"].strip()[:300])

            seen = set()
            deduped_ids = [i for i in raw_ids if not (i in seen or seen.add(i))]

            # A non-empty list with no usable string ids is in_osv=None with an error, NOT True
            if len(deduped_ids) == 0:
                err_msg = "Non-empty 'vulns' list contained no valid string IDs"
                _create_activity_event("osv", target, "invalid_vuln_ids", latency, {"error": err_msg}, activity_log)
                return OsvResult(name=name, version=version, in_osv=None, error=err_msg)

            result = OsvResult(
                name=name,
                version=version,
                in_osv=True,
                ids=deduped_ids,
                truncated=truncated,
                error=None,
            )
            _create_activity_event("osv", target, "vulnerable", latency, {"in_osv": True, "count": len(deduped_ids)}, activity_log)
            if hasattr(cache_obj, "set"):
                cache_obj.set(cache_key, result)
            else:
                cache_obj[cache_key] = result
            return result

        else:
            # "vulns" missing (e.g. empty dict {}) -> clean
            result = OsvResult(
                name=name,
                version=version,
                in_osv=False,
                ids=[],
                truncated=truncated,
                error=None,
            )
            _create_activity_event("osv", target, "clean", latency, {"in_osv": False}, activity_log)
            if hasattr(cache_obj, "set"):
                cache_obj.set(cache_key, result)
            else:
                cache_obj[cache_key] = result
            return result

    except Exception as exc:
        latency = (time.time() - start_time) * 1000.0
        err_msg = f"OSV unexpected exception: {exc}"
        try:
            _create_activity_event("osv", target, "unhandled_exception", latency, {"error": err_msg}, activity_log)
        except Exception:
            pass
        return OsvResult(name=str(name), version=str(version), in_osv=None, error=err_msg)


# 2. npm Metadata
async def npm_metadata(
    name: str,
    version: str,
    client: Optional[httpx.AsyncClient] = None,
    cache: Optional[Union[Dict[str, Any], TtlCache]] = None,
    activity_log: Optional[List[ActivityEvent]] = None,
) -> NpmInfo:
    """
    Fetches lightweight npm registry metadata (version manifest and dist-tags).
    Handles scoped packages via URL-encoded slash (@scope%2Fpkg).
    Returns NpmInfo.
    - 404 -> found=False, error=None
    - 200 -> found=True, latest, deprecated, maintainer_count, publish_date
    - Error -> found=None (UNKNOWN), error="..."
    Does NOT cache results when dist-tags lookup failed (latest is None).
    """
    target = f"{name}@{version}"
    start_time = time.time()

    try:
        # 1. Validate inputs
        val_err = validate_name_and_version(name, version)
        if val_err:
            _create_activity_event("npm", target, "invalid_input", 0.0, {"error": val_err}, activity_log)
            return NpmInfo(name=str(name), version=str(version), found=None, error=val_err)

        cache_obj = cache if cache is not None else GLOBAL_BASELINE_CACHE
        cache_key = f"npm:{name}@{version}"

        # 2. Check cache (only results with latest != None are cached)
        cached = cache_obj.get(cache_key) if hasattr(cache_obj, "get") else cache_obj.get(cache_key)
        if cached is not None:
            _create_activity_event("npm", target, "cache_hit", 0.0, None, activity_log)
            return cached

        # Encode scoped packages (slash becomes %2F)
        encoded_name = urllib.parse.quote(name, safe="@")
        encoded_version = urllib.parse.quote(version, safe="")
        version_url = f"https://registry.npmjs.org/{encoded_name}/{encoded_version}"
        dist_tags_url = f"https://registry.npmjs.org/-/package/{encoded_name}/dist-tags"

        async def _fetch(c: httpx.AsyncClient) -> Tuple[httpx.Response, Optional[httpx.Response]]:
            v_resp = await c.get(version_url, timeout=DEFAULT_TIMEOUT_SEC)
            if v_resp.status_code == 404 or v_resp.status_code >= 400:
                return v_resp, None
            try:
                d_resp = await c.get(dist_tags_url, timeout=DEFAULT_TIMEOUT_SEC)
            except Exception:
                d_resp = None
            return v_resp, d_resp

        try:
            if client is not None:
                resp_ver, resp_dist = await _fetch(client)
            else:
                async with httpx.AsyncClient() as local_client:
                    resp_ver, resp_dist = await _fetch(local_client)
        except httpx.TimeoutException:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"npm request timed out ({DEFAULT_TIMEOUT_SEC}s)"
            _create_activity_event("npm", target, "timeout", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)
        except httpx.RequestError as exc:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"npm connection error: {exc}"
            _create_activity_event("npm", target, "connection_error", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)
        except Exception as exc:
            latency = (time.time() - start_time) * 1000.0
            err_msg = f"npm request error: {exc}"
            _create_activity_event("npm", target, "error", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)

        latency = (time.time() - start_time) * 1000.0

        # 3. Handle 404 (package or version not found - clean absence, no error)
        if resp_ver.status_code == 404:
            result = NpmInfo(name=name, version=version, found=False, error=None)
            _create_activity_event("npm", target, "not_found", latency, {"found": False}, activity_log)
            if hasattr(cache_obj, "set"):
                cache_obj.set(cache_key, result)
            else:
                cache_obj[cache_key] = result
            return result

        # 4. Handle other HTTP errors
        if resp_ver.status_code != 200:
            err_msg = f"npm registry returned HTTP {resp_ver.status_code}"
            _create_activity_event("npm", target, f"http_{resp_ver.status_code}", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)

        # 5. Parse version document JSON
        try:
            ver_data = resp_ver.json()
        except Exception as exc:
            err_msg = f"Invalid JSON in npm version document: {exc}"
            _create_activity_event("npm", target, "malformed_json", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)

        if not isinstance(ver_data, dict):
            err_msg = "Unexpected JSON structure from npm (expected dict)"
            _create_activity_event("npm", target, "unexpected_shape", latency, {"error": err_msg}, activity_log)
            return NpmInfo(name=name, version=version, found=None, error=err_msg)

        # Extract deprecation message (treat as untrusted, truncate to 300 chars)
        raw_deprecated = ver_data.get("deprecated")
        deprecated = str(raw_deprecated)[:300] if raw_deprecated else None

        # Maintainers count
        raw_maintainers = ver_data.get("maintainers")
        maintainer_count = len(raw_maintainers) if isinstance(raw_maintainers, list) else 0

        # Set publish_date ONLY when the version document really contains it
        publish_date = None
        for date_key in ("publish_time", "time", "publish_date"):
            val = ver_data.get(date_key)
            if isinstance(val, str) and val.strip():
                publish_date = val.strip()[:100]
                break

        # Extract latest version from dist-tags if available
        latest = None
        if resp_dist is not None and resp_dist.status_code == 200:
            try:
                dist_data = resp_dist.json()
                if isinstance(dist_data, dict) and "latest" in dist_data:
                    latest = str(dist_data["latest"])[:128]
            except Exception:
                pass

        result = NpmInfo(
            name=name,
            version=version,
            found=True,
            latest=latest,
            deprecated=deprecated,
            maintainer_count=maintainer_count,
            publish_date=publish_date,
            error=None,
        )
        _create_activity_event("npm", target, "found", latency, {"found": True, "latest": latest}, activity_log)

        # Do NOT cache when dist-tags lookup failed (latest is None)
        if latest is not None:
            if hasattr(cache_obj, "set"):
                cache_obj.set(cache_key, result)
            else:
                cache_obj[cache_key] = result

        return result

    except Exception as exc:
        latency = (time.time() - start_time) * 1000.0
        err_msg = f"npm unexpected exception: {exc}"
        try:
            _create_activity_event("npm", target, "unhandled_exception", latency, {"error": err_msg}, activity_log)
        except Exception:
            pass
        return NpmInfo(name=str(name), version=str(version), found=None, error=err_msg)
