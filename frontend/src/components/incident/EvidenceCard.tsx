'use client';

import React from 'react';
import { ReplayEvidenceItem } from '@/data/replay';
import { CheckCircle, ShieldCheck, AlertCircle, ExternalLink, Globe } from 'lucide-react';

interface EvidenceCardProps {
  evidence: ReplayEvidenceItem;
  isActive?: boolean;
  onSelect?: () => void;
}

export function EvidenceCard({ evidence, isActive = false, onSelect }: EvidenceCardProps) {
  // Highlight the verbatim quote within the excerpt safely without dangerouslySetInnerHTML
  const renderHighlightedExcerpt = () => {
    const { excerpt, quote } = evidence;
    if (!quote || !excerpt.includes(quote)) {
      return <span>{excerpt}</span>;
    }

    const index = excerpt.indexOf(quote);
    const before = excerpt.slice(0, index);
    const after = excerpt.slice(index + quote.length);

    return (
      <span>
        {before}
        <mark className="bg-amber-200/90 text-amber-950 font-semibold px-1 py-0.5 rounded border border-amber-300">
          {quote}
        </mark>
        {after}
      </span>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-md transition-all text-left border ${
        isActive
          ? 'ring-2 ring-amber-500/80 border-amber-500/60 bg-slate-900 shadow-md'
          : 'border-slate-800 bg-slate-900/95 hover:border-slate-700'
      } p-3.5`}
    >
      {/* Header bar: source, time, indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            {evidence.sourceDomain}
          </span>
          <span className="text-[11px] text-slate-400">({evidence.sourceName})</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-amber-400 tabular-nums">
          <span>{evidence.timestamp} UTC</span>
        </div>
      </div>

      {/* Forensic Paper Excerpt Panel (Warm off-white background) */}
      <div className="bg-[#faf8f5] text-slate-900 border border-[#e5dfd3] rounded p-3 mb-2.5 font-serif text-sm leading-relaxed shadow-inner">
        <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-[#8a7f70] mb-1.5 flex items-center justify-between">
          <span>Source Excerpt</span>
          <div className="flex items-center gap-1.5">
            {('isSynthetic' in evidence && Boolean((evidence as { isSynthetic?: boolean }).isSynthetic)) && (
              <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 normal-case font-semibold">
                Synthetic
              </span>
            )}
            {evidence.isQuoteVerified ? (
              <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-sans normal-case text-[10px] font-medium">
                <CheckCircle className="w-3 h-3 text-emerald-700" />
                Verified in source text
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-sans normal-case text-[10px] font-medium">
                <AlertCircle className="w-3 h-3 text-amber-700" />
                Unverified quote
              </span>
            )}
          </div>
        </div>
        <p className="text-slate-800 text-xs sm:text-sm">
          &ldquo;{renderHighlightedExcerpt()}&rdquo;
        </p>
      </div>

      {/* Attribution & Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          {evidence.isIndependentOriginal ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              <ShieldCheck className="w-3 h-3" />
              Independent original origin
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
              Syndicated / repost
            </span>
          )}

          {evidence.exactVersionMatched ? (
            <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60 font-mono">
              Exact match: {evidence.packageTargeted}@{evidence.versionTargeted}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700 font-mono">
              <AlertCircle className="w-3 h-3 text-slate-400" />
              Version unconfirmed
            </span>
          )}
        </div>

        {evidence.sourceUrl && (
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 underline decoration-slate-600 transition-colors"
          >
            <span>Source report</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {evidence.notes && (
        <div className="mt-2 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400 italic">
          Note: {evidence.notes}
        </div>
      )}
    </div>
  );
}
