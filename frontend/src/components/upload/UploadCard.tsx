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
  Zap,
} from 'lucide-react';
import {
  validateAndParsePackageLock,
  SAMPLE_DEMO_PACKAGE_LOCK,
  SAMPLE_LEGACY_PACKAGE_LOCK,
} from '@/services/lockfileParser';
import { LockfileParsedSummary } from '@/types';

interface UploadCardProps {
  onStartScan: (summary: LockfileParsedSummary) => void;
  isScanning: boolean;
  onError?: (error: string) => void;
}

export function UploadCard({ onStartScan, isScanning, onError }: UploadCardProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<LockfileParsedSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileContent = (content: string, fileName: string, isSample = false) => {
    setErrorMessage(null);
    const result = validateAndParsePackageLock(content, fileName, isSample);

    if (!result.valid || !result.summary) {
      const err = result.error || 'Failed to parse package-lock.json.';
      setErrorMessage(err);
      setSelectedSummary(null);
      if (onError) onError(err);
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
    processFileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'event-stream-2018.json', true);
    if (onSelectPreset) {
      onSelectPreset('event-stream-2018');
    }
  };

  const handleLoadUaParserSample = () => {
    processFileContent(SAMPLE_LEGACY_PACKAGE_LOCK, 'ua-parser-js-2021.json', true);
    if (onSelectPreset) {
      onSelectPreset('ua-parser-js-2021');
    }
  };

  const handleClear = () => {
    setSelectedSummary(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-6 relative overflow-hidden">
      {/* Ambient background accent */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#3C3C42]/30 blur-3xl" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#3C3C42]/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#EFEFF0] flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[#BDBDC1]" />
              Upload Dependency Manifest
            </h2>
            <span className="rounded-full bg-[#3C3C42]/30 px-2.5 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/60">
              npm v2 / v3
            </span>
          </div>
          <p className="text-xs text-[#BDBDC1] mt-1">
            Provide a <code className="text-[#EFEFF0] font-mono">package-lock.json</code> to investigate public threat signals and produce evidence-backed, version-specific risk alerts.
          </p>
        </div>

        {/* Demo Replay Button */}
        <button
          onClick={handleLoadSample}
          disabled={isScanning}
          className="inline-flex items-center gap-2 rounded-lg border border-[#3C3C42]/60 bg-[#3C3C42]/30 px-3.5 py-2 text-xs font-medium text-[#EFEFF0] transition-all hover:bg-[#3C3C42]/50 hover:border-[#7D7E84] active:scale-95 disabled:opacity-50"
          title="Load preconfigured synthetic demo lockfile with simulated signals"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#EFEFF0]" />
          <span>Load Synthetic Demo Lockfile (Replay)</span>
        </button>
      </div>

      {/* Main Upload / Drag & Drop Surface */}
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
            className={`group cursor-pointer rounded-xl border border-dashed p-8 text-center transition-all ${
              dragActive
                ? 'border-[#EFEFF0] bg-[#3C3C42]/30'
                : 'border-[#3C3C42]/70 hover:border-[#7D7E84] bg-[#3C3C42]/10 hover:bg-[#3C3C42]/20'
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#3C3C42]/30 text-[#EFEFF0] group-hover:scale-105 transition-transform border border-[#3C3C42]/60">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="mt-4 text-xs font-medium text-[#EFEFF0]">
              Drag & drop your <span className="text-white font-mono">package-lock.json</span> here, or{' '}
              <span className="text-[#BDBDC1] underline underline-offset-2 hover:text-white">browse files</span>
            </p>
            <p className="mt-1 text-[11px] text-[#7D7E84]">
              Strictly validated for lockfile format v2 or v3. Up to 4 packages deep-checked per scan due to API budget limits.
              {process.env.NEXT_PUBLIC_USE_MOCKS === '1' ? ' Zero external requests.' : ''}
            </p>
          </div>
        ) : (
          /* File Preview Card */
          <div className="rounded-xl border border-[#3C3C42]/60 bg-[#010101]/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3C3C42]/30 text-emerald-400 border border-[#3C3C42]/60">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#EFEFF0] font-mono">
                      {selectedSummary.fileName}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-mono text-blue-700 border border-blue-200 font-semibold shadow-2xs">
                      v{selectedSummary.lockfileVersion}
                    </span>
                    {selectedSummary.isSyntheticSample && (
                      <span className="rounded bg-[#3C3C42]/40 px-2 py-0.5 text-[10px] font-mono text-[#BDBDC1] border border-[#3C3C42]/60">
                        Synthetic Demo Sample
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#BDBDC1]">
                    <span>
                      Project:{' '}
                      <strong className="text-[#EFEFF0]">
                        {selectedSummary.projectName}@{selectedSummary.projectVersion}
                      </strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Format:{' '}
                      <strong className="text-[#EFEFF0] font-mono">v{selectedSummary.lockfileVersion}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Packages:{' '}
                      <strong className="text-[#EFEFF0]">
                        {selectedSummary.totalPackagesDetected}
                      </strong>{' '}
                      transitive
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  onClick={handleClear}
                  disabled={isScanning}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#3C3C42]/60 bg-[#3C3C42]/20 px-3 py-2 text-xs font-medium text-[#BDBDC1] hover:text-[#EFEFF0] hover:bg-[#3C3C42]/40 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onStartScan(selectedSummary)}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#EFEFF0] px-5 py-2 text-xs font-semibold text-[#010101] hover:bg-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Play className={`h-4 w-4 fill-current ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Analyzing Signals...' : 'Start Threat Investigation'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center gap-2.5 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Synthetic Demonstration Notice Banner */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#010101]/40 px-3.5 py-2 text-[11px] text-[#BDBDC1] border border-[#3C3C42]/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#7D7E84]" />
            <span>
              <strong className="text-[#EFEFF0]">Safe Demonstration Mode:</strong> Deep-checks bounded to 4 packages per scan due to API budget limits. Complements standard scanners (Dependabot/Snyk/OSV).{process.env.NEXT_PUBLIC_USE_MOCKS === '1' ? ' Zero external requests.' : ''}
            </span>
          </div>
          {process.env.NEXT_PUBLIC_USE_MOCKS === '1' && (
            <span className="hidden md:inline font-mono text-[10px] text-[#7D7E84]">
              NEXT_PUBLIC_USE_MOCKS=1
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
