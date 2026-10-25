'use client';

import React, { useState, useEffect } from 'react';
import { Search, FolderGit2, Package, FileText, X } from 'lucide-react';
import { REPLAY_CASES, ReplayCase } from '@/data/replay';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (caseId: string) => void;
  onSelectPackage?: (pkgName: string) => void;
  onSelectTime?: (seconds: number) => void;
  activeCase: ReplayCase;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectCase,
  onSelectPackage,
  onSelectTime,
  activeCase,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Close on Escape, toggle on Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build searchable commands list
  const commands: Array<{
    id: string;
    category: 'case' | 'package' | 'evidence';
    title: string;
    subtitle: string;
    action: () => void;
  }> = [];

  // 1. Cases
  REPLAY_CASES.forEach((c) => {
    commands.push({
      id: `case-${c.id}`,
      category: 'case',
      title: c.title,
      subtitle: `Replay case • as of ${c.dateStr}`,
      action: () => {
        onSelectCase(c.id);
        onClose();
      },
    });
  });

  // 2. Packages from current case
  commands.push({
    id: `pkg-${activeCase.headlinePackage}`,
    category: 'package',
    title: `${activeCase.headlinePackage}@${activeCase.headlineVersion}`,
    subtitle: `Headline target package • ${activeCase.directDependency ? 'direct' : 'transitive'}`,
    action: () => {
      onSelectPackage?.(activeCase.headlinePackage);
      onClose();
    },
  });

  // 3. Evidence timeline milestones
  activeCase.timeline.forEach((ev) => {
    commands.push({
      id: `ev-${ev.id}`,
      category: 'evidence',
      title: `${ev.timestamp} UTC - ${ev.sourceName}`,
      subtitle: ev.quote.slice(0, 70),
      action: () => {
        onSelectTime?.(ev.timeSeconds);
        onClose();
      },
    });
  });

  // Filter commands by query
  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (idx: number) => {
    if (filtered[idx]) {
      filtered[idx].action();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 motion-reduce:animate-none">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950">
          <Search className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, package, case name, or evidence timestamp..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              No matching commands or investigation items found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded cursor-pointer flex items-center justify-between text-xs transition-colors ${
                    isSelected ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.category === 'case' ? (
                      <FolderGit2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : item.category === 'package' ? (
                      <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono font-medium truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 shrink-0 ml-2">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
          <div>DepShield Incident Room</div>
        </div>
      </div>
    </div>
  );
}
