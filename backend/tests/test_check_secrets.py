"""
Offline tests for backend/scripts/check_secrets.py.
Ensures secret detection, output redaction, and that full secrets never appear in output.
"""
from __future__ import annotations

import socket
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from scripts import check_secrets


@pytest.fixture(autouse=True)
def block_network_sockets(monkeypatch):
    """Ensure no network connections during offline tests."""
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


def test_clean_file_passes():
    """A clean file produces no findings and returns exit code 0."""
    clean_text = """
    def add(a, b):
        return a + b
    # Regular safe comments
    URL = "https://example.com/api"
    """
    findings = check_secrets.scan_text(clean_text, "safe.py")
    assert len(findings) == 0


def test_fake_secret_detected_as_likely_fake():
    """Values containing fake/test/dummy are classified as LIKELY FAKE and allowed."""
    fake_secret = "AIzaSyFakeTestPlaceholderKey1234567890123"
    code = f'API_KEY = "{fake_secret}"'
    findings = check_secrets.scan_text(code, "test_file.py")
    assert len(findings) > 0
    assert all(f["classification"] == "LIKELY FAKE" for f in findings)
    assert any("AIza...(41 chars)" in f["preview"] for f in findings)


def test_real_suspect_secret_blocked_and_redacted(capsys, monkeypatch):
    """
    Real-suspect secret raises alert and exits with code 1.
    The FULL secret MUST NEVER appear in stdout or stderr.
    """
    # A synthetic test value without fake/dummy/1234 keywords to trigger REAL-SUSPECT logic
    test_secret = "AIzaSyOperationalKeyAlphaNumeric876543"
    diff_output = f"""
diff --git a/app/config.py b/app/config.py
--- a/app/config.py
+++ b/app/config.py
@@ -1,1 +1,2 @@
+GEMINI_KEY = "{test_secret}"
"""
    monkeypatch.setattr(check_secrets, "get_staged_diff", lambda *args: diff_output)

    exit_code = check_secrets.main([])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "REAL-SUSPECT secrets detected! Commit blocked." in captured.out
    # Full secret MUST NOT be printed in either stdout or stderr
    assert test_secret not in captured.out
    assert test_secret not in captured.err
    # Redacted preview MUST appear
    assert "AIza...(38 chars)" in captured.out


def test_full_secret_never_logged_even_on_fake(capsys, monkeypatch):
    """Even for fake secrets, check_secrets never prints the raw full token."""
    fake_token = "ghp_FakeTokenForTesting12345678901234"
    diff_output = f"""
+GITHUB_TOKEN = "{fake_token}"
"""
    monkeypatch.setattr(check_secrets, "get_staged_diff", lambda *args: diff_output)

    exit_code = check_secrets.main([])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert fake_token not in captured.out
    assert fake_token not in captured.err
    assert "ghp_...(37 chars)" in captured.out
