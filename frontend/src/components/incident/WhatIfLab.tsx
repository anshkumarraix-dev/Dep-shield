'use client';

import React, { useState } from 'react';
import { evaluateDeterministicRules, WhatIfInput, WhatIfEvaluation } from '@/utils/rulesEngine';
import { Sliders, RefreshCw } from 'lucide-react';

interface WhatIfLabProps {
  initialInput?: Partial<WhatIfInput>;
}

export function WhatIfLab({ initialInput }: WhatIfLabProps) {
  const [sourceCount, setSourceCount] = useState<number>(initialInput?.independentSourceCount ?? 2);
  const [exactVersion, setExactVersion] = useState<boolean>(initialInput?.exactVersionMatched ?? true);
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'>(
    initialInput?.severity ?? 'CRITICAL'
  );
  const [hasHook, setHasHook] = useState<boolean>(initialInput?.hasInstallScript ?? true);
  const [osvState, setOsvState] = useState<'matched' | 'clean' | 'unverified'>(
    initialInput?.osvMatched === true ? 'matched' : initialInput?.osvMatched === false ? 'clean' : 'unverified'
  );

  const evaluation: WhatIfEvaluation = evaluateDeterministicRules({
    independentSourceCount: sourceCount,
    exactVersionMatched: exactVersion,
    severity,
    hasInstallScript: hasHook,
    osvMatched: osvState === 'matched' ? true : osvState === 'clean' ? false : null,
  });

  const getStatusBadge = () => {
    switch (evaluation.riskLevel) {
      case 'CRITICAL':
        return 'bg-rose-950/80 border-rose-500 text-rose-300';
      case 'HIGH':
        return 'bg-amber-950/80 border-amber-500 text-amber-300';
      case 'WATCH':
        return 'bg-amber-950/40 border-amber-600/70 text-amber-400';
      case 'INFO':
        return 'bg-slate-800 border-slate-700 text-slate-300';
      case 'UNKNOWN':
      default:
        return 'bg-slate-800 border-slate-600 text-slate-400';
    }
  };

  const handleReset = () => {
    setSourceCount(2);
    setExactVersion(true);
    setSeverity('CRITICAL');
    setHasHook(true);
    setOsvState('unverified');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-4">
      {/* Header with Mandatory Disclaimer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            WHAT-IF SIMULATION LAB
          </span>
        </div>
        <div className="text-[10px] font-mono text-amber-400 bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded">
          ILLUSTRATIVE SIMULATION — BACKEND IS AUTHORITATIVE
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Controls Column */}
        <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded p-3 text-xs">
          {/* Source Independence Control */}
          <div>
            <div className="flex items-center justify-between font-mono text-slate-300 mb-1">
              <span>Independent Original Sources:</span>
              <span className="text-amber-400 font-bold">{sourceCount}</span>
            </div>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSourceCount(val)}
                  className={`flex-1 py-1 rounded font-mono text-xs border transition-colors ${
                    sourceCount === val
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {val === 3 ? '3+ sources' : `${val} source${val === 1 ? '' : 's'}`}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Rule: Single source signals cap at WATCH; ≥2 independent sources required for HIGH/CRITICAL.
            </div>
          </div>

          {/* Exact Version Match Toggle */}
          <div>
            <div className="flex items-center justify-between font-mono text-slate-300 mb-1">
              <span>Exact Installed Version Match:</span>
              <span className={exactVersion ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {exactVersion ? 'Confirmed' : 'Unconfirmed'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExactVersion(true)}
                className={`flex-1 py-1 rounded font-mono text-xs border transition-colors ${
                  exactVersion
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Exact Match (keyv@6.0.0)
              </button>
              <button
                type="button"
                onClick={() => setExactVersion(false)}
                className={`flex-1 py-1 rounded font-mono text-xs border transition-colors ${
                  !exactVersion
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Unconfirmed (general keyv)
              </button>
            </div>
          </div>

          {/* Severity & Install Hook Toggles */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div>
              <span className="font-mono text-slate-300 block mb-1">Malicious Payload:</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN')}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              >
                <option value="CRITICAL">CRITICAL (Worm/Execution)</option>
                <option value="HIGH">HIGH (Data exfil)</option>
                <option value="MEDIUM">MEDIUM (Tamper)</option>
                <option value="LOW">LOW (Protest)</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
            </div>

            <div>
              <span className="font-mono text-slate-300 block mb-1">OSV Baseline:</span>
              <select
                value={osvState}
                onChange={(e) => setOsvState(e.target.value as 'matched' | 'clean' | 'unverified')}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              >
                <option value="unverified">Unverified (not in OSV)</option>
                <option value="matched">Matched Advisory</option>
                <option value="clean">Verified Clean</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setHasHook(!hasHook)}
              className={`px-2 py-1 rounded font-mono text-[11px] border flex items-center gap-1.5 transition-colors ${
                hasHook
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span>Install-time Hook (preinstall)</span>: {hasHook ? 'Active' : 'None'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Live Simulation Output Column */}
        <div className="bg-slate-950 border border-slate-800 rounded p-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold mb-1">
              Simulated Deterministic Output
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">Evaluated Status:</span>
              <span
                className={`px-3 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider border ${getStatusBadge()}`}
              >
                {evaluation.riskLevel}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded p-2 mb-2 font-mono text-xs text-amber-300">
              {evaluation.ruleFired}
            </div>

            <div className="text-xs text-slate-300 leading-relaxed">
              {evaluation.statusExplanation}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
            Safety Guarantee:{' '}
            <span className={evaluation.isSafe ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {evaluation.isSafe ? 'Verified Safe Baseline' : 'Not declared safe (strict closed-world policy)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
