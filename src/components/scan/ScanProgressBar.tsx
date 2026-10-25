'use client';

import React from 'react';
import {
  FileSearch,
  CheckCircle2,
  Database,
  ShieldAlert,
  BarChart3,
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
    { key: 'baseline', label: '2. Baseline', icon: CheckCircle2 },
    { key: 'osv_checks', label: '3. OSV Checks', icon: Database },
    { key: 'evidence_collection', label: '4. Evidence', icon: ShieldAlert },
    { key: 'risk_evaluation', label: '5. Risk Synthesis', icon: BarChart3 },
  ];

  const getStepStatus = (stepKey: string) => {
    const stageOrder = ['idle', 'parsing', 'baseline', 'osv_checks', 'evidence_collection', 'risk_evaluation', 'completed'];
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
    <div className="rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-6 shadow-sm relative overflow-hidden transition-all animate-in fade-in">
      {/* Top ambient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EFEFF0] via-[#BDBDC1] to-[#7D7E84]" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
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

      {/* Step Indicators */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
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
