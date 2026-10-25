'use client';

import React from 'react';
import { ReplayCase } from '@/data/replay';
import { WhatIfEvaluation } from '@/utils/rulesEngine';
import { Printer, X, ShieldAlert, FileText } from 'lucide-react';

interface IncidentOnePagerProps {
  isOpen: boolean;
  onClose: () => void;
  replayCase: ReplayCase;
  evaluation: WhatIfEvaluation;
  currentTimeStr: string;
}

export function IncidentOnePager({
  isOpen,
  onClose,
  replayCase,
  evaluation,
  currentTimeStr,
}: IncidentOnePagerProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-4xl bg-[#faf8f5] text-slate-900 border border-[#e2dcd0] rounded-lg shadow-2xl p-6 sm:p-8 font-sans my-auto">
        {/* Top Action Bar (hidden when printing) */}
        <div className="print:hidden flex items-center justify-between pb-4 mb-6 border-b border-[#e5dfd3]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
              DepShield Incident One-Pager (Forensic Dossier)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 text-slate-100 rounded text-xs font-mono font-medium flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dossier Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-500 font-bold">
              Supply-Chain Incident Assessment Report
            </span>
            <span className="font-mono text-xs bg-slate-900 text-slate-100 px-2 py-0.5 rounded font-bold">
              MODE: REPLAY (RECONSTRUCTED)
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 mb-1">
            {replayCase.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 mt-2">
            <span>Date: <strong>{replayCase.dateStr}</strong></span>
            <span>Target Package: <strong className="bg-slate-200/80 px-1 py-0.5 rounded">{replayCase.headlinePackage}@{replayCase.headlineVersion}</strong></span>
            <span>Lead Time: <strong>{replayCase.leadTime.computedDisplay}</strong></span>
            <span>As Of Evaluation: <strong>{currentTimeStr} UTC</strong></span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-700">
              1. Incident Mechanism & Anatomy
            </h2>
            <p className="text-sm text-slate-800 leading-relaxed font-serif">
              {replayCase.description}
            </p>
            <div className="bg-slate-100 border border-slate-300 rounded p-3 text-xs text-slate-800 font-mono">
              <strong>Execution Mechanism:</strong> {replayCase.mechanism}
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1">
                Deterministic Decision
              </span>
              <div className="text-lg font-mono font-bold text-slate-900 mb-1">
                STATUS: {evaluation.riskLevel}
              </div>
              <div className="text-xs font-mono text-slate-700 bg-white border border-slate-300 rounded p-1.5 mb-2">
                {evaluation.ruleFired}
              </div>
              <p className="text-xs text-slate-600 font-serif leading-snug">
                {evaluation.statusExplanation}
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-3 pt-2 border-t border-slate-300">
              CVE Timestamp: <strong>{replayCase.cveStatus}</strong>
            </div>
          </div>
        </div>

        {/* Timeline of Reconstructed Evidence */}
        <div className="mb-6">
          <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-700 mb-2">
            2. Verified Chronological Evidence Lane
          </h2>
          <div className="border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-200/80 text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="p-2">UTC Time</th>
                  <th className="p-2">Lane</th>
                  <th className="p-2">Source Origin</th>
                  <th className="p-2">Verbatim Quote / Finding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                {replayCase.timeline.map((ev) => (
                  <tr key={ev.id}>
                    <td className="p-2 whitespace-nowrap font-bold text-slate-900">{ev.timestamp}</td>
                    <td className="p-2 uppercase text-[10px] text-slate-500">
                      {ev.lane === 'public_signals' ? 'Public Signal' : 'Registry'}
                    </td>
                    <td className="p-2 font-medium">{ev.sourceName}</td>
                    <td className="p-2 font-serif text-slate-900">&ldquo;{ev.quote}&rdquo;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* IOCs and Scale Disagreements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono mb-6">
          <div className="bg-white border border-slate-300 rounded p-3">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Defanged Indicators of Compromise (IOCs)</span>
            </div>
            {replayCase.iocs.length > 0 ? (
              <ul className="space-y-1.5">
                {replayCase.iocs.map((ioc) => (
                  <li key={ioc.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-bold text-slate-900 select-all">{ioc.defanged}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{ioc.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-500 italic">No IOCs recorded for clean baseline.</div>
            )}
          </div>

          <div className="bg-white border border-slate-300 rounded p-3">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              Disputed Ecosystem Impact Scale
            </div>
            <ul className="space-y-1.5">
              {replayCase.disputedScale.map((d, i) => (
                <li key={i} className="border-b border-slate-100 pb-1">
                  <div className="font-bold text-slate-900">{d.source}:</div>
                  <div className="text-slate-600">{d.claim}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="border-t border-slate-300 pt-3 text-[10px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>{replayCase.reconstructedDisclaimer}</div>
          <div>Generated by DepShield • Forensic Supply Chain Matrix</div>
        </div>
      </div>
    </div>
  );
}
