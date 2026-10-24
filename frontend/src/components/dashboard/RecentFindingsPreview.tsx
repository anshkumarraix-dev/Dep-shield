'use client';

import React from 'react';
import { SecurityFinding } from '@/types';
import { RiskBadge, OsvBadge } from './FindingsTable';
import { ShieldAlert, ChevronRight } from 'lucide-react';

interface RecentFindingsPreviewProps {
  findings: SecurityFinding[];
  onSelectFinding?: (finding: SecurityFinding) => void;
}

export function RecentFindingsPreview({
  findings,
  onSelectFinding,
}: RecentFindingsPreviewProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cyan-400" />
            Detected Supply Chain Findings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time vulnerability telemetry across parsed dependency manifests
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
          {findings.length} Findings Active
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] font-semibold uppercase text-slate-500">
              <th className="pb-3 pl-2">Risk</th>
              <th className="pb-3">Package / Version</th>
              <th className="pb-3">Dependency Type</th>
              <th className="pb-3">CVE / Advisory</th>
              <th className="pb-3">OSV State</th>
              <th className="pb-3 pr-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {findings.slice(0, 5).map((finding) => (
              <tr
                key={finding.id}
                onClick={() => onSelectFinding?.(finding)}
                className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <td className="py-3 pl-2 whitespace-nowrap">
                  <RiskBadge level={finding.riskLevel} />
                </td>
                <td className="py-3 pr-4 max-w-xs">
                  <div className="font-medium text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                    {finding.packageName}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Installed: <span className="text-slate-300">v{finding.installedVersion}</span>
                    {finding.fixedVersion && (
                      <span className="text-slate-500 ml-1">
                        &rarr; <span className="text-emerald-400">v{finding.fixedVersion}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 whitespace-nowrap">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300 border border-slate-700">
                    {finding.dependencyType}
                  </span>
                </td>
                <td className="py-3 whitespace-nowrap">
                  {finding.advisoryId ? (
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700/60">
                      {finding.advisoryId}
                    </span>
                  ) : (
                    <span className="text-slate-500">N/A</span>
                  )}
                </td>
                <td className="py-3 whitespace-nowrap">
                  <OsvBadge state={finding.osvLookupState} in_osv={finding.in_osv} />
                </td>
                <td className="py-3 pr-2 whitespace-nowrap text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-cyan-400 transition-colors">
                    <span>Inspect</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
