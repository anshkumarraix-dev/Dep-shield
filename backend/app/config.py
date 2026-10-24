"""Application configuration.

Owner: Ansh.
Loads the repo-root .env relative to __file__.
Safe defaults: USE_STUBS=1, TINYFISH_LIVE_ENABLED=0.
Never fail at import time if API keys are missing.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Locate repo root based on this file's path (backend/app/config.py -> root)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = REPO_ROOT / ".env"

# Load .env if present
if ENV_PATH.exists():
    load_dotenv(ENV_PATH, override=False)


def _get_bool(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _get_int(key: str, default: int) -> int:
    val = os.getenv(key)
    if val is None:
        return default
    try:
        return int(val.strip())
    except ValueError:
        return default


def _get_float(key: str, default: float) -> float:
    val = os.getenv(key)
    if val is None:
        return default
    try:
        return float(val.strip())
    except ValueError:
        return default


class Settings(BaseModel):
    # API keys (optional for stub/offline mode)
    tinyfish_api_key: str = Field(default_factory=lambda: os.getenv("TINYFISH_API_KEY", ""))
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = Field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))

    # Operational modes
    use_stubs: bool = Field(default_factory=lambda: _get_bool("USE_STUBS", True))
    use_cache: bool = Field(default_factory=lambda: _get_bool("USE_CACHE", True))
    tinyfish_live_enabled: bool = Field(default_factory=lambda: _get_bool("TINYFISH_LIVE_ENABLED", False))
    tinyfish_budget_stage: str = Field(default_factory=lambda: os.getenv("TINYFISH_BUDGET_STAGE", "development"))

    # TinyFish request unit budget caps ($0.25/request)
    tinyfish_cost_per_request_usd: float = Field(default_factory=lambda: _get_float("TINYFISH_COST_PER_REQUEST_USD", 0.25))
    tinyfish_budget_total_usd: float = Field(default_factory=lambda: _get_float("TINYFISH_BUDGET_TOTAL_USD", 16.00))
    tinyfish_budget_final_reserve_usd: float = Field(default_factory=lambda: _get_float("TINYFISH_BUDGET_FINAL_RESERVE_USD", 4.00))
    tinyfish_max_requests_development: int = Field(default_factory=lambda: _get_int("TINYFISH_MAX_REQUESTS_DEVELOPMENT", 48))
    tinyfish_max_requests_total: int = Field(default_factory=lambda: _get_int("TINYFISH_MAX_REQUESTS_TOTAL", 64))

    # Rate and concurrency limits
    max_agent_runs: int = Field(default_factory=lambda: _get_int("MAX_AGENT_RUNS", 2))
    max_research_runs: int = Field(default_factory=lambda: _get_int("MAX_RESEARCH_RUNS", 1))
    max_monitors: int = Field(default_factory=lambda: _get_int("MAX_MONITORS", 1))
    max_research_polls_per_run: int = Field(default_factory=lambda: _get_int("MAX_RESEARCH_POLLS_PER_RUN", 3))

    # Scan caps
    max_packages_per_scan: int = Field(default_factory=lambda: _get_int("MAX_PACKAGES_PER_SCAN", 100))
    max_packages_analyzed_per_scan: int = Field(default_factory=lambda: _get_int("MAX_PACKAGES_ANALYZED_PER_SCAN", 4))
    search_queries_per_package: int = Field(default_factory=lambda: _get_int("SEARCH_QUERIES_PER_PACKAGE", 2))
    max_urls_fetched_per_package: int = Field(default_factory=lambda: _get_int("MAX_URLS_FETCHED_PER_PACKAGE", 2))

    # Gemini caps
    gemini_max_pages: int = Field(default_factory=lambda: _get_int("GEMINI_MAX_PAGES", 5))
    gemini_max_chars_per_page: int = Field(default_factory=lambda: _get_int("GEMINI_MAX_CHARS_PER_PAGE", 3000))
    gemini_max_concurrency: int = Field(default_factory=lambda: _get_int("GEMINI_MAX_CONCURRENCY", 1))
    tinyfish_max_concurrency: int = Field(default_factory=lambda: _get_int("TINYFISH_MAX_CONCURRENCY", 1))

    # Timeouts and polling
    monitor_cron: str = Field(default_factory=lambda: os.getenv("MONITOR_CRON", "0 0 1 1 *"))
    research_timeout_s: int = Field(default_factory=lambda: _get_int("RESEARCH_TIMEOUT_S", 900))
    research_poll_s: int = Field(default_factory=lambda: _get_int("RESEARCH_POLL_S", 10))

    # Storage and CORS
    db_path: str = Field(default_factory=lambda: os.getenv("DB_PATH", str(REPO_ROOT / "depshield.db")))
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        ]
    )


settings = Settings()


def get_settings() -> Settings:
    return settings
