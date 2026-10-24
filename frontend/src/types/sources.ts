/**
 * Dependency Source and Repository Manifest Interfaces for DepShield
 * Note: Types marked [PROVISIONAL] will be finalized against the FastAPI backend endpoints.
 */

export type SourceType = 'package.json' | 'requirements.txt' | 'Pipfile' | 'go.mod' | 'pom.xml' | 'Cargo.toml' | 'lockfile' | 'custom';

export interface DependencySource {
  id: string;
  name: string;
  filePath: string;
  sourceType: SourceType;
  ecosystem: string;
  totalDependenciesCount: number;
  lastScannedAt: string;
  
  /**
   * [PROVISIONAL]: Source repository details if scanned from a remote git provider.
   */
  repository?: {
    url: string;
    branch: string;
    commitHash?: string;
  };

  /**
   * [PROVISIONAL]: Calculated health score (0-100) representing manifest hygiene.
   */
  healthScore?: number;
}
