'use client';

import React from 'react';
import { ActivityEvent, ActivityActionType } from '@/types';
import {
  FileSearch,
  Database,
  Search,
  DownloadCloud,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ActivityFeedPreviewProps {
  activity: ActivityEvent[];
}

export function ActivityFeedPreview({ activity }: ActivityFeedPreviewProps) {
  const getActionBadge = (type: ActivityActionType) => {
    switch (type) {
      case 'parsing':
        return {
          icon: FileSearch,
          color: 'text-sky-700 bg-sky-50 border-sky-200',
          label: 'PARSING',
        };
      case 'osv_check':
        return {
          icon: Database,
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          label: 'OSV CHECK',
        };
      case 'search':
        return {
          icon: Search,
          color: 'text-amber-800 bg-amber-50 border-amber-200',
          label: 'SEARCH',
        };
      case 'fetch':
        return {
          icon: DownloadCloud,
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          label: 'FETCH',
        };
      case 'evidence_analysis':
        return {
          icon: ShieldAlert,
          color: 'text-purple-700 bg-purple-50 border-purple-200',
          label: 'EVIDENCE',
        };
      case 'scoring':
        return {
          icon: ShieldAlert,
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          label: 'SCORING',
        };
      case 'findings':
        return {
          icon: ShieldAlert,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          label: 'FINDINGS',
        };
      default:
        return {
          icon: Clock,
          color: 'text-slate-600 bg-slate-100 border-slate-200',
          label: 'SYSTEM',
        };
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Supply Chain Activity Stream
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audit log of parser, OSV check, search and fetch telemetry
          </p>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono font-medium rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700 border border-blue-200">
          <Sparkles className="h-3 w-3 text-blue-600" />
          Simulated Pipeline
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {activity.map((event, index) => {
          const badge = getActionBadge(event.actionType);
          const Icon = badge.icon;

          return (
            <div key={event.id} className="relative flex gap-3.5 group">
              {/* Timeline connector line */}
              {index < activity.length - 1 && (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 group-hover:bg-slate-300 transition-colors"
                  aria-hidden="true"
                />
              )}

              {/* Action Type Icon */}
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border ${badge.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">{event.title}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                    {event.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{event.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase rounded px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                    {badge.label}
                  </span>
                  {event.isSimulated && (
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Simulated Event
                    </span>
                  )}
                  {event.targetPackage && (
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {event.targetPackage}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
