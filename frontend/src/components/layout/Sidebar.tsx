'use client';

import React from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  AlertTriangle,
  Layers,
  Activity,
  FileCode2,
  X,
  ExternalLink,
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
  findingsCount = 0,
  activeSection = 'dashboard',
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
    { id: 'upload', name: 'Upload & Replay', icon: FileCode2 },
    {
      id: 'findings',
      name: 'Threat Findings',
      icon: AlertTriangle,
      badge: findingsCount > 0 ? String(findingsCount) : undefined,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      id: 'dependencies',
      name: 'Dependency Tree',
      icon: Layers,
    },
    { id: 'activity', name: 'Live Intel Stream', icon: Activity },
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
    <div className="flex h-full w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-5 shadow-xs">
      {/* Brand & Logo */}
      <div className="flex items-center justify-between px-2 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 font-sans">
                DepShield
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-700 border border-blue-200/80 font-medium">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Threat Intelligence</p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close sidebar navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="mt-6 flex-1 space-y-1" aria-label="Sidebar Navigation">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Security Console
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
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      item.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'
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

      {/* Footer Info Card */}
      <div className="mt-auto border-t border-slate-100 pt-4 px-2">
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
            <span>Durable Ledger</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            Deterministic evaluation with quote substring validation.
          </p>
          <a
            href="https://github.com/anshkumarraix-dev/Dep-shield"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col z-40">
        {content}
      </aside>

      {/* Mobile Sidebar (Drawer Overlay) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 flex w-64 max-w-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
