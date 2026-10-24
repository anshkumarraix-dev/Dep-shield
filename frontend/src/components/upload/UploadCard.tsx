'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  validateAndParsePackageLock,
  SAMPLE_DEMO_PACKAGE_LOCK,
} from '@/services/lockfileParser';
import { LockfileParsedSummary } from '@/types';

interface UploadCardProps {
  onStartScan: (summary: LockfileParsedSummary) => void;
  isScanning: boolean;
}

export function UploadCard({ onStartScan, isScanning }: UploadCardProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<LockfileParsedSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileContent = (content: string, fileName: string, isSample = false) => {
    setErrorMessage(null);
    const result = validateAndParsePackageLock(content, fileName, isSample);

    if (!result.valid || !result.summary) {
      setErrorMessage(result.error || 'Failed to parse package-lock.json.');
      setSelectedSummary(null);
    } else {
      setSelectedSummary(result.summary);
      setErrorMessage(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Please select a JSON file, typically named "package-lock.json".');
      setSelectedSummary(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processFileContent(text, file.name, false);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file from disk.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Please select or drop a valid JSON file, typically named "package-lock.json".');
      setSelectedSummary(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processFileContent(text, file.name, false);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the dropped file from disk.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    processFileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'sample-package-lock.json', true);
  };

  const handleClear = () => {
    setSelectedSummary(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-cyan-400" />
              Upload Dependency Manifest
            </h2>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
              npm v2 / v3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provide a <code className="text-cyan-300">package-lock.json</code> to investigate public threat signals and produce evidence-backed, version-specific risk alerts.
          </p>
        </div>

        {/* Sample Lockfile Button */}
        <button
          onClick={handleLoadSample}
          disabled={isScanning}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-all hover:bg-slate-700 hover:text-white active:scale-95 disabled:opacity-50"
          title="Load preconfigured synthetic demo lockfile with simulated signals"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Use Sample Lockfile</span>
        </button>
      </div>

      {/* Main Upload / Drag-and-Drop Area */}
      <div className="mt-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
          id="package-lock-file-input"
        />

        {!selectedSummary ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-cyan-400 group-hover:scale-105 transition-transform border border-slate-700">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="mt-4 text-xs font-medium text-slate-200">
              Drag & drop your <span className="text-cyan-400 font-mono">package-lock.json</span> here, or{' '}
              <span className="text-cyan-400 underline underline-offset-2">browse files</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Strictly validated for lockfile format v2 or v3. Zero external API calls during demonstration.
            </p>
          </div>
        ) : (
          /* File Preview Card */
          <div className="rounded-xl border border-cyan-500/30 bg-slate-950/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white font-mono">
                      {selectedSummary.fileName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({(selectedSummary.fileSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                    {selectedSummary.isSyntheticSample && (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/30">
                        Synthetic Demo Sample
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>
                      Project:{' '}
                      <strong className="text-slate-200">
                        {selectedSummary.projectName}@{selectedSummary.projectVersion}
                      </strong>
                    </span>
                    <span>
                      Format:{' '}
                      <strong className="text-slate-200 font-mono">v{selectedSummary.lockfileVersion}</strong>
                    </span>
                    <span>
                      Packages:{' '}
                      <strong className="text-cyan-300">
                        {selectedSummary.totalPackagesDetected}
                      </strong>{' '}
                      ({selectedSummary.directDependenciesCount} direct, {selectedSummary.transitiveDependenciesCount} transitive)
                    </span>
                    <span>
                      Analysed Scope:{' '}
                      <strong className="text-emerald-400">
                        {selectedSummary.analyzedPackages?.length || 4} direct
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={handleClear}
                  disabled={isScanning}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Replace File</span>
                </button>
                <button
                  onClick={() => onStartScan(selectedSummary)}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{isScanning ? 'Scan Running...' : 'Start Demo Scan'}</span>
                </button>
              </div>
            </div>

            {/* Edge-case warning if applicable */}
            {selectedSummary.warningMessage && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{selectedSummary.warningMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Validation Error:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Synthetic Demonstration Notice Banner */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-950/40 px-3.5 py-2 text-[11px] text-slate-400 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>
              <strong>Safe Demonstration Mode:</strong> All scans execute 100% locally with synthetic threat corpus. Complements standard scanners (Dependabot/Snyk/OSV). Zero external network requests.
            </span>
          </div>
          <span className="hidden md:inline font-mono text-[10px] text-amber-400/90 font-medium">
            DEMO MODE — SYNTHETIC THREAT DATA
          </span>
        </div>
      </div>

    </div>
  );
}
