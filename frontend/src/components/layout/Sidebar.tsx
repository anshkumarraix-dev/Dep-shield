'use client';

import React from 'react';
import {
  Shield,
  LayoutDashboard,
  AlertTriangle,
  Layers,
  History,
  Settings,
  Radio,
  FileCode2,
  X,
} from 'lucide-react';
import { envConfig } from '@/config/env';

interface SidebarProps {
  findingsCount?: number;
  activeSection?: string;
  onNavigate?: (section: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  findingsCount = 6,
  activeSection = 'dashboard',
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', name: 'Security Overview', icon: LayoutDashboard },
    { id: 'upload', name: 'Lockfile Ingestion', icon: FileCode2 },
    { id: 'findings', name: 'Threat Findings', icon: AlertTriangle, badge: findingsCount > 0 ? String(findingsCount) : undefined, badgeType: 'count' as const },
    { id: 'dependencies', name: 'Dependency Inventory', icon: Layers, badge: 'Tree View', badgeType: 'roadmap' as const },
    { id: 'activity', name: 'Audit & Telemetry', icon: History },
  ];


  const handleItemClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 shadow-2xl">
      {/* Brand & Logo */}
      <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Shield className="h-5 w-5 text-slate-950 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">DepShield</span>
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                v0.2
              </span>
            </div>
            <p className="text-xs text-slate-400">Early-Warning Intelligence</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-900"
            aria-label="Close sidebar navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="mt-6 flex-1 space-y-1" aria-label="Sidebar Navigation">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </p>
        <div className="mt-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleItemClick(e, item.id)}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      item.badgeType === 'roadmap'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 font-mono font-medium'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Backend Integration status card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-400">Backend Mode</span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
            <Radio className="h-3 w-3 animate-pulse" />
            {envConfig.useMocks ? 'Offline Mock' : 'FastAPI Connected'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Standalone supply chain analyzer ready for Ansh&apos;s backend integration.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64">
        {content}
      </aside>

      {/* Mobile Drawer (with backdrop) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 animate-in slide-in-from-left">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
