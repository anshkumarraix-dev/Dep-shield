/**
 * Scan and Lockfile Information Interfaces for DepShield
 */

export type ScanStage =
  | 'idle'
  | 'parsing'
  | 'baseline'
  | 'signals'
  | 'evidence'
  | 'scoring'
  | 'findings'
  | 'completed'
  | 'failed';

export interface ScanStageInfo {
  stage: ScanStage;
  label: string;
  description: string;
  progressPercent: number;
}

export interface ParsedDependency {
  name: string;
  version: string;
  direct: boolean;
  depPath: string[];
  analyzed: boolean; // True if prioritized in top <=4 deep investigation scope
}

export interface LockfileParsedSummary {
  fileName: string;
  fileSizeBytes: number;
  lockfileVersion: number;
  projectName?: string;
  projectVersion?: string;
  totalPackagesDetected: number;
  directDependenciesCount: number;
  transitiveDependenciesCount: number;
  parsedAt: string;
  isSyntheticSample: boolean;
  packages: ParsedDependency[];
  analyzedPackages: ParsedDependency[];
  warningMessage?: string;
}

export interface ScanSummaryMetrics {
  totalDependenciesScanned: number;
  directCount: number;
  transitiveCount: number;
  analyzedCount: number; // packages selected for detailed analysis (<= 4)
  criticalCount: number;
  highCount: number;
  watchCount: number;
  infoCount: number;
  shieldScore: number; // 0 - 100 overall score (explicitly labelled demo heuristic)
  osvMatchesCount: number;
  scannedAt: string;
  scanDurationMs?: number;
  isSyntheticDemo: boolean;
}

export interface ScanProgressState {
  stage: ScanStage;
  stageLabel: string;
  progressPercent: number;
  currentMessage: string;
  elapsedMs: number;
  stageIndex?: number;
  totalStages?: number;
}

