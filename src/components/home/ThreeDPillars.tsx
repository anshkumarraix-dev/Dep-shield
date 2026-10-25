'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { ArrowRight, ShieldCheck, Layers, Radio, UploadCloud, Sparkles, Info } from 'lucide-react';

interface ThreeDPillarsProps {
  onUploadClick?: () => void;
  onDemoClick?: () => void;
  isScanning?: boolean;
  onSelectPillar?: (pillarIndex: number) => void;
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function subscribeTouch(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(pointer: coarse)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getTouchSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function getTouchServerSnapshot(): boolean {
  return false;
}

export function ThreeDPillars({
  onUploadClick,
  onDemoClick,
  isScanning = false,
  onSelectPillar,
}: ThreeDPillarsProps) {
  const [activeHover, setActiveHover] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const isTouchDevice = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    getTouchServerSnapshot
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);

  // Pause animations when off-screen or tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  // Pointer move tilt calculation with requestAnimationFrame (max ±8°)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isReducedMotion || isTouchDevice || e.pointerType === 'touch') return;
      if (!containerRef.current) return;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Max ±8 degrees tilt
        const rotateY = ((clientX - centerX) / centerX) * 8;
        const rotateX = -((clientY - centerY) / centerY) * 8;

        setTilt({ x: Math.max(-8, Math.min(8, rotateX)), y: Math.max(-8, Math.min(8, rotateY)) });
      });
    },
    [isReducedMotion, isTouchDevice]
  );

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    // Smoothly ease back to neutral rest position
    setTilt({ x: 0, y: 0 });
    setActiveHover(null);
  }, []);

  const pillars = [
    {
      id: 'pillar-direct',
      category: 'AUTOMATED DEPENDENCY SCANS',
      categoryClass: 'text-cyan-400 font-bold',
      actionVerb: 'LINT & VERIFY',
      title: 'The Direct Manifest',
      description: 'Instant client-side linting & OSV database queries for top-level npm packages.',
      tooltip: 'Scans top-level package declarations against OSV & npm advisories with zero network lock-in.',
      ctaText: 'Inspect manifest',
      targetId: 'upload',
      icon: ShieldCheck,
      gradientId: 'grad-pillar-1',
      glowId: 'glow-pillar-1',
      strokeStart: '#06b6d4',
      strokeMid: '#3b82f6',
      strokeEnd: '#8b5cf6',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      orbitDuration: '8s',
      orbitTrackColor: 'rgba(6, 182, 212, 0.3)',
    },
    {
      id: 'pillar-transitive',
      category: 'UNNOTICED TRANSITIVE BUGS',
      categoryClass: 'bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent font-bold',
      actionVerb: 'RECURSIVELY MAP',
      title: 'The Transitive Graph',
      description: 'Deep-checks nested sub-dependencies often omitted by perimeter scans.',
      tooltip: 'Recursively unwinds dependency trees down to leaf nodes to catch deeply nested vulnerabilities.',
      ctaText: 'Discover findings',
      targetId: 'findings',
      icon: Layers,
      gradientId: 'grad-pillar-2',
      glowId: 'glow-pillar-2',
      strokeStart: '#ec4899',
      strokeMid: '#a855f7',
      strokeEnd: '#f43f5e',
      glowColor: 'rgba(236, 72, 153, 0.45)',
      orbitDuration: '10s',
      orbitTrackColor: 'rgba(236, 72, 153, 0.3)',
    },
    {
      id: 'pillar-web-signals',
      category: 'UNGOVERNED EARLY DISCLOSURES',
      categoryClass: 'text-amber-400 font-bold',
      actionVerb: 'CORROBORATE',
      title: 'Public Web Signals',
      description: 'Corroborates GitHub issues & maintainer discussions before official CVE assignment.',
      tooltip: 'Harvests early heuristic threat telemetry from maintainer conversations before official CVE publishing.',
      ctaText: 'View early evidence',
      targetId: 'demo',
      icon: Radio,
      gradientId: 'grad-pillar-3',
      glowId: 'glow-pillar-3',
      strokeStart: '#f59e0b',
      strokeMid: '#f97316',
      strokeEnd: '#fbbf24',
      glowColor: 'rgba(245, 158, 11, 0.45)',
      orbitDuration: '9s',
      orbitTrackColor: 'rgba(245, 158, 11, 0.3)',
    },
  ];

  const handlePillarClick = (targetId: string, idx: number) => {
    if (onSelectPillar) {
      onSelectPillar(idx);
    }
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick();
    }
    const elem = document.getElementById('upload');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const shouldAnimate = true;

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full max-w-6xl mx-auto py-10 space-y-12 select-none"
    >
      {/* 1. Top Action Row: Upload CTA & Demo CTA */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* Primary upload button */}
        <button
          onClick={handleUploadClick}
          disabled={isScanning}
          className="group relative flex items-center gap-2.5 rounded-xl bg-[#EFEFF0] px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#010101] transition-all duration-200 hover:bg-white active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84]"
        >
          <UploadCloud className="h-4 w-4 text-[#010101] transition-transform duration-200 group-hover:-translate-y-0.5" />
          <span>Upload package-lock.json</span>
        </button>

        {/* Secondary button: "Try a demo scan" */}
        <button
          onClick={onDemoClick}
          disabled={isScanning}
          className="group flex items-center gap-2.5 rounded-xl border border-[#3C3C42]/60 bg-[#3C3C42]/30 backdrop-blur-md px-6 py-3.5 text-xs sm:text-sm font-medium text-[#EFEFF0] transition-all duration-200 hover:bg-[#3C3C42]/50 hover:border-[#7D7E84] active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84]"
        >
          <Sparkles className="h-4 w-4 text-[#BDBDC1] transition-transform duration-200 group-hover:rotate-12" />
          <span>{isScanning ? 'Running Scan...' : 'Try a demo scan'}</span>
        </button>
      </div>

      {/* 2. Three Core Pillar Rings (SVG + CSS Gradient Strokes, Depth & Orbiting Arc Markers) */}
      <div
        style={{
          perspective: '1200px',
        }}
        className="relative"
      >
        <div
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4"
        >
          {pillars.map((pillar, idx) => {
            const isHovered = activeHover === idx;
            const Icon = pillar.icon;

            return (
              <React.Fragment key={pillar.id}>
                {/* Individual Pillar Card */}
                <div
                  onMouseEnter={() => setActiveHover(idx)}
                  onMouseLeave={() => setActiveHover(null)}
                  onClick={() => handlePillarClick(pillar.targetId, idx)}
                  className={`group relative flex flex-col items-center text-center space-y-4 focus:outline-none transition-transform duration-200 z-10 cursor-pointer ${
                    isHovered ? '-translate-y-2' : ''
                  }`}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  aria-describedby={`tooltip-${pillar.id}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePillarClick(pillar.targetId, idx);
                    }
                  }}
                >
                  {/* Category Subtitle */}
                  <span
                    className={`text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-colors duration-200 ${pillar.categoryClass}`}
                  >
                    {pillar.category}
                  </span>

                  {/* SVG Hero Ring Container */}
                  <div className="relative flex h-64 w-64 sm:h-72 sm:w-72 items-center justify-center">
                    {/* SVG Vector Rings with Gradient Defs, Masks, and Glow */}
                    <svg
                      viewBox="0 0 280 280"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                    >
                      <defs>
                        {/* High-res Linear Gradient for Ring */}
                        <linearGradient id={pillar.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={pillar.strokeStart} />
                          <stop offset="50%" stopColor={pillar.strokeMid} />
                          <stop offset="100%" stopColor={pillar.strokeEnd} />
                        </linearGradient>

                        {/* Layered Drop Shadow Filter */}
                        <filter id={pillar.glowId} x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation={isHovered ? 12 : 6} result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* Subtle Ambient Outer Glow Circle */}
                      <circle
                        cx="140"
                        cy="140"
                        r="125"
                        fill="none"
                        stroke={pillar.strokeStart}
                        strokeWidth="1"
                        opacity={isHovered ? 0.4 : 0.15}
                        className="transition-opacity duration-300"
                      />

                      {/* Concentric Outer Ring Track */}
                      <circle
                        cx="140"
                        cy="140"
                        r="120"
                        fill="none"
                        stroke={`url(#${pillar.gradientId})`}
                        strokeWidth={isHovered ? '5' : '3.5'}
                        filter={`url(#${pillar.glowId})`}
                        opacity={isHovered ? 1 : 0.85}
                        className="transition-all duration-300"
                      />

                      {/* Concentric Inner Dotted Track */}
                      <circle
                        cx="140"
                        cy="140"
                        r="105"
                        fill="none"
                        stroke={pillar.orbitTrackColor}
                        strokeWidth="1.5"
                        strokeDasharray="4 6"
                        opacity={isHovered ? 0.9 : 0.5}
                        className="transition-opacity duration-300"
                      />
                    </svg>

                    {/* Orbiting Arc Marker (Pure transform: rotate) */}
                    <div
                      className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                      style={{
                        animation: shouldAnimate ? `orbit-cw ${pillar.orbitDuration} linear infinite` : 'none',
                        animationPlayState: isHovered ? 'paused' : 'running',
                      }}
                    >
                      <div className="absolute top-[13px] left-1/2 -translate-x-1/2 flex items-center justify-center">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]"
                        >
                          <polygon points="2,3 14,8 2,13" fill="#ffffff" />
                        </svg>
                      </div>
                    </div>

                    {/* Inner Dark Glassmorphism Core */}
                    <div
                      style={{
                        transform: isHovered ? 'translateZ(18px)' : 'translateZ(0px)',
                        transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="relative h-44 w-44 sm:h-48 sm:w-48 rounded-full bg-[#121214]/90 backdrop-blur-xl border border-[#3C3C42]/50 flex flex-col items-center justify-center px-4 space-y-1.5 z-10 group-hover:border-[#3C3C42]/90"
                    >
                      <div className="p-2 rounded-xl bg-[#3C3C42]/30 border border-[#3C3C42]/60 text-[#EFEFF0] mb-0.5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-mono tracking-widest text-[#7D7E84] uppercase font-semibold">
                        {pillar.actionVerb}
                      </span>
                      <h3 className="text-sm sm:text-base font-semibold text-[#EFEFF0] tracking-tight leading-tight">
                        {pillar.title}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] font-medium text-[#BDBDC1] group-hover:text-[#EFEFF0] pt-1 transition-colors">
                        <span>{pillar.ctaText}</span>
                        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>

                    {/* Accessible Hover Tooltip Card */}
                    <div
                      id={`tooltip-${pillar.id}`}
                      role="tooltip"
                      className={`absolute -bottom-14 left-1/2 -translate-x-1/2 w-64 pointer-events-none z-30 rounded-lg border border-[#3C3C42]/70 bg-[#121214]/95 p-2 text-center text-[11px] leading-snug text-[#BDBDC1] shadow-xl backdrop-blur-md transition-all duration-200 ${
                        isHovered
                          ? 'opacity-100 translate-y-0 scale-100'
                          : 'opacity-0 translate-y-1 scale-95'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[#EFEFF0] font-semibold mb-0.5">
                        <Info className="h-3 w-3" />
                        <span>Security Intelligence</span>
                      </div>
                      <span>{pillar.tooltip}</span>
                    </div>
                  </div>

                  {/* Supporting Description */}
                  <p className="text-xs text-[#BDBDC1] max-w-xs leading-relaxed px-2">
                    {pillar.description}
                  </p>
                </div>

                {/* Dotted Inter-Ring Connector with Flow Indicator (Row between pillars) */}
                {idx < 2 && (
                  <div className="hidden md:flex flex-col items-center justify-center px-2 py-4">
                    <div
                      className={`flex items-center gap-1.5 text-cyan-400/80 ${
                        shouldAnimate ? 'animate-flow-arrows' : ''
                      }`}
                    >
                      <span className="text-xs font-bold font-mono">▶</span>
                      <span className="text-xs font-bold font-mono">▶</span>
                      <span className="text-xs font-bold font-mono">▶</span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. Dotted Connector with Labelled Pill */}
      <div className="pt-2">
        <div className="relative mx-auto max-w-3xl">
          {/* Vertical drop connectors from pillars on desktop */}
          <div className="hidden md:flex justify-between px-20">
            <div className="h-6 w-[2px] bg-gradient-to-b from-cyan-500/60 to-cyan-500/20" />
            <div className="h-6 w-[2px] bg-gradient-to-b from-amber-500/60 to-amber-500/20" />
          </div>

          {/* Horizontal Connecting Bracket & Labelled Pill */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 px-6 sm:px-10">
            {/* Left Flow Chevrons */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-cyan-400/80 ${
                shouldAnimate ? 'animate-flow-arrows' : ''
              }`}
            >
              <span className="text-xs font-mono">▶</span>
              <span className="text-xs font-mono">▶</span>
              <span className="text-xs font-mono">▶</span>
            </div>

            {/* Sleek Labelled Pill Container */}
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-[#090d16]/95 px-5 py-2 shadow-lg shadow-cyan-950/20 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full bg-cyan-400 ${shouldAnimate ? 'animate-pulse' : ''}`}
              />
              <span className="text-[11px] sm:text-xs font-mono font-bold tracking-widest text-slate-200 uppercase">
                CONTINUOUS EARLY-WARNING CORROBORATION
              </span>
            </div>

            {/* Right Flow Chevrons */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-amber-400/80 ${
                shouldAnimate ? 'animate-flow-arrows' : ''
              }`}
            >
              <span className="text-xs font-mono">▶</span>
              <span className="text-xs font-mono">▶</span>
              <span className="text-xs font-mono">▶</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
