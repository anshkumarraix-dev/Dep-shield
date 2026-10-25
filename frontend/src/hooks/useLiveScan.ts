/**
 * Custom React Hook: useLiveScan
 * Owns scan state: status, progress, findings, activity events, dependencies,
 * error, packagesFailed, and health banner metadata.
 * Works seamlessly in both MOCK mode (default) and LIVE/STUB FastAPI backend mode.
 * Contains zero JSX, CSS, or Tailwind classes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { envConfig } from '@/config/env';
import {
  liveScansService,
  BackendHealthResponse,
  LiveScanStreamEvent,
} from '@/services/liveScansService';
import { scansService } from '@/services/scansService';
import { parseLockfileContent } from '@/services/lockfileParser';
import { SecurityFinding, ActivityEvent, ParsedDependency } from '@/types';

export type ScanStatus = 'idle' | 'running' | 'done' | 'error';
export type ScanMode = 'mock' | 'stub' | 'live';

export interface HealthBannerInfo {
  mode: ScanMode;
  modeLabel: string;
  isMock: boolean;
  isStub: boolean;
  isLive: boolean;
  unitsUsed: number;
  totalCap: number;
  developmentCap: number;
  geminiModel?: string;
  rawHealth?: BackendHealthResponse;
}

export interface ScanProgressInfo {
  packagesTotal: number;
  packagesDone: number;
  currentPackage?: string;
  percent: number;
}

export interface UseLiveScanReturn {
  status: ScanStatus;
  mode: ScanMode;
  healthBannerInfo: HealthBannerInfo;
  progress: ScanProgressInfo;
  findings: SecurityFinding[];
  activityEvents: ActivityEvent[];
  dependencies: ParsedDependency[];
  error: string | null;
  packagesFailed: number;
  honestEmptyStateMessage: string;
  partialScanWarning: string | null;
  currentScanId: string | null;
  startScan: (lockfileText: string, fileName?: string) => Promise<void>;
  startReplayScan: (caseId: string) => Promise<void>;
  triggerDeepResearch: (findingId: string) => Promise<void>;
  resetScan: () => void;
}

const HONEST_EMPTY_STATE_DISCLAIMER =
  'no public warning signal found among the sources checked. This is not proof the package is safe.';

export function useLiveScan(): UseLiveScanReturn {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [dependencies, setDependencies] = useState<ParsedDependency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [packagesFailed, setPackagesFailed] = useState<number>(0);

  const [progress, setProgress] = useState<ScanProgressInfo>({
    packagesTotal: 0,
    packagesDone: 0,
    percent: 0,
  });

  const [healthBannerInfo, setHealthBannerInfo] = useState<HealthBannerInfo>({
    mode: 'mock',
    modeLabel: 'DEMO MODE (mock)',
    isMock: true,
    isStub: false,
    isLive: false,
    unitsUsed: 0,
    totalCap: 64,
    developmentCap: 48,
    geminiModel: 'gemini-2.0-flash',
  });

  const sseCleanupRef = useRef<(() => void) | null>(null);

  // Unsubscribe on unmount
  useEffect(() => {
    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
        sseCleanupRef.current = null;
      }
    };
  }, []);

  // Fetch health and mode metadata
  useEffect(() => {
    let ignore = false;
    async function initHealth() {
      if (envConfig.useMocks) {
        if (!ignore) {
          setHealthBannerInfo({
            mode: 'mock',
            modeLabel: 'DEMO MODE (mock)',
            isMock: true,
            isStub: false,
            isLive: false,
            unitsUsed: 0,
            totalCap: 64,
            developmentCap: 48,
            geminiModel: 'gemini-2.0-flash',
          });
        }
        return;
      }

      try {
        const health = await liveScansService.getHealth();
        if (ignore) return;

        let mode: ScanMode = 'live';
        let modeLabel = `LIVE MODE (${health.units_used} / ${health.total_cap} units used)`;

        if (health.use_stubs) {
          mode = 'stub';
          modeLabel = 'BACKEND STUB MODE - SYNTHETIC FINDINGS';
        } else if (!health.tinyfish_live_enabled) {
          mode = 'stub';
          modeLabel = 'BACKEND STUB MODE - SYNTHETIC FINDINGS';
        }

        setHealthBannerInfo({
          mode,
          modeLabel,
          isMock: false,
          isStub: mode === 'stub',
          isLive: mode === 'live',
          unitsUsed: health.units_used,
          totalCap: health.total_cap,
          developmentCap: health.development_cap,
          geminiModel: health.gemini_model,
          rawHealth: health,
        });
      } catch {
        if (ignore) return;
        setHealthBannerInfo({
          mode: 'stub',
          modeLabel: 'BACKEND OFFLINE - DEMO FALLBACK',
          isMock: true,
          isStub: true,
          isLive: false,
          unitsUsed: 0,
          totalCap: 64,
          developmentCap: 48,
        });
      }
    }

    void initHealth();
    return () => {
      ignore = true;
    };
  }, []);

  const resetScan = useCallback(() => {
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
      sseCleanupRef.current = null;
    }
    setStatus('idle');
    setCurrentScanId(null);
    setFindings([]);
    setActivityEvents([]);
    setError(null);
    setPackagesFailed(0);
    setProgress({ packagesTotal: 0, packagesDone: 0, percent: 0 });
  }, []);

  /**
   * Starts a lockfile scan (MOCK simulation vs LIVE/STUB FastAPI endpoint)
   */
  const startScan = useCallback(
    async (lockfileText: string, fileName = 'package-lock.json') => {
      resetScan();
      setStatus('running');

      // Local parsing of dependency inventory
      try {
        const summary = parseLockfileContent(lockfileText, fileName);
        setDependencies(summary.packages);
        setProgress({
          packagesTotal: Math.min(4, summary.packages.length),
          packagesDone: 0,
          percent: 10,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid package-lock.json');
        setStatus('error');
        return;
      }

      // If in Mock Mode: run client-side deterministic simulation
      if (envConfig.useMocks) {
        try {
          const summary = parseLockfileContent(lockfileText, fileName, true);
          const result = await scansService.simulateScan(summary, (p) => {
            setProgress({
              packagesTotal: 4,
              packagesDone: Math.round((p.progressPercent / 100) * 4),
              currentPackage: p.activePackage,
              percent: p.progressPercent,
            });
          });
          setFindings(result.findings);
          setActivityEvents(result.activity);
          setStatus('done');
          setProgress({ packagesTotal: 4, packagesDone: 4, percent: 100 });
        } catch (simErr) {
          setError(simErr instanceof Error ? simErr.message : 'Simulation failed');
          setStatus('error');
        }
        return;
      }

      // Live / Stub Mode: Upload to FastAPI backend and subscribe to SSE
      try {
        const scanId = await liveScansService.uploadScan(lockfileText, fileName);
        setCurrentScanId(scanId);

        // Fetch initial dependency tree from backend if available
        liveScansService
          .getDependencies(scanId)
          .then((depGraph) => {
            if (depGraph.nodes && depGraph.nodes.length > 0) {
              const mapped: ParsedDependency[] = depGraph.nodes.map((n) => ({
                name: n.name,
                version: n.version,
                type: n.direct ? 'direct' : 'transitive',
                direct: n.direct,
                depPath: n.dep_path || [n.name],
                analyzed: Boolean(n.analyzed),
                hasInstallScript: Boolean(n.hasInstallScript),
              }));
              setDependencies(mapped);
            }
          })
          .catch(() => {
            // Keep local parsed inventory
          });

        // Subscribe to SSE
        const cleanup = liveScansService.subscribeScanEvents(
          scanId,
          (event: LiveScanStreamEvent) => {
            if (event.type === 'activity') {
              setActivityEvents((prev) => [event.data, ...prev]);
            } else if (event.type === 'finding') {
              setFindings((prev) => {
                if (prev.some((f) => f.id === event.data.id)) return prev;
                return [...prev, event.data];
              });
            } else if (event.type === 'progress') {
              const { packages_total, packages_done, package: currentPkg } = event.data;
              const pct = packages_total > 0 ? Math.round((packages_done / packages_total) * 100) : 0;
              setProgress({
                packagesTotal: packages_total,
                packagesDone: packages_done,
                currentPackage: currentPkg,
                percent: pct,
              });
            } else if (event.type === 'done') {
              setStatus('done');
              setProgress((prev) => ({ ...prev, percent: 100 }));
            } else if (event.type === 'error') {
              setError(event.data.error);
              setStatus('error');
            }
          },
          () => {
            // Error in SSE connection: fallback to polling /api/scans/{id}
            liveScansService.getScan(scanId).then((res) => {
              if (res.findings) setFindings(res.findings);
              if (res.scan.status === 'done') setStatus('done');
            });
          }
        );

        sseCleanupRef.current = cleanup;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend scan endpoint.');
        setStatus('error');
      }
    },
    [resetScan]
  );

  /**
   * Starts a Replay Case Scan
   */
  const startReplayScan = useCallback(
    async (caseId: string) => {
      resetScan();
      setStatus('running');

      if (envConfig.useMocks) {
        setStatus('done');
        return;
      }

      try {
        const scanId = await liveScansService.startReplayScan(caseId);
        setCurrentScanId(scanId);

        const cleanup = liveScansService.subscribeScanEvents(scanId, (event) => {
          if (event.type === 'activity') {
            setActivityEvents((prev) => [event.data, ...prev]);
          } else if (event.type === 'finding') {
            setFindings((prev) => {
              if (prev.some((f) => f.id === event.data.id)) return prev;
              return [...prev, event.data];
            });
          } else if (event.type === 'progress') {
            const { packages_total, packages_done, package: currentPkg } = event.data;
            const pct = packages_total > 0 ? Math.round((packages_done / packages_total) * 100) : 0;
            setProgress({
              packagesTotal: packages_total,
              packagesDone: packages_done,
              currentPackage: currentPkg,
              percent: pct,
            });
          } else if (event.type === 'done') {
            setStatus('done');
            setProgress((prev) => ({ ...prev, percent: 100 }));
          } else if (event.type === 'error') {
            setError(event.data.error);
            setStatus('error');
          }
        });

        sseCleanupRef.current = cleanup;
      } catch (err) {
        setError(err instanceof Error ? err.message : `Replay failed for ${caseId}`);
        setStatus('error');
      }
    },
    [resetScan]
  );

  /**
   * Deep research action
   */
  const triggerDeepResearch = useCallback(
    async (findingId: string) => {
      if (!currentScanId || envConfig.useMocks) return;
      try {
        const updated = await liveScansService.triggerResearch(currentScanId, findingId);
        setFindings((prev) => prev.map((f) => (f.id === findingId ? updated : f)));
      } catch {
        // preserve existing finding
      }
    },
    [currentScanId]
  );

  // Partial scan failure banner (N packages could not be analysed)
  const partialScanWarning =
    packagesFailed > 0
      ? `${packagesFailed} package${packagesFailed === 1 ? '' : 's'} could not be analysed (not checked, not safe)`
      : null;

  return {
    status,
    mode: healthBannerInfo.mode,
    healthBannerInfo,
    progress,
    findings,
    activityEvents,
    dependencies,
    error,
    packagesFailed,
    honestEmptyStateMessage: HONEST_EMPTY_STATE_DISCLAIMER,
    partialScanWarning,
    currentScanId,
    startScan,
    startReplayScan,
    triggerDeepResearch,
    resetScan,
  };
}
