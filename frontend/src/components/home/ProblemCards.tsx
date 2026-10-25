'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, GitPullRequest, ShieldAlert } from 'lucide-react';

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function ProblemCards() {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const problems = [
    {
      fileTab: 'rules/threat-payload.json',
      tag: 'CRITICAL',
      tagLabel: 'Prototype Pollution',
      tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      icon: ShieldAlert,
      staggerDelay: '0ms',
      terminalSnippet: [
        '# Threat payload detected in nested tree',
        'Object.prototype.__proto__ vulnerable in demo-core < 1.2.1',
        '>> SIGNAL: Pull request disclosed on example.com',
        '>> IN_OSV: TRUE | ADVISORY: SYNTH-OSV-2026-081',
      ],
      title: 'Automated Supply-Chain Exploits',
      description:
        'Machine-speed threat actors exploit unpatched vulnerabilities rapidly upon public disclosure — often before engineering teams review Dependabot alerts.',
    },
    {
      fileTab: 'agent/transitive-resolver.ts',
      tag: 'HIGH',
      tagLabel: 'Transitive Drift',
      tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      icon: AlertTriangle,
      staggerDelay: '120ms',
      terminalSnippet: [
        'import { spawn } from "demo-tools";',
        '// Transitive call chain: demo-server -> demo-router -> demo-mime',
        'CRITICAL RISK: ReDoS vulnerability in regex parser',
        '>> IN_OSV: null (PROVISIONAL) | LEAD TIME: Illustrative advance window',
      ],
      title: 'Untrusted Transitive Invisibility',
      description:
        'Over 80% of application code lives in transitive dependencies. Perimeter linters miss compromised child packages that are never audited directly.',
    },
    {
      fileTab: 'policy/cve-lag-index.yaml',
      tag: 'WATCH',
      tagLabel: 'Pre-CVE Window',
      tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      icon: GitPullRequest,
      staggerDelay: '240ms',
      terminalSnippet: [
        'APPLICATION_BOM:',
        '  - package: "demo-client@1.6.8"',
        '  - signal: "Header leakage in demo-transport chain"',
        '  - cve_status: "Pending official NVD publication"',
      ],
      title: 'Lagging Official Advisory Databases',
      description:
        'Threat discussions and proof-of-concept exploits often circulate in repository issues and discussions before official CVE registration.',
    },
  ];

  return (
    <section ref={containerRef} id="problems" className="space-y-8 pt-8">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#7D7E84]">
          Threat Vector Architecture
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#EFEFF0]">
          Three problems defining dependency risk
        </h2>
        <p className="text-xs sm:text-sm text-[#BDBDC1] leading-relaxed">
          Why traditional perimeter scanners leave blind spots in modern JavaScript and TypeScript applications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {problems.map((item) => (
          <div
            key={item.title}
            style={{
              transitionDelay: isReducedMotion ? '0ms' : item.staggerDelay,
            }}
            className={`group relative flex flex-col justify-between rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-5 transition-all duration-300 hover:border-[#3C3C42]/80 hover:bg-[#3C3C42]/30 hover:-translate-y-1 ${
              isVisible || isReducedMotion
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            }`}
          >
            {/* Top Terminal Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#3C3C42]/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#5F5F62]" />
                    <span className="h-2 w-2 rounded-full bg-[#5F5F62]" />
                    <span className="h-2 w-2 rounded-full bg-[#5F5F62]" />
                  </div>
                  <span className="font-mono text-[11px] text-[#BDBDC1] pl-1">
                    {item.fileTab}
                  </span>
                </div>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-mono font-semibold ${item.tagColor}`}
                >
                  {item.tag}: {item.tagLabel}
                </span>
              </div>

              {/* Terminal Code Snippet */}
              <div className="rounded-lg bg-[#010101]/80 border border-[#3C3C42]/40 p-3 font-mono text-[11px] text-[#BDBDC1] space-y-1">
                {item.terminalSnippet.map((line, i) => (
                  <p
                    key={i}
                    className={`leading-relaxed truncate ${
                      line.startsWith('>>')
                        ? 'text-[#EFEFF0] font-semibold'
                        : line.startsWith('CRITICAL') || line.startsWith('Object')
                        ? 'text-rose-400'
                        : 'text-[#7D7E84]'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Title & Description */}
            <div className="pt-5 space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-[#EFEFF0] tracking-tight group-hover:text-white transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-[#BDBDC1] leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
