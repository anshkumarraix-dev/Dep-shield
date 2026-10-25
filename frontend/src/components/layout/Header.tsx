'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, Sparkles, Terminal, Menu, Play } from 'lucide-react';
import { envConfig } from '@/config/env';

interface HeaderProps {
  onRefresh?: () => void;
  isScanning?: boolean;
  onToggleMobileMenu?: () => void;
  onSelectReplayPreset?: (presetId: string) => void;
  currentReplayCase?: string;
}

export function Header({
  onRefresh,
  isScanning = false,
  onToggleMobileMenu,
  onSelectReplayPreset,
  currentReplayCase,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 sm:px-6 md:px-8 backdrop-blur-md shadow-xs">
      {/* Brand & Left Controls */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-slate-900 font-sans">
                DepShield
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200/80">
                v1.0 MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              npm Supply Chain Threat Radar
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls: Quick Replay Presets + Status Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Replay Dropdown / Pill */}
        {onSelectReplayPreset && (
          <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-slate-700">Replay Case:</span>
            <select
              value={currentReplayCase || ''}
              onChange={(e) => onSelectReplayPreset(e.target.value)}
              className="bg-transparent text-xs font-medium text-blue-700 font-mono focus:outline-none cursor-pointer"
            >
              <option value="event-stream-2018">event-stream (2018)</option>
              <option value="ua-parser-js-2021">ua-parser-js (2021)</option>
              <option value="benign-control-clean">benign-clean</option>
            </select>
          </div>
        )}

        {/* Demo Mode Badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-700 text-[11px]">
            {envConfig.useMocks ? 'Demo Fixtures' : 'Live Connected'}
          </span>
        </div>

        {/* Re-Scan Action Button */}
        <button
          onClick={onRefresh}
          disabled={isScanning}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Restart investigation on current package-lock.json"
          aria-label="Restart scan"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Re-Scan'}</span>
        </button>
      </div>
    </header>
  );
}
