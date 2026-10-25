'use client';

import React from 'react';
import { WhatIfEvaluation } from '@/utils/rulesEngine';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, ShieldAlert } from 'lucide-react';

interface DecisionTraceProps {
  evaluation: WhatIfEvaluation;
  asOfTimeStr: string;
}

export function DecisionTrace({ evaluation, asOfTimeStr }: DecisionTraceProps) {
  const { riskLevel, ruleFired, statusExplanation, gates } = evaluation;

  // Determine badge styling based on strict riskLevel
  const getBadgeStyle = () => {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'bg-rose-950/80 border-rose-500/80 text-rose-300 ring-1 ring-rose-500/40';
      case 'HIGH':
        return 'bg-amber-950/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/40';
      case 'WATCH':
        return 'bg-amber-950/40 border-amber-600/60 text-amber-400';
      case 'INFO':
        return 'bg-slate-800 border-slate-700 text-slate-300';
      case 'UNKNOWN':
      default:
        return 'bg-slate-800 border-slate-600 text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-3.5 flex flex-col justify-between">
      <div>
        {/* Header with live evaluated status badge */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">
              Deterministic Decision Trace
            </div>
            <div className="text-xs text-slate-300 font-mono">
              Evaluated as of: <span className="text-amber-400 font-semibold tabular-nums">{asOfTimeStr}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider border ${getBadgeStyle()}`}
            >
              STATUS: {riskLevel}
            </span>
          </div>
        </div>

        {/* Vertical list of gates */}
        <div className="space-y-2.5">
          {gates.map((gate, idx) => {
            let icon = <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />;
            let borderColor = 'border-slate-800 bg-slate-950/60';
            let titleColor = 'text-slate-300';

            if (gate.status === 'passed') {
              icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
              borderColor = 'border-emerald-900/60 bg-emerald-950/20';
              titleColor = 'text-emerald-300';
            } else if (gate.status === 'warning') {
              icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
              borderColor = 'border-amber-900/60 bg-amber-950/20';
              titleColor = 'text-amber-300';
            } else if (gate.status === 'failed') {
              icon = <XCircle className="w-4 h-4 text-slate-500 shrink-0" />;
              borderColor = 'border-slate-800 bg-slate-950/40';
              titleColor = 'text-slate-400';
            } else if (gate.status === 'unknown') {
              icon = <HelpCircle className="w-4 h-4 text-amber-500/80 shrink-0" />;
              borderColor = 'border-amber-900/40 bg-amber-950/10';
              titleColor = 'text-amber-400/90';
            }

            return (
              <div
                key={gate.gateId}
                className={`border rounded p-2.5 transition-colors ${borderColor}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {icon}
                  <span className={`text-xs font-semibold ${titleColor}`}>
                    Gate {idx + 1}: {gate.name}
                  </span>
                  <span className="text-[10px] uppercase font-mono ml-auto text-slate-500">
                    {gate.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pl-6 leading-tight">
                  {gate.details}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Final Fired Rule Banner */}
      <div className="mt-3.5 pt-3 border-t border-slate-800">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Authoritative Deterministic Fired Rule</span>
        </div>
        <div className="font-mono text-xs font-semibold text-amber-300 bg-slate-950 border border-slate-800/90 rounded px-2.5 py-1.5">
          {ruleFired}
        </div>
        <div className="text-[11px] text-slate-400 mt-1.5">
          {statusExplanation}
        </div>
      </div>
    </div>
  );
}
