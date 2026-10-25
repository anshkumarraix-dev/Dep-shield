'use client';

import React, { useState } from 'react';
import { SecurityFinding } from '@/types';
import { RiskBadge, OsvBadge } from '@/components/dashboard/FindingsTable';
import {
  ChevronRight,
  ShieldAlert,
  Layers,
  Sparkles,
  ExternalLink,
  Terminal,
  Quote,
} from 'lucide-react';

interface ProductPreviewCardProps {
  findings: SecurityFinding[];
  onSelectFinding: (finding: SecurityFinding) => void;
}

export function ProductPreviewCard({
  findings,
  onSelectFinding,
}: ProductPreviewCardProps) {
  // Select first finding by default, or provide fallback
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeFinding: SecurityFinding | undefined = findings[selectedIndex] || findings[0];

  if (!activeFinding) {
    return null;
  }

  const primaryEvidence = activeFinding.evidenceQuotes?.[0];
  const primarySource = activeFinding.sources?.[0];

  return (
    <div
      id="demo"
      className="relative overflow-hidden rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 shadow-sm backdrop-blur-md"
    >
      {/* Subtle ambient accent */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#3C3C42]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#3C3C42]/15 blur-3xl" />

      {/* Top Banner with "Synthetic demo data" label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#3C3C42]/50 bg-[#010101]/80 px-4 sm:px-6 py-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full bg-[#EFEFF0] animate-pulse" />
          <span className="text-xs font-semibold text-[#EFEFF0] tracking-tight flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-[#BDBDC1]" />
            Interactive Threat Intelligence Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Exact required label */}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3C3C42]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#BDBDC1] border border-[#3C3C42]/50">
            <Sparkles className="h-3 w-3 text-[#EFEFF0]" />
            Synthetic demo data
          </span>
          <span className="text-[11px] text-[#7D7E84] hidden xs:inline">
            Click finding below to inspect
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Interactive finding selector tabs */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7D7E84] block mb-2">
            Select a candidate finding to preview:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {findings.slice(0, 3).map((f, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-[#3C3C42] bg-[#3C3C42]/40 shadow-sm'
                      : 'border-[#3C3C42]/40 bg-[#010101]/40 hover:bg-[#3C3C42]/20 hover:border-[#3C3C42]/70'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <RiskBadge level={f.riskLevel} />
                    <span className="text-[10px] font-mono text-[#7D7E84]">
                      v{f.installedVersion}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#EFEFF0] truncate w-full">
                    {f.packageName}
                  </span>
                  <span className="text-[11px] text-[#BDBDC1] line-clamp-1 mt-0.5">
                    {f.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Finding Detail Card */}
        <div className="rounded-xl border border-[#3C3C42]/50 bg-[#010101]/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#3C3C42]/40">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={activeFinding.riskLevel} />
              <h3 className="font-mono text-sm sm:text-base font-bold text-[#EFEFF0] tracking-tight">
                {activeFinding.packageName}
              </h3>
              <span className="text-xs text-[#BDBDC1] font-mono">
                installed: <span className="text-[#EFEFF0] font-semibold">v{activeFinding.installedVersion}</span>
                {activeFinding.fixedVersion && (
                  <> &rarr; safe: <span className="text-emerald-400 font-semibold">v{activeFinding.fixedVersion}</span></>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono uppercase bg-[#3C3C42]/40 text-[#BDBDC1] border border-[#3C3C42]/60">
                <Layers className="h-2.5 w-2.5" />
                {activeFinding.dependencyType}
              </span>
              <OsvBadge state={activeFinding.osvLookupState} in_osv={activeFinding.in_osv} />
              <span className="rounded bg-[#3C3C42]/30 px-2 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/50">
                {(activeFinding.confidence * 100).toFixed(0)}% heuristic confidence
              </span>
            </div>
          </div>

          {/* Finding Title & Risk Explanation */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-[#EFEFF0]">
              {activeFinding.title}
            </h4>
            <p className="mt-1 text-xs text-[#BDBDC1] leading-relaxed">
              {activeFinding.riskExplanation}
            </p>
          </div>

          {/* Verbatim Evidence Snippet with Source Link */}
          {primaryEvidence && (
            <div className="rounded-lg border border-[#3C3C42]/50 bg-[#121214]/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#BDBDC1]">
                <span className="flex items-center gap-1.5 font-medium text-[#EFEFF0]">
                  <Quote className="h-3 w-3 text-[#BDBDC1]" />
                  Corroborated Public Threat Evidence
                </span>
                <span className="font-mono text-[10px] text-[#7D7E84]">
                  Source: {primaryEvidence.source}
                </span>
              </div>
              <blockquote className="border-l-2 border-[#7D7E84] pl-3 text-xs italic text-[#BDBDC1] font-mono leading-relaxed bg-[#010101]/60 py-1.5 pr-2 rounded-r">
                &ldquo;{primaryEvidence.quote}&rdquo;
              </blockquote>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                {primarySource?.safeUrl ? (
                  <a
                    href={primarySource.safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#EFEFF0] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate max-w-xs">{primarySource.safeUrl}</span>
                  </a>
                ) : (
                  <span className="text-[#BDBDC1] font-mono text-[10px]">
                    {primaryEvidence.source}
                  </span>
                )}
                <span className="font-mono text-[10px] text-[#7D7E84]">
                  Context: {primaryEvidence.context}
                </span>
              </div>
            </div>
          )}

          {/* Remediation Preview & Interactive Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-mono text-[#BDBDC1]">
              <Terminal className="h-3.5 w-3.5 text-[#BDBDC1] flex-shrink-0" />
              <span className="truncate max-w-xs sm:max-w-md">
                Remediation: <span className="text-[#EFEFF0]">{activeFinding.remediationGuidance}</span>
              </span>
            </div>

            <button
              onClick={() => onSelectFinding(activeFinding)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#EFEFF0] px-4 py-2 text-xs font-semibold text-[#010101] hover:bg-white transition-all active:scale-95 shadow"
              aria-label={`Open full evidence drawer for ${activeFinding.packageName}`}
            >
              <span>Inspect Evidence Drawer</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
