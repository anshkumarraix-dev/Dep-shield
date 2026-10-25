import {
  SecurityFinding,
  ScanSummaryMetrics,
  ActivityEvent,
  ScanStageInfo,
} from '@/types';

/**
 * Scan pipeline stage descriptions for realistic bounded progress.
 */
export const MOCK_SCAN_STAGES: ScanStageInfo[] = [
  {
    stage: 'parsing',
    label: 'Parsing Manifest & Dependency Tree',
    description: 'Deconstructing package-lock.json packages, resolving direct vs. transitive graph edges...',
    progressPercent: 20,
  },
  {
    stage: 'baseline',
    label: 'Baseline Integrity & Schema Checks',
    description: 'Verifying lockfile format v2/v3, checking sha512 integrity hashes and package registries...',
    progressPercent: 40,
  },
  {
    stage: 'osv_checks',
    label: 'OSV Vulnerability & Registry Telemetry',
    description: 'Querying Open Source Vulnerabilities (OSV) database for package version ranges and known CVEs...',
    progressPercent: 65,
  },
  {
    stage: 'evidence_collection',
    label: 'Supply Chain Evidence & Heuristics',
    description: 'Analyzing pre/postinstall scripts, package age, typo-squatting risks, and anomaly signals...',
    progressPercent: 85,
  },
  {
    stage: 'risk_evaluation',
    label: 'Risk Synthesis & Shield Scoring',
    description: 'Corroborating multi-source telemetry, calculating confidence ratings, and generating remediation guidance...',
    progressPercent: 100,
  },
];

/**
 * Synthetic Scan Summary Metrics.
 */
export const mockSummaryMetrics: ScanSummaryMetrics = {
  totalDependenciesScanned: 384,
  directCount: 22,
  transitiveCount: 362,
  criticalCount: 1,
  highCount: 2,
  watchCount: 2,
  infoCount: 1,
  shieldScore: 78,
  osvMatchesCount: 3,
  scannedAt: new Date().toISOString(),
  isSyntheticDemo: true,
};

/**
 * Rich synthetic security findings across CRITICAL, HIGH, WATCH, and INFO levels.
 * All URLs and advisories use reserved synthetic documentation names (RFC 2606).
 */
export const mockFindings: SecurityFinding[] = [
  {
    id: 'DEP-SYNTH-001',
    title: 'Prototype Pollution via Deep Merge Utility (Synthetic demo data)',
    packageName: 'demo-core',
    installedVersion: '4.17.20',
    fixedVersion: '4.17.21',
    affectedRange: '< 4.17.21',
    riskLevel: 'CRITICAL',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'demo-core@4.17.20'],
    confidence: 0.98,
    sourceCount: 2, // Deduplicated independent original sources (reposts filtered)
    riskExplanation:
      'Synthetic demo data: The installed version 4.17.20 is susceptible to prototype pollution when merging untrusted input, allowing attackers to modify Object.prototype attributes.',
    in_osv: true,
    osvLookupState: 'MATCHED',
    advisoryId: 'SYNTH-OSV-2026-081',
    cvssScore: 9.8,
    // Timeline Milestones
    firstSignalAt: '2020-07-02T14:22:00Z',      // First public issue disclosure
    officialAdvisoryAt: '2020-07-15T09:00:00Z', // Vendor / maintainer security release
    cvePublishedAt: '2020-07-15T18:15:00Z',     // NVD/CVE official publication
    versionMatchExplanation:
      'Lockfile specifies installed version 4.17.20. Synthetic OSV rule SYNTH-OSV-2026-081 matches versions strictly below 4.17.21. Upgrade path is available without breaking changes.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Advisory: Functions zipObjectDeep and merge do not validate prototype property chains during recursive assignment.',
        context: 'Synthetic Vulnerability Corpus (Reference: SYNTH-2026-PROT)',
        source: 'OSV Synthetic Index',
        isSynthetic: true,
        publishedAt: '2020-07-15T18:15:00Z',
        exactQuoteVerified: true,
      },
      {
        quote:
          'Contemporaneous Report: Object.prototype pollution observed in demo-core merge with __proto__ payload.',
        context: 'Public Issue Tracker Reproducer (Synthetic demo data)',
        source: 'Ecosystem Issue Tracker',
        isSynthetic: true,
        publishedAt: '2020-07-02T14:22:00Z',
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'Open Source Vulnerabilities (OSV) Index (Synthetic demo data)',
        sourceType: 'OSV Database',
        safeUrl: 'https://example.com/demo/advisories/SYNTH-OSV-2026-081',
        publishedAt: '2020-07-15T18:15:00Z',
        retrievedAt: '2026-10-24T09:15:00Z',
        isOriginalSource: false,
        provenanceNote: 'Aggregated ecosystem vulnerability database mirror (Synthetic demo data)',
      },
      {
        name: 'Public Issue Tracker (Original Reproduction)',
        sourceType: 'Issue Tracker',
        safeUrl: 'https://example.com/demo/issues/demo-core-merge-proto',
        publishedAt: '2020-07-02T14:22:00Z',
        retrievedAt: '2026-10-24T09:15:02Z',
        isOriginalSource: true,
        provenanceNote: 'Primary contemporaneous public bug report (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Update root package.json dependency: "demo-core": "^4.17.21" and run `npm update demo-core`. No major breaking API modifications exist between 4.17.20 and 4.17.21.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:00Z',
  },
  {
    id: 'DEP-SYNTH-002',
    title: 'Arbitrary File Overwrite via Malicious Header in Archive (Synthetic demo data)',
    packageName: 'demo-archive',
    installedVersion: '6.1.13',
    fixedVersion: '6.2.1',
    affectedRange: '>= 6.0.0 < 6.2.1',
    riskLevel: 'HIGH',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'demo-archive@6.1.13'],
    confidence: 0.91,
    sourceCount: 2,
    riskExplanation:
      'Synthetic demo data: Simulated path traversal vulnerability during archive extraction allows directory escape when encountering specially crafted symlinks in headers.',
    in_osv: true,
    osvLookupState: 'MATCHED',
    advisoryId: 'SYNTH-OSV-2026-144',
    cvssScore: 7.8,
    // Timeline Milestones
    firstSignalAt: '2021-08-01T11:00:00Z',
    officialAdvisoryAt: '2021-08-31T16:00:00Z',
    cvePublishedAt: '2021-09-01T12:15:00Z',
    versionMatchExplanation:
      'Current manifest contains demo-archive 6.1.13. Vulnerability affects all releases prior to 6.2.1 where path normalisation skips leading folder traversal markers.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Telemetry: Unpack operations verify absolute paths but fail to check relative directory symlink chains during extraction.',
        context: 'Synthetic Package Inspection Note (Synthetic demo data)',
        source: 'OSV Synthetic Index',
        isSynthetic: true,
        publishedAt: '2021-09-01T12:15:00Z',
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'DepShield Supply Chain Threat Intelligence (Synthetic demo data)',
        sourceType: 'Dependency Graph Scanner',
        safeUrl: 'https://example.com/demo/advisories/SYNTH-OSV-2026-144',
        publishedAt: null, // Internal scan heuristic date not claimed as historical external publication
        retrievedAt: '2026-10-24T09:15:04Z',
        isOriginalSource: true,
        provenanceNote: 'Primary manifest graph correlation analysis (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Update package.json to require "demo-archive": "^6.2.1". Verify that archive unpack routines sanitize destination directories.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:04Z',
  },
  {
    id: 'DEP-SYNTH-003',
    title: 'Authorization Header Leakage across Cross-Origin HTTP Redirects (Synthetic demo data)',
    packageName: 'demo-transport',
    installedVersion: '1.15.4',
    fixedVersion: '1.15.6',
    affectedRange: '< 1.15.6',
    riskLevel: 'HIGH',
    status: 'INVESTIGATING',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'demo-client@1.6.8', 'demo-transport@1.15.4'],
    confidence: 0.89,
    sourceCount: 2,
    riskExplanation:
      'Synthetic demo data: Transitive dependency demo-transport improperly forwards confidential Authorization HTTP headers when following HTTP 302 redirects to different third-party domains.',
    in_osv: true,
    osvLookupState: 'MATCHED',
    advisoryId: 'SYNTH-OSV-2026-219',
    cvssScore: 7.4,
    // Timeline Milestones
    firstSignalAt: '2024-02-12T08:10:00Z',
    officialAdvisoryAt: '2024-03-08T10:00:00Z',
    cvePublishedAt: '2024-03-14T17:15:00Z',
    versionMatchExplanation:
      'Transitively required by demo-client 1.6.8. The installed version 1.15.4 does not scrub Bearer tokens before resending requests to alternate origin hostnames.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Benchmark: Client credentials forwarded in Authorization header during automatic redirect handling across untrusted cross-origin URLs.',
        context: 'Synthetic Advisory Audit Log (Synthetic demo data)',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: '2024-03-14T17:15:00Z',
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'Open Source Vulnerabilities (OSV) Simulated Mirror (Synthetic demo data)',
        sourceType: 'OSV Database',
        safeUrl: 'https://example.com/demo/advisories/SYNTH-OSV-2026-219',
        publishedAt: '2024-03-14T17:15:00Z',
        retrievedAt: '2026-10-24T09:15:06Z',
        isOriginalSource: false,
        provenanceNote: 'OSV synchronized upstream security database (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Add package override in package.json: "overrides": { "demo-transport": "^1.15.6" } or upgrade demo-client to the latest stable release.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:06Z',
  },
  {
    id: 'DEP-SYNTH-004',
    title: 'Obfuscated Post-install Script in Synthetic Demonstration Package (Synthetic demo data)',
    packageName: 'demo-lifecycle-plugin', // Purely synthetic package name to avoid fake allegations against real packages
    installedVersion: '1.0.4',
    fixedVersion: undefined,
    affectedRange: 'N/A (Heuristic Flag)',
    riskLevel: 'WATCH',
    status: 'OPEN',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'demo-server@4.19.2', 'demo-lifecycle-plugin@1.0.4'],
    confidence: 0.76,
    sourceCount: 1, // Single source, capped at WATCH per severity policy
    riskExplanation:
      'Synthetic demo data: Static analysis flagged a lifecycle script pattern that invokes system shells during `npm install`. Flagged by DepShield behavioral heuristics on a synthetic demonstration package.',
    in_osv: null, // OSV query not performed (provisional heuristic only)
    osvLookupState: 'PROVISIONAL',
    advisoryId: 'SYNTH-WATCH-2026-004',
    cvssScore: 5.2,
    // Timeline Milestones: No official CVE or vendor advisory exists for early provisional signals
    firstSignalAt: '2026-10-23T19:40:00Z',
    officialAdvisoryAt: null, // Unknown / None
    cvePublishedAt: null,     // Unassigned (provisional early signal)
    versionMatchExplanation:
      'No CVE match in standard vulnerability databases; flagged by DepShield Supply-Chain Behavioral Heuristics as an early watch item.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Heuristic: Package declares lifecycle hook `postinstall: node scripts/verify-env.js`. Network socket invocation observed in static AST analysis.',
        context: 'AST Syntax Tree Inspection (Synthetic Test Package)',
        source: 'Registry Heuristics',
        isSynthetic: true,
        publishedAt: null,
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'DepShield Behavioral Heuristic Analyzer (Synthetic demo data)',
        sourceType: 'Registry Heuristics',
        safeUrl: 'https://example.com/demo/heuristics/lifecycle-scripts',
        publishedAt: null, // Local scanner heuristic date is not an external publication
        retrievedAt: '2026-10-24T09:15:08Z',
        isOriginalSource: true,
        provenanceNote: 'Primary AST syntax rule evaluator (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Run `npm config set ignore-scripts true` in production environments or audit `scripts/verify-env.js` before executing automated CI builds.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:08Z',
  },
  {
    id: 'DEP-SYNTH-005',
    title: 'Unmaintained Legacy Utility with Zero Publisher Activity in 24 Months (Synthetic demo data)',
    packageName: 'demo-utils',
    installedVersion: '2.0.4',
    fixedVersion: undefined,
    affectedRange: 'N/A (Maintenance Hygiene)',
    riskLevel: 'WATCH',
    status: 'OPEN',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'demo-server@4.19.2', 'demo-tools@0.10.3', 'demo-utils@2.0.4'],
    confidence: 0.82,
    sourceCount: 1, // Single source, capped at WATCH per severity policy
    riskExplanation:
      'Synthetic demo data: Package has not published an update or security triage commit in over 730 days. Unmaintained legacy utilities present abandonment and takeover risks.',
    in_osv: false, // Explicitly queried in OSV and verified clean
    osvLookupState: 'CLEAN',
    advisoryId: 'SYNTH-HYGIENE-2026-012',
    cvssScore: 4.1,
    // Timeline Milestones: No vulnerability or advisory
    firstSignalAt: null,
    officialAdvisoryAt: null,
    cvePublishedAt: null,
    versionMatchExplanation:
      'Clean in OSV vulnerability database. Flagged strictly by supply chain health and maintainer activity telemetry.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Hygiene Metric: Repository last updated over 730 days ago. No active 2FA enforcement verified for package publisher handles.',
        context: 'Ecosystem Maintainer Telemetry (Synthetic demo data)',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: null,
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'Supply Chain Hygiene & Provenance Service (Synthetic demo data)',
        sourceType: 'Static Manifest Linter',
        safeUrl: 'https://example.com/demo/hygiene/unmaintained-packages',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:10Z',
        isOriginalSource: true,
        provenanceNote: 'Registry maintainer activity telemetry (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Consider refactoring to native JavaScript `Object.create` or `class ... extends` to remove legacy polyfill dependency.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:10Z',
  },
  {
    id: 'DEP-SYNTH-006',
    title: 'Permissive Caret Range in Direct Dependency Declaration (Synthetic demo data)',
    packageName: 'demo-client',
    installedVersion: '1.6.8',
    fixedVersion: '1.7.0',
    affectedRange: '^1.6.8',
    riskLevel: 'INFO',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'demo-client@1.6.8'],
    confidence: 0.95,
    sourceCount: 1,
    riskExplanation:
      'Synthetic demo data: Direct requirement in package.json uses caret prefix (`^1.6.8`), which permits automatic minor and patch updates on subsequent installs without lockfile pins.',
    in_osv: false, // Clean in OSV database
    osvLookupState: 'CLEAN',
    advisoryId: 'SYNTH-INFO-2026-099',
    cvssScore: 2.1,
    // Timeline Milestones: Informational best practice only
    firstSignalAt: null,
    officialAdvisoryAt: null,
    cvePublishedAt: null,
    versionMatchExplanation:
      'Clean in OSV database. Informational advisory on pinning best practices to prevent supply chain drift.',
    evidenceQuotes: [
      {
        quote:
          'Informational Policy: Caret range `^1.6.8` allows floating dependencies during build-time dependency resolution.',
        context: 'DepShield Supply Chain Policy Rule POL-PIN-01 (Synthetic demo data)',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: null,
        exactQuoteVerified: true,
      },
    ],
    sources: [
      {
        name: 'DepShield Best Practice Linter (Synthetic demo data)',
        sourceType: 'Static Manifest Linter',
        safeUrl: 'https://example.com/demo/policies/exact-pinning',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:12Z',
        isOriginalSource: true,
        provenanceNote: 'Static manifest rule evaluator (Synthetic demo data)',
      },
    ],
    remediationGuidance:
      'Pin exact version in package.json ("demo-client": "1.6.8") or use `npm ci` in continuous integration to strictly enforce package-lock.json.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:12Z',
  },
];

/**
 * Rich mock activity events covering parsing, OSV checks, Search, Fetch, and Evidence Analysis.
 * Clearly tagged with isSimulated: true.
 */
export const mockActivity: ActivityEvent[] = [
  {
    id: 'ACT-001',
    actionType: 'evidence_analysis',
    title: 'Evidence Correlation & Synthesis Finalized',
    description:
      '[Simulated Run] Evaluated 6 supply-chain findings across 384 resolved packages. Generated risk scores and remediation matrix.',
    timestamp: 'Just now',
    targetPackage: 'depshield-demo-app',
    status: 'success',
    isSimulated: true,
    metadata: { findingsCount: 6, overallScore: 78 },
  },
  {
    id: 'ACT-002',
    actionType: 'osv_check',
    title: 'OSV Match: demo-core@4.17.20 Flagged (CRITICAL)',
    description:
      '[Simulated Run] Correlated installed version against simulated OSV feed entry SYNTH-OSV-2026-081 (Prototype Pollution).',
    timestamp: '15 seconds ago',
    targetPackage: 'demo-core@4.17.20',
    status: 'flagged',
    isSimulated: true,
    metadata: { cve: 'SYNTH-OSV-2026-081', cvss: 9.8 },
  },
  {
    id: 'ACT-003',
    actionType: 'search',
    title: 'Search: Threat Intelligence Vector Scan',
    description:
      '[Simulated Run] Checked registry hashes against known malicious campaigns and typo-squatting namespaces.',
    timestamp: '35 seconds ago',
    targetPackage: 'registry/npm',
    status: 'info',
    isSimulated: true,
    metadata: { packagesChecked: 384, matches: 0 },
  },
  {
    id: 'ACT-004',
    actionType: 'fetch',
    title: 'Fetch: Registry Integrity Metadata Queried',
    description:
      '[Simulated Run] Retrieved cryptographic signatures and publisher attestations for transitive node_modules.',
    timestamp: '50 seconds ago',
    targetPackage: 'node_modules/demo-archive',
    status: 'info',
    isSimulated: true,
    metadata: { verifiedHashes: 384 },
  },
  {
    id: 'ACT-005',
    actionType: 'osv_check',
    title: 'OSV Batch Query Completed',
    description:
      '[Simulated Run] Batch query submitted for 384 package coordinates against Open Source Vulnerability mock index.',
    timestamp: '1 minute ago',
    targetPackage: 'all-dependencies',
    status: 'warning',
    isSimulated: true,
    metadata: { queries: 384, hits: 3 },
  },
  {
    id: 'ACT-006',
    actionType: 'parsing',
    title: 'Manifest Parse: package-lock.json v3 Validated',
    description:
      '[Simulated Run] Successfully ingested lockfile structure. Identified 22 direct and 362 transitive dependencies.',
    timestamp: '2 minutes ago',
    targetPackage: 'package-lock.json',
    status: 'success',
    isSimulated: true,
    metadata: { format: 'v3', totalDeps: 384 },
  },
];
