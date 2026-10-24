"""Lockfile parser for npm package-lock.json v2 and v3.

Owner: Ansh.
Extracts:
- Direct and transitive dependencies
- Nested node_modules resolution
- Deduplication by name@version
- Shortest dependency path from root project
- Strict validation with informative ValueError
"""
from __future__ import annotations

import json
from collections import deque
from typing import Any

from .models import Dependency


def _extract_pkg_name(path: str, meta: dict[str, Any]) -> str:
    """Extract package name from metadata or path."""
    if meta.get("name"):
        return meta["name"]
    # Path is e.g. "node_modules/foo" or "node_modules/@scope/bar"
    # or "node_modules/a/node_modules/b"
    parts = path.split("node_modules/")
    last_part = parts[-1]
    return last_part


def parse_lockfile(lockfile_text: str) -> list[Dependency]:
    """Parse a package-lock.json string into a list of unique Dependency objects."""
    if not lockfile_text or not lockfile_text.strip():
        raise ValueError("package-lock.json content is empty")

    try:
        data = json.loads(lockfile_text)
    except Exception as e:
        raise ValueError(f"Invalid JSON in package-lock.json: {e}") from e

    if not isinstance(data, dict):
        raise ValueError("package-lock.json must be a JSON object")  # noqa: TRY004

    lockfile_version = data.get("lockfileVersion")
    if lockfile_version not in (2, 3, "2", "3"):
        raise ValueError(
            f"Unsupported lockfileVersion: {lockfile_version}. DepShield supports lockfileVersion 2 and 3."
        )

    packages = data.get("packages")
    if packages is None or not isinstance(packages, dict):
        raise ValueError("Corrupt package-lock.json: missing 'packages' map")

    root_meta = packages.get("", {})
    root_name = root_meta.get("name") or data.get("name") or "root"

    # Identify declared direct dependency names from root package
    direct_dep_names: set[str] = set()
    for key in ("dependencies", "devDependencies", "optionalDependencies"):
        deps = root_meta.get(key, {})
        if isinstance(deps, dict):
            direct_dep_names.update(deps.keys())

    # Build path-to-pkg metadata mapping for non-root packages
    # Also index packages by name to resolve dependencies
    # path -> (name, version, dependencies_dict)
    path_map: dict[str, tuple[str, str, dict[str, str]]] = {}
    name_to_paths: dict[str, list[str]] = {}

    for path, meta in packages.items():
        if not path or not isinstance(meta, dict):
            continue  # Skip root or invalid entries

        version = meta.get("version")
        if not version:
            continue

        name = _extract_pkg_name(path, meta)
        deps = meta.get("dependencies", {})
        if not isinstance(deps, dict):
            deps = {}

        path_map[path] = (name, str(version), deps)
        name_to_paths.setdefault(name, []).append(path)

    # Resolve child path according to npm node_modules hierarchy
    def resolve_child_path(parent_path: str, child_name: str) -> str | None:
        """Find the matching node_modules path for child_name required by parent_path."""
        if parent_path:
            # Check nested first: parent_path/node_modules/child_name
            nested = f"{parent_path}/node_modules/{child_name}"
            if nested in path_map:
                return nested

            # Check upward in parent directory hierarchy
            parts = parent_path.split("/node_modules/")
            for i in range(len(parts) - 1, 0, -1):
                candidate = "/node_modules/".join(parts[:i]) + f"/node_modules/{child_name}"
                if candidate in path_map:
                    return candidate

        # Top-level fallback: node_modules/child_name
        top_level = f"node_modules/{child_name}"
        if top_level in path_map:
            return top_level

        # Fallback to any known path for that name
        candidates = name_to_paths.get(child_name, [])
        if candidates:
            return candidates[0]
        return None

    # BFS from root to compute shortest dependency paths
    # Queue items: (current_path, current_dep_path)
    # For root: path is "", dep_path is [root_name]
    shortest_paths_by_path: dict[str, list[str]] = {}
    visited_paths: set[str] = set()

    queue: deque[tuple[str, list[str]]] = deque()

    # Seed root's direct dependencies
    root_deps: dict[str, str] = {}
    for key in ("dependencies", "devDependencies", "optionalDependencies"):
        deps = root_meta.get(key, {})
        if isinstance(deps, dict):
            root_deps.update(deps)

    for dep_name in root_deps:
        child_path = resolve_child_path("", dep_name)
        if child_path and child_path in path_map:
            c_name, c_ver, _ = path_map[child_path]
            dep_step = f"{c_name}@{c_ver}"
            p = [root_name, dep_step]
            shortest_paths_by_path[child_path] = p
            visited_paths.add(child_path)
            queue.append((child_path, p))

    # Also include any top-level node_modules/package whose name was in direct_dep_names
    for path, (name, version, _) in path_map.items():
        if path not in visited_paths and name in direct_dep_names and path == f"node_modules/{name}":
            p = [root_name, f"{name}@{version}"]
            shortest_paths_by_path[path] = p
            visited_paths.add(path)
            queue.append((path, p))

    # BFS traversal
    while queue:
        curr_path, curr_chain = queue.popleft()
        if curr_path not in path_map:
            continue
        _, _, child_deps = path_map[curr_path]

        for child_name in child_deps:
            child_path = resolve_child_path(curr_path, child_name)
            if child_path and child_path in path_map and child_path not in visited_paths:
                visited_paths.add(child_path)
                c_name, c_ver, _ = path_map[child_path]
                new_chain = curr_chain + [f"{c_name}@{c_ver}"]
                shortest_paths_by_path[child_path] = new_chain
                queue.append((child_path, new_chain))

    # Fallback for unreached packages in path_map (isolated or unlinked)
    for path, (name, version, _) in path_map.items():
        if path not in shortest_paths_by_path:
            shortest_paths_by_path[path] = [root_name, f"{name}@{version}"]

    # Deduplicate by (name, version)
    # Multiple paths may resolve to the same name@version
    # Preserve direct=True if any instance was direct, and keep shortest dep_path
    deduped: dict[tuple[str, str], Dependency] = {}

    for path, (name, version, _) in path_map.items():
        key = (name, version)
        dep_path = shortest_paths_by_path.get(path, [root_name, f"{name}@{version}"])
        is_direct = (name in direct_dep_names) and (len(dep_path) == 2)

        if key not in deduped:
            deduped[key] = Dependency(
                name=name,
                version=version,
                ecosystem="npm",
                direct=is_direct,
                dep_path=dep_path,
            )
        else:
            existing = deduped[key]
            # Update direct flag
            if is_direct:
                existing.direct = True
            # Update to shorter dep_path if found
            if len(dep_path) < len(existing.dep_path):
                existing.dep_path = dep_path

    # Sort results: direct dependencies first, then alphabetically by name
    result = list(deduped.values())
    result.sort(key=lambda d: (0 if d.direct else 1, d.name, d.version))
    return result
