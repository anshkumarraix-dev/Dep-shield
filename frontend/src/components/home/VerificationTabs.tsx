'use client';

import React, { useState, useRef } from 'react';
import { Database, ShieldAlert, Cpu, GitBranch } from 'lucide-react';

export function VerificationTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const tabListRef = useRef<HTMLDivElement>(null);

  const scenarios = [
    {
      id: 'tab-prototype',
      name: 'Prototype Pollution Zero-Day',
      badge: 'Scenario 1 • Direct Manifest',
      icon: ShieldAlert,
      tag: 'CRITICAL RISK',
      tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      packageName: 'demo-core@1.2.0',
      leadTime: 'Synthetic demo signal: Illustrative early warning lead-time',
      summary:
        'A public pull request on example.com demonstrates unvalidated object prototype injection before formal advisory issuance.',
      telemetryTrail: [
        'Pull request on example.com disclosed proof-of-concept injection',
        'OSV database lookup: Pending formal entry (Provisional state)',
        'Heuristic scoring: Rule #PR-04 triggered (Confidence 92%)',
        'Early mitigation suggested: Pin to demo-core@1.2.1 or apply safe clone wrapper',
      ],
      citation: 'Corroborated via synthetic public discussion on example.com',
    },
    {
      id: 'tab-redos',
      name: 'Transitive ReDoS Injection',
      badge: 'Scenario 2 • Nested Graph',
      icon: GitBranch,
      tag: 'HIGH RISK',
      tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      packageName: 'demo-mime@1.0.4 (via demo-router -> demo-server)',
      leadTime: 'Synthetic demo signal: Illustrative early warning lead-time',
      summary:
        'A regular expression denial-of-service vulnerability buried two layers deep in the demo-server subdependency tree.',
      telemetryTrail: [
        'Direct manifest (demo-server@2.4.0) shows no direct security flags',
        'Transitive tree traversal discovers vulnerable child demo-mime@1.0.4',
        'Maintainer commit on example.com resolves catastrophic backtracking',
        'Early mitigation: Override transitive resolution to demo-mime >= 1.1.0',
      ],
      citation: 'Discovered during recursive lockfile graph unwinding (example.com sources)',
    },
    {
      id: 'tab-lifecycle',
      name: 'Malicious Postinstall Script',
      badge: 'Scenario 3 • Supply Chain Hook',
      icon: Cpu,
      tag: 'CRITICAL RISK',
      tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      packageName: 'demo-agent@0.7.2',
      leadTime: 'Synthetic demo signal: Illustrative early warning lead-time',
      summary:
        'Fictional package publish containing unexpected pre/postinstall curl execution downloading binary payload from foreign IP.',
      telemetryTrail: [
        'Registry metadata indicates sudden package release anomaly',
        'AST inspection flags forbidden child_process.exec in lifecycle hooks',
        'Public web signal: Developer warnings on example.com discussions',
        'DepShield warning: Immediate quarantine recommended',
      ],
      citation: 'Corroborated through synthetic registry diff on example.com',
    },
    {
      id: 'tab-clean',
      name: 'Verified Clean Verification',
      badge: 'Scenario 4 • Tri-State Integrity',
      icon: Database,
      tag: 'VERIFIED CLEAN',
      tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      packageName: 'demo-logger@3.1.0 (Direct)',
      leadTime: 'Audited & Confirmed Clean (Synthetic Demo)',
      summary:
        'A fictional package queried against OSV with zero advisories and no suspicious public discussions on example.com is accurately tagged as Clean.',
      telemetryTrail: [
        'Queried OSV database: 0 matching vulnerabilities found',
        'Registry deprecation check: Package active and maintained',
        'Public sentiment correlation: Clean commit log on example.com',
        'Tri-state output: inOsv = false (Confirmed Clean, not Provisional)',
      ],
      citation: 'Tri-state OSV Standard guarantee: Verified clean with evidence',
    },
  ];

  const current = scenarios[activeTab];

  // Keyboard arrow navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let nextIdx = activeTab;
    if (e.key === 'ArrowRight') {
      nextIdx = (activeTab + 1) % scenarios.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (activeTab - 1 + scenarios.length) % scenarios.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = scenarios.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveTab(nextIdx);
    const buttons = tabListRef.current?.querySelectorAll('button');
    if (buttons && buttons[nextIdx]) {
      buttons[nextIdx].focus();
    }
  };

  return (
    <section id="philosophy" className="space-y-8 pt-8">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#3C3C42]/60 bg-[#3C3C42]/30 px-3 py-1 text-[11px] font-mono font-medium text-[#BDBDC1]">
          <span>Synthetic demo scenarios</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#EFEFF0]">
          Real-world threat scenarios evaluated
        </h2>
        <p className="text-xs sm:text-sm text-[#BDBDC1] leading-relaxed">
          How DepShield analyzes and tags real dependency vulnerabilities before official CVE advisories are published.
        </p>
      </div>

      {/* Segmented Pill Tabs with Keyboard Navigation */}
      <div className="flex items-center justify-center overflow-x-auto pb-2">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Example Threat Scenarios"
          onKeyDown={handleKeyDown}
          className="relative inline-flex rounded-2xl border border-[#3C3C42]/50 bg-[#121214] p-1.5 gap-1.5 shadow-sm"
        >
          {scenarios.map((tab, idx) => {
            const isSelected = activeTab === idx;
            return (
              <button
                key={tab.id}
                role="tab"
                id={tab.id}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(idx)}
                className={`relative z-10 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84] ${
                  isSelected
                    ? 'bg-[#EFEFF0] text-[#010101]'
                    : 'text-[#BDBDC1] hover:text-[#EFEFF0] hover:bg-[#3C3C42]/30'
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario Detail Card */}
      <div
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={current.id}
        className="rounded-2xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 p-6 sm:p-8 md:p-10 max-w-5xl mx-auto transition-all duration-300 backdrop-blur-md"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Metadata Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`rounded border px-2.5 py-0.5 text-[11px] font-mono font-bold ${current.tagColor}`}>
                {current.tag}
              </span>
              <span className="text-[11px] font-mono text-[#7D7E84]">
                {current.badge}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold text-[#EFEFF0] tracking-tight">
                {current.packageName}
              </h3>
              <p className="text-xs font-mono text-[#EFEFF0] font-semibold">
                {current.leadTime}
              </p>
            </div>

            <p className="text-xs text-[#BDBDC1] leading-relaxed pt-1">
              {current.summary}
            </p>

            <div className="pt-2 text-[11px] font-mono text-[#7D7E84] border-t border-[#3C3C42]/40">
              {current.citation}
            </div>
          </div>

          {/* Right Telemetry Trail (7 cols) */}
          <div className="md:col-span-7 rounded-xl border border-[#3C3C42]/50 bg-[#010101]/60 p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#3C3C42]/40 pb-2">
              <span className="text-[#BDBDC1] text-[11px] uppercase tracking-wider font-semibold">
                Corroborated Signal Trail
              </span>
              <span className="text-[10px] text-[#EFEFF0] bg-[#3C3C42]/30 border border-[#3C3C42]/60 px-2 py-0.5 rounded">
                Synthetic Demo
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {current.telemetryTrail.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[#BDBDC1]">
                  <span className="text-[#7D7E84] font-bold shrink-0">&gt;</span>
                  <span className="leading-relaxed text-[11px]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
