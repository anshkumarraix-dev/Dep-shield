/**
 * Scan and Lockfile Information Interfaces for DepShield
 */

export type ScanStage =
  | 'idle'
  | 'parsing'
  | 'baseline'
  | 'osv_checks'
  | 'evidence_collection'
  | 'risk_evaluation'
  | 'completed'
  | 'failed';

export interface ScanStageInfo {
  stage: ScanStage;
  label: string;
  description: string;
  progressPercent: number;
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
}

export interface ScanSummaryMetrics {
  totalDependenciesScanned: number;
  directCount: number;
  transitiveCount: number;
  criticalCount: number;
  highCount: number;
  watchCount: number;
  infoCount: number;
  shieldScore: number; // 0 - 100 overall score
  osvMatchesCount: number;
  scannedAt: string;
  isSyntheticDemo: boolean;
}

export interface ScanProgressState {
  stage: ScanStage;
  stageLabel: string;
  progressPercent: number;
  currentMessage: string;
  elapsedMs: number;
}
