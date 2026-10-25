'use client';

import React, { useState, useMemo } from 'react';
import { ParsedDependency, SecurityFinding } from '@/types';
import {
  Layers,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';

interface DependencyInventoryProps {
  packages: ParsedDependency[];
  findings?: SecurityFinding[];
  onSelectFinding?: (finding: SecurityFinding) => void;
  selectedFilter?: 'all' | 'direct' | 'transitive' | 'analyzed';
}

export function DependencyInventory({
  packages,
  findings = [],
  onSelectFinding,
  selectedFilter = 'all',
}: DependencyInventoryProps) {
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'transitive' | 'analyzed'>(selectedFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Map package names to their security finding if one exists
  const findingsByPackage = useMemo(() => {
    const map = new Map<string, SecurityFinding>();
    findings.forEach((f) => {
      map.set(f.packageName.toLowerCase(), f);
    });
    return map;
  }, [findings]);

  // Compute stats
  const totalCount = packages.length;
  const directCount = packages.filter((p) => p.type === 'direct').length;
  const transitiveCount = packages.filter((p) => p.type === 'transitive').length;
  const analyzedCount = packages.filter((p) => p.analyzed).length;

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // Type / Scope filter
      if (filterType === 'direct' && pkg.type !== 'direct') return false;
      if (filterType === 'transitive' && pkg.type !== 'transitive') return false;
      if (filterType === 'analyzed' && !pkg.analyzed) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = pkg.name.toLowerCase().includes(q);
        const matchesVersion = pkg.version.toLowerCase().includes(q);
        const matchesPath = pkg.depPath.some((node) => node.toLowerCase().includes(q));
        return matchesName || matchesVersion || matchesPath;
      }
      return true;
    });
  }, [packages, filterType, searchQuery]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Title & Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Dependency Inventory & Tree Hierarchy
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Parsed from uploaded <code className="font-mono text-slate-700 font-medium">package-lock.json</code> with exact installed versions and resolution paths
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Inventory:</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700 font-bold border border-blue-200">
            {filteredPackages.length} of {totalCount} packages
          </span>
        </div>
      </div>

      {/* Scope Distinction Notice */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-blue-900">
            Investigation Scope Policy: Up to 4 Packages Prioritized per Scan
          </p>
          <p className="text-[11px] text-blue-800/80 leading-relaxed">
            Direct dependencies are prioritized first for external OSV baseline and public signal discovery. Inventoried transitive packages are tracked in the manifest tree without implying exhaustive zero-day verification.
          </p>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
        <button
          onClick={() => setFilterType('all')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === 'all'
              ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-xs'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-medium">Total Catalog</span>
          <span className="text-sm font-bold text-slate-900">{totalCount} pkgs</span>
        </button>

        <button
          onClick={() => setFilterType('direct')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === 'direct'
              ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-xs'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-medium">Direct Deps</span>
          <span className="text-sm font-bold text-blue-700">{directCount} pkgs</span>
        </button>

        <button
          onClick={() => setFilterType('transitive')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === 'transitive'
              ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-xs'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-medium">Transitive Deps</span>
          <span className="text-sm font-bold text-slate-700">{transitiveCount} pkgs</span>
        </button>

        <button
          onClick={() => setFilterType('analyzed')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === 'analyzed'
              ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-xs'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="text-[10px] uppercase text-blue-600 block font-bold">Deep Threat Scope</span>
          <span className="text-sm font-bold text-blue-700">{analyzedCount} analyzed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filter:
          </span>
          {(['all', 'direct', 'transitive', 'analyzed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterType(mode)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-all cursor-pointer ${
                filterType === mode
                  ? 'bg-blue-50 text-blue-700 border border-blue-300 font-semibold shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {mode === 'analyzed' ? 'Deep Scope Only' : mode}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search package or dependency path..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Package List / Tree Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase text-slate-500">
              <th className="py-3 pl-4">Package & Version</th>
              <th className="py-3">Type</th>
              <th className="py-3">Analysis Scope</th>
              <th className="py-3">Dependency Hierarchy Path</th>
              <th className="py-3 pr-4 text-right">Threat Correlation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPackages.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <SlidersHorizontal className="h-5 w-5 text-slate-400" />
                    <span>No dependencies match your search or filter.</span>
                    <button
                      onClick={() => {
                        setFilterType('all');
                        setSearchQuery('');
                      }}
                      className="mt-1 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset inventory filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPackages.map((pkg, idx) => {
                const associatedFinding = findingsByPackage.get(pkg.name.toLowerCase());
                return (
                  <tr
                    key={`${pkg.name}@${pkg.version}-${idx}`}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      pkg.analyzed ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {/* Package Name & Version */}
                    <td className="py-3 pl-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 font-mono">
                        {pkg.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        v{pkg.version}
                      </div>
                    </td>

                    {/* Dependency Type Badge */}
                    <td className="py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase ${
                          pkg.type === 'direct'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {pkg.type}
                      </span>
                    </td>

                    {/* Analysis Scope Indicator */}
                    <td className="py-3 whitespace-nowrap">
                      {pkg.analyzed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-mono text-blue-700 border border-blue-200 font-semibold">
                          <Sparkles className="h-3 w-3 text-blue-600" />
                          <span>Deep Scope (&le;4)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200">
                          <span>Manifest Baseline</span>
                        </span>
                      )}
                    </td>

                    {/* Shortest Dependency Hierarchy Path */}
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                        {pkg.depPath.map((node, nodeIdx) => (
                          <React.Fragment key={nodeIdx}>
                            <span
                              className={`rounded px-1.5 py-0.5 ${
                                nodeIdx === pkg.depPath.length - 1
                                  ? 'bg-slate-100 text-slate-800 font-semibold border border-slate-200'
                                  : 'text-slate-500'
                              }`}
                            >
                              {node}
                            </span>
                            {nodeIdx < pkg.depPath.length - 1 && (
                              <ArrowRight className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </td>

                    {/* Threat Correlation Action */}
                    <td className="py-3 pr-4 whitespace-nowrap text-right">
                      {associatedFinding ? (
                        <button
                          onClick={() => onSelectFinding?.(associatedFinding)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono font-medium transition-all cursor-pointer ${
                            associatedFinding.riskLevel === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : associatedFinding.riskLevel === 'HIGH'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                              : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                          }`}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          <span>{associatedFinding.riskLevel} Finding</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Clean
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Hierarchical tree depth: Direct dependencies have length 2 (<code className="text-slate-700">root &rarr; pkg</code>); transitive dependencies list ancestor resolution chains.
        </span>
        <span className="font-mono text-slate-400">{packages.length} tracked</span>
      </div>
    </div>
  );
}
