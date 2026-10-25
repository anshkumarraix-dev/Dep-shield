'use client';

import React from 'react';
import { Database, ShieldCheck, Radio } from 'lucide-react';

export function DataSourcesStrip() {
  // ONLY sources actually queried by the backend
  const sources = [
    {
      name: 'OSV Database',
      desc: 'Open Source Vulnerabilities API (Google)',
      role: 'Baseline CVE & GHSA lookup',
      icon: Database,
      badge: 'Known Threats',
    },
    {
      name: 'npm Registry',
      desc: 'Official Package Metadata & Deprecation',
      role: 'Direct & transitive package graph resolver',
      icon: ShieldCheck,
      badge: 'Package Graph',
    },
    {
      name: 'Public Web Signals',
      desc: 'Repository Issues, PRs & Maintainer Notes',
      role: 'Pre-CVE early-warning heuristic correlation',
      icon: Radio,
      badge: 'Early Intelligence',
    },
  ];

  // Duplicate items 4 times to guarantee a seamless, infinite loop on wide displays
  const marqueeItems = [...sources, ...sources, ...sources, ...sources];

  return (
    <section
      id="sources"
      aria-label="Corroborated Telemetry Sources"
      className="relative w-full overflow-hidden border-y border-[#3C3C42]/40 bg-[#010101] py-5"
    >
      <div className="max-w-7xl mx-auto px-4 mb-3 text-center">
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#7D7E84] uppercase">
          Corroborated Telemetry Sources &bull; No Fake Badges &bull; No Analyst Claims
        </span>
      </div>

      {/* Marquee Wrapper with Edge Fade Gradients */}
      <div className="group relative flex overflow-hidden">
        {/* Left edge shadow fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-16 sm:w-28 bg-gradient-to-r from-[#010101] to-transparent" />
        {/* Right edge shadow fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-16 sm:w-28 bg-gradient-to-l from-[#010101] to-transparent" />

        {/* Marquee Track (CSS-only infinite translation) */}
        <div className="flex shrink-0 items-center gap-4 py-1 animate-marquee group-hover:[animation-play-state:paused]">
          {marqueeItems.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={`${s.name}-${idx}`}
                className="flex items-center gap-3 rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/15 backdrop-blur-md px-4 py-2.5 transition-all duration-200 hover:border-[#3C3C42]/80 hover:bg-[#3C3C42]/25"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3C3C42]/40 text-[#EFEFF0] border border-[#3C3C42]/60">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#EFEFF0] tracking-tight">
                      {s.name}
                    </span>
                    <span className="rounded bg-[#3C3C42]/40 px-1.5 py-0.2 text-[9px] font-mono font-medium text-[#BDBDC1] border border-[#3C3C42]/60">
                      {s.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#BDBDC1] truncate max-w-[220px]">
                    {s.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
