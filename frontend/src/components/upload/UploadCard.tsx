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
  onSelectPreset?: (presetId: string) => void;
}

export function UploadCard({ onStartScan, isScanning, onSelectPreset }: UploadCardProps) {
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
    <div className="card-glass-elevated rounded-2xl p-6 sm:p-7 relative overflow-hidden transition-all">
      {/* Header with Title and Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <FileCode2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight font-sans">
              Scan Dependency Manifest
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200">
              lockfile v2 / v3
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Drop any <code className="text-blue-600 font-semibold font-mono">package-lock.json</code> to discover public threat signals and verify quotes with exact version resolution.
          </p>
        </div>

        {/* 1-Click Incident Replay Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 font-mono uppercase">
            1-Click Replay:
          </span>
          <button
            onClick={handleLoadSample}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 hover:shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Load event-stream 2018 backdoor incident replay"
          >
            <Zap className="h-3.5 w-3.5 text-rose-600" />
            <span>event-stream (2018)</span>
          </button>
          <button
            onClick={handleLoadUaParserSample}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-100 hover:shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Load ua-parser-js 2021 account hijack incident replay"
          >
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            <span>ua-parser-js (2021)</span>
          </button>
        </div>
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
            className={`group cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                : 'border-slate-200/90 hover:border-blue-400 hover:bg-slate-50/60'
            }`}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform shadow-xs border border-blue-100">
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              Drag & drop your <span className="text-blue-600 font-mono">package-lock.json</span> here, or{' '}
              <span className="text-blue-600 underline underline-offset-2">browse file</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              Strictly validated for lockfile v2/v3 &bull; Resolves direct & transitive shortest paths
            </p>
          </div>
        ) : (
          /* Staged File Preview Card */
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {selectedSummary.fileName}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-mono text-blue-700 border border-blue-200 font-semibold shadow-2xs">
                      v{selectedSummary.lockfileVersion}
                    </span>
                    {selectedSummary.isSyntheticSample && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200">
                        Demo Replay
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span>
                      <strong className="text-slate-800 font-semibold font-mono">
                        {selectedSummary.totalPackagesDetected}
                      </strong>{' '}
                      packages
                    </span>
                    <span>&bull;</span>
                    <span>
                      <strong className="text-slate-800 font-semibold font-mono">
                        {selectedSummary.directDependenciesCount}
                      </strong>{' '}
                      direct
                    </span>
                    <span>&bull;</span>
                    <span>
                      <strong className="text-slate-800 font-semibold font-mono">
                        {selectedSummary.transitiveDependenciesCount}
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
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-xs font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onStartScan(selectedSummary)}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
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
      </div>
    </div>
  );
}
