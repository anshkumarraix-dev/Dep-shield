/**
 * Security Finding Interfaces for DepShield Supply-Chain Threat Intelligence
 * All data in mock mode uses reserved synthetic demonstration models.
 */

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'WATCH' | 'INFO';

export type FindingStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'DISMISSED';

export type OsvLookupState = 'MATCHED' | 'CLEAN' | 'PROVISIONAL' | 'UNKNOWN';

export type DependencyType = 'direct' | 'transitive';

/**
 * Resolves OSV state preserving the critical distinction between:
 * - true: matched in OSV database
 * - false: queried OSV and verified clean (zero advisories)
 * - null/undefined: OSV query not performed or unsupported (provisional / heuristic only)
 */
export function resolveOsvState(in_osv?: boolean | null): OsvLookupState {
  if (in_osv === true) return 'MATCHED';
  if (in_osv === false) return 'CLEAN';
  if (in_osv === null || in_osv === undefined) return 'PROVISIONAL';
  return 'UNKNOWN';
}

export type QuoteVerificationStatus =
  | 'simulated_verified'
  | 'unverified'
  | 'conflicting'
  | 'unknown';

export interface EvidenceQuote {
  quote: string;
  context: string;
  source: string;
  isSynthetic: boolean;
  publishedAt?: string | null;
  exactQuoteVerified?: boolean;
  verificationStatus?: QuoteVerificationStatus;
}

export interface SourceMetadata {
  name: string;
  sourceType:
    | 'OSV Database'
    | 'Static Manifest Linter'
    | 'Registry Heuristics'
    | 'Dependency Graph Scanner'
    | 'Public Advisory'
    | 'Issue Tracker'
    | 'Maintainer Advisory'
    | 'Independent Security Report'
    | 'Discussion Forum';
  safeUrl?: string;
  publishedAt?: string | null; // Null if unknown / unrecorded
  retrievedAt: string;         // When telemetry was retrieved
  isOriginalSource?: boolean;  // Original source vs syndicated repost
  provenanceNote?: string;
}

export interface SecurityFinding {
  id: string;
  title: string;
  packageName: string;
  installedVersion: string;
  fixedVersion?: string;
  affectedRange?: string;
  riskLevel: RiskLevel;
  status: FindingStatus;
  dependencyType: DependencyType;
  dependencyPath: string[]; // e.g. ["my-app", "express", "accepts", "negotiator"]
  
  // Threat & Evidence Metrics
  signalCategory: string; // e.g. "Malicious Dependency Injection", "Prototype Pollution", "Account Hijack"
  quoteVerification?: QuoteVerificationStatus; // Quote verification state
  confidence: number; // 0.0 - 1.0 (uncalibrated heuristic rule score, e.g. 0.92)
  sourceCount: number; // Count of deduplicated independent original sources
  riskExplanation: string;
  deterministicRuleApplied?: string; // Concise explanation of deterministic scoring logic

  /**
   * Tri-state OSV indicator:
   * - true: Matched in OSV vulnerability database
   * - false: Explicitly queried in OSV and verified clean
   * - null: OSV query was not performed (provisional / heuristic only)
   */
  in_osv: boolean | null;
  osvLookupState: OsvLookupState;

  advisoryId?: string; // e.g. "SYNTH-OSV-2026-081"
  cvssScore?: number;

  // Timeline Milestones (distinct: public signal, official advisory, CVE publication)
  firstSignalAt?: string | null;      // First public threat signal timestamp, or null if unknown
  officialAdvisoryAt?: string | null; // First vendor/maintainer advisory timestamp, or null
  cvePublishedAt?: string | null;     // Official CVE assignment/publication timestamp, or null

  // Evidence Drawer Details
  versionMatchExplanation: string;
  evidenceQuotes: EvidenceQuote[];
  sources: SourceMetadata[];
  corroborationDetails?: string;
  uncertaintyNotes?: string;
  remediationGuidance: string;
  recommendedAction?: string;

  // Metadata
  isSyntheticDemo: boolean;
  detectedAt: string;
}


export interface FindingsFilterOptions {
  riskLevel?: RiskLevel | 'ALL';
  dependencyType?: DependencyType | 'ALL';
  searchQuery?: string;
}
