'use client';

import React, { useState } from 'react';
import { ParsedDependency } from '@/types';
import { Layers, Terminal } from 'lucide-react';

interface BlastRadiusGraphProps {
  packages: ParsedDependency[];
  projectName?: string;
  selectedPackage?: string;
  headlinePackage?: string;
  onSelectPackage?: (pkgName: string) => void;
}

interface GraphNode {
  id: string;
  name: string;
  version: string;
  type: 'root' | 'direct' | 'transitive';
  depth: number;
  depPath: string[];
  hasInstallScript: boolean;
  analyzed: boolean;
  isCompromised: boolean;
  x: number;
  y: number;
}

interface GraphEdge {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function BlastRadiusGraph({
  packages,
  projectName = 'root-project',
  selectedPackage,
  headlinePackage,
  onSelectPackage,
}: BlastRadiusGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Group packages by depth based on depPath length
  // Root = depth 0
  // Direct = depth 1
  // Transitive = depth 2+
  const width = 840;
  const height = 360;

  const directDeps = packages.filter((p) => p.direct);
  const transitiveDeps = packages.filter((p) => !p.direct);

  // Layout columns:
  // Col 0: Root (x: 80)
  // Col 1: Direct (x: 340)
  // Col 2: Transitive (x: 640)
  const rootNode: GraphNode = {
    id: 'root-node',
    name: projectName,
    version: '1.0.0',
    type: 'root',
    depth: 0,
    depPath: [projectName],
    hasInstallScript: false,
    analyzed: false,
    isCompromised: false,
    x: 90,
    y: height / 2,
  };

  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];

  // Position direct dependencies vertically
  const maxDirect = Math.min(6, directDeps.length);
  const directSpacing = maxDirect > 1 ? (height - 80) / (maxDirect - 1) : 0;
  const directStartY = maxDirect > 1 ? 50 : height / 2;

  directDeps.slice(0, maxDirect).forEach((p, idx) => {
    const y = maxDirect === 1 ? height / 2 : directStartY + idx * directSpacing;
    const isComp = headlinePackage ? p.name.includes(headlinePackage) : p.analyzed;
    const node: GraphNode = {
      id: `dir-${p.name}-${idx}`,
      name: p.name,
      version: p.version,
      type: 'direct',
      depth: 1,
      depPath: p.depPath,
      hasInstallScript: Boolean(p.hasInstallScript),
      analyzed: p.analyzed,
      isCompromised: isComp,
      x: 340,
      y,
    };
    nodes.push(node);
    edges.push({
      fromId: rootNode.id,
      toId: node.id,
      x1: rootNode.x,
      y1: rootNode.y,
      x2: node.x,
      y2: node.y,
    });
  });

  // Position transitive dependencies
  const maxTransitive = Math.min(8, transitiveDeps.length);
  const transSpacing = maxTransitive > 1 ? (height - 60) / (maxTransitive - 1) : 0;
  const transStartY = maxTransitive > 1 ? 40 : height / 2;

  transitiveDeps.slice(0, maxTransitive).forEach((p, idx) => {
    const y = maxTransitive === 1 ? height / 2 : transStartY + idx * transSpacing;
    const isComp =
      (headlinePackage && p.name.includes(headlinePackage)) ||
      Boolean(p.hasInstallScript && p.analyzed);

    const node: GraphNode = {
      id: `trans-${p.name}-${idx}`,
      name: p.name,
      version: p.version,
      type: 'transitive',
      depth: 2,
      depPath: p.depPath,
      hasInstallScript: Boolean(p.hasInstallScript),
      analyzed: p.analyzed,
      isCompromised: isComp,
      x: 640,
      y,
    };
    nodes.push(node);

    // Find parent in direct dependencies if path mentions it
    const parentDirect = nodes.find(
      (n) => n.type === 'direct' && p.depPath.some((seg: string) => seg.includes(n.name))
    );
    const parentNode = parentDirect || nodes.find((n) => n.type === 'direct') || rootNode;

    edges.push({
      fromId: parentNode.id,
      toId: node.id,
      x1: parentNode.x,
      y1: parentNode.y,
      x2: node.x,
      y2: node.y,
    });
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-4">
      {/* Header and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            BLAST-RADIUS DEPENDENCY GRAPH (PARSED LOCKFILE)
          </span>
          <span className="text-[10px] font-mono bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
            {packages.length} packages total
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>
            <span>Compromised / High Signal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900"></span>
            <span>Install Hook</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
            <span>Standard Baseline</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto bg-slate-950 border border-slate-800/80 rounded p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[700px] select-none"
        >
          <defs>
            <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* Depth column column indicator lines & labels */}
          <line x1="90" y1="20" x2="90" y2={height - 20} stroke="#1e293b" strokeDasharray="4 4" />
          <line x1="340" y1="20" x2="340" y2={height - 20} stroke="#1e293b" strokeDasharray="4 4" />
          <line x1="640" y1="20" x2="640" y2={height - 20} stroke="#1e293b" strokeDasharray="4 4" />

          <text x="90" y="24" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">
            ROOT
          </text>
          <text x="340" y="24" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">
            DIRECT DEPENDENCIES
          </text>
          <text x="640" y="24" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">
            TRANSITIVE DEPENDENCIES
          </text>

          {/* Render connecting edges */}
          {edges.map((e, idx) => (
            <path
              key={`edge-${idx}`}
              d={`M ${e.x1} ${e.y1} C ${(e.x1 + e.x2) / 2} ${e.y1}, ${(e.x1 + e.x2) / 2} ${e.y2}, ${e.x2} ${e.y2}`}
              fill="none"
              stroke="url(#edge-grad)"
              strokeWidth="1.5"
            />
          ))}

          {/* Render nodes */}
          {nodes.map((n) => {
            const isSelected = selectedPackage === n.name;
            const isHovered = hoveredNode?.id === n.id;

            let fillColor = '#1e293b';
            let strokeColor = '#475569';
            let textColor = '#e2e8f0';

            if (n.type === 'root') {
              fillColor = '#0f172a';
              strokeColor = '#38bdf8';
              textColor = '#38bdf8';
            } else if (n.isCompromised) {
              fillColor = '#881337';
              strokeColor = '#f43f5e';
              textColor = '#ffe4e6';
            } else if (n.analyzed) {
              fillColor = '#451a03';
              strokeColor = '#f59e0b';
              textColor = '#fef3c7';
            }

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => onSelectPackage?.(n.name)}
                onMouseEnter={() => setHoveredNode(n)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-transform"
              >
                {/* Node Box */}
                <rect
                  x="-90"
                  y="-18"
                  width="180"
                  height="36"
                  rx="4"
                  fill={fillColor}
                  stroke={isSelected || isHovered ? '#f59e0b' : strokeColor}
                  strokeWidth={isSelected || isHovered ? '2' : '1'}
                  className="transition-colors"
                />

                {/* Package Name Text */}
                <text
                  x="-75"
                  y="4"
                  fill={textColor}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                  className="pointer-events-none"
                >
                  {n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name}
                </text>

                {/* Install Script Indicator Badge (X-Ray) */}
                {n.hasInstallScript && (
                  <g transform="translate(62, -10)">
                    <rect x="-8" y="-4" width="28" height="14" rx="2" fill="#78350f" stroke="#f59e0b" strokeWidth="0.8" />
                    <text x="6" y="6" fill="#fef3c7" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                      HOOK
                    </text>
                  </g>
                )}

                {/* Version badge */}
                <text
                  x="-75"
                  y="14"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                  className="pointer-events-none"
                >
                  v{n.version}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Inspector Bar for Focused/Hovered Node */}
      <div className="mt-2.5 p-2 bg-slate-950 border border-slate-800 rounded font-mono text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Node Inspector:</span>
          {hoveredNode ? (
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-semibold">{hoveredNode.name}@{hoveredNode.version}</span>
              <span className="text-slate-500 text-[11px]">(depth {hoveredNode.depth})</span>
              {hoveredNode.hasInstallScript && (
                <span className="text-amber-400 bg-amber-950/70 border border-amber-600/60 px-1.5 py-0.2 rounded text-[10px] flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Runs code at install time
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 italic">Hover a node to inspect dependency path and hooks</span>
          )}
        </div>

        {hoveredNode && (
          <div className="text-[11px] text-slate-400 truncate max-w-md">
            Path: <span className="text-slate-300">{hoveredNode.depPath.join(' → ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
