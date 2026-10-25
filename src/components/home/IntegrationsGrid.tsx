'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Database, FileCode, GitPullRequest, Layers, ShieldCheck, Cpu } from 'lucide-react';

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

export function IntegrationsGrid() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const integrations = [
    {
      title: 'npm Package Ecosystem',
      desc: 'Parses npm package-lock.json formats v2 and v3 without external network dependencies.',
      icon: FileCode,
      tag: 'Lockfile Parser',
      delay: '0ms',
    },
    {
      title: 'OSV Vulnerability DB',
      desc: 'Google open source vulnerability data queried client-side for known CVE & GHSA records.',
      icon: Database,
      tag: 'Advisory Engine',
      delay: '60ms',
    },
    {
      title: 'Maintainer Pull Requests',
      desc: 'Ingests public issue threads and pull request disclosures before official CVE assignment.',
      icon: GitPullRequest,
      tag: 'Signal Harvest',
      delay: '120ms',
    },
    {
      title: 'Transitive Tree Unwinder',
      desc: 'Recursively builds dependency graph maps down to leaf nodes to catch hidden transitive risks.',
      icon: Layers,
      tag: 'Graph Resolver',
      delay: '180ms',
    },
    {
      title: 'Heuristic Rule Pipeline',
      desc: 'Deterministic multi-factor risk scoring with strict caps preventing false alarm fatigue.',
      icon: Cpu,
      tag: 'Heuristics',
      delay: '240ms',
    },
    {
      title: 'Tri-State OSV Standard',
      desc: 'Strict tagging guarantee: Unchecked packages remain Provisional/Unknown, never Safe.',
      icon: ShieldCheck,
      tag: 'Integrity Protocol',
      delay: '300ms',
    },
  ];

  return (
    <section ref={sectionRef} id="integrations" className="space-y-8 pt-8">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#7D7E84]">
          Ecosystem Integrations
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#EFEFF0]">
          Architected for modern developer toolchains
        </h2>
        <p className="text-xs sm:text-sm text-[#BDBDC1] leading-relaxed">
          Client-first, privacy-respecting dependency inspection designed for immediate developer confidence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
        {integrations.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              style={{
                transitionDelay: isReducedMotion ? '0ms' : item.delay,
              }}
              className={`rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:border-[#3C3C42]/80 hover:bg-[#3C3C42]/30 hover:-translate-y-0.5 ${
                isVisible || isReducedMotion
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95'
              }`}
            >
              <div className="flex items-start justify-between pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3C3C42]/40 text-[#EFEFF0] border border-[#3C3C42]/60">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-mono rounded bg-[#3C3C42]/30 px-2 py-0.5 text-[#BDBDC1] border border-[#3C3C42]/50">
                  {item.tag}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#EFEFF0] tracking-tight">
                {item.title}
              </h3>
              <p className="text-xs text-[#BDBDC1] leading-relaxed pt-1.5">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
