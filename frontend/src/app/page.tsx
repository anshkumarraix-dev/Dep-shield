'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatCards } from '@/components/dashboard/StatCards';
import { FindingsTable } from '@/components/dashboard/FindingsTable';
import { EvidenceDrawer } from '@/components/dashboard/EvidenceDrawer';
import { ActivityFeedPreview } from '@/components/dashboard/ActivityFeedPreview';
import { DependencyInventory } from '@/components/dashboard/DependencyInventory';
import { UploadCard } from '@/components/upload/UploadCard';
import { ScanProgressBar } from '@/components/scan/ScanProgressBar';
import { scansService } from '@/services/scansService';
import { parseLockfileContent, SAMPLE_DEMO_PACKAGE_LOCK } from '@/services/lockfileParser';
import {
  ScanSummaryMetrics,
  SecurityFinding,
  ActivityEvent,
  LockfileParsedSummary,
  ScanProgressState,
  ParsedDependency,
  RiskLevel,
} from '@/types';
import { envConfig } from '@/config/env';
import { Shield, Sparkles, CheckCircle2, ArrowDown, RotateCw } from 'lucide-react';

export default function DepShieldDashboard() {
  const [metrics, setMetrics] = useState<ScanSummaryMetrics | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [packages, setPackages] = useState<ParsedDependency[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progressState, setProgressState] = useState<ScanProgressState | null>(null);
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [lastScannedFile, setLastScannedFile] = useState<string>('sample-package-lock.json');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'direct' | 'transitive' | 'analyzed'>('all');
  const [lastCompletedScan, setLastCompletedScan] = useState<{
    completedAt: string;
    durationMs: number;
    packagesCount: number;
    findingsCount: number;
    fileName: string;
  } | null>(null);

  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const findingsSectionRef = useRef<HTMLDivElement>(null);
  const dependenciesSectionRef = useRef<HTMLDivElement>(null);
  const activitySectionRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup pending timers on component unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  // Initial load with baseline demo data and parsed sample packages
  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        // Parse baseline sample fixture packages locally
        const parsedSample = parseLockfileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'sample-package-lock.json');
        if (!ignore && parsedSample.packages) {
          setPackages(parsedSample.packages);
        }

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
    if (isScanning) return;

    // Clear any previous transition timers
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    const startTime = performance.now();
    setIsScanning(true);
    setLastScannedFile(lockfileSummary.fileName);

    // Update parsed inventory packages if present
    if (lockfileSummary.packages && lockfileSummary.packages.length > 0) {
      setPackages(lockfileSummary.packages);
    }

    try {
      const result = await scansService.simulateScan(lockfileSummary, (progress) => {
        setProgressState(progress);
      });

      const elapsed = Math.round(performance.now() - startTime);
      setMetrics(result.summary);
      setFindings(result.findings);
      setActivity(result.activity);
      setLastSyncedTime(new Date().toLocaleTimeString());
      setLastCompletedScan({
        completedAt: new Date().toLocaleTimeString(),
        durationMs: elapsed,
        packagesCount: result.summary.totalDependenciesScanned,
        findingsCount: result.findings.length,
        fileName: lockfileSummary.fileName,
      });

      // Auto scroll to findings table after scan completes
      const scrollTimer = setTimeout(() => {
        findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
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

  // Re-run demo scan with current file
  const handleTriggerQuickScan = async () => {
    if (isScanning) return;

    const dummySummary: LockfileParsedSummary = {
      fileName: lastScannedFile,
      fileSizeBytes: 24500,
      lockfileVersion: 3,
      projectName: 'depshield-demo-app',
      projectVersion: '2.1.0',
      totalPackagesDetected: packages.length || 9,
      directDependenciesCount: packages.filter((p) => p.type === 'direct').length || 5,
      transitiveDependenciesCount: packages.filter((p) => p.type === 'transitive').length || 4,
      packages: packages,
      analyzedPackages: packages.slice(0, 4),
      parsedAt: new Date().toISOString(),
      isSyntheticSample: true,
    };
    await handleStartScan(dummySummary);
  };

  // Handle interactive filter clicks from StatCards
  const handleStatCardFilterClick = (filterType: 'riskLevel' | 'dependencyType' | 'section', value: string) => {
    if (filterType === 'riskLevel') {
      setRiskFilter(value as RiskLevel);
      findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (filterType === 'dependencyType') {
      setInventoryFilter(value as 'all' | 'direct' | 'transitive');
      dependenciesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (filterType === 'section') {
      if (value === 'findings') {
        findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (value === 'dependencies') {
        dependenciesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleNavigation = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'upload') {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'findings') {
      findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'dependencies') {
      dependenciesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'activity') {
      activitySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Sidebar Navigation (Desktop fixed + Mobile drawer) */}
      <Sidebar
        findingsCount={findings.length}
        activeSection={activeSection}
        onNavigate={handleNavigation}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area (Responsive padding) */}
      <div className="flex-1 lg:pl-64 pl-0 flex flex-col min-h-screen">
        <Header
          onRefresh={handleTriggerQuickScan}
          isScanning={isScanning}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Welcome / Intelligence Engine Header Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-xl">
            <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20 mb-3">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Early-Warning Intelligence Layer</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Early-Warning Intelligence for Dependency Threats
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
                  Investigates public threat signals and produces evidence-backed, version-specific risk alerts. Complements standard scanners (Dependabot, Snyk, OSV) without claiming guaranteed zero-day detection.
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex flex-col items-start md:items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Engine: Ready (Synthetic Mock Mode)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>Target:</span>
                  <span className="text-cyan-300 font-medium">{lastScannedFile}</span>
                  {lastSyncedTime && (
                    <span className="text-slate-500">&bull; {lastSyncedTime}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Capability Classification Grid: Implemented vs Mocked vs Roadmap vs Proposed Validation */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4 border-t border-slate-800/80 text-[11px]">
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 space-y-1">
                <span className="font-semibold text-cyan-400 font-mono uppercase text-[10px] block">
                  &bull; Implemented (Live Frontend)
                </span>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Lockfile v2/v3 parser, tri-state OSV badge logic, evidence drawer, filterable findings, SSE client.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 space-y-1">
                <span className="font-semibold text-amber-400 font-mono uppercase text-[10px] block">
                  &bull; Mocked (Hackathon Demo)
                </span>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Synthetic demonstration signals, client-side bounded scanner, sample lockfile replay.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 space-y-1">
                <span className="font-semibold text-blue-400 font-mono uppercase text-[10px] block">
                  &bull; Roadmap (Planned)
                </span>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Interactive D3-force dependency graph, automated PR remediations, persistent webhook monitor.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 space-y-1">
                <span className="font-semibold text-purple-400 font-mono uppercase text-[10px] block">
                  &bull; Proposed Validation (Research)
                </span>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Empirical lead-time benchmark against official CVE dates using verifiable historical snapshots.
                </p>
              </div>
            </div>
          </section>

          {/* Upload Lockfile Section */}
          <div ref={uploadSectionRef} id="upload">
            <UploadCard onStartScan={handleStartScan} isScanning={isScanning} />
          </div>

          {/* Active Dedicated Scan Progress View */}
          {progressState && (
            <div className="transition-all animate-in slide-in-from-top-4">
              <ScanProgressBar progressState={progressState} />
            </div>
          )}

          {/* Scan Completion Alert & Telemetry Card */}
          {lastCompletedScan && !isScanning && !progressState && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      Security Analysis Complete
                    </span>
                    <span className="rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-800/60">
                      {(lastCompletedScan.durationMs / 1000).toFixed(1)}s elapsed
                    </span>
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-800">
                      $0.00 billable API cost
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300/80 mt-0.5">
                    Evaluated <strong className="text-white">{lastCompletedScan.packagesCount} packages</strong> from <code className="text-cyan-300">{lastCompletedScan.fileName}</code> &bull; Verified against OSV vulnerability graph &bull; Ranked <strong className="text-white">{lastCompletedScan.findingsCount} security findings</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  onClick={() => findingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/60 px-3 py-1.5 text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span>Inspect Findings</span>
                </button>
                <button
                  onClick={handleTriggerQuickScan}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Re-Scan</span>
                </button>
              </div>
            </div>
          )}

          {/* Key Metrics Overview */}
          {metrics && (
            <section aria-label="Key Supply Chain Metrics" id="dashboard">
              <StatCards metrics={metrics} onFilterClick={handleStatCardFilterClick} />
            </section>
          )}

          {/* Findings Table Section */}
          <section ref={findingsSectionRef} id="findings" className="space-y-4">
            <FindingsTable
              findings={findings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              selectedFindingId={selectedFinding?.id}
              initialRiskFilter={riskFilter}
            />
          </section>

          {/* Dependency Inventory Section */}
          <section ref={dependenciesSectionRef} id="dependencies" className="space-y-4">
            <DependencyInventory
              packages={packages}
              findings={findings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              selectedFilter={inventoryFilter}
            />
          </section>

          {/* Activity Stream Section */}
          <section ref={activitySectionRef} id="activity" className="space-y-4">
            <ActivityFeedPreview activity={activity} />
          </section>

          {/* Footer Note */}
          <footer className="pt-6 pb-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>DepShield &bull; Autonomous Dependency Defense Frontend</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="font-mono text-slate-400">Environment: {envConfig.nodeEnv}</span>
              <span className="font-mono text-cyan-400">NEXT_PUBLIC_USE_MOCKS=1</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}

