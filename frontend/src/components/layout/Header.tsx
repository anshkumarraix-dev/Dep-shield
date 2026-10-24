'use client';

import React, { useState } from 'react';
import { Shield, Upload, Menu, X } from 'lucide-react';
import { envConfig } from '@/config/env';

interface HeaderProps {
  onUploadClick?: () => void;
  onDemoClick?: () => void;
  isScanning?: boolean;
}

export function Header({
  onUploadClick,
  onDemoClick,
  isScanning = false,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: DepShield Wordmark */}
        <div className="flex items-center gap-6">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 group"
            aria-label="DepShield Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5 text-slate-950 fill-current" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                DepShield
              </span>
              <span className="hidden xs:inline-block rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                v0.2
              </span>
            </div>
          </a>

          {/* Desktop Nav Links: How it works, Demo, Findings */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="hover:text-white transition-colors"
            >
              How it works
            </button>
            <button
              onClick={() => {
                if (onDemoClick) onDemoClick();
                handleScrollTo('demo');
              }}
              className="hover:text-white transition-colors"
            >
              Demo
            </button>
            <button
              onClick={() => handleScrollTo('findings')}
              className="hover:text-white transition-colors"
            >
              Findings
            </button>
          </nav>
        </div>

        {/* Right: Mode Badge & Primary Action Button */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Environment Mode Indicator Badge */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs"
            title={envConfig.useMocks ? 'Offline Synthetic Mock Mode' : 'Connected to FastAPI Backend'}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                envConfig.useMocks ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-slate-400 font-medium">Mode:</span>
            <span className="font-semibold text-slate-200">
              {envConfig.useMocks ? 'Mock Demo' : 'Live Backend'}
            </span>
          </div>

          {/* One Primary Button: Upload package-lock.json */}
          <button
            onClick={() => {
              if (onUploadClick) onUploadClick();
              handleScrollTo('upload');
            }}
            disabled={isScanning}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-all hover:bg-cyan-400 active:scale-95 shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload package-lock.json</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2 text-xs font-medium text-slate-300">
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="text-left px-2 py-1.5 rounded hover:bg-slate-900"
            >
              How it works
            </button>
            <button
              onClick={() => {
                if (onDemoClick) onDemoClick();
                handleScrollTo('demo');
              }}
              className="text-left px-2 py-1.5 rounded hover:bg-slate-900"
            >
              Demo
            </button>
            <button
              onClick={() => handleScrollTo('findings')}
              className="text-left px-2 py-1.5 rounded hover:bg-slate-900"
            >
              Findings
            </button>
          </nav>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400">Mode:</span>
            <span className="font-semibold text-cyan-300">
              {envConfig.useMocks ? 'Mock Demo' : 'Live Backend'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
