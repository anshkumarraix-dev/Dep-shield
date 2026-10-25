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
          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/60',
          label: 'PARSING',
        };
      case 'osv_check':
        return {
          icon: Database,
          color: 'text-rose-400 bg-rose-950/50 border-rose-800/60',
          label: 'OSV CHECK',
        };
      case 'search':
        return {
          icon: Search,
          color: 'text-amber-400 bg-amber-950/50 border-amber-800/60',
          label: 'SEARCH',
        };
      case 'fetch':
        return {
          icon: DownloadCloud,
          color: 'text-blue-400 bg-blue-950/50 border-blue-800/60',
          label: 'FETCH',
        };
      case 'evidence_analysis':
        return {
          icon: ShieldAlert,
          color: 'text-purple-400 bg-purple-950/50 border-purple-800/60',
          label: 'ANALYSIS',
        };
      default:
        return {
          icon: Clock,
          color: 'text-slate-400 bg-slate-900 border-slate-800',
          label: 'SYSTEM',
        };
    }
  };

  return (
    <div className="rounded-xl border border-[#3C3C42]/50 bg-[#3C3C42]/20 backdrop-blur-md p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-[#3C3C42]/50">
        <div>
          <h2 className="text-sm font-semibold text-[#EFEFF0] flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#BDBDC1]" />
            Supply Chain Activity Stream
          </h2>
          <p className="text-xs text-[#BDBDC1] mt-0.5">
            Real-time audit log of parser, OSV check, search and fetch telemetry
          </p>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono font-medium rounded-full bg-[#3C3C42]/30 px-2.5 py-0.5 text-[#BDBDC1] border border-[#3C3C42]/50">
          <Sparkles className="h-3 w-3 text-[#EFEFF0]" />
          Simulated Pipeline
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {activity.map((event, index) => {
          const badge = getActionBadge(event.actionType);
          const Icon = badge.icon;

          return (
            <div key={event.id} className="relative flex gap-3 group">
              {/* Timeline connector line */}
              {index < activity.length - 1 && (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-[#3C3C42]/50 group-hover:bg-[#3C3C42]"
                  aria-hidden="true"
                />
              )}

              {/* Action Type Icon */}
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${badge.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-[#EFEFF0]">{event.title}</span>
                  <span className="text-[11px] text-[#7D7E84] whitespace-nowrap font-mono">
                    {event.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#BDBDC1] leading-relaxed">{event.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase rounded px-1.5 py-0.2 bg-[#3C3C42]/40 text-[#BDBDC1] border border-[#3C3C42]/60">
                    {badge.label}
                  </span>
                  {event.isSimulated && (
                    <span className="text-[10px] font-mono text-[#BDBDC1] bg-[#3C3C42]/30 px-2 py-0.2 rounded border border-[#3C3C42]/50">
                      Simulated Event
                    </span>
                  )}
                  {event.targetPackage && (
                    <span className="text-[10px] font-mono text-[#BDBDC1] bg-[#010101]/80 px-2 py-0.2 rounded border border-[#3C3C42]/50">
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
