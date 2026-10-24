"""
Tests for operational and evaluation scripts:
- backend/scripts/list_gemini_models.py
- backend/scripts/try_classifier.py
All tests are strictly offline with network sockets blocked.
"""
from __future__ import annotations

import io
import json
import socket
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from scripts import list_gemini_models, try_classifier


@pytest.fixture(autouse=True)
def block_network_sockets(monkeypatch):
    """Ensure no real socket connection or DNS lookup can be made in any script test."""
    orig_connect = socket.socket.connect
    orig_socketpair = getattr(socket, "socketpair", None)

    def blocked_connect(self, *args, **kwargs):
        raise RuntimeError("Network connect blocked during offline tests")

    def blocked_gai(*args, **kwargs):
        raise RuntimeError("DNS getaddrinfo blocked during offline tests")

    def safe_socketpair(*args, **kwargs):
        saved = socket.socket.connect
        socket.socket.connect = orig_connect
        try:
            return orig_socketpair(*args, **kwargs)
        finally:
            socket.socket.connect = saved

    if orig_socketpair is not None:
        monkeypatch.setattr(socket, "socketpair", safe_socketpair)
    monkeypatch.setattr(socket.socket, "connect", blocked_connect)
    monkeypatch.setattr(socket, "getaddrinfo", blocked_gai)


# ---------------------------------------------------------------------------
# 1. Tests for list_gemini_models.py
# ---------------------------------------------------------------------------

def test_list_gemini_models_default_mode_dry_run(monkeypatch, capsys):
    """Default mode (no flags) makes zero network calls and never prints the API key."""
    fake_key = "mock-secret-key-default-mode-12345"
    monkeypatch.setenv("GEMINI_API_KEY", fake_key)
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Mock dotenv.load_dotenv so it does not read local file during test
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)

    code = list_gemini_models.main([])
    captured = capsys.readouterr()

    assert code == 0
    assert "DRY RUN" in captured.out
    assert "GEMINI_API_KEY present: yes" in captured.out
    assert "gemini-2.0-flash" in captured.out
    assert "No network calls made" in captured.out
    # Security requirement: NEVER print the key or any prefix of it
    assert fake_key not in captured.out
    assert fake_key not in captured.err


def test_list_gemini_models_refuses_when_no_key(monkeypatch, capsys):
    """Running --list without an API key must exit with code 2 before any network call."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)

    code = list_gemini_models.main(["--list"])
    captured = capsys.readouterr()

    assert code == 2
    assert "Refusing to list models: GEMINI_API_KEY is not set" in captured.err


def test_list_gemini_models_with_mocked_client(monkeypatch, capsys):
    """
    With --list and a mocked client, print only IDs supporting generateContent,
    verify GEMINI_MODEL detection, and ensure the API key never leaks.
    """
    fake_key = "mock-secret-key-client-test-67890"
    monkeypatch.setenv("GEMINI_API_KEY", fake_key)
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.0-flash")
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)

    # Models: 2 supporting generateContent, 1 embedding model that does not
    m1 = MagicMock()
    m1.name = "models/gemini-2.0-flash"
    m1.supported_actions = ["generateContent"]

    m2 = MagicMock()
    m2.name = "gemini-1.5-pro"
    m2.supported_actions = ["generateContent"]

    m3 = MagicMock()
    m3.name = "models/text-embedding-004"
    m3.supported_actions = ["embedContent"]

    mock_client = MagicMock()
    mock_client.models.list.return_value = [m1, m2, m3]

    # Mock genai.Client
    mock_genai = MagicMock()
    mock_genai.Client.return_value = mock_client
    monkeypatch.setitem(sys.modules, "google.genai", mock_genai)

    code = list_gemini_models.main(["--list"])
    captured = capsys.readouterr()

    assert code == 0
    # Must list only IDs supporting generateContent
    assert "gemini-2.0-flash" in captured.out
    assert "gemini-1.5-pro" in captured.out
    assert "text-embedding-004" not in captured.out

    # Model in list check
    assert "Current GEMINI_MODEL: gemini-2.0-flash" in captured.out
    assert "GEMINI_MODEL in list: True" in captured.out

    # Key safety check
    assert fake_key not in captured.out
    assert fake_key not in captured.err


# ---------------------------------------------------------------------------
# 2. Tests for try_classifier.py
# ---------------------------------------------------------------------------

def test_try_classifier_refuses_without_canned_output(tmp_path, capsys):
    """try_classifier must refuse to run if no canned output is supplied."""
    fixture_no_canned = tmp_path / "no_canned.json"
    fixture_no_canned.write_text(
        json.dumps({
            "package": "sample-pkg",
            "version": "1.0.0",
            "pages": [{"url": "https://example.test", "text": "Some text"}]
        }),
        encoding="utf-8",
    )

    code = try_classifier.main(["--fixture", str(fixture_no_canned)])
    captured = capsys.readouterr()

    assert code == 2
    assert "Refusing to run: No canned Gemini output supplied" in captured.err


def test_try_classifier_benign_fixture_zero_network(capsys):
    """Running try_classifier on the synthetic benign fixture yields clean result."""
    fixture_path = Path("backend/fixtures/pages/synthetic_benign.json")
    if not fixture_path.is_file():
        fixture_path = Path("fixtures/pages/synthetic_benign.json")

    code = try_classifier.main(["--fixture", str(fixture_path)])
    captured = capsys.readouterr()

    assert code == 0
    payload = json.loads(captured.out)
    assert payload["status"] == "ok"
    assert payload["package"] == "example-benign-util"
    # Benign package produces no security finding
    assert payload["finding"] is None


def test_try_classifier_injection_fixture_treats_injection_as_content(capsys):
    """Prompt injection text in page fixture is treated strictly as evidence content, not instructions."""
    fixture_path = Path("backend/fixtures/pages/synthetic_injection.json")
    if not fixture_path.is_file():
        fixture_path = Path("fixtures/pages/synthetic_injection.json")

    code = try_classifier.main(["--fixture", str(fixture_path)])
    captured = capsys.readouterr()

    assert code == 0
    payload = json.loads(captured.out)
    assert payload["status"] == "ok"
    assert payload["package"] == "example-injection-eval"

    # Finding was generated, proving the override instruction was NOT obeyed
    finding = payload["finding"]
    assert finding is not None
    assert finding["status"] != "clean"
    assert finding["severity"] == "high"

    # The prompt-injection quote was treated strictly as evidence quote data
    quote_found = any(
        "SYSTEM OVERRIDE" in s.get("evidence_quote", "")
        for s in finding.get("signals", [])
    )
    assert quote_found is True


def test_try_classifier_detects_classifier_mismatch_and_prints_for_aman_ansh(capsys):
    """When classifier.py does not expose classify(...), reports mismatch for Aman and Ansh without crashing."""
    fixture_path = Path("backend/fixtures/pages/synthetic_benign.json")
    if not fixture_path.is_file():
        fixture_path = Path("fixtures/pages/synthetic_benign.json")

    code = try_classifier.main(["--fixture", str(fixture_path)])
    captured = capsys.readouterr()

    assert code == 0
    assert "[CONTRACT MISMATCH DETECTED for Aman & Ansh]" in captured.err
    assert "Expected contract function: classify" in captured.err
    assert "'classify' is NOT exposed in backend/app/classifier.py" in captured.err


def test_try_classifier_with_contract_conforming_classify(monkeypatch, capsys):
    """When a conforming classify function is available, executes it with patched Gemini call."""
    from app import classifier
    from app.models import Signal

    mock_signal = Signal(
        url="https://docs.example.test/packages/example-benign-util",
        security_relevant=False,
        claim="Conforming test signal",
        version_match="not_affected",
        severity="none",
        credibility=0.5,
        is_original_report=True,
        evidence_quote="",
    )

    async def mock_classify(dep, pages, osv, *, scan_id=None, emit=None):
        return [mock_signal]

    monkeypatch.setattr(classifier, "classify", mock_classify, raising=False)

    fixture_path = Path("backend/fixtures/pages/synthetic_benign.json")
    if not fixture_path.is_file():
        fixture_path = Path("fixtures/pages/synthetic_benign.json")

    code = try_classifier.main(["--fixture", str(fixture_path)])
    captured = capsys.readouterr()

    assert code == 0
    payload = json.loads(captured.out)
    assert payload["status"] == "ok"
    assert payload["classifier_contract_valid"] is True


# ---------------------------------------------------------------------------
# 3. Adversarial Tests
# ---------------------------------------------------------------------------

def test_adversarial_key_redaction_on_exception(monkeypatch, capsys):
    """
    Adversarial test: Google GenAI client raises an exception containing the secret key.
    The exception text in stderr MUST redact the key.
    """
    secret_key = "mock-leak-attack-secret-key-9876543210"
    monkeypatch.setenv("GEMINI_API_KEY", secret_key)
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)

    mock_client = MagicMock()
    mock_client.models.list.side_effect = RuntimeError(
        f"API Error 403: Forbidden for key {secret_key} on endpoint"
    )

    mock_genai = MagicMock()
    mock_genai.Client.return_value = mock_client
    monkeypatch.setitem(sys.modules, "google.genai", mock_genai)

    code = list_gemini_models.main(["--list"])
    captured = capsys.readouterr()

    assert code == 1
    assert "Error querying Gemini models" in captured.err
    # The actual secret key MUST NOT be present in either stream
    assert secret_key not in captured.err
    assert secret_key not in captured.out
    assert "[REDACTED_API_KEY]" in captured.err


def test_adversarial_malformed_fixture_handling(tmp_path, capsys):
    """
    Adversarial test: Passing malformed JSON or invalid schema does not cause
    unhandled crashes or network calls.
    """
    # 1. Invalid JSON
    bad_json_file = tmp_path / "bad.json"
    bad_json_file.write_text("{ unclosed json: true, ", encoding="utf-8")

    code = try_classifier.main(["--fixture", str(bad_json_file)])
    captured = capsys.readouterr()
    assert code == 1
    assert "Error reading fixture JSON" in captured.err

    # 2. Missing pages
    empty_fixture = tmp_path / "empty.json"
    empty_fixture.write_text(json.dumps({"package": "foo"}), encoding="utf-8")

    code2 = try_classifier.main(["--fixture", str(empty_fixture)])
    captured2 = capsys.readouterr()
    assert code2 == 1
    assert "contains no 'pages'" in captured2.err


def test_adversarial_zero_tinyfish_budget_consumed(monkeypatch, capsys):
    """
    Adversarial test: Even with live flags enabled, running scripts consumes zero
    TinyFish budget reservations.
    """
    from app import tinyfish_client as tf

    reservation_attempts = []

    def tracking_reserve(*args, **kwargs):
        reservation_attempts.append((args, kwargs))
        return (True, 1, 1)

    monkeypatch.setattr(tf, "reserve_tinyfish_request", tracking_reserve, raising=False)
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    monkeypatch.setenv("USE_STUBS", "0")

    fixture_path = Path("backend/fixtures/pages/synthetic_benign.json")
    if not fixture_path.is_file():
        fixture_path = Path("fixtures/pages/synthetic_benign.json")

    code = try_classifier.main(["--fixture", str(fixture_path)])
    assert code == 0
    # No TinyFish reservations must ever have been attempted
    assert len(reservation_attempts) == 0


def test_adversarial_whitespace_only_api_key_refuses(monkeypatch, capsys):
    """Whitespace-only API key must be treated as missing and exit with code 2."""
    monkeypatch.setenv("GEMINI_API_KEY", "   \t\n  ")
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)

    code = list_gemini_models.main(["--list"])
    captured = capsys.readouterr()

    assert code == 2
    assert "Refusing to list models: GEMINI_API_KEY is not set" in captured.err


def test_adversarial_invalid_canned_json_path_or_contents(tmp_path, capsys):
    """Non-existent or corrupted canned output file causes safe exit code 1."""
    benign_path = Path("backend/fixtures/pages/synthetic_benign.json")
    if not benign_path.is_file():
        benign_path = Path("fixtures/pages/synthetic_benign.json")

    # 1. Non-existent canned file
    code1 = try_classifier.main([
        "--fixture", str(benign_path),
        "--canned", str(tmp_path / "does_not_exist.json"),
    ])
    captured1 = capsys.readouterr()
    assert code1 == 1
    assert "Canned output file not found" in captured1.err

    # 2. Corrupted canned file
    bad_canned = tmp_path / "bad_canned.json"
    bad_canned.write_text("{ corrupt: json", encoding="utf-8")
    code2 = try_classifier.main([
        "--fixture", str(benign_path),
        "--canned", str(bad_canned),
    ])
    captured2 = capsys.readouterr()
    assert code2 == 1
    assert "Error reading canned output JSON" in captured2.err

