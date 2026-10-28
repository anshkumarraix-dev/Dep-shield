"""
DepShield - Pre-commit and Local Secret Scanner.
Scans staged git changes (and optionally working tree) for exposed API keys and secrets.

Security rules:
- NEVER prints, logs, or copies full secrets. Outputs only first 4 chars + length.
- Never reads .env.
- Ignores values containing fake/test/dummy/example/placeholder/xxxx/1234/secret-in-a-test.
- Exits 1 if any REAL-SUSPECT secret is found; exits 0 otherwise.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, List, Tuple

# Repo root relative to this script
_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent.parent

# Phase 1 Secret Detection Patterns
SECRET_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("Google API Key", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
    ("OpenAI / Anthropic Key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("GitHub Personal Access Token", re.compile(r"ghp_[A-Za-z0-9]{30,}")),
    ("GitHub Fine-Grained Token", re.compile(r"github_pat_[A-Za-z0-9_]{30,}")),
    ("Slack Token", re.compile(r"xox[abp]-[A-Za-z0-9-]{10,}")),
    ("AWS Access Key ID", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Private Key Header", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    (
        "Generic Secret Assignment",
        re.compile(
            r"""(?:API_KEY|TOKEN|SECRET|PASSWORD|BEARER)\s*[=:]\s*["']?([A-Za-z0-9_./+-]{16,})""",
            re.IGNORECASE,
        ),
    ),
    (
        "NEXT_PUBLIC Secret Assignment",
        re.compile(
            r"""NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)\s*[=:]\s*["']?([A-Za-z0-9_./+-]{16,})""",
            re.IGNORECASE,
        ),
    ),
]

FAKE_INDICATORS = [
    "fake",
    "test",
    "dummy",
    "example",
    "placeholder",
    "xxxx",
    "1234",
    "secret-in-a-test",
    "mock",
    "sample",
    "todo",
]


def redact(val: str) -> str:
    """Format redacted secret preview: first 4 chars + total length."""
    if len(val) <= 4:
        return f"{val}..."
    return f"{val[:4]}...({len(val)} chars)"


def is_fake(val: str, line_context: str) -> bool:
    """Check if value or line contains explicit fake/test indicators."""
    val_lower = val.lower()
    ctx_lower = line_context.lower()
    for ind in FAKE_INDICATORS:
        if ind in val_lower or ind in ctx_lower:
            return True
    return False


def scan_text(text: str, source_label: str) -> list[dict[str, Any]]:
    """Scan given text lines and return findings."""
    findings = []
    lines = text.splitlines()
    for idx, line in enumerate(lines, start=1):
        for pat_name, pat in SECRET_PATTERNS:
            for match in pat.finditer(line):
                val = match.group(1) if match.lastindex else match.group(0)
                # Ignore short or non-secret identifier words
                if len(val.strip()) < 16 and "PRIVATE KEY" not in pat_name:
                    continue
                if val.isidentifier() and not any(
                    k in pat_name for k in ["Google", "OpenAI", "GitHub", "AWS"]
                ):
                    continue

                if is_fake(val, line):
                    classification = "LIKELY FAKE"
                else:
                    classification = "REAL-SUSPECT"

                findings.append(
                    {
                        "source": source_label,
                        "line": idx,
                        "pattern": pat_name,
                        "preview": redact(val),
                        "classification": classification,
                    }
                )
    return findings


def get_staged_diff(repo_root: Path) -> str:
    """Get unified diff of staged changes."""
    cmd = ["git", "diff", "--cached", "-U0"]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(repo_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            errors="ignore",
        )
        return proc.stdout
    except Exception:
        return ""


def scan_staged_changes(repo_root: Path) -> list[dict[str, Any]]:
    """Scan newly added lines in git staged changes."""
    diff_text = get_staged_diff(repo_root)
    findings = []
    current_file = "staged"
    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            current_file = line[6:].strip()
        elif line.startswith("+") and not line.startswith("+++"):
            added_content = line[1:]
            hits = scan_text(added_content, current_file)
            findings.extend(hits)
    return findings


def scan_working_tree_files(repo_root: Path) -> list[dict[str, Any]]:
    """Scan all working tree files (skipping .git, node_modules, .venv, etc.)."""
    findings = []
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", ".next", "out"}

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            # Rule: NEVER read .env contents
            if f == ".env" or f.startswith(".env.") and not f.endswith(".example"):
                continue
            path = Path(root) / f
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
                rel_path = path.relative_to(repo_root)
                hits = scan_text(content, str(rel_path))
                findings.extend(hits)
            except Exception:
                pass
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="DepShield: Secret scanner for staged changes and working tree."
    )
    parser.add_argument(
        "--working-tree",
        action="store_true",
        help="Scan the entire working tree in addition to staged changes.",
    )
    args = parser.parse_args(argv)

    if args.working_tree:
        findings = scan_working_tree_files(_REPO_ROOT)
        scan_scope = "Working tree files"
    else:
        findings = scan_staged_changes(_REPO_ROOT)
        scan_scope = "Staged git changes"

    real_suspects = [f for f in findings if f["classification"] == "REAL-SUSPECT"]
    likely_fakes = [f for f in findings if f["classification"] == "LIKELY FAKE"]

    print(f"DepShield Secret Scanner ({scan_scope})")
    print("=" * 50)
    print(f"Total findings: {len(findings)} (Real-Suspect: {len(real_suspects)}, Fake/Test: {len(likely_fakes)})")

    if real_suspects:
        print("\n[ALERT] REAL-SUSPECT secrets detected! Commit blocked.")
        print("-" * 50)
        for f in real_suspects:
            print(f"  File: {f['source']}:{f['line']}")
            # codeql[py/clear-text-logging-sensitive-data] Scanner diagnostic output displays redacted pattern metadata only
            print(f"  Type: {f['pattern']}")
            # codeql[py/clear-text-logging-sensitive-data] Scanner diagnostic output displays redacted preview only
            print(f"  Preview: {f['preview']}")
            print()
        return 1

    if likely_fakes:
        print("\n[INFO] Found values marked as test/fake (allowed):")
        for f in likely_fakes:
            # codeql[py/clear-text-logging-sensitive-data] Diagnostic info for allowed fake/test secret pattern
            print(f"  File: {f['source']}:{f['line']} | {f['pattern']}")

    print("\nNo exposed secrets found. Check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
