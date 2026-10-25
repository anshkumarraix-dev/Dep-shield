'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SecurityFinding } from '@/types';
import { RiskBadge, OsvBadge } from '@/components/dashboard/FindingsTable';
import { ChevronRight, Terminal } from 'lucide-react';

const STAT_TARGETS = [384, 92, 9, 0];

interface StatsWithConsoleProps {
  findings: SecurityFinding[];
  onSelectFinding: (finding: SecurityFinding) => void;
}

export function StatsWithConsole({
  findings,
  onSelectFinding,
}: StatsWithConsoleProps) {
  const [activeStatIdx, setActiveStatIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'profile' | 'issues' | 'tree'>('profile');
  const [isHovered, setIsHovered] = useState(false);
  const [countValues, setCountValues] = useState<number[]>([0, 0, 0, 0]);

  const statRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Count-up animation on initial intersection
  useEffect(() => {
    let frame = 0;
    const totalFrames = 40;
    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(1, frame / totalFrames);
      // ease-out cubic
      const factor = 1 - Math.pow(1 - progress, 3);
      setCountValues([
        Math.round(STAT_TARGETS[0] * factor),
        Math.round(STAT_TARGETS[1] * factor),
        Math.round(STAT_TARGETS[2] * factor),
        0,
      ]);
      if (frame >= totalFrames) {
        clearInterval(interval);
      }
    }, 25);

    return () => clearInterval(interval);
  }, []);

  // IntersectionObserver to sync active stat with right sticky console
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    statRefs.current.forEach((el, idx) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveStatIdx(idx);
            }
          });
        },
        { threshold: 0.6 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  // Continuous auto-cycle for telemetry and live console
  useEffect(() => {
    if (isHovered) return;

    const timer = setInterval(() => {
      setActiveStatIdx((prev) => (prev + 1) % 4);
    }, 5000);

    return () => clearInterval(timer);
  }, [isHovered]);

  const activeFinding = findings[activeStatIdx] || findings[0];

  const stats = [
    {
      numericDisplay: `${countValues[0]}`,
      unit: '',
      label: 'PACKAGES PARSED',
      sublabel: '4 deep-checked per scan',
      headline: 'Full lockfile dependency tree parsed client-side',
      description: 'Recursively resolves both direct top-level packages and nested sub-dependencies in v2/v3 npm lockfiles. 4 deep-checked per scan.',
      findingSample: 'demo-core@1.2.0 (Direct)',
      findingRisk: 'CRITICAL',
    },
    {
      numericDisplay: `${countValues[1]}%`,
      unit: '%',
      label: 'HEURISTIC CONFIDENCE',
      headline: 'Deterministic rule-based threat correlation',
      description: 'Scores risk from verified repository PRs, issue disclosures, and maintainer advisory notices.',
      findingSample: 'demo-mime@1.0.4 (Transitive via demo-router)',
      findingRisk: 'HIGH',
    },
    {
      numericDisplay: `+${countValues[2]}.4d`,
      unit: 'd',
      label: 'AVERAGE LEAD TIME',
      sublabel: 'Illustrative, synthetic demo value',
      headline: 'Early warning advance window before official CVEs',
      description: 'Illustrative, synthetic demo value.',
      findingSample: 'demo-transport@1.14.0 (Transitive via demo-client)',
      findingRisk: 'WATCH',
    },
    {
      numericDisplay: `${countValues[3]}`,
      unit: '',
      label: 'FALSE-SAFE ASSUMPTIONS',
      headline: 'Zero ambiguous "Clean" marks for unverified packages',
      description: 'If OSV has no data or a package was skipped, DepShield explicitly outputs Provisional/Unknown, never Safe.',
      findingSample: 'demo-logger@3.1.0 (Verified Clean)',
      findingRisk: 'INFO',
    },
  ];

  return (
    <section id="demo" className="space-y-8 pt-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#7D7E84]">
          Telemetry &amp; Live Console
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#EFEFF0]">
          The DepShield Dependency Defense Console
        </h2>
        <p className="text-xs sm:text-sm text-[#BDBDC1] leading-relaxed">
          How teams answer the essential question: Can we trust what we are shipping before official advisories land?
        </p>
      </div>

      {/* Two-Column Sticky-Scroll: Left scrollable stats, Right sticky console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-7xl mx-auto">
        {/* Left Scrollable Stats Column (4 cols) */}
        <div className="lg:col-span-5 space-y-8">
          <div className="flex items-center justify-between pb-3 border-b border-[#3C3C42]/50">
            <span className="text-xs font-mono font-semibold text-[#BDBDC1] uppercase tracking-wider">
              Scan Telemetry
            </span>
            <span className="text-[10px] font-mono text-[#EFEFF0] bg-[#3C3C42]/30 border border-[#3C3C42]/60 px-2 py-0.5 rounded-full">
              Synthetic demo data
            </span>
          </div>

          <div className="space-y-6">
            {stats.map((s, idx) => {
              const isActive = activeStatIdx === idx;
              return (
                <div
                  key={s.label}
                  ref={(el) => {
                    statRefs.current[idx] = el;
                  }}
                  onClick={() => setActiveStatIdx(idx)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
                    isActive
                      ? 'border-[#3C3C42] bg-[#3C3C42]/30 backdrop-blur-md'
                      : 'border-[#3C3C42]/40 bg-[#3C3C42]/10 backdrop-blur-md hover:border-[#3C3C42]/70 hover:bg-[#3C3C42]/20'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#EFEFF0] font-mono">
                      {s.numericDisplay}
                    </span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold tracking-wider text-[#7D7E84] uppercase pt-1">
                    {s.label}
                    {s.sublabel && (
                      <span className="ml-2 text-[10px] text-[#BDBDC1] font-normal normal-case font-mono">
                        ({s.sublabel})
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-[#EFEFF0] pt-1">
                    {s.headline}
                  </h4>
                  <p className="text-xs text-[#BDBDC1] leading-relaxed pt-1">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sticky Product Console Column (7 cols) */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="lg:col-span-7 lg:sticky lg:top-24 rounded-2xl border border-[#3C3C42]/50 bg-[#121214]/90 overflow-hidden backdrop-blur-md transition-all duration-300"
        >
          {/* Console Window Top Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#3C3C42]/50 bg-[#1a1a1e]/80 px-4 sm:px-6 py-3 gap-2">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <span className="font-mono text-xs font-semibold text-[#EFEFF0]">
                package-lock.json • Security Console
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#BDBDC1] bg-[#3C3C42]/30 border border-[#3C3C42]/60 px-2 py-0.5 rounded">
                Synthetic demo data
              </span>
            </div>
          </div>

          {/* Console Subheader with Tabs */}
          <div className="flex items-center justify-between border-b border-[#3C3C42]/40 bg-[#010101]/60 px-4 sm:px-6 py-2.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('profile')}
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-[#3C3C42]/60 text-[#EFEFF0]'
                    : 'text-[#BDBDC1] hover:text-[#EFEFF0]'
                }`}
              >
                Active Finding
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'issues'
                    ? 'bg-[#3C3C42]/60 text-[#EFEFF0]'
                    : 'text-[#BDBDC1] hover:text-[#EFEFF0]'
                }`}
              >
                Catalog ({findings.length || 4})
              </button>
            </div>

            <div className="text-[11px] font-mono text-[#7D7E84]">
              Stage: <span className="text-[#EFEFF0] font-semibold">{stats[activeStatIdx].label.split(' ')[0]}</span>
            </div>
          </div>

          {/* Console Main Content Body */}
          <div className="p-4 sm:p-6 space-y-4 min-h-[320px]">
            {activeFinding ? (
              <div className="space-y-4">
                {/* Finding Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-white">
                        {activeFinding.packageName}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        @{activeFinding.installedVersion}
                      </span>
                      <span className="text-[10px] font-mono rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                        {activeFinding.dependencyType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {activeFinding.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <RiskBadge level={activeFinding.riskLevel} />
                    <OsvBadge in_osv={activeFinding.in_osv} state={activeFinding.osvLookupState} />
                  </div>
                </div>

                {/* Evidence & Lead-Time Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-3 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      Advised Lead Time (Illustrative, synthetic demo value)
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-mono font-bold text-cyan-400">
                        {activeFinding.firstSignalAt ? '+9.4 days' : 'Provisional'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        before official CVE
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-3 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      Heuristic Confidence
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-mono font-bold text-emerald-400">
                        {Math.round((activeFinding.confidence ?? 0.92) * 100)}%
                      </span>
                      <span className="text-[11px] text-slate-400">
                        rule-based match
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terminal Evidence Stream */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] border-b border-slate-800 pb-1.5 mb-1.5">
                    <Terminal className="h-3 w-3 text-cyan-400" />
                    <span>Evidence Pipeline Log (Synthetic Telemetry)</span>
                  </div>
                  {activeFinding.evidenceQuotes?.[0] ? (
                    <p className="text-cyan-300 text-[11px] leading-relaxed">
                      &gt; &quot;{activeFinding.evidenceQuotes[0].quote}&quot;
                    </p>
                  ) : (
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      &gt; No public exploit threads observed. OSV database matched advisory baseline.
                    </p>
                  )}
                  {activeFinding.sources?.[0]?.safeUrl && (
                    <p className="text-slate-400 text-[10px] truncate">
                      Source: {activeFinding.sources[0].safeUrl}
                    </p>
                  )}
                </div>

                {/* Interactive Action Button to Open Evidence Drawer */}
                <button
                  onClick={() => onSelectFinding(activeFinding)}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700/80 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span>Open Full Evidence Dossier &amp; Remediation</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-xs text-slate-400 font-mono">
                No active finding selected
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
