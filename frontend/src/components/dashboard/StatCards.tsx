'use client';

import React from 'react';
import { ShieldCheck, AlertOctagon, Layers, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { ScanSummaryMetrics } from '@/types';
import { TiltCard } from '@/components/ui/TiltCard';

interface StatCardsProps {
  metrics: ScanSummaryMetrics;
  onFilterClick?: (filterType: 'riskLevel' | 'dependencyType' | 'section', value: string) => void;
}

export function StatCards({ metrics, onFilterClick }: StatCardsProps) {
  const isHealthy = metrics.criticalCount === 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-4 transition-all hover:border-[#3C3C42]/90 hover:bg-[#3C3C42]/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#BDBDC1]">{card.title}</span>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3C3C42]/60 bg-[#3C3C42]/20 text-[#EFEFF0]"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isHealthy ? 'Protected & Verified' : 'Vulnerabilities Detected'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Deterministic lead-time engine</span>
            <span className="flex items-center gap-0.5 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
              Inspect <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </TiltCard>

      {/* Card 2: Threats & Risk Alerts */}
      <TiltCard className="card-glass-elevated p-6 cursor-pointer group" maxTilt={6}>
        <div
          onClick={() => onFilterClick?.('riskLevel', metrics.criticalCount > 0 ? 'CRITICAL' : 'HIGH')}
          className="flex flex-col justify-between h-full space-y-4"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Prioritized Threats
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertOctagon className="h-5 w-5" />
            </div>
          </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#EFEFF0] font-mono">{card.value}</span>
              {card.isPulsing && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
              {metrics.highCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  {metrics.highCount} High
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
                {metrics.watchCount} Watch
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{metrics.osvMatchesCount} correlated with OSV baseline</span>
            <span className="flex items-center gap-0.5 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
              Filter <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </TiltCard>

      {/* Card 3: Dependency Inventory Scope */}
      <TiltCard className="card-glass-elevated p-6 cursor-pointer group" maxTilt={6}>
        <div
          onClick={() => onFilterClick?.('section', 'dependencies')}
          className="flex flex-col justify-between h-full space-y-4"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Dependency Scope
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
                {metrics.totalDependenciesScanned}
              </span>
              <span className="text-sm font-medium text-slate-400">packages resolved</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {metrics.directCount} Direct
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {metrics.transitiveCount} Transitive
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Analyzed top direct roots</span>
            <span className="flex items-center gap-0.5 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
              View Tree <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
