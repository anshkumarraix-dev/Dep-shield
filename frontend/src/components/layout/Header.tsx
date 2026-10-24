'use client';

import React from 'react';
import { Search, Bell, RefreshCw, Terminal, Menu } from 'lucide-react';
import { envConfig } from '@/config/env';

interface HeaderProps {
  onRefresh?: () => void;
  isScanning?: boolean;
  onToggleMobileMenu?: () => void;
}

export function Header({
  onRefresh,
  isScanning = false,
  onToggleMobileMenu,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Mobile menu trigger + Search Bar */}
      <div className="flex items-center gap-3 w-full max-w-xs sm:max-w-sm md:max-w-md">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="global-header-search"
            aria-label="Search dependencies, CVE-IDs, or packages"
            type="text"
            placeholder="Search dependencies, CVE-IDs, or packages..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Environment Mode Indicator Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              envConfig.useMocks ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          <span className="text-slate-400 font-medium">Mode:</span>
          <span className="font-semibold text-slate-200">
            {envConfig.useMocks ? 'Mock Demo' : 'Live FastAPI'}
          </span>
        </div>

        {/* Backend Target indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-md bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400 font-mono border border-slate-800/80">
          <Terminal className="h-3 w-3 text-cyan-400" />
          <span>{envConfig.apiUrl}</span>
        </div>

        {/* Refresh / Scan Action */}
        <button
          onClick={onRefresh}
          disabled={isScanning}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95 disabled:opacity-50"
          title="Run quick scan refresh"
          aria-label="Trigger scan refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">{isScanning ? 'Scanning...' : 'Trigger Scan'}</span>
        </button>

        {/* Notification Bell */}
        <button
          className="relative rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </button>
      </div>
    </header>
  );
}
