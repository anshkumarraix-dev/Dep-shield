import { LockfileParsedSummary, ParsedDependency } from '@/types';

export interface LockfileValidationResult {
  valid: boolean;
  error?: string;
  summary?: LockfileParsedSummary;
}

function extractPackageName(pkgPath: string, meta: Record<string, unknown>): string {
  if (typeof meta.name === 'string' && meta.name.trim()) {
    return meta.name.trim();
  }
  const parts = pkgPath.split('node_modules/');
  return parts[parts.length - 1] || pkgPath;
}

/**
 * Validates and extracts full dependency inventory from npm package-lock.json (v2 or v3).
 * Performs local client-side parsing without external network transmission.
 */
export function validateAndParsePackageLock(
  content: string,
  fileName = 'package-lock.json',
  isSyntheticSample = false,
  parsedAt?: string
): LockfileValidationResult {
  if (!content || !content.trim()) {
    return {
      valid: false,
      error: 'The uploaded file is empty. Please select a valid package-lock.json file.',
    };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Syntax error';
    return {
      valid: false,
      error: `Invalid JSON syntax: ${message}. Make sure the file is an untruncated package-lock.json.`,
    };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      valid: false,
      error: 'Invalid file format: Expected a root JSON object in package-lock.json.',
    };
  }

  // Validate lockfileVersion (number or string representation of 2 or 3)
  const rawVersion = data.lockfileVersion;
  if (rawVersion === undefined || rawVersion === null) {
    return {
      valid: false,
      error: 'Missing "lockfileVersion" attribute. This file does not appear to be an npm package-lock.',
    };
  }

  const numericVersion = Number(rawVersion);
  if (numericVersion === 1) {
    return {
      valid: false,
      error: 'Detected npm package-lock v1 (legacy format). DepShield requires package-lock format v2 or v3 (npm 7+). Run `npm install --package-lock-only` in your project to upgrade.',
    };
  }

  if (numericVersion !== 2 && numericVersion !== 3) {
    return {
      valid: false,
      error: `Unsupported lockfileVersion: "${String(rawVersion)}". DepShield supports lockfileVersion 2 and 3.`,
    };
  }

  // Validate packages object
  const packages = data.packages as Record<string, Record<string, unknown>> | undefined;
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    return {
      valid: false,
      error: 'Missing or corrupt "packages" map in package-lock.json.',
    };
  }

  const rootMeta = packages[''] || {};
  const projectName =
    (typeof rootMeta.name === 'string' && rootMeta.name) ||
    (typeof data.name === 'string' && data.name) ||
    'unnamed-project';
  const projectVersion =
    (typeof rootMeta.version === 'string' && rootMeta.version) ||
    (typeof data.version === 'string' && data.version) ||
    '1.0.0';

  // Identify direct dependency names declared in the root package
  const directNames = new Set<string>();
  const directDepSections = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
  for (const section of directDepSections) {
    const depsObj = (rootMeta[section] || data[section]) as Record<string, unknown> | undefined;
    if (depsObj && typeof depsObj === 'object') {
      Object.keys(depsObj).forEach((name) => directNames.add(name));
    }
  }

  let warningMessage: string | undefined;
  if (directNames.size === 0 && Object.keys(packages).length > 1) {
    warningMessage =
      'Root dependency manifests were not explicitly declared; top-level node_modules entries are treated as direct dependencies.';
  }

  // Extract all package entries deduplicating by package identity (name@version)
  const dedupeMap = new Map<string, ParsedDependency>();
  const allParsed: ParsedDependency[] = [];

  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!pkgPath || typeof meta !== 'object' || meta === null) {
      continue; // Skip root project entry
    }

    const version = typeof meta.version === 'string' ? meta.version : '';
    if (!version) {
      continue; // Incomplete package record
    }

    const name = extractPackageName(pkgPath, meta);
    const isDirect = directNames.size > 0 ? directNames.has(name) : !pkgPath.includes('/node_modules/');

    // Build human-readable shortest dependency path
    const pathParts = pkgPath.split('node_modules/').filter(Boolean);
    const depPath: string[] = [projectName];
    if (pathParts.length > 0) {
      pathParts.forEach((part, idx) => {
        const cleanPart = part.replace(/\/$/, '');
        if (idx === pathParts.length - 1) {
          depPath.push(`${cleanPart}@${version}`);
        } else {
          depPath.push(cleanPart);
        }
      });
    } else {
      depPath.push(`${name}@${version}`);
    }

    const pkgKey = `${name}@${version}`;
    const hasInstallScript = Boolean(meta.hasInstallScript);
    if (!dedupeMap.has(pkgKey)) {
      const depItem: ParsedDependency = {
        name,
        version,
        type: isDirect ? 'direct' : 'transitive',
        direct: isDirect,
        depPath,
        analyzed: false,
        hasInstallScript,
      };
      dedupeMap.set(pkgKey, depItem);
      allParsed.push(depItem);
    }
  }

  // Sort: direct dependencies first, then alphabetical by name
  allParsed.sort((a, b) => {
    if (a.direct && !b.direct) return -1;
    if (!a.direct && b.direct) return 1;
    return a.name.localeCompare(b.name);
  });

  // Accurate direct and transitive counts without double-counting identities
  const directCount = allParsed.filter((p) => p.direct).length;
  const transitiveCount = allParsed.length - directCount;

  // Prioritize top <= 4 packages for deep analysis (exact parity with backend MAX_PACKAGES_ANALYZED_PER_SCAN)
  const maxAnalyzedScope = 4;
  const analyzedPackages = allParsed.slice(0, maxAnalyzedScope).map((p) => {
    p.analyzed = true;
    return p;
  });

  const summary: LockfileParsedSummary = {
    fileName,
    fileSizeBytes: new TextEncoder().encode(content).length,
    lockfileVersion: numericVersion,
    projectName,
    projectVersion,
    totalPackagesDetected: allParsed.length,
    directDependenciesCount: directCount,
    transitiveDependenciesCount: transitiveCount,
    parsedAt: parsedAt || '2026-10-25T00:00:00.000Z',
    isSyntheticSample,
    packages: allParsed,
    analyzedPackages,
    warningMessage,
  };

  return {
    valid: true,
    summary,
  };
}

/**
 * Convenience helper to parse lockfile content and return the summary directly.
 */
export function parseLockfileContent(
  content: string,
  fileName = 'package-lock.json',
  isSyntheticSample = false
): LockfileParsedSummary {
  const res = validateAndParsePackageLock(content, fileName, isSyntheticSample);
  if (!res.valid || !res.summary) {
    throw new Error(res.error || 'Failed to parse package-lock.json');
  }
  return res.summary;
}

/**
 * Built-in synthetic sample package-lock.json (npm v3) for instant demo/replay.
 * Accurately represents a modern Node.js service with direct & transitive dependencies.
 */
export const SAMPLE_DEMO_PACKAGE_LOCK = JSON.stringify(
  {
    name: "depshield-demo-app",
    version: "2.1.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "depshield-demo-app",
        version: "2.1.0",
        dependencies: {
          "express": "^4.19.2",
          "lodash": "^4.17.20",
          "tar": "^6.1.13",
          "axios": "^1.6.8",
          "jsonwebtoken": "^9.0.0"
        },
        devDependencies: {
          "typescript": "^5.4.5",
          "eslint": "^8.57.0"
        }
      },
      "node_modules/lodash": {
        "version": "4.17.20",
        "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz",
        "integrity": "sha512-synth-integrity-lodash-demo-hash=="
      },
      "node_modules/tar": {
        "version": "6.1.13",
        "resolved": "https://registry.npmjs.org/tar/-/tar-6.1.13.tgz",
        "integrity": "sha512-synth-integrity-tar-demo-hash=="
      },
      "node_modules/express": {
        "version": "4.19.2",
        "resolved": "https://registry.npmjs.org/express/-/express-4.19.2.tgz",
        "integrity": "sha512-synth-integrity-express-demo-hash==",
        "dependencies": {
          "accepts": "~1.3.8",
          "cookie": "0.6.0",
          "qs": "6.11.0"
        }
      },
      "node_modules/axios": {
        "version": "1.6.8",
        "resolved": "https://registry.npmjs.org/axios/-/axios-1.6.8.tgz",
        "integrity": "sha512-synth-integrity-axios-demo-hash==",
        "dependencies": {
          "follow-redirects": "^1.15.4"
        }
      },
      "node_modules/jsonwebtoken": {
        "version": "9.0.0",
        "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-9.0.0.tgz",
        "integrity": "sha512-synth-integrity-jwt-demo-hash=="
      },
      "node_modules/accepts": {
        "version": "1.3.8",
        "resolved": "https://registry.npmjs.org/accepts/-/accepts-1.3.8.tgz",
        "integrity": "sha512-synth-integrity-accepts-hash=="
      },
      "node_modules/cookie": {
        "version": "0.6.0",
        "resolved": "https://registry.npmjs.org/cookie/-/cookie-0.6.0.tgz",
        "integrity": "sha512-synth-integrity-cookie-hash=="
      },
      "node_modules/qs": {
        "version": "6.11.0",
        "resolved": "https://registry.npmjs.org/qs/-/qs-6.11.0.tgz",
        "integrity": "sha512-synth-integrity-qs-hash=="
      },
      "node_modules/follow-redirects": {
        "version": "1.15.4",
        "resolved": "https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.15.4.tgz",
        "integrity": "sha512-synth-integrity-follow-redirects-hash=="
      },
      "node_modules/typescript": {
        "version": "5.4.5",
        "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.4.5.tgz",
        "integrity": "sha512-synth-integrity-typescript-hash=="
      },
      "node_modules/eslint": {
        "version": "8.57.0",
        "resolved": "https://registry.npmjs.org/eslint/-/eslint-8.57.0.tgz",
        "integrity": "sha512-synth-integrity-eslint-hash=="
      }
    }
  },
  null,
  2
);

/**
 * Built-in synthetic sample package-lock.json (npm v2) for legacy node microservice.
 */
export const SAMPLE_LEGACY_PACKAGE_LOCK = JSON.stringify(
  {
    name: "legacy-auth-service",
    version: "1.4.2",
    lockfileVersion: 2,
    requires: true,
    packages: {
      "": {
        name: "legacy-auth-service",
        version: "1.4.2",
        dependencies: {
          "jsonwebtoken": "8.5.1",
          "lodash": "4.17.19",
          "minimist": "1.2.5",
          "ws": "7.4.5"
        }
      },
      "node_modules/jsonwebtoken": {
        "version": "8.5.1",
        "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-8.5.1.tgz"
      },
      "node_modules/lodash": {
        "version": "4.17.19",
        "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.19.tgz"
      },
      "node_modules/minimist": {
        "version": "1.2.5",
        "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.5.tgz"
      },
      "node_modules/ws": {
        "version": "7.4.5",
        "resolved": "https://registry.npmjs.org/ws/-/ws-7.4.5.tgz"
      }
    }
  },
  null,
  2
);


