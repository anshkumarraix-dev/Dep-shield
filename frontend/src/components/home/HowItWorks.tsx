'use client';

import React from 'react';
import { UploadCloud, Database, Radio, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Upload',
      subtitle: 'Manifest ingestion',
      icon: UploadCloud,
      description:
        'Upload your package-lock.json (npm v2 or v3). The client-side parser extracts all direct and transitive dependency trees without sending raw source code.',
    },
    {
      step: '02',
      title: 'Check known databases (OSV/npm)',
      subtitle: 'Tri-state baseline verification',
      icon: Database,
      description:
        'Cross-references dependencies against published CVEs in the Open Source Vulnerabilities (OSV) database and official npm advisory feeds.',
    },
    {
      step: '03',
      title: 'Look for early public warnings',
      subtitle: 'Emerging risk telemetry',
      icon: Radio,
      description:
        'Monitors public repository discussions, security notices, and early maintainer issue disclosures for threat signals before official CVE publication.',
    },
    {
      step: '04',
      title: 'Scored findings with evidence',
      subtitle: 'Corroborated intelligence',
      icon: CheckCircle2,
      description:
        'Produces heuristic confidence scores backed by verbatim evidence quotes, direct source URLs, package/version relevance match, and remediation commands.',
    },
  ];

  return (
    <section id="how-it-works" className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#7D7E84]">
            Defense Workflow
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#EFEFF0] mt-1">
            How DepShield Works
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#BDBDC1] max-w-lg leading-relaxed">
          Four automated analysis phases designed to reveal unpatched threats before they become published CVEs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="group relative flex flex-col justify-between rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-5 transition-all hover:border-[#3C3C42]/80 hover:bg-[#3C3C42]/30"
            >
              {/* Step indicator pill */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold text-[#EFEFF0] bg-[#3C3C42]/40 border border-[#3C3C42]/60 px-2 py-0.5 rounded">
                  Step {item.step}
                </span>
                <div className="p-2 rounded-lg bg-[#010101]/80 border border-[#3C3C42]/60 text-[#BDBDC1] group-hover:text-[#EFEFF0] transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {/* Step Content */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#EFEFF0] tracking-tight leading-snug">
                  {item.title}
                </h3>
                <p className="text-[11px] font-mono text-[#7D7E84]">
                  {item.subtitle}
                </p>
                <p className="text-xs text-[#BDBDC1] leading-relaxed pt-1">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
