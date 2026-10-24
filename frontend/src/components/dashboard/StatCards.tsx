import React from 'react';
import { ShieldCheck, AlertOctagon, AlertTriangle, Layers, Database } from 'lucide-react';
import { ScanSummaryMetrics } from '@/types';

interface StatCardsProps {
  metrics: ScanSummaryMetrics;
}

export function StatCards({ metrics }: StatCardsProps) {
  const cards = [
    {
      title: 'Shield Security Score',
      value: `${metrics.shieldScore}/100`,
      status: metrics.shieldScore >= 80 ? 'Robust Defense Posture' : 'Remediation Required',
      statusColor: metrics.shieldScore >= 80 ? 'text-emerald-400' : 'text-amber-400',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      bgGlow: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-slate-800',
    },
    {
      title: 'Critical CVEs',
      value: metrics.criticalCount,
      status: metrics.criticalCount > 0 ? 'Immediate Attention Required' : 'Zero Critical Risks',
      statusColor: metrics.criticalCount > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400',
      icon: AlertOctagon,
      iconColor: 'text-rose-400',
      bgGlow: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-900/40',
      isPulsing: metrics.criticalCount > 0,
    },
    {
      title: 'High & Watch Risks',
      value: metrics.highCount + metrics.watchCount,
      status: `${metrics.highCount} High Severity, ${metrics.watchCount} Watchlist`,
      statusColor: 'text-amber-400',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      bgGlow: 'from-amber-500/10 to-transparent',
      borderColor: 'border-slate-800',
    },
    {
      title: 'Packages Evaluated',
      value: metrics.totalDependenciesScanned,
      status: `${metrics.directCount} direct \u2022 ${metrics.transitiveCount} transitive`,
      statusColor: 'text-slate-400',
      icon: Layers,
      iconColor: 'text-cyan-400',
      bgGlow: 'from-cyan-500/10 to-transparent',
      borderColor: 'border-slate-800',
    },
    {
      title: 'OSV Matched Records',
      value: metrics.osvMatchesCount,
      status: 'Correlated with open telemetry',
      statusColor: 'text-cyan-400',
      icon: Database,
      iconColor: 'text-cyan-400',
      bgGlow: 'from-cyan-500/10 to-transparent',
      borderColor: 'border-slate-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-xl border ${card.borderColor} bg-slate-900/85 p-4 shadow-sm transition-all hover:border-slate-700`}
          >
            {/* Ambient subtle glow */}
            <div
              className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${card.bgGlow} blur-2xl`}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{card.title}</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 ${card.iconColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">{card.value}</span>
              {card.isPulsing && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </div>

            <p className={`mt-1.5 text-[11px] truncate ${card.statusColor}`}>{card.status}</p>
          </div>
        );
      })}
    </div>
  );
}
