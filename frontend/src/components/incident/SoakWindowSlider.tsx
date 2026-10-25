'use client';

import React, { useState } from 'react';
import { Hourglass, ShieldCheck, ShieldAlert } from 'lucide-react';

interface SoakWindowSliderProps {
  packagePublishTimeStr?: string;
  packageName?: string;
  packageVersion?: string;
}

export function SoakWindowSlider({
  packagePublishTimeStr = '09:35:00 UTC',
  packageName = 'keyv',
  packageVersion = '6.0.0',
}: SoakWindowSliderProps) {
  const [soakHours, setSoakHours] = useState<number>(24);

  // In the ChainDrop incident, the malicious version was adopted within minutes (0.5h of publish)
  const adoptionElapsedHours = 0.5;
  const isProtected = soakHours > adoptionElapsedHours;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Hourglass className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            SOAK-WINDOW POLICY SIMULATOR (0 TO 168 HOURS)
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          POLICY SIMULATION
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Slider Controls */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Mandatory Minimum Package Age Policy:
            </span>
            <span className="text-amber-400 font-bold tabular-nums text-sm">
              {soakHours} hour{soakHours === 1 ? '' : 's'}
              {soakHours >= 24 ? ` (${(soakHours / 24).toFixed(1)} days)` : ''}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={168}
            step={1}
            value={soakHours}
            onChange={(e) => setSoakHours(Number(e.target.value))}
            aria-label="Soak window hours slider"
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>0h (Instant Adoption)</span>
            <span>24h (Standard)</span>
            <span>72h (Cautious)</span>
            <span>168h (1 Week)</span>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] font-mono text-slate-500">Presets:</span>
            {[0, 6, 24, 48, 72].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSoakHours(preset)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] border transition-colors ${
                  soakHours === preset
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset === 0 ? 'Off (0h)' : `${preset}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Protection Outcome Card */}
        <div
          className={`border rounded p-3 text-xs flex flex-col justify-between ${
            isProtected
              ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {isProtected ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-mono font-bold uppercase tracking-wider text-xs">
              {isProtected ? 'BLOCKED (PROTECTED)' : 'ADOPTED (COMPROMISED)'}
            </span>
          </div>

          <div className="text-[11px] leading-snug mb-2 opacity-90">
            {isProtected ? (
              <span>
                A {soakHours}h soak policy would have quarantined{' '}
                <strong className="font-mono">{packageName}@{packageVersion}</strong> (published{' '}
                {packagePublishTimeStr}), preventing the automated payload from executing during install.
              </span>
            ) : (
              <span>
                Zero soak delay allowed immediate automated installation of{' '}
                <strong className="font-mono">{packageName}@{packageVersion}</strong> within 30 minutes of
                registry release, triggering the malicious preinstall hook.
              </span>
            )}
          </div>

          <div className="text-[10px] font-mono opacity-70 border-t border-current pt-1">
            Status: {isProtected ? 'Zero-Day Gated Out' : 'Vulnerable to Rapid Worm Propagation'}
          </div>
        </div>
      </div>
    </div>
  );
}
