'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Shield, Info, Database, Layers } from 'lucide-react';

export function HelpLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCKS === '1';

  const faqs = [
    {
      q: 'Is this an AI chatbot?',
      a: 'It is not a chatbot; Gemini extracts structured claims from public pages, and deterministic code decides the risk level.',
      icon: Shield,
    },
    {
      q: 'What is the Tri-State OSV Standard?',
      a: 'Traditional scanners confuse "no advisory found" with "guaranteed safe". DepShield outputs three distinct states: Matched (advisory found), Clean (queried & verified zero flags), and Provisional/Unknown (unqueried or incomplete data). We never output false-safe guarantees.',
      icon: Database,
    },
    {
      q: 'Why are only 4 packages deep-checked?',
      a: `In this prototype demonstration, full heuristic evidence synthesis is bounded to 4 packages per scan due to upstream API budget constraints.${isMockMode ? ' In mock mode (NEXT_PUBLIC_USE_MOCKS=1), all checks operate with zero external requests.' : ''}`,
      icon: Layers,
    },
    {
      q: 'Which lockfile formats are supported?',
      a: 'DepShield currently parses npm package-lock.json versions 2 and 3. Direct dependencies and transitive packages are parsed client-side in the browser.',
      icon: Info,
    },
  ];

  return (
    <>
      {/* Floating Launcher Button at Bottom-Right */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Open Help and Frequently Asked Questions drawer"
          className="group flex items-center gap-2 rounded-full border border-cyan-500/40 bg-slate-950/90 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all duration-200 hover:border-cyan-400 hover:bg-slate-900 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <HelpCircle className="h-4 w-4 text-cyan-400 transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline">Help &amp; FAQ</span>
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        </button>
      </div>

      {/* Slide-over FAQ Drawer (NOT an AI Chat) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="DepShield Help & FAQ Drawer"
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        >
          {/* Backdrop Dismiss Area */}
          <div
            onClick={() => setIsOpen(false)}
            className="flex-1 cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className="w-full max-w-md bg-[#090d16] border-l border-slate-800 p-6 flex flex-col h-full shadow-2xl overflow-y-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Help &amp; Architecture FAQ
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                aria-label="Close FAQ drawer"
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Honest Notice */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                <span>Deterministic Documentation</span>
              </div>
              <p className="leading-relaxed text-[11px] text-slate-400">
                This is a documentation and FAQ drawer providing verified product facts — NOT an uncalibrated AI chatbot.
              </p>
            </div>

            {/* Questions List */}
            <div className="space-y-4 flex-1">
              {faqs.map((faq, i) => {
                const Icon = faq.icon;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-white">
                      <Icon className="h-4 w-4 text-cyan-400 shrink-0" />
                      <h4>{faq.q}</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pl-6">
                      {faq.a}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Footer Close Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-white transition-colors"
              >
                Close FAQ Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
