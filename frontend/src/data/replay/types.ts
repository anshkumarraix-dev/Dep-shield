/**
 * Types for Replay Cases and Incident Room Evidence
 */

export interface ReplayEvidenceItem {
  id: string;
  timestamp: string; // ISO or HH:mm:ss UTC
  timeSeconds: number; // For non-decreasing order check & scrubber position
  lane: 'public_signals' | 'registry_reality';
  sourceName: string;
  sourceDomain: string;
  sourceUrl: string;
  isIndependentOriginal: boolean;
  exactVersionMatched: boolean;
  packageTargeted: string;
  versionTargeted: string;
  excerpt: string;
  quote: string; // MUST be a strict verbatim substring of excerpt
  category: 'commit' | 'comment' | 'advisory' | 'blog' | 'registry_publish' | 'investigation';
  isQuoteVerified: boolean;
  notes?: string;
}

export interface IocItem {
  id: string;
  indicator: string;
  defanged: string; // Defanged string, e.g. "npm-cache[.]com" (NEVER clickable)
  type: 'c2_domain' | 'ip' | 'payload_hash' | 'script_file';
  notes: string;
}

export interface ScaleDisagreement {
  source: string;
  claim: string;
  citationUrl: string;
}

export interface ReplayCase {
  id: string;
  title: string;
  dateStr: string;
  asOfDate: string;
  description: string;
  headlinePackage: string;
  headlineVersion: string;
  directDependency: boolean;
  mechanism: string;
  cveStatus: string; // "not verified" if unknown
  reconstructedDisclaimer: string;
  leadTime: {
    firstSignalTime: string;
    registryPublishTime: string;
    computedDisplay: string;
    description: string;
  };
  disputedScale: ScaleDisagreement[];
  iocs: IocItem[];
  timeline: ReplayEvidenceItem[];
  lockfileContent: string;
}
