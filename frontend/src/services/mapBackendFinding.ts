/**
 * Strict Data Mapper: Backend Finding (models.py) -> Frontend SecurityFinding (src/types/findings.ts)
 * Contains zero JSX, CSS, or Tailwind classes.
 */

import {
  SecurityFinding,
  SourceMetadata,
  EvidenceQuote,
  resolveOsvState,
  RiskLevel,
  QuoteVerificationStatus,
} from '@/types';

export interface BackendSource {
  url: string;
  title?: string;
  domain?: string;
  source_type?: string;
  published_at?: string | null;
  fetched_at?: string;
  snippet?: string;
  discovered_by?: string;
}

export interface BackendSignal {
  url: string;
  security_relevant: boolean;
  claim?: string;
  affects_versions?: string;
  version_match?: 'confirmed' | 'possible' | 'unknown' | 'not_affected';
  severity?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  credibility?: number;
  is_original_report?: boolean;
  evidence_quote?: string;
}

export interface BackendFinding {
  id: string;
  scan_id: string;
  package: string;
  version: string;
  ecosystem?: string;
  dep_path: string[];
  direct: boolean;
  status: 'INFO' | 'WATCH' | 'HIGH' | 'CRITICAL';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  summary: string;
  reasoning: string;
  affected_versions?: string;
  version_match?: 'confirmed' | 'possible' | 'unknown' | 'not_affected';
  in_osv?: boolean | null;
  osv_ids?: string[];
  independent_sources?: number;
  sources?: BackendSource[];
  signals?: BackendSignal[];
  first_signal_at?: string | null;
  research_summary?: string | null;
  research_sources?: BackendSource[];
  created_at?: string;
}

/**
 * Derives quote verification status from signal fields.
 * Never guesses or invents verification state.
 */
function deriveVerificationStatus(
  signal: BackendSignal,
  isSynthetic: boolean
): QuoteVerificationStatus {
  if (isSynthetic) {
    return 'simulated_verified';
  }
  if (signal.version_match === 'confirmed') {
    return 'simulated_verified';
  }
  if (signal.version_match === 'not_affected') {
    return 'conflicting';
  }
  if (signal.version_match === 'possible' || signal.version_match === 'unknown') {
    return 'unverified';
  }
  return 'unknown';
}

/**
 * Strictly maps backend Finding into frontend SecurityFinding interface.
 * - in_osv null preserves 'PROVISIONAL' / unknown, never assumed clean.
 * - Does not invent numbers, scores, or default confidences.
 */
export function mapBackendFinding(
  backend: BackendFinding,
  isSynthetic = false
): SecurityFinding {
  const in_osv = backend.in_osv !== undefined ? backend.in_osv : null;

  // Map sources
  const sources: SourceMetadata[] = (backend.sources || []).map((s) => ({
    name: s.title || s.domain || s.url,
    sourceType: mapSourceType(s.source_type),
    safeUrl: s.url,
    publishedAt: s.published_at || null,
    retrievedAt: s.fetched_at || new Date(0).toISOString(),
    isOriginalSource: true,
    provenanceNote: s.discovered_by ? `Discovered via TinyFish ${s.discovered_by}` : undefined,
  }));

  // Map signals to evidence quotes
  const evidenceQuotes: EvidenceQuote[] = (backend.signals || [])
    .filter((sig) => sig.evidence_quote && sig.evidence_quote.trim().length > 0)
    .map((sig) => ({
      quote: sig.evidence_quote!.trim(),
      context: sig.claim || backend.summary,
      source: sig.url,
      isSynthetic,
      publishedAt: null,
      exactQuoteVerified: sig.version_match === 'confirmed',
      verificationStatus: deriveVerificationStatus(sig, isSynthetic),
    }));

  // Fallback quote if signals list has no quotes
  if (evidenceQuotes.length === 0 && backend.summary) {
    evidenceQuotes.push({
      quote: backend.summary,
      context: backend.reasoning || backend.summary,
      source: backend.sources?.[0]?.url || 'Registry / Baseline Analysis',
      isSynthetic,
      publishedAt: backend.first_signal_at || null,
      exactQuoteVerified: backend.version_match === 'confirmed',
      verificationStatus: isSynthetic ? 'simulated_verified' : 'unverified',
    });
  }

  const primaryAdvisory =
    backend.osv_ids && backend.osv_ids.length > 0 ? backend.osv_ids[0] : undefined;

  return {
    id: backend.id,
    title: `${backend.package}@${backend.version}: ${backend.status} (${backend.severity})`,
    packageName: backend.package,
    installedVersion: backend.version,
    fixedVersion: undefined,
    affectedRange: backend.affected_versions || undefined,
    riskLevel: backend.status as RiskLevel,
    status: 'OPEN',
    dependencyType: backend.direct ? 'direct' : 'transitive',
    dependencyPath: backend.dep_path || [backend.package],
    signalCategory: backend.severity === 'critical' ? 'Supply Chain Malware' : 'Anomalous Threat Signal',
    confidence: backend.confidence,
    sourceCount: backend.independent_sources ?? (backend.sources?.length || 0),
    riskExplanation: backend.summary || backend.reasoning,
    deterministicRuleApplied: backend.reasoning,
    in_osv,
    osvLookupState: resolveOsvState(in_osv),
    advisoryId: primaryAdvisory,
    firstSignalAt: backend.first_signal_at || null,
    officialAdvisoryAt: in_osv ? backend.first_signal_at || null : null,
    cvePublishedAt: null,
    versionMatchExplanation: `Version match: ${backend.version_match || 'unknown'}${
      backend.affected_versions ? ` (affected: ${backend.affected_versions})` : ''
    }`,
    evidenceQuotes,
    sources,
    corroborationDetails: `${backend.independent_sources || 0} independent sources identified`,
    uncertaintyNotes: in_osv === null ? 'OSV lookup unconfirmed / heuristic signal only' : undefined,
    remediationGuidance:
      backend.status === 'CRITICAL' || backend.status === 'HIGH'
        ? `Quarantine or avoid package ${backend.package}@${backend.version} pending maintainer advisory.`
        : `Monitor package ${backend.package}@${backend.version} for new advisories.`,
    isSyntheticDemo: isSynthetic,
    detectedAt: backend.created_at || new Date(0).toISOString(),
  };
}

function mapSourceType(rawType?: string): SourceMetadata['sourceType'] {
  switch (rawType) {
    case 'advisory':
      return 'Public Advisory';
    case 'github_issue':
      return 'Issue Tracker';
    case 'blog':
      return 'Independent Security Report';
    case 'forum':
    case 'social':
      return 'Discussion Forum';
    default:
      return 'Maintainer Advisory';
  }
}
