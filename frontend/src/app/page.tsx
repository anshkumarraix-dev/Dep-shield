'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  REPLAY_CASES,
  REPLAY_CASES_MAP,
  ReplayCase,
  ReplayEvidenceItem,
  chaindrop2026Case,
} from '@/data/replay';
import { SignalClock } from '@/components/incident/SignalClock';
import { BlastRadiusGraph } from '@/components/incident/BlastRadiusGraph';
import { EvidenceCard } from '@/components/incident/EvidenceCard';
import { DecisionTrace } from '@/components/incident/DecisionTrace';
import { WhatIfLab } from '@/components/incident/WhatIfLab';
import { SoakWindowSlider } from '@/components/incident/SoakWindowSlider';
import { IocStrip } from '@/components/incident/IocStrip';
import { CommandPalette } from '@/components/incident/CommandPalette';
import { IncidentOnePager } from '@/components/incident/IncidentOnePager';
import { validateAndParsePackageLock } from '@/services/lockfileParser';
import { evaluateDeterministicRules, WhatIfEvaluation } from '@/utils/rulesEngine';
import { useLiveScan } from '@/hooks/useLiveScan';
import { ParsedDependency } from '@/types';
import {
  Shield,
  Upload,
  Search,
  FileText,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

export default function IncidentRoomPage() {
  // Case selection state initialized from URL if present
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('case');
      if (p && REPLAY_CASES_MAP.has(p)) return p;
    }
    return 'chaindrop-2026';
  });
  const activeCase: ReplayCase = useMemo(() => {
    return REPLAY_CASES_MAP.get(selectedCaseId) || chaindrop2026Case;
  }, [selectedCaseId]);

  // Scrubber time in seconds (as of time)
  const initialTimeSeconds = useMemo(() => {
    const times = activeCase.timeline.map((e) => e.timeSeconds);
    return Math.max(...times);
  }, [activeCase]);

  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(initialTimeSeconds);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>(undefined);
  const [selectedPackage, setSelectedPackage] = useState<string | undefined>(undefined);

  // Modals & Panels
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isOnePagerOpen, setIsOnePagerOpen] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'decision' | 'whatif' | 'soak'>('decision');

  // Unified live/mock scan state from useLiveScan
  const {
    status: scanStatus,
    healthBannerInfo,
    progress: scanProgress,
    dependencies: liveDependencies,
    error: scanError,
    honestEmptyStateMessage,
    partialScanWarning,
    startScan,
    startReplayScan,
  } = useLiveScan();

  // Custom uploaded lockfile state
  const [customParsedPackages, setCustomParsedPackages] = useState<ParsedDependency[] | null>(null);
  const [customProjectName, setCustomProjectName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Adjust state during render when active case changes (React recommended pattern)
  const [prevCaseId, setPrevCaseId] = useState<string>(activeCase.id);
  if (prevCaseId !== activeCase.id) {
    setPrevCaseId(activeCase.id);
    const times = activeCase.timeline.map((e) => e.timeSeconds);
    setCurrentTimeSeconds(Math.max(...times));
    setSelectedEvidenceId(undefined);
    setSelectedPackage(activeCase.headlinePackage);
    setCustomParsedPackages(null);
    setCustomProjectName(null);
  }

  // Parse lockfile packages from active case, custom uploaded lockfile, or live dependencies
  const packages: ParsedDependency[] = useMemo(() => {
    if (customParsedPackages && customParsedPackages.length > 0) {
      return customParsedPackages;
    }
    if (liveDependencies && liveDependencies.length > 0) {
      return liveDependencies;
    }
    try {
      const parsed = validateAndParsePackageLock(activeCase.lockfileContent, `${activeCase.id}.json`);
      if (parsed.valid && parsed.summary) {
        return parsed.summary.packages;
      }
    } catch {
      // fallback
    }
    return [
      {
        name: activeCase.headlinePackage,
        version: activeCase.headlineVersion,
        type: 'direct',
        direct: true,
        depPath: [activeCase.headlinePackage],
        analyzed: true,
        hasInstallScript: true,
      },
    ];
  }, [customParsedPackages, liveDependencies, activeCase]);

  // Filter evidence based on draggable scrubber ("as of" time)
  const visibleEvidence: ReplayEvidenceItem[] = useMemo(() => {
    return activeCase.timeline.filter((e) => e.timeSeconds <= currentTimeSeconds);
  }, [activeCase, currentTimeSeconds]);

  // Compute live deterministic evaluation from currently visible evidence
  const liveEvaluation: WhatIfEvaluation = useMemo(() => {
    // If case is benign control
    if (activeCase.id === 'benign-control-clean') {
      return evaluateDeterministicRules({
        independentSourceCount: 0,
        exactVersionMatched: true,
        severity: 'LOW',
        osvMatched: false, // clean baseline
        hasInstallScript: false,
      });
    }

    const publicSignals = visibleEvidence.filter((e) => e.lane === 'public_signals');
    const independentSources = new Set(
      publicSignals.filter((e) => e.isIndependentOriginal).map((e) => e.sourceDomain)
    );
    const hasExactVersion = visibleEvidence.some((e) => e.exactVersionMatched);
    const hasCriticalPayload = visibleEvidence.some(
      (e) => e.category === 'commit' || e.category === 'blog' || e.category === 'registry_publish'
    );

    return evaluateDeterministicRules({
      independentSourceCount: independentSources.size,
      exactVersionMatched: hasExactVersion,
      severity: hasCriticalPayload ? 'CRITICAL' : 'HIGH',
      hasInstallScript: true,
      osvMatched: activeCase.cveStatus.includes('GHSA') ? true : null, // unverified or matched
    });
  }, [visibleEvidence, activeCase]);

  // Keyboard navigation for scrubber (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const times = activeCase.timeline.map((ev) => ev.timeSeconds);
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      const step = Math.max(1, Math.round((maxT - minT) / 50));

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTimeSeconds((prev) => Math.max(minT, prev - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTimeSeconds((prev) => Math.min(maxT, prev + step));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCase]);

  // Deep linking URL query synchronization with popstate
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const caseParam = params.get('case');
        if (caseParam && REPLAY_CASES_MAP.has(caseParam)) {
          setSelectedCaseId(caseParam);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleCaseChange = (newCaseId: string) => {
    setSelectedCaseId(newCaseId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('case', newCaseId);
      window.history.pushState({}, '', url.toString());
    }
    void startReplayScan(newCaseId);
  };

  // Handle Lockfile upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const res = validateAndParsePackageLock(text, file.name);
      if (res.valid && res.summary) {
        setCustomParsedPackages(res.summary.packages);
        setCustomProjectName(res.summary.projectName || null);
        setSelectedPackage(res.summary.packages[0]?.name);
        try {
          await startScan(text, file.name);
        } catch {
          // Handled in useLiveScan state
        }
      } else {
        setUploadError(res.error || 'Failed to parse lockfile.');
      }
    };
    reader.readAsText(file);
  };

  // Formatted currentTime string
  const currentTimeDisplay = useMemo(() => {
    if (currentTimeSeconds > 1000000) {
      return new Date(currentTimeSeconds * 1000).toUTCString().slice(17, 25);
    }
    const h = Math.floor(currentTimeSeconds / 3600);
    const m = Math.floor((currentTimeSeconds % 3600) / 60);
    const s = currentTimeSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [currentTimeSeconds]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* 1. SLIM FORENSIC TOP BAR */}
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/90 backdrop-blur px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Mode Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500/20 border border-amber-500/60 rounded flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-mono font-bold tracking-tight text-sm text-slate-100">
                DEPSHIELD <span className="text-slate-400 font-normal text-xs">&#47;&#47; INCIDENT ROOM</span>
              </span>
            </div>

            {/* Strict Mode Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-amber-600/60 bg-amber-950/40 text-[10px] font-mono text-amber-300 font-semibold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>MODE: {healthBannerInfo.modeLabel}</span>
            </div>
          </div>

          {/* Controls: Case Picker, Search, Upload, Export */}
          <div className="flex items-center gap-2">
            {/* Case Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedCaseId}
                onChange={(e) => handleCaseChange(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded px-3 py-1.5 pr-8 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {REPLAY_CASES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Lockfile Upload Button */}
            <label className="cursor-pointer px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Upload Lockfile</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload custom package-lock.json"
              />
            </label>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              title="Command Palette (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ctrl+K</span>
            </button>

            {/* Print One-Pager */}
            <button
              type="button"
              onClick={() => setIsOnePagerOpen(true)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
              title="Incident One-Pager"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Dossier</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scan Running Indicator */}
      {scanStatus === 'running' && (
        <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 py-1.5 text-xs font-mono text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              Scanning packages... {scanProgress.currentPackage ? `(${scanProgress.currentPackage})` : ''}
            </span>
          </div>
          <span className="tabular-nums font-semibold">{scanProgress.percent}%</span>
        </div>
      )}

      {/* Partial Scan Warning Banner (Invariant: N packages could not be analysed) */}
      {partialScanWarning && (
        <div className="bg-amber-950/90 border-b border-amber-700 px-4 py-2 text-xs font-mono text-amber-200 text-center flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{partialScanWarning}</span>
        </div>
      )}

      {/* Upload or Scan Error Banner */}
      {(uploadError || scanError) && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-2 text-xs font-mono text-rose-300 text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{uploadError || scanError}</span>
        </div>
      )}

      {/* 2. MAIN INCIDENT WORKSPACE (THE FORENSIC DESK) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5 space-y-4">
        {/* Case Metadata & Scale Disagreement Strip */}
        <section className="bg-slate-900 border border-slate-800/90 rounded-md p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                  Incident Investigation Case
                </span>
                <span className="text-[10px] font-mono bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                  {activeCase.dateStr}
                </span>
                <span className="text-[10px] font-mono bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded border border-amber-800/50">
                  Target: {activeCase.headlinePackage}@{activeCase.headlineVersion}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-mono tracking-tight text-slate-100">
                {activeCase.title}
              </h1>
            </div>

            {/* Advisory / CVE Status indicator */}
            <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-right font-mono text-xs">
              <span className="text-slate-500 block text-[10px] uppercase">Registry / CVE Baseline</span>
              <span className="text-slate-300 font-semibold">{activeCase.cveStatus}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
            {activeCase.description}
          </p>

          {/* Disputed Scale Range with Source Attribution */}
          {activeCase.disputedScale.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                Reported Ecosystem Scale (Range with Attribution):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {activeCase.disputedScale.map((scale, i) => (
                  <div
                    key={i}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 flex items-center gap-1.5"
                  >
                    <span className="text-slate-400">{scale.source}:</span>
                    <strong className="text-amber-300 font-semibold">{scale.claim}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. SIGNAL CLOCK (P0 FEATURE 1) */}
        <section>
          <SignalClock
            replayCase={activeCase}
            currentTimeSeconds={currentTimeSeconds}
            onTimeChange={(secs) => setCurrentTimeSeconds(secs)}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={(id) => setSelectedEvidenceId(id)}
          />
        </section>

        {/* 4. INVESTIGATION GRID (EVIDENCE + BLAST RADIUS GRAPH + DECISION TRACE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (7 cols): Evidence Cards & Blast Radius Graph */}
          <div className="lg:col-span-7 space-y-4">
            {/* Blast-Radius Dependency Graph (P0 Feature 2) */}
            <section>
              <BlastRadiusGraph
                packages={packages}
                projectName={customProjectName || activeCase.headlinePackage}
                selectedPackage={selectedPackage}
                headlinePackage={activeCase.headlinePackage}
                onSelectPackage={(pkg) => setSelectedPackage(pkg)}
              />
            </section>

            {/* Evidence Feed Cards (P0 Feature 3) */}
            <section className="bg-slate-900 border border-slate-800 rounded-md p-4">
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    FORENSIC EVIDENCE CARDS (AS OF {currentTimeDisplay} UTC)
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Showing <strong className="text-amber-300">{visibleEvidence.length}</strong> of{' '}
                  {activeCase.timeline.length} items
                </div>
              </div>

              {visibleEvidence.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded p-6 text-center text-xs font-mono text-slate-400 space-y-2">
                  <div className="text-amber-300 font-semibold">
                    {honestEmptyStateMessage}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    No public evidence or registry entries published prior to {currentTimeDisplay} UTC.
                    <br />
                    Scrub the Signal Clock forward to observe threat signal arrival.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleEvidence.map((ev) => (
                    <EvidenceCard
                      key={ev.id}
                      evidence={ev}
                      isActive={selectedEvidenceId === ev.id}
                      onSelect={() => setSelectedEvidenceId(ev.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column (5 cols): Decision Trace & Forensic Tooltabs */}
          <div className="lg:col-span-5 space-y-4">
            {/* Deterministic Decision Trace (P0 Feature 4) */}
            <section>
              <DecisionTrace
                evaluation={liveEvaluation}
                asOfTimeStr={currentTimeDisplay}
              />
            </section>

            {/* Forensic Labs Tab Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
              <div className="flex items-center gap-1 mb-3 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('decision')}
                  className={`px-2.5 py-1 rounded font-mono text-xs font-medium transition-colors ${
                    activeRightTab === 'decision'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  IOC Strip
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('whatif')}
                  className={`px-2.5 py-1 rounded font-mono text-xs font-medium transition-colors ${
                    activeRightTab === 'whatif'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  What-If Lab
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('soak')}
                  className={`px-2.5 py-1 rounded font-mono text-xs font-medium transition-colors ${
                    activeRightTab === 'soak'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Soak Policy
                </button>
              </div>

              {/* Tab 1: Defanged IOC Strip (P1 Feature 9) */}
              {activeRightTab === 'decision' && (
                <IocStrip iocs={activeCase.iocs} caseTitle={activeCase.title} />
              )}

              {/* Tab 2: What-If Lab (P1 Feature 6) */}
              {activeRightTab === 'whatif' && (
                <WhatIfLab
                  initialInput={{
                    independentSourceCount: visibleEvidence.filter((e) => e.isIndependentOriginal).length,
                    exactVersionMatched: visibleEvidence.some((e) => e.exactVersionMatched),
                    severity: liveEvaluation.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                    hasInstallScript: true,
                  }}
                />
              )}

              {/* Tab 3: Soak-Window Simulator (P1 Feature 8) */}
              {activeRightTab === 'soak' && (
                <SoakWindowSlider
                  packageName={activeCase.headlinePackage}
                  packageVersion={activeCase.headlineVersion}
                  packagePublishTimeStr={activeCase.leadTime.registryPublishTime}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 5. MODALS: Command Palette & Incident One-Pager */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeCase={activeCase}
        onSelectCase={(id) => handleCaseChange(id)}
        onSelectPackage={(pkg) => setSelectedPackage(pkg)}
        onSelectTime={(secs) => setCurrentTimeSeconds(secs)}
      />

      <IncidentOnePager
        isOpen={isOnePagerOpen}
        onClose={() => setIsOnePagerOpen(false)}
        replayCase={activeCase}
        evaluation={liveEvaluation}
        currentTimeStr={currentTimeDisplay}
      />
    </div>
  );
}
