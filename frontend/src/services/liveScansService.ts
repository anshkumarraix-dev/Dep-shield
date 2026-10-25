/**
 * Live Scans Service for DepShield
 * Handles FastAPI HTTP communications and SSE event streams.
 * Contains zero JSX, CSS, or Tailwind classes.
 */

import { envConfig } from '@/config/env';
import { mapBackendFinding, BackendFinding } from './mapBackendFinding';
import { SecurityFinding, ActivityEvent } from '@/types';

export interface BackendHealthResponse {
  status: string;
  use_stubs: boolean;
  tinyfish_live_enabled: boolean;
  tinyfish_budget_stage: string;
  units_used: number;
  development_cap: number;
  total_cap: number;
  gemini_model?: string;
}

export interface BackendReplayCase {
  id: string;
  title: string;
  description: string;
  as_of_date: string;
}

export interface BackendScanResponse {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  mode: 'upload' | 'replay';
  replay_case?: string | null;
  as_of_date?: string | null;
  created_at: string;
  packages_total: number;
  packages_done: number;
  error?: string | null;
}

export interface BackendDependencyGraph {
  nodes: Array<{
    id: string;
    name: string;
    version: string;
    direct: boolean;
    dep_path: string[];
    analyzed?: boolean;
    hasInstallScript?: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
  }>;
}

export type LiveScanStreamEvent =
  | { type: 'activity'; data: ActivityEvent }
  | { type: 'finding'; data: SecurityFinding }
  | { type: 'progress'; data: { packages_total: number; packages_done: number; package?: string } }
  | { type: 'done'; data: { scan_id: string } }
  | { type: 'error'; data: { error: string } };

class LiveScansService {
  private get baseUrl(): string {
    return envConfig.apiUrl.replace(/\/$/, '');
  }

  /**
   * Health check and mode metadata from /api/health
   */
  async getHealth(): Promise<BackendHealthResponse> {
    if (envConfig.useMocks) {
      return {
        status: 'ok',
        use_stubs: true,
        tinyfish_live_enabled: false,
        tinyfish_budget_stage: 'development',
        units_used: 0,
        development_cap: 48,
        total_cap: 64,
        gemini_model: 'gemini-2.0-flash',
      };
    }

    const res = await fetch(`${this.baseUrl}/api/health`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Health check failed: HTTP ${res.status}`);
    }
    return (await res.json()) as BackendHealthResponse;
  }

  /**
   * Replay cases list from /api/replay
   */
  async getReplayCases(): Promise<BackendReplayCase[]> {
    if (envConfig.useMocks) {
      return [
        {
          id: 'chaindrop-2026',
          title: 'ChainDrop npm Worm (Aug 2026)',
          description: 'Self-propagating worm compromising keyv and Cacheable family packages',
          as_of_date: '2026-08-04',
        },
        {
          id: 'miasma-redhat-2026',
          title: 'Miasma / Red Hat npm Compromise (Jun 2026)',
          description: '32 @redhat-cloud-services packages altered via preinstall hooks',
          as_of_date: '2026-06-01',
        },
        {
          id: 'event-stream-2018',
          title: 'event-stream Compromise (Nov 2018)',
          description: 'Targeted bitcoin wallet injection',
          as_of_date: '2018-11-26',
        },
        {
          id: 'ua-parser-js-2021',
          title: 'ua-parser-js Hijack (Oct 2021)',
          description: 'Account takeover injecting trojans',
          as_of_date: '2021-10-22',
        },
        {
          id: 'benign-control-clean',
          title: 'Benign Control: Clean Project',
          description: 'Verified clean baseline with zero alerts',
          as_of_date: '2026-01-01',
        },
      ];
    }

    const res = await fetch(`${this.baseUrl}/api/replay`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch replay cases: HTTP ${res.status}`);
    }
    return (await res.json()) as BackendReplayCase[];
  }

  /**
   * Uploads lockfile to POST /api/scans
   */
  async uploadScan(lockfileText: string, fileName = 'package-lock.json'): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([lockfileText], { type: 'application/json' });
    formData.append('lockfile', blob, fileName);

    const res = await fetch(`${this.baseUrl}/api/scans`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Scan upload failed (HTTP ${res.status}): ${err || res.statusText}`);
    }
    const data = await res.json();
    return String(data.scan_id || data.id);
  }

  /**
   * Starts a replay scan via POST /api/replay/{caseId}
   */
  async startReplayScan(caseId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/replay/${encodeURIComponent(caseId)}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Replay scan failed (HTTP ${res.status}): ${err || res.statusText}`);
    }
    const data = await res.json();
    return String(data.scan_id || data.id);
  }

  /**
   * Gets scan status and findings from GET /api/scans/{scanId}
   */
  async getScan(scanId: string): Promise<{ scan: BackendScanResponse; findings: SecurityFinding[] }> {
    const res = await fetch(`${this.baseUrl}/api/scans/${encodeURIComponent(scanId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch scan (HTTP ${res.status})`);
    }
    const data = await res.json();
    const rawFindings: BackendFinding[] = data.findings || [];
    const findings = rawFindings.map((bf) => mapBackendFinding(bf, false));
    return {
      scan: data.scan,
      findings,
    };
  }

  /**
   * Gets dependency tree from GET /api/scans/{scanId}/dependencies
   */
  async getDependencies(scanId: string): Promise<BackendDependencyGraph> {
    const res = await fetch(`${this.baseUrl}/api/scans/${encodeURIComponent(scanId)}/dependencies`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dependencies (HTTP ${res.status})`);
    }
    return (await res.json()) as BackendDependencyGraph;
  }

  /**
   * Deep research trigger via POST /api/scans/{scanId}/research/{findingId}
   */
  async triggerResearch(scanId: string, findingId: string): Promise<SecurityFinding> {
    const res = await fetch(
      `${this.baseUrl}/api/scans/${encodeURIComponent(scanId)}/research/${encodeURIComponent(findingId)}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Research failed (HTTP ${res.status}): ${err || res.statusText}`);
    }
    const data = await res.json();
    return mapBackendFinding(data.finding, false);
  }

  /**
   * Subscribes to SSE event stream at /api/scans/{scanId}/stream
   * Handles activity, finding, progress, done, error events.
   * Returns an unsubscribe/close function.
   */
  subscribeScanEvents(
    scanId: string,
    onEvent: (event: LiveScanStreamEvent) => void,
    onError?: (err: Event) => void
  ): () => void {
    const streamUrl = `${this.baseUrl}/api/scans/${encodeURIComponent(scanId)}/stream`;
    const es = new EventSource(streamUrl);

    es.addEventListener('activity', (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        onEvent({ type: 'activity', data: raw });
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('finding', (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data) as BackendFinding;
        const finding = mapBackendFinding(raw, false);
        onEvent({ type: 'finding', data: finding });
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        onEvent({ type: 'progress', data: raw });
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('done', (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        onEvent({ type: 'done', data: raw });
      } catch {
        onEvent({ type: 'done', data: { scan_id: scanId } });
      }
      es.close();
    });

    es.addEventListener('error', (e: Event) => {
      onError?.(e);
      // EventSource may emit error event with message in data or generic error
      try {
        const me = e as MessageEvent;
        if (me.data) {
          const raw = JSON.parse(me.data);
          onEvent({ type: 'error', data: raw });
        }
      } catch {
        // generic network disconnect
      }
    });

    return () => {
      es.close();
    };
  }
}

export const liveScansService = new LiveScansService();
