'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileSearch,
  Database,
  Search,
  CheckCircle2,
  BarChart3,
  ShieldAlert,
  Loader2,
  Terminal,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { ScanProgressState } from '@/types';

interface ScanProgressBarProps {
  progressState: ScanProgressState;
  onViewFindings?: () => void;
}

export function ScanProgressBar({ progressState, onViewFindings }: ScanProgressBarProps) {
  const [showTerminal, setShowTerminal] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const steps = [
    { key: 'parsing', label: '1. Parsing', icon: FileSearch },
    { key: 'baseline', label: '2. Baseline', icon: Database },
    { key: 'signals', label: '3. Signals', icon: Search },
    { key: 'evidence', label: '4. Evidence', icon: CheckCircle2 },
    { key: 'scoring', label: '5. Scoring', icon: BarChart3 },
    { key: 'findings', label: '6. Findings', icon: ShieldAlert },
  ];

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [progressState.logs]);

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

  const isComplete = progressState.stage === 'completed';

  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-all animate-in fade-in">
      {/* Top glowing ambient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {isComplete
                  ? 'Supply Chain Threat Analysis Finalized'
                  : 'Live Supply Chain Threat Investigation in Progress'}
              </h3>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                DEMO MODE — SYNTHETIC THREAT DATA
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-mono">
              {progressState.currentMessage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="text-right">
            <span className="font-mono text-2xl font-bold text-cyan-400">
              {progressState.progressPercent}%
            </span>
            <div className="text-[11px] text-slate-400 font-mono">
              Elapsed: {(progressState.elapsedMs / 1000).toFixed(1)}s
            </div>
          </div>
          {isComplete && onViewFindings && (
            <button
              onClick={onViewFindings}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30"
            >
              View Findings &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="mt-4 h-2.5 w-full rounded-full bg-slate-950 overflow-hidden p-0.5 border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out shadow-lg ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-emerald-500/40'
              : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 shadow-cyan-500/50'
          }`}
          style={{ width: `${progressState.progressPercent}%` }}
        />
      </div>

      {/* 6 Step Indicators */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition-all ${
                status === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-medium'
                  : status === 'active'
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/50 font-semibold shadow-md shadow-cyan-500/10'
                  : 'border-slate-800/60 bg-slate-950/40 text-slate-500'
              }`}
            >
              {status === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 flex-shrink-0" />
              ) : status === 'completed' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Icon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Prioritized Package Inspection Radar Bar */}
      {progressState.analyzedPackages && progressState.analyzedPackages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px] font-sans">
            <Package className="h-3.5 w-3.5 text-cyan-400" />
            <span>Deep Threat Scope (Prioritized &le;4 pkgs):</span>
          </span>
          {progressState.analyzedPackages.map((pkg) => {
            const isActive = progressState.activePackage === pkg;
            return (
              <span
                key={pkg}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] transition-all border ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 animate-pulse font-bold'
                    : isComplete
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />}
                <span>{pkg}</span>
                {isComplete && <span className="text-emerald-400 text-[10px]">&check;</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Live Streaming Terminal Console */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-inner">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 ml-2">
              <Terminal className="h-3 w-3 text-cyan-400" />
              <span>depshield-agent: live-telemetry-stream</span>
            </div>
          </div>
          <button
            onClick={() => setShowTerminal((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>{showTerminal ? 'Hide Terminal' : 'Show Terminal'}</span>
            {showTerminal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Terminal Body */}
        {showTerminal && (
          <div
            ref={terminalRef}
            className="p-3.5 max-h-48 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
          >
            {(!progressState.logs || progressState.logs.length === 0) ? (
              <div className="text-slate-500 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                <span>Initializing DepShield manifest ingestion...</span>
              </div>
            ) : (
              progressState.logs.map((log, index) => {
                let badgeColor = 'text-slate-400';
                if (log.includes('[PARSER]')) badgeColor = 'text-cyan-400';
                if (log.includes('[BASELINE]')) badgeColor = 'text-blue-400';
                if (log.includes('[SIGNALS]')) badgeColor = 'text-amber-400';
                if (log.includes('[EVIDENCE]')) badgeColor = 'text-purple-400';
                if (log.includes('[SCORING]')) badgeColor = 'text-orange-400';
                if (log.includes('[FINDINGS]')) badgeColor = 'text-emerald-400';
                if (log.includes('[COMPLETE]')) badgeColor = 'text-emerald-300 font-bold';

                return (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none text-[10px]">{index + 1}</span>
                    <span className={`${badgeColor} break-all`}>{log}</span>
                  </div>
                );
              })
            )}
            {!isComplete && (
              <div className="flex items-center gap-1 text-cyan-400 text-[10px] pt-1">
                <span className="animate-pulse">&gt;</span>
                <span className="h-3 w-1.5 bg-cyan-400 animate-pulse inline-block" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
