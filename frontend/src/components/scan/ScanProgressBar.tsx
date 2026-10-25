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
    <div className="rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-6 shadow-sm relative overflow-hidden transition-all animate-in fade-in">
      {/* Top ambient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EFEFF0] via-[#BDBDC1] to-[#7D7E84]" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3C3C42]/40 text-[#EFEFF0] border border-[#3C3C42]/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#EFEFF0]">
                Simulated Supply Chain Threat Scan in Progress
              </h3>
              <span className="rounded bg-[#3C3C42]/30 px-2 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/50">
                100% Offline
              </span>
            </div>
            <p className="text-xs text-[#BDBDC1] mt-0.5">{progressState.currentMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="font-mono text-xl font-bold text-[#EFEFF0]">
            {progressState.progressPercent}%
          </span>
          <span className="text-xs text-[#7D7E84]">
            ({(progressState.elapsedMs / 1000).toFixed(1)}s)
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="mt-2 h-2.5 w-full rounded-full bg-[#010101]/80 overflow-hidden p-0.5 border border-[#3C3C42]/50">
        <div
          className="h-full rounded-full bg-[#EFEFF0] transition-all duration-300 ease-out"
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
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : status === 'active'
                  ? 'border-[#3C3C42] bg-[#3C3C42]/40 text-[#EFEFF0]'
                  : 'border-[#3C3C42]/40 bg-[#010101]/40 text-[#7D7E84]'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  status === 'active' ? 'animate-pulse text-[#EFEFF0]' : ''
                }`}
              />
              <span className="truncate font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Telemetry Console line */}
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#010101]/80 px-3 py-1.5 text-[11px] font-mono text-[#BDBDC1] border border-[#3C3C42]/50">
        <Terminal className="h-3.5 w-3.5 text-[#BDBDC1] flex-shrink-0" />
        <span className="text-[#EFEFF0]">depshield@local:</span>
        <span className="truncate">{progressState.stageLabel} &bull; {progressState.currentMessage}</span>
      </div>
    </div>
  );
}
