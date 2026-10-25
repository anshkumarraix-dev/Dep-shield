'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Upload,
  ChevronDown,
  Menu,
  X,
  Database,
  Radio,
  Layers,
  Sparkles,
  FileCode2,
  SlidersHorizontal,
} from 'lucide-react';
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Track scroll progress and navbar background style
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      if (totalScroll > 0) {
        setScrollProgress((currentScroll / totalScroll) * 100);
      }
      setIsScrolled(currentScroll > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside or Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleScrollTo = (id: string) => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const platformMenuItems = [
    {
      title: 'Tri-State OSV Scanner',
      desc: 'Differentiates Matched vs Clean vs Provisional unknown states.',
      icon: Database,
      targetId: 'findings',
    },
    {
      title: 'Transitive Tree Analyzer',
      desc: 'Parses full dependency trees in npm v2 and v3 package-lock files.',
      icon: Layers,
      targetId: 'upload',
    },
    {
      title: 'Public Signal Correlation',
      desc: 'Monitors early pull requests, issue threads, and maintainer warnings.',
      icon: Radio,
      targetId: 'demo',
    },
  ];

  const architectureMenuItems = [
    {
      title: 'How It Works (4-Step Pipeline)',
      desc: 'Upload, check known DBs, search public warnings, score findings.',
      icon: SlidersHorizontal,
      targetId: 'how-it-works',
    },
    {
      title: 'Manifest Parser Logic',
      desc: 'Client-side zero-leak parsing of direct and transitive trees.',
      icon: FileCode2,
      targetId: 'upload',
    },
    {
      title: 'Honest Limits & Boundaries',
      desc: '4 packages deep-checked per scan due to API budget limits.',
      icon: Sparkles,
      targetId: 'faq',
    },
  ];

  return (
    <header
      ref={navRef}
      className={`sticky top-0 z-40 w-full transition-all duration-200 ${
        isScrolled
          ? 'border-b border-[#3C3C42]/50 bg-[#010101]/85 backdrop-blur-md'
          : 'border-b border-[#3C3C42]/30 bg-[#010101]/60 backdrop-blur-sm'
      }`}
    >
      {/* Scroll Progress Indicator Bar */}
      <div
        className="h-[2px] bg-gradient-to-r from-[#5F5F62] via-[#BDBDC1] to-[#EFEFF0] transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Left: DepShield Wordmark & Dropdown Menus */}
        <div className="flex items-center gap-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84] rounded-lg p-1"
            aria-label="DepShield Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3C3C42]/30 border border-[#3C3C42]/70 text-[#EFEFF0] group-hover:border-[#7D7E84] transition-colors">
              <Shield className="h-4 w-4 fill-current" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#EFEFF0] group-hover:text-white transition-colors">
                DepShield
              </span>
              <span className="rounded bg-[#3C3C42]/20 px-1.5 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/50 hidden xs:inline-block">
                v0.2
              </span>
            </div>
          </a>

          {/* Snyk-style Navigation Links with Dropdown Menus */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            {/* Platform Dropdown */}
            <div className="relative">
              <button
                onClick={() =>
                  setActiveDropdown((curr) => (curr === 'platform' ? null : 'platform'))
                }
                className="flex items-center gap-1 py-2 hover:text-white transition-colors focus:outline-none"
                aria-expanded={activeDropdown === 'platform'}
              >
                <span>Platform</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    activeDropdown === 'platform' ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'platform' && (
                <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    {platformMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.title}
                          onClick={() => handleScrollTo(item.targetId)}
                          className="w-full flex items-start gap-3 rounded-xl p-2.5 text-left hover:bg-slate-900 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mt-0.5">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug">
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Dropdown */}
            <div className="relative">
              <button
                onClick={() =>
                  setActiveDropdown((curr) => (curr === 'arch' ? null : 'arch'))
                }
                className="flex items-center gap-1 py-2 hover:text-white transition-colors focus:outline-none"
                aria-expanded={activeDropdown === 'arch'}
              >
                <span>Architecture</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    activeDropdown === 'arch' ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'arch' && (
                <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    {architectureMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.title}
                          onClick={() => handleScrollTo(item.targetId)}
                          className="w-full flex items-start gap-3 rounded-xl p-2.5 text-left hover:bg-slate-900 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 mt-0.5">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug">
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Links */}
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="py-2 hover:text-white transition-colors"
            >
              How it works
            </button>

            <button
              onClick={() => {
                if (onDemoClick) onDemoClick();
                handleScrollTo('demo');
              }}
              className="py-2 hover:text-white transition-colors"
            >
              Interactive Demo
            </button>

            <button
              onClick={() => handleScrollTo('findings')}
              className="py-2 hover:text-white transition-colors"
            >
              Findings
            </button>
          </nav>
        </div>

        {/* Right: Mode Badge & Primary Action CTA Button */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Environment Mode Badge */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-full border border-[#3C3C42]/50 bg-[#3C3C42]/20 px-3 py-1 text-xs"
            title={envConfig.useMocks ? 'Offline Synthetic Mock Mode' : 'Connected to FastAPI Backend'}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                envConfig.useMocks ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[#7D7E84] font-medium">Mode:</span>
            <span className="font-semibold text-[#EFEFF0]">
              {envConfig.useMocks ? 'Mock Demo' : 'Live FastAPI'}
            </span>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => {
              if (onUploadClick) onUploadClick();
              handleScrollTo('upload');
            }}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-lg bg-[#EFEFF0] px-4 py-2 text-xs font-semibold text-[#010101] transition-all hover:bg-white active:scale-95 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload package-lock.json</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden rounded-lg border border-[#3C3C42]/60 p-2 text-[#BDBDC1] hover:text-[#EFEFF0] hover:bg-[#3C3C42]/30 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation with Focus Trap */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#05070c]/98 px-5 py-6 space-y-4 animate-in slide-in-from-top-2 shadow-2xl">
          <nav className="flex flex-col space-y-3 text-sm font-medium text-slate-200">
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="text-left px-3 py-2 rounded-lg hover:bg-slate-900"
            >
              How it works
            </button>
            <button
              onClick={() => {
                if (onDemoClick) onDemoClick();
                handleScrollTo('demo');
              }}
              className="text-left px-3 py-2 rounded-lg hover:bg-slate-900"
            >
              Interactive Demo
            </button>
            <button
              onClick={() => handleScrollTo('findings')}
              className="text-left px-3 py-2 rounded-lg hover:bg-slate-900"
            >
              Threat Findings Table
            </button>
            <button
              onClick={() => handleScrollTo('faq')}
              className="text-left px-3 py-2 rounded-lg hover:bg-slate-900"
            >
              Transparency &amp; FAQ
            </button>
          </nav>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 font-mono">Environment Mode:</span>
            <span className="font-semibold text-cyan-300 font-mono">
              {envConfig.useMocks ? 'Mock Demo (Offline)' : 'Live FastAPI'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
