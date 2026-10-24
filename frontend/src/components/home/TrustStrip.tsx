'use client';

import React from 'react';
import { ExternalLink, HelpCircle, Tag, ShieldCheck } from 'lucide-react';

export function TrustStrip() {
  const claims = [
    {
      title: 'Every finding links to its source',
      description:
        'Zero black-box hallucinations. Every alert includes direct citations, original URLs, and verbatim evidence snippets for independent verification.',
      icon: ExternalLink,
    },
    {
      title: 'Unknown is never shown as safe',
      description:
        'Unchecked or unverified dependencies are explicitly marked as Provisional/Unchecked. We never treat lack of data as confirmation of safety.',
      icon: HelpCircle,
    },
    {
      title: 'Demo data is always labelled',
      description:
        'All synthetic demonstration artifacts and offline simulation signals are transparently flagged as Synthetic demo data.',
      icon: Tag,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
          Security Integrity &amp; Honest Claims
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {claims.map((claim) => {
          const Icon = claim.icon;
          return (
            <div
              key={claim.title}
              className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 transition-colors hover:border-slate-700"
            >
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20 flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                  {claim.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {claim.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
