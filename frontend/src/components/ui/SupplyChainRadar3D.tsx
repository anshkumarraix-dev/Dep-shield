'use client';

import React, { useState, MouseEvent } from 'react';
import { ShieldCheck, ShieldAlert, Zap, Layers, Sparkles } from 'lucide-react';

interface SupplyChainRadar3DProps {
  isScanning?: boolean;
  criticalCount?: number;
  highCount?: number;
  totalCount?: number;
}

export function SupplyChainRadar3D({
  isScanning = false,
  criticalCount = 1,
  highCount = 2,
  totalCount = 384,
}: SupplyChainRadar3DProps) {
  const [rotate, setRotate] = useState({ x: 5, y: -8 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setRotate({
      x: (y / (rect.height / 2)) * -12,
      y: (x / (rect.width / 2)) * 12,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 5, y: -8 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="perspective-1000 relative flex items-center justify-center p-6 select-none cursor-pointer group"
    >
      <div
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transition: 'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="relative h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80 rounded-full flex items-center justify-center"
      >
        {/* Soft background ambient glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/10 via-sky-400/5 to-emerald-400/10 blur-2xl -z-10" />

        {/* Outer Ring 3 */}
        <div className="absolute inset-0 rounded-full border border-dashed border-slate-300/80 group-hover:border-blue-400/60 transition-colors animate-[spin_60s_linear_infinite]" />

        {/* Middle Ring 2 */}
        <div className="absolute inset-8 rounded-full border border-slate-200/90 group-hover:border-sky-300/80 transition-colors" />

        {/* Inner Ring 1 */}
        <div className="absolute inset-16 rounded-full border border-dashed border-slate-300/70" />

        {/* Radar Sweeper Line (Rotates continuously or during scan) */}
        <div
          className={`absolute inset-0 rounded-full pointer-events-none ${
            isScanning ? 'animate-[spin_2.5s_linear_infinite]' : 'animate-[spin_10s_linear_infinite]'
          }`}
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(2, 132, 199, 0.08) 330deg, rgba(2, 132, 199, 0.25) 360deg)',
          }}
        />

        {/* Center Root Project Node */}
        <div
          style={{ transform: 'translateZ(35px)' }}
          className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg border border-slate-200/90 group-hover:shadow-xl transition-shadow"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          {isScanning && (
            <span className="absolute -inset-1 rounded-2xl border-2 border-blue-400 animate-ping opacity-30" />
          )}
        </div>

        {/* Floating Dependency Nodes in 3D */}
        {/* Node 1: Critical finding (top right) */}
        <div
          style={{ transform: 'translateZ(45px)' }}
          className="absolute top-6 right-10 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-rose-700 shadow-md border border-rose-200 transition-transform group-hover:scale-105"
        >
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-mono font-semibold">event-stream</span>
          <span className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-800">CRIT</span>
        </div>

        {/* Node 2: Watch item (bottom left) */}
        <div
          style={{ transform: 'translateZ(25px)' }}
          className="absolute bottom-8 left-8 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-md border border-amber-200 transition-transform group-hover:scale-105"
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="font-mono">flatmap-stream</span>
          <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800">WATCH</span>
        </div>

        {/* Node 3: Clean verified package (bottom right) */}
        <div
          style={{ transform: 'translateZ(30px)' }}
          className="absolute bottom-10 right-8 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-emerald-700 shadow-md border border-emerald-200 transition-transform group-hover:scale-105"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-mono">express</span>
          <span className="text-[10px] text-emerald-600 font-semibold">&bull; 4.18.2</span>
        </div>

        {/* Node 4: Clean verified package (top left) */}
        <div
          style={{ transform: 'translateZ(20px)' }}
          className="absolute top-10 left-10 flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm border border-slate-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span className="font-mono">lodash</span>
          <span className="text-[9px] text-slate-400">clean</span>
        </div>

        {/* Connecting SVG mesh lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-40">
          <line x1="50%" y1="50%" x2="72%" y2="22%" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="50%" y1="50%" x2="28%" y2="76%" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="50%" y1="50%" x2="75%" y2="72%" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="50%" y1="50%" x2="26%" y2="28%" stroke="#cbd5e1" strokeWidth="1.5" />
        </svg>

        {/* Status Pill beneath radar */}
        <div
          style={{ transform: 'translateZ(40px)' }}
          className="absolute -bottom-4 bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200/90 shadow-sm flex items-center gap-2 text-xs text-slate-600 font-medium"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <span>Interactive 3D Dependency Radar</span>
        </div>
      </div>
    </div>
  );
}
