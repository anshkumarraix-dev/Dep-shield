'use client';

import React from 'react';
import {
  FileSearch,
  Database,
  Search,
  CheckCircle2,
  BarChart3,
  ShieldAlert,
  Loader2,
  Terminal,
} from 'lucide-react';
import { ScanProgressState } from '@/types';

interface ScanProgressBarProps {
  progressState: ScanProgressState;
}

export function ScanProgressBar({ progressState }: ScanProgressBarProps) {
  const steps = [
    { key: 'parsing', label: '1. Parsing', icon: FileSearch },
    { key: 'baseline', label: '2. Baseline', icon: Database },
    { key: 'signals', label: '3. Signals', icon: Search },
    { key: 'evidence', label: '4. Evidence', icon: CheckCircle2 },
    { key: 'scoring', label: '5. Scoring', icon: BarChart3 },
    { key: 'findings', label: '6. Findings', icon: ShieldAlert },
  ];

  const getStepStatus = (stepKey: string) => {
    const stageOrder = [
      'idle',
      'parsing',
      'baseline',
      'signals',
      'evidence',
      'scoring',
      'findings',
      'completed',
    ];
    const currentIndex = stageOrder.indexOf(progressState.stage);
    const stepIndex = stageOrder.indexOf(stepKey);

    if (progressState.stage === 'completed' || currentIndex > stepIndex) {
      return 'completed';
    }
    if (currentIndex === stepIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl relative overflow-hidden transition-all animate-in fade-in">
      {/* Top glowing ambient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Simulated Supply Chain Threat Scan in Progress
              </h3>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                DEMO MODE — 100% OFFLINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{progressState.currentMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="font-mono text-xl font-bold text-cyan-400">
            {progressState.progressPercent}%
          </span>
          <span className="text-xs text-slate-500">
            ({(progressState.elapsedMs / 1000).toFixed(1)}s)
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="mt-2 h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 transition-all duration-300 ease-out shadow-lg shadow-cyan-500/50"
          style={{ width: `${progressState.progressPercent}%` }}
        />
      </div>

      {/* 6 Step Indicators */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition-all ${
                status === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : status === 'active'
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                  : 'border-slate-800/60 bg-slate-950/40 text-slate-500'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  status === 'active' ? 'animate-pulse text-cyan-400' : ''
                }`}
              />
              <span className="truncate font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Telemetry Console line with Scope Note */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-1.5 text-[11px] font-mono text-slate-400 border border-slate-800">
        <div className="flex items-center gap-2 truncate">
          <Terminal className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
          <span className="text-cyan-400">depshield@local:</span>
          <span className="truncate">{progressState.stageLabel} &bull; {progressState.currentMessage}</span>
        </div>
        <span className="text-[10px] text-slate-500 shrink-0">
          Scope: at most 4 direct packages analysed
        </span>
      </div>
    </div>
  );
}
