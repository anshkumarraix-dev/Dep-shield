'use client';

import React, { useState } from 'react';
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
  Eye,
  Info,
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
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    CRITICAL: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400 font-bold',
      border: 'border-rose-500/30',
      icon: <AlertOctagon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />,
    },
    HIGH: {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400 font-bold',
      border: 'border-orange-500/30',
      icon: <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />,
    },
    WATCH: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400 font-semibold',
      border: 'border-amber-500/30',
      icon: <Eye className="h-3 w-3 flex-shrink-0" aria-hidden="true" />,
    },
    INFO: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400 font-medium',
      border: 'border-blue-500/30',
      icon: <Info className="h-3 w-3 flex-shrink-0" aria-hidden="true" />,
    },
  };

  const config = styles[level] || styles.INFO;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] tracking-wider font-mono ${style.bg} ${style.text} ${style.border}`}
      role="status"
    >
      {style.icon}
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
      bg: 'bg-rose-50',
      text: 'text-rose-700 font-semibold',
      border: 'border-rose-200',
      label: 'OSV Matched',
      tooltip: 'Confirmed CVE match in OSV database (in_osv: true)',
    },
    CLEAN: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700 font-semibold',
      border: 'border-emerald-200',
      label: 'OSV Clean',
      tooltip: 'Explicitly checked in OSV with 0 advisories (in_osv: false)',
    },
    PROVISIONAL: {
      bg: 'bg-amber-50',
      text: 'text-amber-800 font-medium',
      border: 'border-amber-200',
      label: 'OSV Unchecked',
      tooltip: 'OSV lookup not performed / heuristic only (in_osv: null)',
    },
    UNKNOWN: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      label: 'Unchecked',
      tooltip: 'Status unverified',
    },
  };

  const current = styles[resolvedState] || styles.UNKNOWN;

  return (
    <span
      title={current.tooltip}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono border ${current.bg} ${current.text} ${current.border}`}
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

  const filteredFindings = findings
    .filter((f) => {
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
    })
    .sort((a, b) => {
      if (sortBy === 'severity') {
        const diff = SEVERITY_ORDER[b.riskLevel] - SEVERITY_ORDER[a.riskLevel];
        if (diff !== 0) return diff;
        return a.packageName.localeCompare(b.packageName);
      }
      return a.packageName.localeCompare(b.packageName);
    });

  return (
    <div className="rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-5 shadow-sm">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#3C3C42]/50">
        <div>
          <h2 className="text-sm font-semibold text-[#EFEFF0] flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#BDBDC1]" />
            Supply Chain Threat Findings
          </h2>
          <p className="text-xs text-[#BDBDC1] mt-0.5">
            Correlated vulnerability telemetry across direct and transitive dependencies
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#BDBDC1]">Showing</span>
          <span className="rounded bg-[#3C3C42]/30 px-2 py-0.5 text-[#EFEFF0] font-bold border border-[#3C3C42]/50">
            {filteredFindings.length} of {findings.length}
          </span>
          <span className="text-[#BDBDC1]">findings</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3">
        {/* Risk Level Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-medium text-[#7D7E84] mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Risk:
          </span>
          {riskFilters.map((risk) => (
            <button
              key={risk}
              onClick={() => setSelectedRisk(risk)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                selectedRisk === risk
                  ? 'bg-[#3C3C42] text-[#EFEFF0] border border-[#3C3C42]'
                  : 'bg-[#010101]/60 text-[#BDBDC1] border border-[#3C3C42]/40 hover:bg-[#3C3C42]/30 hover:text-[#EFEFF0]'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>

        {/* Secondary controls: Dep Type Toggle, Sort & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Control */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <span className="px-2 text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              Sort:
            </span>
            <button
              onClick={() => setSortBy('severity')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                sortBy === 'severity'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Severity
            </button>
            <button
              onClick={() => setSortBy('package')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                sortBy === 'package'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Name (A-Z)
            </button>
          </div>

          {/* Direct / Transitive Toggle */}
          <div className="flex items-center rounded-lg border border-[#3C3C42]/50 bg-[#010101]/80 p-0.5 text-xs">
            <button
              onClick={() => setSelectedDepType('ALL')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                selectedDepType === 'ALL'
                  ? 'bg-[#3C3C42] text-[#EFEFF0]'
                  : 'text-[#BDBDC1] hover:text-[#EFEFF0]'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedDepType('direct')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                selectedDepType === 'direct'
                  ? 'bg-[#3C3C42] text-[#EFEFF0]'
                  : 'text-[#BDBDC1] hover:text-[#EFEFF0]'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setSelectedDepType('transitive')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                selectedDepType === 'transitive'
                  ? 'bg-[#3C3C42] text-[#EFEFF0]'
                  : 'text-[#BDBDC1] hover:text-[#EFEFF0]'
              }`}
            >
              Transitive
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7D7E84]" />
            <input
              id="findings-search-input"
              aria-label="Search package, CVE, or title"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search package, CVE, or title..."
              className="w-full rounded-lg border border-[#3C3C42]/50 bg-[#010101]/80 py-1 pl-8 pr-7 text-xs text-[#EFEFF0] placeholder-[#7D7E84] focus:border-[#3C3C42] focus:outline-none focus:ring-1 focus:ring-[#3C3C42]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7D7E84] hover:text-[#EFEFF0]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="mt-2 overflow-x-auto rounded-lg border border-[#3C3C42]/50 bg-[#010101]/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#3C3C42]/50 bg-[#010101]/80 text-[11px] font-semibold uppercase text-[#7D7E84]">
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
              <th className="py-3 pr-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3C3C42]/30">
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#7D7E84]">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <SlidersHorizontal className="h-5 w-5 text-[#5F5F62]" />
                    <span>No findings match the selected filters or search query.</span>
                    <button
                      onClick={() => {
                        setSelectedRisk('ALL');
                        setSelectedDepType('ALL');
                        setSearchQuery('');
                      }}
                      className="mt-1 text-xs text-[#EFEFF0] hover:underline"
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
                        ? 'bg-[#3C3C42]/30 border-l-2 border-l-[#EFEFF0]'
                        : 'hover:bg-[#3C3C42]/20'
                    }`}
                  >
                    {/* Risk Level Badge */}
                    <td className="py-3.5 pl-4 whitespace-nowrap">
                      <RiskBadge level={finding.riskLevel} />
                    </td>

                    {/* Package Name & Installed Version */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <div className="font-semibold text-[#EFEFF0] group-hover:text-white transition-colors font-mono">
                        {finding.packageName}
                      </div>
                      <div className="text-[11px] text-[#BDBDC1] font-mono mt-0.5">
                        <span className="text-[#EFEFF0]">v{finding.installedVersion}</span>
                        {finding.fixedVersion && (
                          <span className="text-[#7D7E84] ml-1">
                            &rarr; <span className="text-emerald-400">v{finding.fixedVersion}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Direct vs Transitive */}
                    <td className="py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono uppercase bg-[#3C3C42]/40 text-[#BDBDC1] border border-[#3C3C42]/60">
                        <Layers className="h-2.5 w-2.5" />
                        {finding.dependencyType}
                      </span>
                    </td>

                    {/* Title & Explanation */}
                    <td className="py-3 pr-4 max-w-sm">
                      <div className="font-medium text-[#EFEFF0] line-clamp-1">
                        {finding.title}
                      </div>
                      <div className="text-[11px] text-[#BDBDC1] line-clamp-1 mt-0.5">
                        {finding.riskExplanation}
                      </div>
                    </td>

                    {/* Heuristic Confidence & Deduplicated Source Count */}
                    <td className="py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[#EFEFF0] font-medium text-xs"
                          title="Rule-based heuristic score (not a statistical probability)"
                        >
                          {(finding.confidence * 100).toFixed(0)}% <span className="text-[10px] text-[#7D7E84] font-sans">heuristic</span>
                        </span>
                        <span
                          className="rounded bg-[#3C3C42]/40 px-1.5 py-0.2 text-[10px] text-[#BDBDC1] font-mono"
                          title="Deduplicated independent original sources"
                        >
                          {finding.sourceCount} {finding.sourceCount === 1 ? 'src' : 'srcs'}
                        </span>
                      </div>
                    </td>

                    {/* OSV Lookup State */}
                    <td className="py-3.5 whitespace-nowrap">
                      <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
                    </td>

                    {/* Details Action */}
                    <td className="py-3 pr-3 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFinding(finding);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-[#BDBDC1] group-hover:text-[#EFEFF0] transition-colors"
                      >
                        <span>Evidence</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Helpful Hint & Severity Policy Explanation */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#7D7E84] gap-2 border-t border-[#3C3C42]/40 pt-2.5">
        <span>
          <strong className="text-[#BDBDC1]">Severity Policy:</strong> Single independent sources cannot exceed WATCH. Higher severity requires confirmed package/version relevance and independent original corroboration — not raw domain counts.
        </span>
        <span className="font-mono text-[10px] text-[#7D7E84] flex-shrink-0">
          Catalog: {findings.length} findings
        </span>
      </div>
    </div>
  );
}
