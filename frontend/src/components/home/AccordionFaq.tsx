'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function AccordionFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does DepShield differ from standard scanners like Dependabot or Snyk?',
      a: 'Standard scanners rely almost entirely on registered CVE databases and official vendor advisories. DepShield investigates early public threat signals, repository issues, and pull request warnings to provide advance warnings weeks before formal CVE registration.',
    },
    {
      q: 'What are the current prototype limits and constraints?',
      a: 'This prototype is focused on demonstration and developer evaluation. It deep-checks a limited number of packages per scan (typically 4 priority candidates), runs in client-side synthetic mock mode, and evaluates npm manifests (package-lock.json v2/v3). Lead-time claims are heuristic demonstrations and not statistical guarantees.',
    },
    {
      q: 'How does the tri-state OSV badge prevent false safety?',
      a: 'Traditional scanners frequently show unindexed or unanalyzed packages as "Safe" by default. DepShield strictly uses three states: Matched (in_osv: true), Clean (in_osv: false, confirmed checked with 0 advisories), and Provisional/Unknown (in_osv: null). We never assume lack of data equals security.',
    },
    {
      q: 'Does DepShield upload proprietary source code or private repositories?',
      a: 'No. In mock demonstration mode, lockfile parsing and telemetry analysis happen entirely offline within your browser session. No external HTTP requests, CDN scripts, or private repository files are transmitted.',
    },
    {
      q: 'Can single uncorroborated sources trigger a Critical alert?',
      a: 'No. DepShield enforces a strict corroboration policy: single independent source mentions can never exceed WATCH severity. Higher severity classifications require verified package/version match relevance and multi-source corroboration.',
    },
  ];

  const handleToggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <section id="faq" className="space-y-8 pt-8">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#7D7E84]">
          Transparency &amp; FAQ
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#EFEFF0]">
          Frequently Asked Questions
        </h2>
        <p className="text-xs sm:text-sm text-[#BDBDC1] leading-relaxed">
          Honest explanations of our scoring heuristics, tri-state verification, and current prototype boundaries.
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md overflow-hidden transition-colors hover:border-[#3C3C42]/80"
            >
              <button
                onClick={() => handleToggle(idx)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-semibold text-[#EFEFF0] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#3C3C42]"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2.5 pr-4">
                  <HelpCircle className="h-4 w-4 text-[#BDBDC1] flex-shrink-0" />
                  {faq.q}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[#7D7E84] transition-transform duration-200 flex-shrink-0 ${
                    isOpen ? 'rotate-180 text-[#EFEFF0]' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-5 pt-2 text-xs text-[#BDBDC1] leading-relaxed border-t border-[#3C3C42]/40 bg-[#010101]/60">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
