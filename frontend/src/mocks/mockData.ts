import {
  SecurityFinding,
  ScanSummaryMetrics,
  ActivityEvent,
  ScanStageInfo,
} from '@/types';

/**
 * Scan pipeline stage descriptions for realistic bounded progress.
 */
/**
 * Scan pipeline stage descriptions for the finalized 6-step workflow.
 * All stages in demo mode are visibly simulated with deterministic fixtures.
 */
export const MOCK_SCAN_STAGES: ScanStageInfo[] = [
  {
    stage: 'parsing',
    label: '1. Parsing package-lock.json',
    description:
      'Extracting package identities, exact versions, and shortest dependency paths from lockfile manifest...',
    progressPercent: 16,
  },
  {
    stage: 'baseline',
    label: '2. Checking OSV/npm baseline',
    description:
      'Correlating package coordinates against known OSV vulnerability database and npm registry metadata...',
    progressPercent: 33,
  },
  {
    stage: 'signals',
    label: '3. Discovering public threat signals',
    description:
      'Simulating targeted search for emerging security signals across top prioritized direct packages (max 4)...',
    progressPercent: 50,
  },
  {
    stage: 'evidence',
    label: '4. Validating source evidence',
    description:
      'Verifying short quote substrings, checking publication dates, and deduplicating registrable domains...',
    progressPercent: 68,
  },
  {
    stage: 'scoring',
    label: '5. Assigning deterministic risk status',
    description:
      'Applying deterministic multi-source rules to assign WATCH, HIGH, or CRITICAL status without LLM drift...',
    progressPercent: 85,
  },
  {
    stage: 'findings',
    label: '6. Preparing findings',
    description:
      'Synthesizing findings overview, evidence citations, uncertainty notes, and developer remediation steps...',
    progressPercent: 100,
  },
];

/**
 * Synthetic Scan Summary Metrics.
 * Internally consistent with mockFindings (1 Critical, 2 High, 2 Watch, 1 Info, 3 OSV matches).
 */
export const mockSummaryMetrics: ScanSummaryMetrics = {
  totalDependenciesScanned: 384,
  directCount: 22,
  transitiveCount: 362,
  analyzedCount: 4, // Top 4 packages prioritized for deep investigation
  criticalCount: 1,
  highCount: 2,
  watchCount: 2,
  infoCount: 1,
  shieldScore: 78, // Explicitly labelled uncalibrated demo heuristic score
  osvMatchesCount: 3,
  scannedAt: new Date().toISOString(),
  scanDurationMs: 1850,
  isSyntheticDemo: true,
};


/**
 * Rich synthetic security findings across CRITICAL, HIGH, WATCH, and INFO levels.
 * All URLs and advisories use reserved synthetic documentation names (RFC 2606).
 */
export const mockFindings: SecurityFinding[] = [
  {
    id: 'DEP-SYNTH-001',
    title: 'Prototype Pollution via Deep Merge Utility',
    packageName: 'lodash',
    installedVersion: '4.17.20',
    fixedVersion: '4.17.21',
    affectedRange: '< 4.17.21',
    riskLevel: 'CRITICAL',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'lodash@4.17.20'],
    signalCategory: 'Prototype Pollution',
    confidence: 0.98,
    sourceCount: 2, // Deduplicated independent original sources (reposts filtered)
    riskExplanation:
      'The installed version 4.17.20 is susceptible to prototype pollution when merging untrusted input, allowing attackers to modify Object.prototype attributes.',
    deterministicRuleApplied:
      'CRITICAL: >=2 independent original sources confirmed the vulnerability for installed version 4.17.20 with critical impact (CVSS 9.8). Subdomains deduplicated under single registrable domains.',
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
        context: 'Synthetic Vulnerability Corpus (CVE Reference: SYNTH-2026-PROT)',
        source: 'OSV Synthetic Index',
        isSynthetic: true,
        publishedAt: '2020-07-15T18:15:00Z',
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
      {
        quote:
          'Contemporaneous Report: Object.prototype pollution observed in lodash merge with __proto__ payload.',
        context: 'Public Issue Tracker Reproducer',
        source: 'Ecosystem Issue Tracker',
        isSynthetic: true,
        publishedAt: '2020-07-02T14:22:00Z',
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'Open Source Vulnerabilities (OSV) Index',
        sourceType: 'OSV Database',
        safeUrl: 'https://osv.dev/vulnerability/GHSA-p6mc-m468-83gw',
        publishedAt: '2020-07-15T18:15:00Z',
        retrievedAt: '2026-10-24T09:15:00Z',
        isOriginalSource: false,
        provenanceNote: 'Aggregated ecosystem vulnerability database mirror',
      },
      {
        name: 'Public Issue Tracker (Original Reproduction)',
        sourceType: 'Issue Tracker',
        safeUrl: 'https://github.com/lodash/lodash/issues/4759',
        publishedAt: '2020-07-02T14:22:00Z',
        retrievedAt: '2026-10-24T09:15:02Z',
        isOriginalSource: true,
        provenanceNote: 'Primary contemporaneous public bug report',
      },
    ],
    corroborationDetails:
      'Corroborated across 2 distinct registrable domains (osv.dev mirror + github.com issue). Secondary blog reposts excluded from independent source tally.',
    uncertaintyNotes:
      'Public disclosure preceded official advisory by 13 days. Timeline lead-time verified against contemporaneous commit timestamps.',
    remediationGuidance:
      'Update root package.json dependency: "lodash": "^4.17.21" and run `npm update lodash`. No major breaking API modifications exist between 4.17.20 and 4.17.21.',
    recommendedAction: 'Upgrade dependency to lodash@4.17.21 immediately.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:00Z',
  },
  {
    id: 'DEP-SYNTH-002',
    title: 'Arbitrary File Overwrite via Malicious PAX Header in Tar Archive',
    packageName: 'tar',
    installedVersion: '6.1.13',
    fixedVersion: '6.2.1',
    affectedRange: '>= 6.0.0 < 6.2.1',
    riskLevel: 'HIGH',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'tar@6.1.13'],
    signalCategory: 'Path Traversal',
    confidence: 0.91,
    sourceCount: 2,
    riskExplanation:
      'Simulated path traversal vulnerability during archive extraction allows directory escape when encountering specially crafted symlinks in tar headers.',
    deterministicRuleApplied:
      'HIGH: >=2 independent original sources with confirmed version match (< 6.2.1) and high severity (CVSS 7.8).',
    in_osv: true,
    osvLookupState: 'MATCHED',
    advisoryId: 'SYNTH-OSV-2026-144',
    cvssScore: 7.8,
    // Timeline Milestones
    firstSignalAt: '2021-08-01T11:00:00Z',
    officialAdvisoryAt: '2021-08-31T16:00:00Z',
    cvePublishedAt: '2021-09-01T12:15:00Z',
    versionMatchExplanation:
      'Current manifest contains tar 6.1.13. Vulnerability affects all releases prior to 6.2.1 where path normalisation skips leading folder traversal markers.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Telemetry: Unpack operations verify absolute paths but fail to check relative directory symlink chains during extraction.',
        context: 'Synthetic Package Inspection Note',
        source: 'OSV Synthetic Index',
        isSynthetic: true,
        publishedAt: '2021-09-01T12:15:00Z',
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'DepShield Supply Chain Threat Intelligence',
        sourceType: 'Dependency Graph Scanner',
        safeUrl: 'https://osv.dev/vulnerability/GHSA-r628-82hm-mfhg',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:04Z',
        isOriginalSource: true,
        provenanceNote: 'Primary manifest graph correlation analysis',
      },
      {
        name: 'Security Research Advisory Note',
        sourceType: 'Public Advisory',
        safeUrl: 'https://github.com/isaacs/node-tar/security/advisories/GHSA-r628-82hm-mfhg',
        publishedAt: '2021-08-31T16:00:00Z',
        retrievedAt: '2026-10-24T09:15:05Z',
        isOriginalSource: true,
        provenanceNote: 'Vendor security advisory publication',
      },
    ],
    corroborationDetails:
      'Two independent sources corroborated symlink escape vector on Linux extraction runtimes.',
    uncertaintyNotes:
      'Impact depends on whether untrusted archives are unpacked without destination directory sandboxing.',
    remediationGuidance:
      'Update package.json to require "tar": "^6.2.1". Verify that archive unpack routines sanitize destination directories.',
    recommendedAction: 'Bump tar version to ^6.2.1 and sanitize extract destination paths.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:04Z',
  },
  {
    id: 'DEP-SYNTH-003',
    title: 'Authorization Header Leakage across Cross-Origin HTTP Redirects',
    packageName: 'follow-redirects',
    installedVersion: '1.15.4',
    fixedVersion: '1.15.6',
    affectedRange: '< 1.15.6',
    riskLevel: 'HIGH',
    status: 'INVESTIGATING',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'axios@1.6.8', 'follow-redirects@1.15.4'],
    signalCategory: 'Credential Leakage',
    confidence: 0.89,
    sourceCount: 2,
    riskExplanation:
      'Transitive dependency follow-redirects improperly forwards confidential Authorization HTTP headers when following HTTP 302 redirects to different third-party domains.',
    deterministicRuleApplied:
      'HIGH: 2 independent sources with confirmed affected version (< 1.15.6) and high risk CVSS score (7.4).',
    in_osv: true,
    osvLookupState: 'MATCHED',
    advisoryId: 'SYNTH-OSV-2026-219',
    cvssScore: 7.4,
    // Timeline Milestones
    firstSignalAt: '2024-02-12T08:10:00Z',
    officialAdvisoryAt: '2024-03-08T10:00:00Z',
    cvePublishedAt: '2024-03-14T17:15:00Z',
    versionMatchExplanation:
      'Transitively required by axios 1.6.8. The installed version 1.15.4 does not scrub Bearer tokens before resending requests to alternate origin hostnames.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Benchmark: Client credentials forwarded in Authorization header during automatic redirect handling across untrusted cross-origin URLs.',
        context: 'Synthetic Advisory Audit Log',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: '2024-03-14T17:15:00Z',
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'Open Source Vulnerabilities (OSV) Simulated Mirror',
        sourceType: 'OSV Database',
        safeUrl: 'https://osv.dev/vulnerability/GHSA-cxjh-pqwp-8mfp',
        publishedAt: '2024-03-14T17:15:00Z',
        retrievedAt: '2026-10-24T09:15:06Z',
        isOriginalSource: false,
        provenanceNote: 'OSV synchronized upstream security database',
      },
      {
        name: 'Security Advisory: Cross-Origin Token Leak',
        sourceType: 'Independent Security Report',
        safeUrl: 'https://github.com/follow-redirects/follow-redirects/issues/192',
        publishedAt: '2024-02-12T08:10:00Z',
        retrievedAt: '2026-10-24T09:15:07Z',
        isOriginalSource: true,
        provenanceNote: 'Contemporaneous independent vulnerability report',
      },
    ],
    corroborationDetails:
      'Corroborated by independent security report and subsequent vendor advisory notice.',
    uncertaintyNotes:
      'Only affects clients making requests with Authorization headers that follow external redirect targets.',
    remediationGuidance:
      'Add package override in package.json: "overrides": { "follow-redirects": "^1.15.6" } or upgrade axios to the latest stable release.',
    recommendedAction: 'Add package.json override for follow-redirects@^1.15.6.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:06Z',
  },
  {
    id: 'DEP-SYNTH-004',
    title: 'Obfuscated Post-install Script in Synthetic Demonstration Package',
    packageName: 'demo-lifecycle-plugin', // Purely synthetic package name
    installedVersion: '1.0.4',
    fixedVersion: undefined,
    affectedRange: 'N/A (Heuristic Flag)',
    riskLevel: 'WATCH',
    status: 'OPEN',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'express@4.19.2', 'demo-lifecycle-plugin@1.0.4'],
    signalCategory: 'Behavioral Anomaly',
    confidence: 0.76,
    sourceCount: 1, // Single source, capped at WATCH per severity policy
    riskExplanation:
      'Static analysis flagged a lifecycle script pattern that invokes system shells during `npm install`. Flagged by DepShield behavioral heuristics on a synthetic demonstration package.',
    deterministicRuleApplied:
      'WATCH: Exactly 1 source flagged behavioral anomaly. Single-source findings can NEVER exceed WATCH per DepShield scoring policy.',
    in_osv: null, // OSV query not performed (provisional heuristic only)
    osvLookupState: 'PROVISIONAL',
    advisoryId: 'SYNTH-WATCH-2026-004',
    cvssScore: 5.2,
    firstSignalAt: '2026-10-23T19:40:00Z',
    officialAdvisoryAt: null,
    cvePublishedAt: null,
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
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'DepShield Behavioral Heuristic Analyzer',
        sourceType: 'Registry Heuristics',
        safeUrl: 'https://docs.npmjs.com/cli/v10/using-npm/scripts#life-cycle-scripts',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:08Z',
        isOriginalSource: true,
        provenanceNote: 'Primary AST syntax rule evaluator',
      },
    ],
    corroborationDetails:
      'Uncorroborated single-source signal. Awaiting independent community or advisory verification.',
    uncertaintyNotes:
      'Provisional heuristic analysis; script may perform legitimate compilation steps. Manual code audit recommended.',
    remediationGuidance:
      'Run `npm config set ignore-scripts true` in production environments or audit `scripts/verify-env.js` before executing automated CI builds.',
    recommendedAction: 'Audit postinstall script contents or configure `ignore-scripts = true`.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:08Z',
  },
  {
    id: 'DEP-SYNTH-005',
    title: 'Unmaintained Legacy Utility with Zero Publisher Activity in 24 Months',
    packageName: 'inherits',
    installedVersion: '2.0.4',
    fixedVersion: undefined,
    affectedRange: 'N/A (Maintenance Hygiene)',
    riskLevel: 'WATCH',
    status: 'OPEN',
    dependencyType: 'transitive',
    dependencyPath: ['depshield-demo-app', 'express@4.19.2', 'util@0.10.3', 'inherits@2.0.4'],
    signalCategory: 'Maintenance Hygiene',
    confidence: 0.82,
    sourceCount: 1, // Single source, capped at WATCH per severity policy
    riskExplanation:
      'Package has not published an update or security triage commit in over 730 days. Unmaintained legacy utilities present abandonment and takeover risks.',
    deterministicRuleApplied:
      'WATCH: Single-source telemetry check. Does not represent an active exploit, but represents an architectural hygiene watchpoint.',
    in_osv: false, // Explicitly queried in OSV and verified clean
    osvLookupState: 'CLEAN',
    advisoryId: 'SYNTH-HYGIENE-2026-012',
    cvssScore: 4.1,
    firstSignalAt: null,
    officialAdvisoryAt: null,
    cvePublishedAt: null,
    versionMatchExplanation:
      'Clean in OSV vulnerability database. Flagged strictly by supply chain health and maintainer activity telemetry.',
    evidenceQuotes: [
      {
        quote:
          'Simulated Hygiene Metric: Repository last updated over 730 days ago. No active 2FA enforcement verified for package publisher handles.',
        context: 'Ecosystem Maintainer Telemetry',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: null,
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'Supply Chain Hygiene & Provenance Service (Simulated)',
        sourceType: 'Static Manifest Linter',
        safeUrl: 'https://www.npmjs.com/package/inherits',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:10Z',
        isOriginalSource: true,
        provenanceNote: 'Registry maintainer activity telemetry',
      },
    ],
    corroborationDetails:
      'Metric derived directly from public npm registry publish history.',
    uncertaintyNotes:
      'Package is stable and feature-complete; lack of updates does not necessarily imply malicious tampering.',
    remediationGuidance:
      'Consider refactoring to native JavaScript `Object.create` or `class ... extends` to remove legacy polyfill dependency.',
    recommendedAction: 'Verify whether modern ECMAScript class inheritance replaces this package.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:10Z',
  },
  {
    id: 'DEP-SYNTH-006',
    title: 'Permissive Caret Range in Direct Dependency Declaration',
    packageName: 'axios',
    installedVersion: '1.6.8',
    fixedVersion: '1.7.0',
    affectedRange: '^1.6.8',
    riskLevel: 'INFO',
    status: 'OPEN',
    dependencyType: 'direct',
    dependencyPath: ['depshield-demo-app', 'axios@1.6.8'],
    signalCategory: 'Policy Linter',
    confidence: 0.95,
    sourceCount: 1,
    riskExplanation:
      'Direct requirement in package.json uses caret prefix (`^1.6.8`), which permits automatic minor and patch updates on subsequent installs without lockfile pins.',
    deterministicRuleApplied:
      'INFO: Informational policy linter notice. Low operational impact with zero known baseline vulnerabilities.',
    in_osv: false, // Clean in OSV database
    osvLookupState: 'CLEAN',
    advisoryId: 'SYNTH-INFO-2026-099',
    cvssScore: 2.1,
    firstSignalAt: null,
    officialAdvisoryAt: null,
    cvePublishedAt: null,
    versionMatchExplanation:
      'Clean in OSV database. Informational advisory on pinning best practices to prevent supply chain drift.',
    evidenceQuotes: [
      {
        quote:
          'Informational Policy: Caret range `^1.6.8` allows floating dependencies during build-time dependency resolution.',
        context: 'DepShield Supply Chain Policy Rule POL-PIN-01',
        source: 'Static Manifest Linter',
        isSynthetic: true,
        publishedAt: null,
        exactQuoteVerified: true,
        verificationStatus: 'simulated_verified',
      },
    ],
    sources: [
      {
        name: 'DepShield Best Practice Linter',
        sourceType: 'Static Manifest Linter',
        safeUrl: 'https://docs.npmjs.com/about-semantic-versioning',
        publishedAt: null,
        retrievedAt: '2026-10-24T09:15:12Z',
        isOriginalSource: true,
        provenanceNote: 'Static manifest rule evaluator',
      },
    ],
    corroborationDetails:
      'Evaluated from root package.json dependency specification.',
    uncertaintyNotes:
      'Using package-lock.json with `npm ci` mitigates floating dependency risks.',
    remediationGuidance:
      'Pin exact version in package.json ("axios": "1.6.8") or use `npm ci` in continuous integration to strictly enforce package-lock.json.',
    recommendedAction: 'Pin exact dependency versions or ensure CI strictly runs `npm ci`.',
    isSyntheticDemo: true,
    detectedAt: '2026-10-24T09:15:12Z',
  },
];

/**
 * Rich mock activity events covering the 6 distinct workflow stages.
 * Clearly tagged with isSimulated: true.
 */
export const mockActivity: ActivityEvent[] = [
  {
    id: 'ACT-001',
    actionType: 'evidence_analysis',
    title: 'Stage 6: Findings & Remediation Guidance Prepared',
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
    actionType: 'evidence_analysis',
    title: 'Stage 5: Deterministic Scoring Applied',
    description:
      '[Simulated Run] Applied multi-source corroboration rules: assigned 1 CRITICAL, 2 HIGH, 2 WATCH, and 1 INFO finding without LLM drift.',
    timestamp: '10 seconds ago',
    targetPackage: 'Deterministic Rules Engine',
    status: 'success',
    isSimulated: true,
  },
  {
    id: 'ACT-003',
    actionType: 'evidence_analysis',
    title: 'Stage 4: Source Evidence Validated',
    description:
      '[Simulated Run] Verified verbatim evidence quote substrings, checked publication dates, and deduplicated subdomains to registrable domains.',
    timestamp: '25 seconds ago',
    targetPackage: 'Evidence Validator',
    status: 'success',
    isSimulated: true,
  },
  {
    id: 'ACT-004',
    actionType: 'search',
    title: 'Stage 3: Targeted Signal Discovery',
    description:
      '[Simulated Run] Scanned emerging signals across top 4 prioritized packages (lodash, tar, express, axios). Capped at 2 queries/package.',
    timestamp: '40 seconds ago',
    targetPackage: 'Prioritized Scope (<= 4 pkgs)',
    status: 'info',
    isSimulated: true,
    metadata: { packagesChecked: 4, queriesRun: 8 },
  },
  {
    id: 'ACT-005',
    actionType: 'osv_check',
    title: 'Stage 2: OSV & npm Baseline Queried',
    description:
      '[Simulated Run] Correlated package coordinates against OSV vulnerability database. Identified 3 baseline matches (lodash, tar, follow-redirects).',
    timestamp: '55 seconds ago',
    targetPackage: 'OSV / npm Registry',
    status: 'warning',
    isSimulated: true,
    metadata: { queries: 384, matches: 3 },
  },
  {
    id: 'ACT-006',
    actionType: 'parsing',
    title: 'Stage 1: Manifest Parsed (v3 Format)',
    description:
      '[Simulated Run] Successfully ingested package-lock.json. Extracted 22 direct and 362 transitive dependencies without double-counting identities.',
    timestamp: '1 minute ago',
    targetPackage: 'package-lock.json',
    status: 'success',
    isSimulated: true,
    metadata: { format: 'v3', totalDeps: 384 },
  },
];

