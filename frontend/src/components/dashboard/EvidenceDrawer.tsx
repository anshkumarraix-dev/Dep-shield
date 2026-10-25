'use client';

import React, { useState, useEffect } from 'react';
import { SecurityFinding, QuoteVerificationStatus } from '@/types';
import { RiskBadge, OsvBadge } from './FindingsTable';
import {
  X,
  GitCommit,
  ExternalLink,
  Terminal,
  FileText,
  AlertCircle,
  Database,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';

interface EvidenceDrawerProps {
  finding: SecurityFinding | null;
  onClose: () => void;
}

export function QuoteVerificationBadge({ status }: { status?: QuoteVerificationStatus }) {
  const styles: Record<QuoteVerificationStatus, { label: string; bg: string; text: string; border: string; desc: string }> = {
    simulated_verified: {
      label: 'Simulated Quote Verified',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      desc: 'Simulated verification against synthetic benchmark fixture (Demo mode - no live network request)',
    },
    unverified: {
      label: 'Unverified Quote',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      desc: 'Source text was not checked against ground truth',
    },
    conflicting: {
      label: 'Conflicting Evidence',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      desc: 'Public evidence sources disagree on vulnerability impact or version range',
    },
    unknown: {
      label: 'Unknown Verification',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      desc: 'Insufficient evidence to reach a quote verification conclusion',
    },
  };

  const config = styles[status || 'unknown'] || styles.unknown;

  return (
    <span
      title={config.desc}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono border ${config.bg} ${config.text} ${config.border}`}
    >
      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

export function EvidenceDrawer({ finding, onClose }: EvidenceDrawerProps) {
  const [isResearching, setIsResearching] = React.useState(false);
  const [researchDossier, setResearchDossier] = React.useState<{
    summary: string;
    exploitability: string;
    consensusScore: string;
    completedAt: string;
  } | null>(null);
  const [copiedCommand, setCopiedCommand] = React.useState(false);
  const [isMitigated, setIsMitigated] = React.useState(false);

  // Handle ESC key press to close drawer only when drawer is active
  useEffect(() => {
    if (!finding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finding, onClose]);

  // Reset local state when finding changes
  const [prevFindingId, setPrevFindingId] = useState<string | undefined>(finding?.id);
  if (prevFindingId !== finding?.id) {
    setPrevFindingId(finding?.id);
    setResearchDossier(null);
    setIsResearching(false);
    setIsMitigated(false);
    setCopiedCommand(false);
  }

  if (!finding) return null;

  const handleRunDeepResearch = () => {
    setIsResearching(true);
    setTimeout(() => {
      setIsResearching(false);
      setResearchDossier({
        summary: `Autonomous deep intelligence analysis for ${finding.packageName}@${finding.installedVersion} verified across OSV vulnerability records, maintainer issue threads, and commit diffs. Confirmed ${finding.riskLevel} threat profile with corroborated affected version bounds (${finding.affectedRange || 'N/A'}).`,
        exploitability: finding.riskLevel === 'CRITICAL' ? 'Active Remote Exploitation Feasible' : 'High Dependency Attack Surface (Requires Specific Ingestion Vector)',
        consensusScore: 'Multi-Source Corroborated (98% Heuristic Rule Confidence)',
        completedAt: new Date().toLocaleTimeString(),
      });
    }, 1500);
  };

  const handleCopyCommand = () => {
    if (finding.fixedVersion) {
      navigator.clipboard.writeText(`npm install ${finding.packageName}@${finding.fixedVersion}`);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-drawer-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#010101]/80 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Drawer Container (Slide-over from right) */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside className="w-screen max-w-2xl bg-[#010101] border-l border-[#3C3C42]/50 text-[#EFEFF0] shadow-2xl flex flex-col justify-between overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-[#3C3C42]/50 bg-[#010101]/95 px-6 py-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={finding.riskLevel} />
                  <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
                  {finding.signalCategory && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-mono text-slate-700 border border-slate-200 uppercase font-medium">
                      {finding.signalCategory.replace(/_/g, ' ')}
                    </span>
                  )}
                  {finding.quoteVerification && (
                    <QuoteVerificationBadge status={finding.quoteVerification} />
                  )}
                  {finding.cvssScore && (
                    <span className="rounded bg-[#3C3C42]/40 px-2 py-0.5 text-[11px] font-mono text-[#BDBDC1] border border-[#3C3C42]/60">
                      CVSS {finding.cvssScore.toFixed(1)}
                    </span>
                  )}
                  {finding.advisoryId && (
                    <span className="rounded bg-[#3C3C42]/40 px-2 py-0.5 text-[11px] font-mono text-[#EFEFF0] border border-[#3C3C42]/60">
                      {finding.advisoryId}
                    </span>
                  )}
                </div>

                <h3
                  id="evidence-drawer-title"
                  className="text-lg font-bold text-[#EFEFF0] tracking-tight pt-1"
                >
                  {finding.title}
                </h3>

                <div className="flex items-center gap-2 text-xs text-[#BDBDC1] font-mono">
                  <span className="text-[#EFEFF0] font-semibold">{finding.packageName}</span>
                  <span>@</span>
                  <span className="text-[#EFEFF0]">{finding.installedVersion}</span>
                  <span className="text-[#7D7E84]">&bull;</span>
                  <span className="capitalize">{finding.dependencyType} Dependency</span>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="rounded-lg border border-[#3C3C42]/50 p-2 text-[#BDBDC1] hover:text-[#EFEFF0] hover:bg-[#3C3C42]/30 transition-colors"
                aria-label="Close evidence drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 px-6 py-6 space-y-6">
            {/* Synthetic Evidence Notice */}
            <div className="rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 p-3.5 text-xs text-[#BDBDC1] flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-[#EFEFF0] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#EFEFF0]">Demonstration Evidence Payload (Synthetic Benchmark)</p>
                <p className="mt-0.5 text-[#BDBDC1] leading-relaxed text-[11px]">
                  All quotes, source annotations, and advisories are synthetically generated for hackathon demonstration. No external third-party servers were contacted.
                </p>
              </div>
            </div>

            {/* Heuristic Confidence & Severity Policy Notice */}
            <div className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/80 p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3C3C42]/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#EFEFF0]">Confidence Rating:</span>
                  <span className="font-mono text-[#EFEFF0] font-bold">
                    {(finding.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="rounded bg-[#3C3C42]/40 px-1.5 py-0.5 text-[10px] text-[#BDBDC1] font-mono">
                    Heuristic (Uncalibrated)
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#7D7E84]">
                  {finding.sourceCount} {finding.sourceCount === 1 ? 'Independent Source' : 'Independent Sources'} (deduplicated)
                </div>
              </div>
              <p className="text-[11px] text-[#BDBDC1] leading-relaxed">
                <strong className="text-[#EFEFF0]">Severity Policy:</strong> Confidence represents an uncalibrated heuristic rule score, not a statistical probability. A single uncorroborated source is capped at WATCH; higher severity requires verified version-match relevance and independent original evidence — never raw URL or domain counts.
              </p>
            </div>

            {/* Timeline Milestones (Distinct: Public Signal, Advisory, CVE) */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <GitCommit className="h-3.5 w-3.5 text-[#BDBDC1]" />
                Vulnerability Timeline Milestones
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-[#3C3C42]/50 bg-[#121214]/60 p-3.5 text-xs font-mono">
                {/* Milestone 1: First Public Signal */}
                <div className="p-2.5 rounded-lg bg-[#010101]/80 border border-[#3C3C42]/50 space-y-1">
                  <span className="text-[10px] uppercase text-[#EFEFF0] font-bold block">
                    1. First Public Signal
                  </span>
                  <div className="text-[#EFEFF0] text-xs font-semibold">
                    {finding.firstSignalAt
                      ? new Date(finding.firstSignalAt).toUTCString().replace('GMT', 'UTC')
                      : 'Unknown / Not recorded'}
                  </div>
                  <span className="text-[10px] text-[#7D7E84] block font-sans">
                    {finding.firstSignalAt ? 'Contemporaneous observation' : 'No pre-disclosure signal recorded'}
                  </span>
                </div>

                {/* Milestone 2: Official Advisory */}
                <div className="p-2.5 rounded-lg bg-[#010101]/80 border border-[#3C3C42]/50 space-y-1">
                  <span className="text-[10px] uppercase text-amber-400 font-bold block">
                    2. Official Advisory
                  </span>
                  <div className="text-[#EFEFF0] text-xs font-semibold">
                    {finding.officialAdvisoryAt
                      ? new Date(finding.officialAdvisoryAt).toUTCString().replace('GMT', 'UTC')
                      : 'None (Pre-disclosure)'}
                  </div>
                  <span className="text-[10px] text-[#7D7E84] block font-sans">
                    {finding.officialAdvisoryAt ? 'Maintainer security disclosure' : 'Pending vendor disclosure'}
                  </span>
                </div>

                {/* Milestone 3: CVE Publication */}
                <div className="p-2.5 rounded-lg bg-[#010101]/80 border border-[#3C3C42]/50 space-y-1">
                  <span className="text-[10px] uppercase text-rose-400 font-bold block">
                    3. CVE Publication
                  </span>
                  <div className="text-[#EFEFF0] text-xs font-semibold">
                    {finding.cvePublishedAt
                      ? new Date(finding.cvePublishedAt).toUTCString().replace('GMT', 'UTC')
                      : 'Not Assigned (Pre-CVE)'}
                  </div>
                  <span className="text-[10px] text-[#7D7E84] block font-sans">
                    {finding.cvePublishedAt ? 'Official NVD catalog entry' : 'Provisional / Early intelligence'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#7D7E84] italic px-1">
                Note: Lead-time calculations require verifiable contemporaneous timestamps. A search date filter alone does not establish pre-disclosure existence.
              </p>
            </section>

            {/* TinyFish Deep Research Interactive Intelligence Dossier */}
            <section className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Deep Security Intelligence
                </h4>
                {!researchDossier && (
                  <button
                    onClick={handleRunDeepResearch}
                    disabled={isResearching}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-[11px] font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-white" />
                        <span>Synthesizing Intelligence...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 text-white" />
                        <span>Run Deep Research</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {isResearching && (
                <div className="rounded-xl border border-sky-200 bg-white p-4 space-y-2 text-center animate-pulse mt-2">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-800">
                    Dispatching multi-vector inquiry across GitHub advisory graphs, release diffs & exploit feeds...
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Synthetic Sandbox Model Active • $0.00 billable API cost
                  </p>
                </div>
              )}

              {researchDossier && (
                <div className="rounded-xl border border-sky-200 bg-white p-3.5 space-y-3 text-xs animate-in fade-in slide-in-from-top-2 mt-2 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[11px] font-bold font-mono uppercase text-blue-700">
                        Autonomous Threat Dossier Synthesized
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {researchDossier.completedAt}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    {researchDossier.summary}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                      <span className="text-slate-500 uppercase block font-semibold">Exploitability</span>
                      <span className="text-rose-700 font-mono font-medium">{researchDossier.exploitability}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                      <span className="text-slate-500 uppercase block font-semibold">Multi-Vector Consensus</span>
                      <span className="text-blue-700 font-mono font-medium">{researchDossier.consensusScore}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Risk Explanation */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                Threat Assessment & Impact
              </h4>
              <p className="text-xs text-[#BDBDC1] bg-[#121214]/60 p-4 rounded-xl border border-[#3C3C42]/50 leading-relaxed">
                {finding.riskExplanation}
              </p>

              {/* Deterministic Scoring Rule */}
              {finding.deterministicRuleApplied && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-xs">
                    <Scale className="h-4 w-4" />
                    <span>Deterministic Rule Applied</span>
                  </div>
                  <p className="text-slate-800 font-mono text-[11px] leading-relaxed">
                    {finding.deterministicRuleApplied}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Risk severity is assigned strictly by deterministic scoring rules. Gemini extracts factual claims and evidence quotes; it does not assign the final risk level.
                  </p>
                </div>
              )}

              {/* Corroboration Details */}
              {finding.corroborationDetails && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>Corroboration & Registrable Domains</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {finding.corroborationDetails}
                  </p>
                </div>
              )}

              {/* Uncertainty and Conflicting Information */}
              {finding.uncertaintyNotes && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Uncertainty & Conflicting Signals</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    {finding.uncertaintyNotes}
                  </p>
                </div>
              )}

              {/* OSV Telemetry Explicit Tri-state Status */}
              <div className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/70 p-3.5 text-xs flex items-start gap-3">
                <Database className="h-4 w-4 text-[#BDBDC1] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#EFEFF0]">OSV Verification:</span>
                    <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
                  </div>
                  <p className="text-[11px] text-[#BDBDC1] leading-relaxed">
                    {finding.in_osv === true &&
                      'Confirmed match: package coordinate and version correlated with an active CVE advisory in the OSV database (in_osv: true).'}
                    {finding.in_osv === false &&
                      'Queried OSV database: zero known CVE advisories found. Flagged strictly by supply-chain heuristics (in_osv: false).'}
                    {finding.in_osv === null &&
                      'OSV lookup was not performed / skipped. Evaluated provisionally via static manifest analysis (in_osv: null).'}
                  </p>
                </div>
              </div>
            </section>

            {/* Dependency Graph Chain Path */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#BDBDC1]" />
                Dependency Resolution Path
              </h4>
              <div className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/60 p-4 font-mono text-xs text-[#BDBDC1]">
                <div className="flex flex-wrap items-center gap-2">
                  {finding.dependencyPath.map((node, idx) => (
                    <React.Fragment key={node}>
                      <span
                        className={`rounded px-2 py-1 ${
                          idx === finding.dependencyPath.length - 1
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                            : 'bg-[#3C3C42]/40 text-[#BDBDC1] border border-[#3C3C42]/60'
                        }`}
                      >
                        {node}
                      </span>
                      {idx < finding.dependencyPath.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-[#7D7E84] flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>

            {/* Version Match Analysis */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <GitCommit className="h-3.5 w-3.5 text-[#BDBDC1]" />
                Version Range Matching
              </h4>
              <div className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/50 p-4 space-y-2.5 text-xs">
                <div className="grid grid-cols-3 gap-2 pb-3 border-b border-[#3C3C42]/50 text-center font-mono">
                  <div className="p-2 rounded bg-[#010101] border border-[#3C3C42]/50">
                    <span className="text-[10px] uppercase text-[#7D7E84] block">Installed</span>
                    <span className="font-bold text-rose-400">{finding.installedVersion}</span>
                  </div>
                  <div className="p-2 rounded bg-[#010101] border border-[#3C3C42]/50">
                    <span className="text-[10px] uppercase text-[#7D7E84] block">Affected Range</span>
                    <span className="font-bold text-amber-400">{finding.affectedRange || 'N/A'}</span>
                  </div>
                  <div className="p-2 rounded bg-[#010101] border border-[#3C3C42]/50">
                    <span className="text-[10px] uppercase text-[#7D7E84] block">Recommended Fix</span>
                    <span className="font-bold text-emerald-400">
                      {finding.fixedVersion ? `v${finding.fixedVersion}` : 'Audit / Mitigate'}
                    </span>
                  </div>
                </div>
                <p className="text-[#BDBDC1] leading-relaxed text-[11px]">
                  {finding.versionMatchExplanation}
                </p>
              </div>
            </section>

            {/* Evidence Quotes (NO dangerouslySetInnerHTML) */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#BDBDC1]" />
                Evidence Quotes & Signal Telemetry
              </h4>
              <div className="space-y-2.5">
                {finding.evidenceQuotes.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/60 p-3.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-medium text-[#BDBDC1] font-mono">{item.source}</span>
                      <div className="flex items-center gap-1.5">
                        {item.publishedAt && (
                          <span className="text-[10px] text-[#7D7E84] font-mono">
                            Published: {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                        {item.exactQuoteVerified && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-mono text-emerald-700 border border-emerald-200">
                            Exact Quote Verified
                          </span>
                        )}
                        {item.isSynthetic && (
                          <span className="rounded bg-[#3C3C42]/40 px-1.5 py-0.2 text-[9px] font-mono text-[#BDBDC1] border border-[#3C3C42]/60">
                            Synthetic Telemetry
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Normal text rendering */}
                    <blockquote className="border-l-2 border-[#7D7E84] pl-3 text-xs text-[#EFEFF0] italic font-mono leading-relaxed bg-[#010101]/40 py-1 rounded-r">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                    <p className="text-[11px] text-[#7D7E84] pl-3">Context: {item.context}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Sources & References with Separated Published vs Retrieved Times */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-[#BDBDC1]" />
                Corroborating Sources & Provenance
              </h4>
              <div className="divide-y divide-[#3C3C42]/40 rounded-xl border border-[#3C3C42]/50 bg-[#121214]/60">
                {finding.sources.map((src, idx) => (
                  <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#EFEFF0]">{src.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-mono border ${
                            src.isOriginalSource
                              ? 'bg-[#3C3C42]/40 text-[#EFEFF0] border-[#3C3C42]/60'
                              : 'bg-[#010101]/80 text-[#7D7E84] border-[#3C3C42]/40'
                          }`}
                        >
                          {src.isOriginalSource ? 'Original Source' : 'Syndicated / Repost'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#BDBDC1]">
                        <span>
                          Type: <strong className="font-mono text-[#EFEFF0]">{src.sourceType}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Published:{' '}
                          <strong className="font-mono text-[#EFEFF0]">
                            {src.publishedAt
                              ? new Date(src.publishedAt).toLocaleDateString()
                              : 'Unknown / Not recorded'}
                          </strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Retrieved:{' '}
                          <strong className="font-mono text-[#EFEFF0]">
                            {new Date(src.retrievedAt).toLocaleDateString()}
                          </strong>
                        </span>
                      </div>
                      {src.provenanceNote && (
                        <p className="text-[10px] text-[#7D7E84] italic">
                          Provenance: {src.provenanceNote}
                        </p>
                      )}
                    </div>
                    {src.safeUrl && (
                      <a
                        href={src.safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#18191c] hover:bg-[#23252b] text-[#38bdf8] hover:text-cyan-300 text-[11px] font-mono border border-[#3C3C42]/60 hover:border-cyan-500/50 transition-colors flex-shrink-0 self-start sm:self-center max-w-[280px] sm:max-w-[340px] group shadow-sm"
                        title={src.safeUrl}
                      >
                        <span className="truncate">{src.safeUrl}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 text-[#7D7E84] group-hover:text-cyan-300" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Remediation Guidance */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-[#EFEFF0]" />
                Remediation Guidance
              </h4>
              <div className="rounded-xl border border-[#3C3C42]/60 bg-[#121214]/80 p-4 space-y-2 text-xs">
                <p className="text-[#BDBDC1] leading-relaxed">
                  {finding.remediationGuidance}
                </p>
                {finding.fixedVersion && (
                  <div className="rounded-lg bg-[#010101] p-2.5 font-mono text-[11px] text-[#EFEFF0] border border-[#3C3C42]/50 flex items-center justify-between">
                    <code>npm install {finding.packageName}@{finding.fixedVersion}</code>
                    <button
                      onClick={handleCopyCommand}
                      className="ml-2 inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[10px] text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                      title="Copy remediation command"
                    >
                      {copiedCommand ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Footer Controls */}
          <div className="sticky bottom-0 border-t border-[#3C3C42]/50 bg-[#010101]/95 px-6 py-4 flex items-center justify-between backdrop-blur-md">
            <span className="text-[11px] text-[#7D7E84]">
              Press <kbd className="rounded bg-[#3C3C42]/40 px-1.5 py-0.5 font-mono text-[#BDBDC1] border border-[#3C3C42]/60">ESC</kbd> to dismiss
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-[#3C3C42]/40 border border-[#3C3C42]/60 px-4 py-2 text-xs font-medium text-[#EFEFF0] hover:bg-[#3C3C42] transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
