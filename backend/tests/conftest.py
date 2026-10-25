"""Pytest configuration for DepShield.
Guarantees unit tests run in offline safe stub mode so real API keys in .env
are not accidentally consumed or cause unit tests to timeout.
"""
import os
os.environ["USE_STUBS"] = "1"
os.environ["TINYFISH_LIVE_ENABLED"] = "0"

from backend.app.config import settings
settings.use_stubs = True
settings.tinyfish_live_enabled = False

import pytest

@pytest.fixture(autouse=True)
def force_test_environment(monkeypatch):
    monkeypatch.setenv("USE_STUBS", "1")
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "0")
    monkeypatch.setattr(settings, "use_stubs", True)
    monkeypatch.setattr(settings, "tinyfish_live_enabled", False)
