'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnnouncementBar } from '@/components/home/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { ThreeDPillars } from '@/components/home/ThreeDPillars';
import { DataSourcesStrip } from '@/components/home/DataSourcesStrip';
import { StatsWithConsole } from '@/components/home/StatsWithConsole';
import { ProblemCards } from '@/components/home/ProblemCards';
import { VerificationTabs } from '@/components/home/VerificationTabs';
import { IntegrationsGrid } from '@/components/home/IntegrationsGrid';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustStrip } from '@/components/home/TrustStrip';
import { AccordionFaq } from '@/components/home/AccordionFaq';
import { ClosingCtaBand } from '@/components/home/ClosingCtaBand';
import { Footer } from '@/components/layout/Footer';
import { HelpLauncher } from '@/components/home/HelpLauncher';
import { ToastNotification, ToastMessage } from '@/components/common/ToastNotification';

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

export default function DepShieldHomePage() {
  const [metrics, setMetrics] = useState<ScanSummaryMetrics | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progressState, setProgressState] = useState<ScanProgressState | null>(null);
  const [lastScannedFile, setLastScannedFile] = useState<string>('sample-package-lock.json');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const findingsSectionRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Cleanup pending timers on component unmount
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

  // Initial load with baseline demo telemetry
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
  }, []);

  // Handle Scan execution triggered from UploadCard
  const handleStartScan = async (lockfileSummary: LockfileParsedSummary) => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    setIsScanning(true);
    setLastScannedFile(lockfileSummary.fileName);

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

      setMetrics(result.summary);
      setFindings(result.findings);
      setActivity(result.activity);
      setLastSyncedTime(new Date().toLocaleTimeString());

      addToast(
        'success',
        'Scan Completed',
        `${lockfileSummary.fileName}: ${result.findings.length} findings evaluated (Synthetic demo data)`
      );

      // Auto scroll to findings table after scan
      const scrollTimer = setTimeout(() => {
        findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 400);
      timersRef.current.push(scrollTimer);
    } catch (err) {
      console.error('Scan simulation error:', err);
      addToast('error', 'Scan Error', 'An unexpected error occurred during scan simulation.');
    } finally {
      setIsScanning(false);
      const dismissTimer = setTimeout(() => {
        setProgressState(null);
      }, 1500);
      timersRef.current.push(dismissTimer);
    }
    void startReplayScan(newCaseId);
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
    reader.readAsText(file);
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUploadError = (errorMessage: string) => {
    addToast('error', 'Invalid Lockfile Format', errorMessage);
  };

  return (
    <div className="min-h-screen bg-[#010101] text-[#EFEFF0] flex flex-col selection:bg-[#3C3C42] selection:text-[#EFEFF0]">
      {/* Top Announcement Banner */}
      <AnnouncementBar />

      {/* Sticky Top Nav with Mega-Menus & Scroll-Progress */}
      <Header
        onUploadClick={scrollToUpload}
        onDemoClick={handleTriggerQuickScan}
        isScanning={isScanning}
      />

      {/* Main Home Page Experience */}
      <main className="flex-1 space-y-20 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto text-center">
          {/* Subtle background ambient radial lights */}
          <div className="pointer-events-none absolute left-1/2 -top-32 -translate-x-1/2 h-96 w-[48rem] rounded-full bg-gradient-to-b from-[#3C3C42]/20 via-[#3C3C42]/5 to-transparent blur-3xl" />

          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            {/* Environment Mode Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#3C3C42]/20 px-3.5 py-1 text-xs font-mono border border-[#3C3C42]/60 text-[#BDBDC1] backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  envConfig.useMocks ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span className="text-[#7D7E84]">Environment Mode:</span>
              <span className="font-semibold text-[#EFEFF0]">
                {envConfig.useMocks ? 'Mock Demo (Offline Mode)' : 'Live FastAPI Backend'}
              </span>
            </div>

            {/* Hero Brand Title */}
            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight text-[#EFEFF0] leading-[1.02]">
              Dep<span className="bg-gradient-to-r from-[#EFEFF0] via-white to-[#BDBDC1] bg-clip-text text-transparent">Shield</span>
            </h1>

            {/* Clean, Minimalist Tagline */}
            <p className="text-lg sm:text-xl md:text-2xl text-[#BDBDC1] max-w-2xl mx-auto font-medium tracking-tight">
              Automated early-warning intelligence for npm dependencies.
            </p>
          </div>

          {/* 3D Circular Pillars with Continuous Orbit Animation */}
          <div className="mt-8">
            <ThreeDPillars
              onUploadClick={scrollToUpload}
              onDemoClick={handleTriggerQuickScan}
              isScanning={isScanning}
              onSelectPillar={() => scrollToUpload()}
            />
          </div>
        </section>

        {/* Marquee Strip (CSS-only, pause on hover, listing ONLY OSV, npm registry, public web signals) */}
        <DataSourcesStrip />

        {/* Container for Main Content Sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-24">
          {/* Sticky-Scroll Section: Stats on left, sticky console on right */}
          <StatsWithConsole
            findings={findings}
            onSelectFinding={(f) => setSelectedFinding(f)}
          />

          {/* Three Problems: Code-window cards that rise on scroll with IntersectionObserver */}
          <ProblemCards />

          {/* Verification Tabs: Sliding indicator, keyboard arrows, synthetic demo scenarios */}
          <VerificationTabs />

          {/* Integration & Source Icon Grid: Staggered fade in */}
          <IntegrationsGrid />

          {/* How DepShield Works: 4-Step Pipeline */}
          <HowItWorks />

          {/* Trust Strip: Honest Claims */}
          <TrustStrip />

          {/* Live Scanner & Ingestion Flow */}
          <section id="upload" className="space-y-6 pt-6 border-t border-[#3C3C42]/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#EFEFF0] tracking-tight">
                  Interactive Lockfile Scanner &amp; Ingestion Console
                </h2>
                <p className="text-xs text-[#BDBDC1] mt-1">
                  Upload your package-lock.json (v2 or v3) or replay synthetic demonstration telemetry
                </p>
              </div>
              <span className="font-mono font-bold tracking-tight text-sm text-slate-100">
                DEPSHIELD <span className="text-slate-400 font-normal text-xs">&#47;&#47; INCIDENT ROOM</span>
              </span>
            </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#BDBDC1]">
                <span className="text-[#7D7E84]">Active Target:</span>
                <span className="text-[#EFEFF0] font-semibold">{lastScannedFile}</span>
                {lastSyncedTime && <span className="text-[#5F5F62]">&bull; {lastSyncedTime}</span>}
              </div>
            </div>
          </div>

            {/* Upload Card with error toast trigger */}
            <div ref={uploadSectionRef}>
              <UploadCard
                onStartScan={handleStartScan}
                isScanning={isScanning}
                onError={handleUploadError}
              />
            </div>

            {/* Scan Progress Bar */}
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

            {/* Findings Table with Tri-State OSV Badges */}
            <section ref={findingsSectionRef} id="findings" className="space-y-4">
              <FindingsTable
                findings={findings}
                onSelectFinding={(f) => setSelectedFinding(f)}
                selectedFindingId={selectedFinding?.id}
              />
            </section>

            {/* Activity Stream */}
            <section id="activity" className="space-y-4">
              <ActivityFeedPreview activity={activity} />
            </section>
          </section>

          {/* Section: FAQ Accordion */}
          <AccordionFaq />

          {/* Closing CTA Band */}
          <ClosingCtaBand
            onUploadClick={scrollToUpload}
            onDemoClick={handleTriggerQuickScan}
            isScanning={isScanning}
          />
        </div>
      </main>

      {/* 5-Column Snyk-Style Footer with Demo Scan Card and Honest Limits */}
      <Footer
        onUploadClick={scrollToUpload}
        onDemoClick={handleTriggerQuickScan}
      />

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />

      {/* Floating Help & FAQ Drawer Launcher (NOT an AI chat) */}
      <HelpLauncher />

      {/* Toast Notification Region */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
