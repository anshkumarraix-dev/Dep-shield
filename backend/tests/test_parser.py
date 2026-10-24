"""Unit tests for lockfile parser (lockfileVersion 2 and 3)."""
import json

import pytest
from app.parser import parse_lockfile


def test_invalid_json():
    with pytest.raises(ValueError, match="Invalid JSON"):
        parse_lockfile("{ not json }")

    with pytest.raises(ValueError, match="empty"):
        parse_lockfile("")


def test_unsupported_lockfile_version():
    content = json.dumps({"name": "legacy-app", "lockfileVersion": 1, "dependencies": {}})
    with pytest.raises(ValueError, match="Unsupported lockfileVersion"):
        parse_lockfile(content)


def test_missing_packages():
    content = json.dumps({"name": "app", "lockfileVersion": 2})
    with pytest.raises(ValueError, match="missing 'packages' map"):
        parse_lockfile(content)


def test_valid_lockfile_v2():
    lockfile_data = {
        "name": "my-service",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "my-service",
                "version": "1.0.0",
                "dependencies": {
                    "express": "^4.18.2"
                },
                "devDependencies": {
                    "@types/node": "^20.0.0"
                }
            },
            "node_modules/express": {
                "version": "4.18.2",
                "dependencies": {
                    "qs": "6.11.0"
                }
            },
            "node_modules/qs": {
                "version": "6.11.0"
            },
            "node_modules/@types/node": {
                "version": "20.11.0"
            }
        }
    }

    deps = parse_lockfile(json.dumps(lockfile_data))
    assert len(deps) == 3

    # Check direct dependencies
    dep_map = {d.name: d for d in deps}
    assert dep_map["express"].direct is True
    assert dep_map["express"].version == "4.18.2"
    assert dep_map["express"].dep_path == ["my-service", "express@4.18.2"]

    assert dep_map["@types/node"].direct is True
    assert dep_map["@types/node"].version == "20.11.0"
    assert dep_map["@types/node"].dep_path == ["my-service", "@types/node@20.11.0"]

    # Check transitive dependency
    assert dep_map["qs"].direct is False
    assert dep_map["qs"].version == "6.11.0"
    assert dep_map["qs"].dep_path == ["my-service", "express@4.18.2", "qs@6.11.0"]


def test_nested_node_modules_and_deduplication():
    lockfile_data = {
        "name": "complex-app",
        "lockfileVersion": 3,
        "packages": {
            "": {
                "name": "complex-app",
                "dependencies": {
                    "pkg-a": "1.0.0",
                    "pkg-b": "1.0.0"
                }
            },
            "node_modules/pkg-a": {
                "version": "1.0.0",
                "dependencies": {
                    "shared-dep": "2.0.0"
                }
            },
            "node_modules/pkg-b": {
                "version": "1.0.0",
                "dependencies": {
                    "shared-dep": "2.0.0"
                }
            },
            "node_modules/pkg-a/node_modules/shared-dep": {
                "name": "shared-dep",
                "version": "2.0.0"
            },
            "node_modules/shared-dep": {
                "name": "shared-dep",
                "version": "2.0.0"
            }
        }
    }

    deps = parse_lockfile(json.dumps(lockfile_data))
    # Must deduplicate shared-dep@2.0.0
    shared_deps = [d for d in deps if d.name == "shared-dep"]
    assert len(shared_deps) == 1
    assert shared_deps[0].version == "2.0.0"
    assert shared_deps[0].direct is False
