'use client';

import React from 'react';
import { UploadCloud, Sparkles, Shield } from 'lucide-react';

interface ClosingCtaBandProps {
  onUploadClick?: () => void;
  onDemoClick?: () => void;
  isScanning?: boolean;
}

export function ClosingCtaBand({
  onUploadClick,
  onDemoClick,
  isScanning = false,
}: ClosingCtaBandProps) {
  const handleUpload = () => {
    if (onUploadClick) onUploadClick();
    const el = document.getElementById('upload');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#3C3C42]/50 bg-[#3C3C42]/15 backdrop-blur-md p-8 sm:p-12 md:p-16 text-center max-w-7xl mx-auto shadow-sm">
      {/* Background ambient radial aura */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-[40rem] rounded-full bg-[#3C3C42]/20 blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3C3C42]/60 bg-[#3C3C42]/30 px-3.5 py-1 text-xs font-mono text-[#BDBDC1]">
          <Shield className="h-3.5 w-3.5 text-[#EFEFF0]" />
          <span>Independent Developer Security</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#EFEFF0] leading-tight">
          Inspect your dependencies before{' '}
          <span className="bg-gradient-to-r from-[#EFEFF0] via-[#BDBDC1] to-[#7D7E84] bg-clip-text text-transparent">
            advisories
          </span>{' '}
          land
        </h2>

        <p className="text-sm sm:text-base text-[#BDBDC1] leading-relaxed max-w-2xl mx-auto">
          Client-side lockfile parsing with zero server uploads in mock mode. Corroborate direct and transitive risks against public developer discussions.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={handleUpload}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-xl bg-[#EFEFF0] px-6 py-3.5 text-xs sm:text-sm font-bold text-[#010101] shadow hover:bg-white hover:scale-[1.02] active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3C3C42]"
          >
            <UploadCloud className="h-4 w-4 text-[#010101]" />
            <span>Upload package-lock.json</span>
          </button>

          <button
            onClick={onDemoClick}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-xl border border-[#3C3C42]/60 bg-[#3C3C42]/30 px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#EFEFF0] shadow hover:bg-[#3C3C42]/50 hover:border-[#3C3C42] hover:scale-[1.02] active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3C3C42]"
          >
            <Sparkles className="h-4 w-4 text-[#BDBDC1]" />
            <span>{isScanning ? 'Running Scan...' : 'Try a demo scan'}</span>
          </button>
        </div>

        {/* Prototype disclosure badge */}
        <div className="text-[11px] font-mono text-[#7D7E84] pt-3">
          Deep-checks up to 4 packages per scan due to API budget limits
          {process.env.NEXT_PUBLIC_USE_MOCKS === '1' ? ' • Zero external requests (mock mode)' : ''}
        </div>
      </div>
    </section>
  );
}
