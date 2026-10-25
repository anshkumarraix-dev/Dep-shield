'use client';

import React, { useEffect } from 'react';
import { SecurityFinding } from '@/types';
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
} from 'lucide-react';

interface EvidenceDrawerProps {
  finding: SecurityFinding | null;
  onClose: () => void;
}

export function EvidenceDrawer({ finding, onClose }: EvidenceDrawerProps) {
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

  if (!finding) return null;

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
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={finding.riskLevel} />
                  <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
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

            {/* Risk Explanation */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D7E84] flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                Threat Assessment & Impact
              </h4>
              <p className="text-xs text-[#BDBDC1] bg-[#121214]/60 p-4 rounded-xl border border-[#3C3C42]/50 leading-relaxed">
                {finding.riskExplanation}
              </p>

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
                          <span className="rounded bg-emerald-950/50 px-1.5 py-0.2 text-[9px] font-mono text-emerald-300 border border-emerald-800/50">
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
                          className={`rounded px-1.5 py-0.2 text-[9px] font-mono border ${
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
                        className="inline-flex items-center gap-1 text-[11px] text-[#EFEFF0] hover:underline font-mono flex-shrink-0 self-start sm:self-center"
                      >
                        <span>Demo Link</span>
                        <ExternalLink className="h-3 w-3" />
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
