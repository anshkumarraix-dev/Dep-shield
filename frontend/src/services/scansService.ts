import { envConfig } from '@/config/env';
import { apiFetch } from './apiClient';
import {
  mockSummaryMetrics,
  mockFindings,
  mockActivity,
  MOCK_SCAN_STAGES,
} from '@/mocks/mockData';
import {
  SecurityFinding,
  ScanSummaryMetrics,
  ActivityEvent,
  FindingsFilterOptions,
  LockfileParsedSummary,
  ScanProgressState,
  resolveOsvState,
} from '@/types';

/**
 * Normalizes backend findings payload (supporting both snake_case from FastAPI
 * and camelCase models) to ensure seamless API integration.
 */
export function normalizeFinding(raw: Record<string, unknown>): SecurityFinding {
  const in_osv = raw.in_osv !== undefined ? (raw.in_osv as boolean | null) : null;
  const isDirect =
    raw.is_direct !== undefined
      ? Boolean(raw.is_direct)
      : raw.dependencyType === 'direct' || raw.dependency_type === 'direct';

  return {
    id: String(raw.id || `FIND-${Math.random().toString(36).substring(2, 9)}`),
    title: String(raw.title || raw.name || 'Security Finding'),
    packageName: String(raw.packageName || raw.package_name || 'unknown-package'),
    installedVersion: String(raw.installedVersion || raw.installed_version || '0.0.0'),
    fixedVersion:
      raw.fixedVersion !== undefined
        ? String(raw.fixedVersion)
        : raw.fixed_version !== undefined
        ? String(raw.fixed_version)
        : undefined,
    affectedRange:
      raw.affectedRange !== undefined
        ? String(raw.affectedRange)
        : raw.affected_range !== undefined
        ? String(raw.affected_range)
        : undefined,
    riskLevel: (raw.riskLevel || raw.risk_level || 'INFO') as SecurityFinding['riskLevel'],
    status: (raw.status || 'OPEN') as SecurityFinding['status'],
    dependencyType: isDirect ? 'direct' : 'transitive',
    dependencyPath: Array.isArray(raw.dependencyPath || raw.dependency_path)
      ? ((raw.dependencyPath || raw.dependency_path) as string[])
      : [],
    signalCategory: String(
      raw.signalCategory || raw.signal_category || 'Supply Chain Telemetry'
    ),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.85,
    sourceCount:
      typeof raw.sourceCount === 'number'
        ? raw.sourceCount
        : typeof raw.source_count === 'number'
        ? raw.source_count
        : 1,
    riskExplanation: String(raw.riskExplanation || raw.risk_explanation || raw.description || ''),
    deterministicRuleApplied: raw.deterministicRuleApplied
      ? String(raw.deterministicRuleApplied)
      : raw.deterministic_rule_applied
      ? String(raw.deterministic_rule_applied)
      : undefined,
    in_osv,
    osvLookupState: resolveOsvState(in_osv),
    advisoryId:
      raw.advisoryId !== undefined
        ? String(raw.advisoryId)
        : raw.advisory_id !== undefined
        ? String(raw.advisory_id)
        : raw.cve_id !== undefined
        ? String(raw.cve_id)
        : undefined,
    cvssScore:
      typeof raw.cvssScore === 'number'
        ? raw.cvssScore
        : typeof raw.cvss_score === 'number'
        ? raw.cvss_score
        : undefined,
    firstSignalAt:
      raw.firstSignalAt !== undefined
        ? (raw.firstSignalAt as string | null)
        : raw.first_signal_at !== undefined
        ? (raw.first_signal_at as string | null)
        : null,
    officialAdvisoryAt:
      raw.officialAdvisoryAt !== undefined
        ? (raw.officialAdvisoryAt as string | null)
        : raw.official_advisory_at !== undefined
        ? (raw.official_advisory_at as string | null)
        : null,
    cvePublishedAt:
      raw.cvePublishedAt !== undefined
        ? (raw.cvePublishedAt as string | null)
        : raw.cve_published_at !== undefined
        ? (raw.cve_published_at as string | null)
        : null,
    versionMatchExplanation: String(
      raw.versionMatchExplanation ||
        raw.version_match_explanation ||
        'Version identified via manifest inspection.'
    ),
    evidenceQuotes: Array.isArray(raw.evidenceQuotes || raw.evidence_quotes)
      ? ((raw.evidenceQuotes || raw.evidence_quotes) as Record<string, unknown>[]).map((q) => ({
          quote: String(q.quote || ''),
          context: String(q.context || ''),
          source: String(q.source || ''),
          isSynthetic: Boolean(q.isSynthetic ?? q.is_synthetic ?? false),
          publishedAt:
            q.publishedAt !== undefined
              ? (q.publishedAt as string | null)
              : q.published_at !== undefined
              ? (q.published_at as string | null)
              : null,
          exactQuoteVerified: Boolean(q.exactQuoteVerified ?? q.exact_quote_verified ?? true),
          verificationStatus: (q.verificationStatus ||
            q.verification_status ||
            'simulated_verified') as SecurityFinding['evidenceQuotes'][number]['verificationStatus'],
        }))
      : [],
    sources: Array.isArray(raw.sources)
      ? (raw.sources as Record<string, unknown>[]).map((s) => ({
          name: String(s.name || 'Unknown Source'),
          sourceType: (s.sourceType || s.source_type || 'OSV Database') as SecurityFinding['sources'][number]['sourceType'],
          safeUrl: s.safeUrl ? String(s.safeUrl) : s.safe_url ? String(s.safe_url) : undefined,
          publishedAt:
            s.publishedAt !== undefined
              ? (s.publishedAt as string | null)
              : s.published_at !== undefined
              ? (s.published_at as string | null)
              : null,
          retrievedAt: String(s.retrievedAt || s.retrieved_at || new Date().toISOString()),
          isOriginalSource: Boolean(s.isOriginalSource ?? s.is_original_source ?? true),
          provenanceNote: s.provenanceNote
            ? String(s.provenanceNote)
            : s.provenance_note
            ? String(s.provenance_note)
            : undefined,
        }))
      : [],
    corroborationDetails: s_str(raw.corroborationDetails || raw.corroboration_details),
    uncertaintyNotes: s_str(raw.uncertaintyNotes || raw.uncertainty_notes),
    remediationGuidance: String(
      raw.remediationGuidance || raw.remediation_guidance || 'Audit dependency in package manifest.'
    ),
    recommendedAction: s_str(raw.recommendedAction || raw.recommended_action),
    isSyntheticDemo: Boolean(raw.isSyntheticDemo ?? raw.is_synthetic ?? false),
    detectedAt: String(raw.detectedAt || raw.detected_at || new Date().toISOString()),
  };
}

function s_str(val: unknown): string | undefined {
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

export const scansService = {
  /**
   * Fetches latest scan summary metrics
   */
  async getSummaryMetrics(): Promise<ScanSummaryMetrics> {
    if (envConfig.useMocks) {
      return Promise.resolve(mockSummaryMetrics);
    }
    return apiFetch<ScanSummaryMetrics>('/api/v1/scans/summary');
  },

  /**
   * Fetches security findings with filters (riskLevel, dependencyType, searchQuery)
   */
  async getFindings(filters?: FindingsFilterOptions): Promise<SecurityFinding[]> {
    if (envConfig.useMocks) {
      let filtered = [...mockFindings];

      if (filters?.riskLevel && filters.riskLevel !== 'ALL') {
        filtered = filtered.filter((f) => f.riskLevel === filters.riskLevel);
      }

      if (filters?.dependencyType && filters.dependencyType !== 'ALL') {
        filtered = filtered.filter((f) => f.dependencyType === filters.dependencyType);
      }

      if (filters?.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (f) =>
            f.title.toLowerCase().includes(query) ||
            f.packageName.toLowerCase().includes(query) ||
            f.signalCategory.toLowerCase().includes(query) ||
            f.advisoryId?.toLowerCase().includes(query) ||
            f.riskExplanation.toLowerCase().includes(query) ||
            f.installedVersion.toLowerCase().includes(query)
        );
      }

      return Promise.resolve(filtered);
    }

    const queryParams = new URLSearchParams();
    if (filters?.searchQuery) queryParams.set('search', filters.searchQuery);
    if (filters?.riskLevel && filters.riskLevel !== 'ALL') queryParams.set('risk', filters.riskLevel);
    if (filters?.dependencyType && filters.dependencyType !== 'ALL') queryParams.set('type', filters.dependencyType);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const raw = await apiFetch<Record<string, unknown>[]>(`/api/v1/findings${queryString}`);
    return Array.isArray(raw) ? raw.map(normalizeFinding) : [];
  },

  /**
   * Retrieves single finding by ID
   */
  async getFindingById(id: string): Promise<SecurityFinding | null> {
    const findings = await this.getFindings();
    return findings.find((f) => f.id === id) || null;
  },

  /**
   * Fetches security audit and activity log
   */
  async getActivityFeed(): Promise<ActivityEvent[]> {
    if (envConfig.useMocks) {
      return Promise.resolve(mockActivity);
    }
    return apiFetch<ActivityEvent[]>('/api/v1/activity');
  },

  /**
   * Runs the 6-stage simulated bounded-progress demo scan client-side without calling external APIs.
   * Invokes onProgress callback at every milestone with exact stage info and elapsed time.
   */
  async simulateScan(
    lockfileSummary: LockfileParsedSummary,
    onProgress?: (state: ScanProgressState) => void
  ): Promise<{
    summary: ScanSummaryMetrics;
    findings: SecurityFinding[];
    activity: ActivityEvent[];
  }> {
    const startTime = Date.now();
    const analyzedScope = lockfileSummary.analyzedPackages || [];
    const analyzedNames = analyzedScope.map((p) => p.name).join(', ') || 'direct dependencies';
    const totalDeps = lockfileSummary.totalPackagesDetected;
    const directDeps = lockfileSummary.directDependenciesCount;
    const transitiveDeps = lockfileSummary.transitiveDependenciesCount;

    const logs: string[] = [];
    const getTimestamp = () => {
      const diff = Date.now() - startTime;
      const secs = Math.floor(diff / 1000).toString().padStart(2, '0');
      const ms = Math.floor(diff % 1000).toString().padStart(3, '0');
      return `00:${secs}.${ms}`;
    };

    const packageNames = analyzedScope.map((p) => p.name);

    for (let i = 0; i < MOCK_SCAN_STAGES.length; i++) {
      const stage = MOCK_SCAN_STAGES[i];
      let contextualMessage = stage.description;
      let activePkg: string | undefined = undefined;

      if (stage.stage === 'parsing') {
        contextualMessage = `Parsed ${totalDeps} total dependencies (${directDeps} direct, ${transitiveDeps} transitive).`;
        logs.push(`[${getTimestamp()}] [PARSER] Reading lockfile: ${lockfileSummary.fileName} (format: v${lockfileSummary.lockfileVersion})`);
        logs.push(`[${getTimestamp()}] [PARSER] Ingested ${totalDeps} package coordinates (${directDeps} direct, ${transitiveDeps} transitive)`);
        logs.push(`[${getTimestamp()}] [PARSER] Prioritized ${analyzedScope.length || 4} packages for deep investigation: ${analyzedNames}`);
      } else if (stage.stage === 'baseline') {
        activePkg = packageNames[0] || 'lodash';
        contextualMessage = `Correlating ${totalDeps} package coordinates against OSV & npm vulnerability baseline...`;
        logs.push(`[${getTimestamp()}] [BASELINE] Querying OSV vulnerability database for ${packageNames.slice(0, 3).join(', ')}...`);
        logs.push(`[${getTimestamp()}] [BASELINE] OSV match confirmed for lodash@4.17.20 (GHSA-p6mc-m468-83gw / CVE-2020-8203)`);
      } else if (stage.stage === 'signals') {
        activePkg = packageNames[1] || 'tar';
        contextualMessage = `Simulating targeted Search for top ${analyzedScope.length || 4} prioritized packages (${analyzedNames})...`;
        logs.push(`[${getTimestamp()}] [SIGNALS] Querying maintainer commit logs and public issue discussions...`);
        logs.push(`[${getTimestamp()}] [SIGNALS] Protestware/arbitrary file overwrite signal detected on tar@6.1.13`);
        logs.push(`[${getTimestamp()}] [SIGNALS] Follow-redirects SSRF advisory correlated with axios@1.6.8`);
      } else if (stage.stage === 'evidence') {
        activePkg = packageNames[2] || 'axios';
        contextualMessage = `Validating verbatim quote substrings, dates, and deduplicating registrable domains...`;
        logs.push(`[${getTimestamp()}] [EVIDENCE] Fetching page content and validating verbatim quote substrings`);
        logs.push(`[${getTimestamp()}] [EVIDENCE] Deduplicating subdomains under root registrable domains (github.com, osv.dev)`);
      } else if (stage.stage === 'scoring') {
        activePkg = packageNames[3] || 'express';
        contextualMessage = `Applying deterministic scoring rules (WATCH, HIGH, CRITICAL) without LLM drift...`;
        logs.push(`[${getTimestamp()}] [SCORING] Applying deterministic multi-source corroboration rules`);
        logs.push(`[${getTimestamp()}] [SCORING] Single uncorroborated sources capped at WATCH; multi-source -> HIGH/CRITICAL`);
      } else if (stage.stage === 'findings') {
        contextualMessage = `Cataloging 6 demonstration findings with actionable developer next steps...`;
        logs.push(`[${getTimestamp()}] [FINDINGS] Cataloging 6 findings (1 Critical, 2 High, 2 Watch, 1 Info)`);
        logs.push(`[${getTimestamp()}] [FINDINGS] Compiling remediation guidance & dependency ancestor paths`);
      }

      onProgress?.({
        stage: stage.stage,
        stageLabel: stage.label,
        progressPercent: stage.progressPercent,
        currentMessage: contextualMessage,
        elapsedMs: Date.now() - startTime,
        stageIndex: i + 1,
        totalStages: MOCK_SCAN_STAGES.length,
        logs: [...logs],
        activePackage: activePkg,
        analyzedPackages: packageNames,
      });

      // Realistic predictable demo interval (380ms per stage)
      await new Promise((resolve) => setTimeout(resolve, 380));
    }

    const elapsedTotal = Date.now() - startTime;

    const dynamicSummary: ScanSummaryMetrics = {
      totalDependenciesScanned: totalDeps,
      directCount: directDeps,
      transitiveCount: transitiveDeps,
      analyzedCount: analyzedScope.length || 4,
      criticalCount: 1,
      highCount: 2,
      watchCount: 2,
      infoCount: 1,
      shieldScore: 78,
      osvMatchesCount: 3,
      scannedAt: new Date().toISOString(),
      scanDurationMs: elapsedTotal,
      isSyntheticDemo: true,
    };

    const dynamicActivity: ActivityEvent[] = [
      {
        id: `ACT-RUN-${Date.now()}-6`,
        actionType: 'evidence_analysis',
        title: 'Stage 6: Findings & Evidence Synthesis Finalized',
        description: `[Simulated Run] Synthesized 6 ranked findings across ${totalDeps} parsed packages with remediation guidance.`,
        timestamp: 'Just now',
        targetPackage: lockfileSummary.projectName || 'depshield-demo-app',
        status: 'success',
        isSimulated: true,
        metadata: { findingsCount: 6, overallScore: 78 },
      },
      {
        id: `ACT-RUN-${Date.now()}-5`,
        actionType: 'evidence_analysis',
        title: 'Stage 5: Deterministic Scoring Applied',
        description:
          '[Simulated Run] Evaluated multi-source corroboration: assigned 1 CRITICAL, 2 HIGH, 2 WATCH, and 1 INFO finding.',
        timestamp: 'Just now',
        targetPackage: 'Deterministic Rules Engine',
        status: 'success',
        isSimulated: true,
      },
      {
        id: `ACT-RUN-${Date.now()}-4`,
        actionType: 'evidence_analysis',
        title: 'Stage 4: Source Evidence & Subdomains Validated',
        description:
          '[Simulated Run] Verified short quote substrings and deduplicated subdomains under single registrable domains.',
        timestamp: 'Just now',
        targetPackage: 'Evidence Validator',
        status: 'success',
        isSimulated: true,
      },
      {
        id: `ACT-RUN-${Date.now()}-3`,
        actionType: 'search',
        title: `Stage 3: Targeted Signal Discovery (${analyzedScope.length || 4} packages)`,
        description: `[Simulated Run] Ran targeted signal searches for prioritized direct dependencies: ${analyzedNames}.`,
        timestamp: 'Just now',
        targetPackage: 'Prioritized Scope (<= 4 pkgs)',
        status: 'info',
        isSimulated: true,
      },
      {
        id: `ACT-RUN-${Date.now()}-2`,
        actionType: 'osv_check',
        title: 'Stage 2: OSV Vulnerability Baseline Correlated',
        description: `[Simulated Run] Correlated ${totalDeps} dependency coordinates against synthetic OSV vulnerability corpus.`,
        timestamp: 'Just now',
        targetPackage: 'OSV / npm Baseline',
        status: 'warning',
        isSimulated: true,
      },
      {
        id: `ACT-RUN-${Date.now()}-1`,
        actionType: 'parsing',
        title: `Stage 1: Manifest Parsed (${lockfileSummary.fileName})`,
        description: `[Simulated Run] Ingested ${totalDeps} package identities (${directDeps} direct, ${transitiveDeps} transitive). Format: v${lockfileSummary.lockfileVersion}.`,
        timestamp: 'Just now',
        targetPackage: lockfileSummary.fileName,
        status: 'success',
        isSimulated: true,
      },
    ];

    logs.push(`[${getTimestamp()}] [COMPLETE] Scan finalized: 6 findings compiled in ${(elapsedTotal / 1000).toFixed(2)}s. Zero network drift.`);

    onProgress?.({
      stage: 'completed',
      stageLabel: 'Scan Completed',
      progressPercent: 100,
      currentMessage: `Analysis completed: ${totalDeps} packages inventoried. Top ${analyzedScope.length || 4} direct packages evaluated. 6 findings cataloged.`,
      elapsedMs: elapsedTotal,
      stageIndex: 6,
      totalStages: 6,
      logs: [...logs],
      analyzedPackages: packageNames,
    });

    return {
      summary: dynamicSummary,
      findings: mockFindings,
      activity: dynamicActivity,
    };
  },

  /**
   * Subscribes to live scan telemetry over Server-Sent Events (SSE).
   * Compatible with FastAPI EventSource stream (GET /api/v1/scans/{scanId}/events).
   * Automatically cleans up listeners on teardown.
   */
  subscribeToScanEvents(
    scanId: string,
    handlers: {
      onProgress?: (progress: ScanProgressState) => void;
      onFinding?: (finding: SecurityFinding) => void;
      onActivity?: (event: ActivityEvent) => void;
      onDone?: (summary: ScanSummaryMetrics) => void;
      onError?: (error: Error) => void;
    }
  ): () => void {
    if (envConfig.useMocks || typeof window === 'undefined') {
      return () => {};
    }

    const sseUrl = `${envConfig.apiUrl.replace(/\/$/, '')}/api/v1/scans/${encodeURIComponent(scanId)}/events`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ScanProgressState;
        handlers.onProgress?.(data);
      } catch (err) {
        console.warn('[DepShield SSE] Malformed progress event payload:', err);
      }
    });

    eventSource.addEventListener('finding', (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data) as Record<string, unknown>;
        handlers.onFinding?.(normalizeFinding(raw));
      } catch (err) {
        console.warn('[DepShield SSE] Malformed finding event payload:', err);
      }
    });

    eventSource.addEventListener('activity', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ActivityEvent;
        handlers.onActivity?.(data);
      } catch (err) {
        console.warn('[DepShield SSE] Malformed activity event payload:', err);
      }
    });

    eventSource.addEventListener('done', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ScanSummaryMetrics;
        handlers.onDone?.(data);
      } catch (err) {
        console.warn('[DepShield SSE] Malformed done event payload:', err);
      } finally {
        eventSource.close();
      }
    });

    eventSource.addEventListener('error', (e) => {
      handlers.onError?.(new Error(`[DepShield SSE] Stream error: ${JSON.stringify(e)}`));
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  },
};
