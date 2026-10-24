'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { ProductPreviewCard } from '@/components/home/ProductPreviewCard';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustStrip } from '@/components/home/TrustStrip';
import { StatCards } from '@/components/dashboard/StatCards';
import { FindingsTable } from '@/components/dashboard/FindingsTable';
import { EvidenceDrawer } from '@/components/dashboard/EvidenceDrawer';
import { ActivityFeedPreview } from '@/components/dashboard/ActivityFeedPreview';
import { UploadCard } from '@/components/upload/UploadCard';
import { ScanProgressBar } from '@/components/scan/ScanProgressBar';
import { scansService } from '@/services/scansService';
import {
  ScanSummaryMetrics,
  SecurityFinding,
  ActivityEvent,
  LockfileParsedSummary,
  ScanProgressState,
} from '@/types';
import { envConfig } from '@/config/env';
import { Shield, Sparkles, Upload } from 'lucide-react';

export default function DepShieldHomePage() {
  const [metrics, setMetrics] = useState<ScanSummaryMetrics | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progressState, setProgressState] = useState<ScanProgressState | null>(null);
  const [lastScannedFile, setLastScannedFile] = useState<string>('sample-package-lock.json');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const findingsSectionRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup pending timers on component unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  // Initial load with baseline demo telemetry
  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [metricsData, findingsData, activityData] = await Promise.all([
          scansService.getSummaryMetrics(),
          scansService.getFindings(),
          scansService.getActivityFeed(),
        ]);
        if (!ignore) {
          setMetrics(metricsData);
          setFindings(findingsData);
          setActivity(activityData);
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to load initial DepShield telemetry:', err);
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  // Handle Scan execution triggered from UploadCard
  const handleStartScan = async (lockfileSummary: LockfileParsedSummary) => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    setIsScanning(true);
    setLastScannedFile(lockfileSummary.fileName);

    try {
      const result = await scansService.simulateScan(lockfileSummary, (progress) => {
        setProgressState(progress);
      });

      setMetrics(result.summary);
      setFindings(result.findings);
      setActivity(result.activity);
      setLastSyncedTime(new Date().toLocaleTimeString());

      // Auto scroll to findings table after scan
      const scrollTimer = setTimeout(() => {
        findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 400);
      timersRef.current.push(scrollTimer);
    } catch (err) {
      console.error('Scan simulation error:', err);
    } finally {
      setIsScanning(false);
      const dismissTimer = setTimeout(() => {
        setProgressState(null);
      }, 1500);
      timersRef.current.push(dismissTimer);
    }
  };

  // Re-run demo scan with sample lockfile
  const handleTriggerQuickScan = async () => {
    const dummySummary: LockfileParsedSummary = {
      fileName: 'sample-package-lock.json',
      fileSizeBytes: 24500,
      lockfileVersion: 3,
      projectName: 'depshield-demo-app',
      projectVersion: '2.1.0',
      totalPackagesDetected: metrics?.totalDependenciesScanned || 384,
      directDependenciesCount: metrics?.directCount || 22,
      transitiveDependenciesCount: metrics?.transitiveCount || 362,
      parsedAt: new Date().toISOString(),
      isSyntheticSample: true,
    };
    await handleStartScan(dummySummary);
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Sticky top nav: DepShield wordmark, links (How it works, Demo), one primary button */}
      <Header
        onUploadClick={scrollToUpload}
        onDemoClick={handleTriggerQuickScan}
        isScanning={isScanning}
      />

      {/* Main Home Page Body */}
      <main className="flex-1 px-4 py-8 sm:px-6 md:px-8 max-w-7xl w-full mx-auto space-y-12">
        {/* 2. Hero: headline "Early warnings for risky npm dependencies", one supporting line, buttons & mode badge */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/40 to-slate-950 p-6 sm:p-10 md:p-12 shadow-2xl">
          {/* Subtle ambient lighting */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="relative z-10 max-w-3xl space-y-6">
            {/* Mock / Backend mode badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-1 text-xs font-mono border border-slate-800 text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  envConfig.useMocks ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span className="text-slate-400">Environment Mode:</span>
              <span className="font-semibold text-cyan-300">
                {envConfig.useMocks ? 'Mock Demo (Offline Mode)' : 'Live FastAPI Backend'}
              </span>
            </div>

            {/* Exact required headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              Early warnings for risky npm dependencies
            </h1>

            {/* One supporting line */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Investigate emerging threat signals, verify unpatched repository reports, and inspect evidence-backed findings before official CVE publication.
            </p>

            {/* Hero CTA buttons: "Upload package-lock.json" (primary) and "Try a demo scan" (secondary) */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={scrollToUpload}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-500/35 active:scale-95"
              >
                <Upload className="h-4 w-4" />
                <span>Upload package-lock.json</span>
              </button>

              <button
                onClick={handleTriggerQuickScan}
                disabled={isScanning}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-5 py-3 text-xs sm:text-sm font-semibold text-slate-200 transition-all hover:bg-slate-800 hover:text-white hover:border-slate-600 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span>{isScanning ? 'Running Scan...' : 'Try a demo scan'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Product preview directly under the hero: real, interactive card using mock findings labelled "Synthetic demo data" */}
        <section aria-label="Interactive Product Preview">
          <ProductPreviewCard
            findings={findings}
            onSelectFinding={(f) => setSelectedFinding(f)}
          />
        </section>

        {/* 4. "How it works" in 4 steps: Upload, Check known databases, Look for early warnings, Scored findings */}
        <HowItWorks />

        {/* 5. Trust strip with honest claims only */}
        <TrustStrip />

        {/* Comprehensive Scan Flow: Upload, Progress, Metrics, Findings, Activity */}
        <div className="space-y-6 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Live Scanner &amp; Ingestion Console
              </h2>
              <p className="text-xs text-slate-400">
                Upload your lockfile or replay a demo scan to inspect findings in depth
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>Active Target:</span>
              <span className="text-cyan-300 font-semibold">{lastScannedFile}</span>
              {lastSyncedTime && <span>&bull; {lastSyncedTime}</span>}
            </div>
          </div>

          {/* Upload Card Section */}
          <div ref={uploadSectionRef} id="upload">
            <UploadCard onStartScan={handleStartScan} isScanning={isScanning} />
          </div>

          {/* Active Scan Progress State */}
          {progressState && (
            <div className="transition-all animate-in slide-in-from-top-4">
              <ScanProgressBar progressState={progressState} />
            </div>
          )}

          {/* Key Metrics Overview */}
          {metrics && (
            <section aria-label="Key Supply Chain Metrics" id="dashboard">
              <StatCards metrics={metrics} />
            </section>
          )}

          {/* Findings Table Section */}
          <section ref={findingsSectionRef} id="findings" className="space-y-4">
            <FindingsTable
              findings={findings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              selectedFindingId={selectedFinding?.id}
            />
          </section>

          {/* Audit & Activity Stream Section */}
          <section id="activity" className="space-y-4">
            <ActivityFeedPreview activity={activity} />
          </section>
        </div>

        {/* 6. Footer with exact limits note: "Prototype. Deep-checks a limited number of packages per scan." */}
        <footer className="pt-8 pb-10 border-t border-slate-800/80 space-y-4 text-xs text-slate-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-sm">
                <Shield className="h-4 w-4 fill-current" />
              </div>
              <span className="font-bold text-slate-200 text-sm">DepShield</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400">Early-Warning Intelligence for npm Dependencies</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span>Environment: <strong className="text-cyan-400">{envConfig.nodeEnv}</strong></span>
              <span>&bull;</span>
              <span>Mode: <strong className="text-slate-300">{envConfig.useMocks ? 'Mock Demo' : 'Live Backend'}</strong></span>
            </div>
          </div>

          {/* Exact limits note required by prompt */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-center sm:text-left text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong className="text-slate-300">Notice:</strong> Prototype. Deep-checks a limited number of packages per scan.
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              NEXT_PUBLIC_USE_MOCKS=1
            </span>
          </div>
        </footer>
      </main>

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}
