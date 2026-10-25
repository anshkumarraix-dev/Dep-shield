'use client';

import React from 'react';
import { Copy, Check, ShieldAlert } from 'lucide-react';
import { IocItem } from '@/data/replay';

interface IocStripProps {
  iocs: IocItem[];
  caseTitle: string;
}

export function IocStrip({ iocs, caseTitle }: IocStripProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (!iocs || iocs.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded p-3 text-xs text-slate-400 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>No malicious network or file IOCs recorded for this verified clean baseline.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded p-3">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
            Defanged Threat Indicators (IOCs) {caseTitle ? `// ${caseTitle}` : ''}
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {iocs.length} records
          </span>
        </div>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Non-clickable • Defanged for security
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {iocs.map((ioc) => {
          const isCopied = copiedId === ioc.id;
          return (
            <div
              key={ioc.id}
              className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  {ioc.type.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(ioc.id, ioc.defanged)}
                  title="Copy defanged indicator"
                  className="text-slate-500 hover:text-slate-200 p-0.5 transition-colors"
                  aria-label={`Copy indicator ${ioc.defanged}`}
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Defanged indicator is plain text, never an <a> link */}
              <div className="font-mono text-xs font-semibold text-amber-300 select-all tracking-tight break-all">
                {ioc.defanged}
              </div>

              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {ioc.notes}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
