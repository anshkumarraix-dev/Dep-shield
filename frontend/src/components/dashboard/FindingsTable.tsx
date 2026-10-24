'use client';

import React, { useState, useMemo } from 'react';
import {
  SecurityFinding,
  RiskLevel,
  DependencyType,
  OsvLookupState,
} from '@/types';
import {
  ShieldAlert,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Database,
  SlidersHorizontal,
  X,
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowUpDown,
  Download,
  Copy,
  Check,
} from 'lucide-react';

interface FindingsTableProps {
  findings: SecurityFinding[];
  onSelectFinding: (finding: SecurityFinding) => void;
  selectedFindingId?: string;
  initialRiskFilter?: RiskLevel | 'ALL';
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<
    RiskLevel,
    { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    CRITICAL: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400 font-bold',
      border: 'border-rose-500/30',
      icon: AlertOctagon,
    },
    HIGH: {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400 font-bold',
      border: 'border-orange-500/30',
      icon: AlertTriangle,
    },
    WATCH: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400 font-semibold',
      border: 'border-amber-500/30',
      icon: AlertCircle,
    },
    INFO: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400 font-medium',
      border: 'border-blue-500/30',
      icon: Info,
    },
  };

  const config = styles[level] || styles.INFO;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] tracking-wider font-mono ${config.bg} ${config.text} ${config.border}`}
      role="status"
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span>{level}</span>
    </span>
  );
}

export function OsvBadge({
  state,
  in_osv,
}: {
  state?: OsvLookupState;
  in_osv?: boolean | null;
}) {
  const resolvedState: OsvLookupState =
    state || (in_osv === true ? 'MATCHED' : in_osv === false ? 'CLEAN' : 'PROVISIONAL');

  const styles: Record<OsvLookupState, { bg: string; text: string; border: string; label: string; tooltip: string }> = {
    MATCHED: {
      bg: 'bg-rose-950/40',
      text: 'text-rose-300 font-semibold',
      border: 'border-rose-800/50',
      label: 'OSV Matched',
      tooltip: 'Confirmed CVE match in OSV database (in_osv: true)',
    },
    CLEAN: {
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-300 font-semibold',
      border: 'border-emerald-800/50',
      label: 'OSV Clean',
      tooltip: 'Explicitly checked in OSV with 0 advisories (in_osv: false)',
    },
    PROVISIONAL: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-300 font-medium',
      border: 'border-amber-800/50',
      label: 'OSV Unchecked',
      tooltip: 'OSV lookup not performed / heuristic only (in_osv: null)',
    },
    UNKNOWN: {
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-800',
      label: 'Unchecked',
      tooltip: 'Status unverified',
    },
  };

  const current = styles[resolvedState] || styles.UNKNOWN;

  return (
    <span
      title={current.tooltip}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono border ${current.bg} ${current.text} ${current.border}`}
    >
      <Database className="h-2.5 w-2.5 flex-shrink-0" />
      <span>{current.label}</span>
    </span>
  );
}

const SEVERITY_ORDER: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  WATCH: 2,
  INFO: 1,
};

export function FindingsTable({
  findings,
  onSelectFinding,
  selectedFindingId,
  initialRiskFilter = 'ALL',
}: FindingsTableProps) {
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | 'ALL'>(initialRiskFilter);
  const [selectedDepType, setSelectedDepType] = useState<DependencyType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'severity' | 'package'>('severity');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const riskFilters: (RiskLevel | 'ALL')[] = ['ALL', 'CRITICAL', 'HIGH', 'WATCH', 'INFO'];

  const handleCopyFix = (finding: SecurityFinding, e: React.MouseEvent) => {
    e.stopPropagation();
    const cmd = finding.fixedVersion
      ? `npm install ${finding.packageName}@${finding.fixedVersion}`
      : `npm audit fix`;
    navigator.clipboard.writeText(cmd);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = (findingId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cycle: Record<string, string> = {
      OPEN: 'INVESTIGATING',
      INVESTIGATING: 'MITIGATED',
      MITIGATED: 'OPEN',
    };
    const nextStatus = cycle[statusOverrides[findingId] || currentStatus] || 'OPEN';
    setStatusOverrides((prev) => ({ ...prev, [findingId]: nextStatus }));
  };

  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      reportVersion: '1.0.0',
      provenance: 'DepShield Supply Chain Threat Intelligence Console (Demo Mode)',
      findingsCount: filteredFindings.length,
      findings: filteredFindings.map((f) => ({
        id: f.id,
        title: f.title,
        packageName: f.packageName,
        installedVersion: f.installedVersion,
        fixedVersion: f.fixedVersion,
        riskLevel: f.riskLevel,
        status: statusOverrides[f.id] || f.status,
        signalCategory: f.signalCategory,
        deterministicRule: f.deterministicRuleApplied,
        confidence: f.confidence,
        osvMatch: f.in_osv,
        remediationAction: f.recommendedAction || f.remediationGuidance,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depshield-threat-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredFindings = useMemo(() => {
    const list = findings.filter((f) => {
      // Risk filter
      if (selectedRisk !== 'ALL' && f.riskLevel !== selectedRisk) {
        return false;
      }
      // Dependency Type filter
      if (selectedDepType !== 'ALL' && f.dependencyType !== selectedDepType) {
        return false;
      }
      // Search query across package name, version, title, category, advisory
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesPackage = f.packageName.toLowerCase().includes(query);
        const matchesVersion = f.installedVersion.toLowerCase().includes(query);
        const matchesTitle = f.title.toLowerCase().includes(query);
        const matchesCategory = (f.signalCategory || '').toLowerCase().includes(query);
        const matchesAdvisory = f.advisoryId?.toLowerCase().includes(query) || false;
        const matchesExplanation = f.riskExplanation.toLowerCase().includes(query);
        return (
          matchesPackage ||
          matchesVersion ||
          matchesTitle ||
          matchesCategory ||
          matchesAdvisory ||
          matchesExplanation
        );
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'severity') {
        const diff = SEVERITY_ORDER[b.riskLevel] - SEVERITY_ORDER[a.riskLevel];
        if (diff !== 0) return diff;
        return a.packageName.localeCompare(b.packageName);
      }
      return a.packageName.localeCompare(b.packageName);
    });
  }, [findings, selectedRisk, selectedDepType, searchQuery, sortBy]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cyan-400" />
            Supply Chain Threat Findings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Correlated vulnerability telemetry across direct and transitive dependencies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            title="Download JSON threat intelligence report"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export Report</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Showing</span>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-300 font-bold border border-cyan-500/20">
              {filteredFindings.length} of {findings.length}
            </span>
            <span className="text-slate-400">findings</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3">
        {/* Risk Level Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-medium text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Risk:
          </span>
          {riskFilters.map((risk) => (
            <button
              key={risk}
              onClick={() => setSelectedRisk(risk)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedRisk === risk
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>

        {/* Secondary controls: Dep Type Toggle, Sort & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Control */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5 text-xs">
            <span className="px-2 text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              Sort:
            </span>
            <button
              onClick={() => setSortBy('severity')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                sortBy === 'severity'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Severity
            </button>
            <button
              onClick={() => setSortBy('package')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                sortBy === 'package'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Name (A-Z)
            </button>
          </div>

          {/* Direct / Transitive Toggle */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5 text-xs">
            <button
              onClick={() => setSelectedDepType('ALL')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedDepType === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedDepType('direct')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedDepType === 'direct'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setSelectedDepType('transitive')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedDepType === 'transitive'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Transitive
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="findings-search-input"
              aria-label="Search package, CVE, or title"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search package, category, title..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-1 pl-8 pr-7 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800/70 bg-slate-950/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold uppercase text-slate-400">
              <th className="py-3 pl-3">Risk Level</th>
              <th className="py-3">Package / Version</th>
              <th className="py-3">Dependency Type</th>
              <th className="py-3">Threat Summary</th>
              <th
                className="py-3"
                title="Confidence is a rule-based heuristic score, not a calibrated statistical probability. Source counts count deduplicated original sources."
              >
                Heuristic Confidence & Sources
              </th>
              <th className="py-3">OSV State</th>
              <th className="py-3 pr-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <SlidersHorizontal className="h-5 w-5 text-slate-600" />
                    <span>No findings match the selected filters or search query.</span>
                    <button
                      onClick={() => {
                        setSelectedRisk('ALL');
                        setSelectedDepType('ALL');
                        setSearchQuery('');
                      }}
                      className="mt-1 text-xs text-cyan-400 hover:underline"
                    >
                      Reset all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFindings.map((finding) => {
                const isSelected = selectedFindingId === finding.id;
                return (
                  <tr
                    key={finding.id}
                    onClick={() => onSelectFinding(finding)}
                    className={`group cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Risk Level Badge */}
                    <td className="py-3 pl-3 whitespace-nowrap">
                      <RiskBadge level={finding.riskLevel} />
                    </td>

                    {/* Package Name & Installed Version */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                        {finding.packageName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        <span className="text-slate-300">v{finding.installedVersion}</span>
                        {finding.fixedVersion && (
                          <span className="text-slate-500 ml-1">
                            &rarr; <span className="text-emerald-400">v{finding.fixedVersion}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Direct vs Transitive */}
                    <td className="py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono uppercase ${
                          finding.dependencyType === 'direct'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                        }`}
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {finding.dependencyType}
                      </span>
                    </td>

                    {/* Title & Explanation */}
                    <td className="py-3 pr-4 max-w-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {finding.signalCategory && (
                          <span className="rounded bg-cyan-950/60 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 border border-cyan-800/40">
                            {finding.signalCategory.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="font-medium text-slate-200 line-clamp-1">
                          {finding.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {finding.riskExplanation}
                      </div>
                    </td>

                    {/* Heuristic Confidence & Deduplicated Source Count */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-slate-200 font-medium text-xs"
                          title="Rule-based heuristic score (not a statistical probability)"
                        >
                          {(finding.confidence * 100).toFixed(0)}% <span className="text-[10px] text-slate-500 font-sans">heuristic</span>
                        </span>
                        <span
                          className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400 font-mono"
                          title="Deduplicated independent original sources"
                        >
                          {finding.sourceCount} {finding.sourceCount === 1 ? 'src' : 'srcs'}
                        </span>
                      </div>
                    </td>

                    {/* OSV Lookup State */}
                    <td className="py-3 whitespace-nowrap">
                      <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
                    </td>

                    {/* Details & Actions */}
                    <td className="py-3 pr-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Status Toggle */}
                        <button
                          onClick={(e) => handleToggleStatus(finding.id, finding.status, e)}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase border transition-all ${
                            (statusOverrides[finding.id] || finding.status) === 'MITIGATED'
                              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50 font-bold'
                              : (statusOverrides[finding.id] || finding.status) === 'INVESTIGATING'
                              ? 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                          title="Click to toggle status (OPEN -> INVESTIGATING -> MITIGATED)"
                        >
                          {statusOverrides[finding.id] || finding.status}
                        </button>

                        {/* Quick Copy Fix */}
                        <button
                          onClick={(e) => handleCopyFix(finding, e)}
                          className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 transition-colors"
                          title={finding.fixedVersion ? `Copy: npm install ${finding.packageName}@${finding.fixedVersion}` : 'Copy: npm audit fix'}
                        >
                          {copiedId === finding.id ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5 text-slate-400" />
                              <span>Fix</span>
                            </>
                          )}
                        </button>

                        {/* Open Evidence Drawer */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFinding(finding);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-cyan-400 transition-colors pl-1"
                        >
                          <span>Evidence</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Helpful Hint & Severity Policy Explanation */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2 border-t border-slate-800/60 pt-2.5">
        <span>
          <strong className="text-slate-400">Severity Policy:</strong> Single independent sources cannot exceed WATCH. Higher severity requires confirmed package/version relevance and independent original corroboration — not raw domain counts.
        </span>
        <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
          Catalog: {findings.length} findings
        </span>
      </div>
    </div>
  );
}
