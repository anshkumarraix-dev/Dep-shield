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
      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md"
    >
      {/* Subtle ambient gradient accent */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

      {/* Top Banner with "Synthetic demo data" label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 bg-slate-950/70 px-4 sm:px-6 py-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
            Interactive Threat Intelligence Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Exact required label */}
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 border border-cyan-500/30">
            <Sparkles className="h-3 w-3" />
            Synthetic demo data
          </span>
          <span className="text-[11px] text-slate-400 hidden xs:inline">
            Click finding below to inspect
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Interactive finding selector tabs */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
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
                      ? 'border-cyan-500/50 bg-cyan-950/20 shadow-md shadow-cyan-950/30'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <RiskBadge level={f.riskLevel} />
                    <span className="text-[10px] font-mono text-slate-400">
                      v{f.installedVersion}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-200 truncate w-full">
                    {f.packageName}
                  </span>
                  <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {f.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Finding Detail Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={activeFinding.riskLevel} />
              <h3 className="font-mono text-sm sm:text-base font-bold text-white tracking-tight">
                {activeFinding.packageName}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                installed: <span className="text-slate-300 font-semibold">v{activeFinding.installedVersion}</span>
                {activeFinding.fixedVersion && (
                  <> &rarr; safe: <span className="text-emerald-400 font-semibold">v{activeFinding.fixedVersion}</span></>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                <Layers className="h-2.5 w-2.5" />
                {activeFinding.dependencyType}
              </span>
              <OsvBadge state={activeFinding.osvLookupState} in_osv={activeFinding.in_osv} />
              <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/20">
                {(activeFinding.confidence * 100).toFixed(0)}% heuristic confidence
              </span>
            </div>
          </div>

          {/* Finding Title & Risk Explanation */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
              {activeFinding.title}
            </h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              {activeFinding.riskExplanation}
            </p>
          </div>

          {/* Verbatim Evidence Snippet with Source Link */}
          {primaryEvidence && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Quote className="h-3 w-3 text-cyan-400" />
                  Corroborated Public Threat Evidence
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Source: {primaryEvidence.source}
                </span>
              </div>
              <blockquote className="border-l-2 border-cyan-500/50 pl-3 text-xs italic text-slate-300 font-mono leading-relaxed bg-slate-950/30 py-1.5 pr-2 rounded-r">
                &ldquo;{primaryEvidence.quote}&rdquo;
              </blockquote>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                {primarySource?.safeUrl ? (
                  <a
                    href={primarySource.safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate max-w-xs">{primarySource.safeUrl}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 font-mono text-[10px]">
                    {primaryEvidence.source}
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-400">
                  Context: {primaryEvidence.context}
                </span>
              </div>
            </div>
          )}

          {/* Remediation Preview & Interactive Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
              <span className="truncate max-w-xs sm:max-w-md">
                Remediation: <span className="text-slate-300">{activeFinding.remediationGuidance}</span>
              </span>
            </div>

            <button
              onClick={() => onSelectFinding(activeFinding)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-all active:scale-95 shadow-md shadow-cyan-500/20"
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
