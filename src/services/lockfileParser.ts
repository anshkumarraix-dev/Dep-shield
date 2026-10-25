import { LockfileParsedSummary } from '@/types';

export interface LockfileValidationResult {
  valid: boolean;
  error?: string;
  summary?: LockfileParsedSummary;
}

/**
 * Validates and extracts basic structure from npm package-lock.json (v2 or v3).
 */
export function validateAndParsePackageLock(
  content: string,
  fileName = 'package-lock.json',
  isSyntheticSample = false
): LockfileValidationResult {
  if (!content || !content.trim()) {
    return {
      valid: false,
      error: 'The uploaded file is empty. Please provide a valid package-lock.json file.',
    };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Syntax error';
    return {
      valid: false,
      error: `Invalid JSON format: ${message}. Make sure the file is a well-formed package-lock.json.`,
    };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      valid: false,
      error: 'Invalid file structure: Expected a root JSON object in package-lock.json.',
    };
  }

  // Validate lockfileVersion
  const lockfileVersion = data.lockfileVersion;
  if (lockfileVersion === undefined || lockfileVersion === null) {
    return {
      valid: false,
      error: 'Missing "lockfileVersion" attribute. This does not appear to be an npm package-lock.json.',
    };
  }

  if (lockfileVersion === 1) {
    return {
      valid: false,
      error: 'Detected npm package-lock v1 (legacy). DepShield requires package-lock format v2 or v3 (npm 7+). Run `npm install --package-lock-only` to upgrade.',
    };
  }

  if (lockfileVersion !== 2 && lockfileVersion !== 3) {
    return {
      valid: false,
      error: `Unsupported lockfileVersion (${String(lockfileVersion)}). DepShield supports package-lock v2 and v3.`,
    };
  }

  // Validate packages object
  const packages = data.packages as Record<string, Record<string, unknown>> | undefined;
  if (!packages || typeof packages !== 'object') {
    return {
      valid: false,
      error: 'Missing or malformed "packages" map. In npm v2/v3, packages must contain dependency tree descriptors.',
    };
  }

  // Calculate dependency counts
  const rootPackage = packages[''] || {};
  const rootDependencies = (rootPackage.dependencies as Record<string, string>) || (data.dependencies as Record<string, string>) || {};
  const rootDevDependencies = (rootPackage.devDependencies as Record<string, string>) || (data.devDependencies as Record<string, string>) || {};
  
  const directDepsCount = Object.keys(rootDependencies).length + Object.keys(rootDevDependencies).length;
  const allPackageKeys = Object.keys(packages).filter((k) => k !== '');
  const totalPackages = allPackageKeys.length > 0 ? allPackageKeys.length : Object.keys(rootDependencies).length;
  const transitiveDepsCount = Math.max(0, totalPackages - directDepsCount);

  const projectName = (rootPackage.name as string) || (data.name as string) || 'unnamed-project';
  const projectVersion = (rootPackage.version as string) || (data.version as string) || '1.0.0';

  const summary: LockfileParsedSummary = {
    fileName,
    fileSizeBytes: new Blob([content]).size,
    lockfileVersion: Number(lockfileVersion),
    projectName,
    projectVersion,
    totalPackagesDetected: totalPackages,
    directDependenciesCount: directDepsCount,
    transitiveDependenciesCount: transitiveDepsCount,
    parsedAt: new Date().toISOString(),
    isSyntheticSample,
  };

  return {
    valid: true,
    summary,
  };
}

/**
 * Built-in synthetic sample package-lock.json for instant demo/replay.
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
          "demo-server": "^4.19.2",
          "demo-client": "^1.6.8",
          "demo-core": "^4.17.20",
          "demo-auth": "^9.0.0",
          "demo-archive": "^6.1.13"
        },
        devDependencies: {
          "typescript": "^5.4.5",
          "eslint": "^8.57.0",
          "jest": "^29.7.0"
        }
      },
      "node_modules/demo-core": {
        "version": "4.17.20",
        "resolved": "https://example.com/demo/packages/demo-core-4.17.20.tgz",
        "integrity": "sha512-synth-integrity-demo-core-hash-only=="
      },
      "node_modules/demo-archive": {
        "version": "6.1.13",
        "resolved": "https://example.com/demo/packages/demo-archive-6.1.13.tgz",
        "integrity": "sha512-synth-integrity-demo-archive-hash-only=="
      },
      "node_modules/demo-client": {
        "version": "1.6.8",
        "resolved": "https://example.com/demo/packages/demo-client-1.6.8.tgz",
        "integrity": "sha512-synth-integrity-demo-client-hash-only=="
      },
      "node_modules/demo-server": {
        "version": "4.19.2",
        "resolved": "https://example.com/demo/packages/demo-server-4.19.2.tgz",
        "integrity": "sha512-synth-integrity-demo-server-hash-only=="
      },
      "node_modules/demo-lifecycle-plugin": {
        "version": "1.0.4",
        "resolved": "https://example.com/demo/packages/demo-lifecycle-plugin-1.0.4.tgz",
        "integrity": "sha512-synth-integrity-demo-lifecycle-plugin-hash=="
      },
      "node_modules/demo-transport": {
        "version": "1.15.4",
        "resolved": "https://example.com/demo/packages/demo-transport-1.15.4.tgz",
        "integrity": "sha512-synth-integrity-demo-transport-hash=="
      }
    }
  },
  null,
  2
);
