'use client';

import React from 'react';
import { Shield, Sparkles, ArrowUp, Play, UploadCloud } from 'lucide-react';
import { envConfig } from '@/config/env';

interface FooterProps {
  onDemoClick?: () => void;
  onUploadClick?: () => void;
}

export function Footer({ onDemoClick, onUploadClick }: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpload = () => {
    if (onUploadClick) onUploadClick();
    const el = document.getElementById('upload');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[#3C3C42]/40 bg-[#010101] pt-16 pb-12 text-[#BDBDC1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-12">
        {/* Main 5-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
          {/* Brand Column (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3C3C42]/40 text-[#EFEFF0] border border-[#3C3C42]/60 font-bold">
                <Shield className="h-4 w-4 fill-current" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[#EFEFF0]">
                DepShield
              </span>
              <span className="rounded bg-[#3C3C42]/30 px-1.5 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/50">
                v0.2
              </span>
            </div>
            <p className="text-xs text-[#BDBDC1] leading-relaxed">
              Automated early-warning intelligence for npm dependencies. Corroborates public threat signals before official CVE publication.
            </p>
            <div className="flex flex-col gap-1 text-[11px] font-mono text-[#7D7E84] pt-1">
              <span>Mode: <strong className="text-[#EFEFF0]">{envConfig.useMocks ? 'Offline Mock' : 'FastAPI'}</strong></span>
              <span>Target: <strong className="text-[#BDBDC1]">{envConfig.apiUrl}</strong></span>
            </div>
          </div>

          {/* Links Column 2: Platform (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#EFEFF0]">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#upload" className="hover:text-[#EFEFF0] transition-colors">
                  Lockfile Ingestion
                </a>
              </li>
              <li>
                <a href="#demo" className="hover:text-[#EFEFF0] transition-colors">
                  Security Console
                </a>
              </li>
              <li>
                <a href="#findings" className="hover:text-[#EFEFF0] transition-colors">
                  Findings Catalog
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#EFEFF0] transition-colors">
                  4-Step Pipeline
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column 3: Telemetry (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#EFEFF0]">
              Telemetry
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#sources" className="hover:text-[#EFEFF0] transition-colors">
                  OSV Database
                </a>
              </li>
              <li>
                <a href="#sources" className="hover:text-[#EFEFF0] transition-colors">
                  npm Registry API
                </a>
              </li>
              <li>
                <a href="#sources" className="hover:text-[#EFEFF0] transition-colors">
                  Public Web Signals
                </a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-[#EFEFF0] transition-colors">
                  Integrations Grid
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column 4: Integrity & Standards (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#EFEFF0]">
              Integrity
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#faq" className="hover:text-[#EFEFF0] transition-colors">
                  Tri-State OSV Standard
                </a>
              </li>
              <li>
                <a href="#philosophy" className="hover:text-[#EFEFF0] transition-colors">
                  Threat Scenarios
                </a>
              </li>
              <li>
                <a href="#problems" className="hover:text-[#EFEFF0] transition-colors">
                  Three Threat Vectors
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-[#EFEFF0] transition-colors">
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: "Try a demo scan" interactive action card (3 cols) */}
          <div className="lg:col-span-3 rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/15 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#EFEFF0]">
              <Sparkles className="h-3.5 w-3.5 text-[#BDBDC1]" />
              <span>Instant Verification</span>
            </div>
            <p className="text-[11px] text-[#BDBDC1] leading-relaxed">
              Experience the client-side parser and tri-state findings with preloaded synthetic telemetry.
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={onDemoClick}
                type="button"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#EFEFF0] hover:bg-white py-2 text-xs font-bold text-[#010101] transition-colors shadow"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Try a demo scan</span>
              </button>
              <button
                onClick={handleUpload}
                type="button"
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#3C3C42]/60 bg-[#3C3C42]/30 hover:bg-[#3C3C42]/50 py-2 text-xs font-medium text-[#EFEFF0] transition-colors"
              >
                <UploadCloud className="h-3 w-3" />
                <span>Upload lockfile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Required Prototype Limits Note & Copyright Band */}
        <div className="border-t border-[#3C3C42]/40 pt-8 space-y-4">
          <div className="rounded-xl border border-[#3C3C42]/50 bg-[#121214]/80 p-4 text-xs text-[#BDBDC1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#EFEFF0] flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-relaxed">
                <strong className="text-[#EFEFF0]">Prototype Disclaimer:</strong> Deep-checks up to 4 packages per scan due to upstream API budget constraints (npm ecosystem only). Detection accuracy is heuristic and unproven in enterprise production. Zero false-safe guarantees.
              </span>
            </div>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 text-xs text-[#BDBDC1] hover:text-[#EFEFF0] transition-colors self-start sm:self-auto shrink-0"
            >
              <span>Back to top</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7D7E84] gap-2">
            <span>&copy; 2026 DepShield. Independent Developer-Security Prototype.</span>
            {process.env.NEXT_PUBLIC_USE_MOCKS === '1' && (
              <span className="font-mono text-[10px] text-[#7D7E84]">
                NEXT_PUBLIC_USE_MOCKS=1 • Zero external requests
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
