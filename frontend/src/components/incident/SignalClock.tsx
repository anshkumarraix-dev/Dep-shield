'use client';

import { ReplayCase } from '@/data/replay';
import { Clock, SkipBack, SkipForward, Info } from 'lucide-react';

interface SignalClockProps {
  replayCase: ReplayCase;
  currentTimeSeconds: number;
  onTimeChange: (newTimeSeconds: number) => void;
  selectedEvidenceId?: string;
  onSelectEvidence?: (id: string) => void;
}

export function SignalClock({
  replayCase,
  currentTimeSeconds,
  onTimeChange,
  selectedEvidenceId,
  onSelectEvidence,
}: SignalClockProps) {
  const { timeline, leadTime, reconstructedDisclaimer } = replayCase;

  // Determine min and max timeSeconds from the timeline
  const times = timeline.map((e) => e.timeSeconds);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(1, maxTime - minTime);

  // Group events by lane
  const laneAEvents = timeline.filter((e) => e.lane === 'public_signals');
  const laneBEvents = timeline.filter((e) => e.lane === 'registry_reality');

  // Format seconds to HH:mm:ss UTC string
  const formatSecondsToUtc = (secs: number) => {
    // If secs is epoch timestamp
    if (secs > 1000000) {
      const d = new Date(secs * 1000);
      return d.toUTCString().slice(17, 25);
    }
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getPercent = (secs: number) => {
    return Math.min(100, Math.max(0, ((secs - minTime) / timeSpan) * 100));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTimeChange(Number(e.target.value));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-4">
      {/* Top Bar: Lead Time metric & Reconstructed Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{'SIGNAL CLOCK ("AS OF" TIME SCRUBBER)'}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded font-mono text-xs">
            <span className="text-slate-500 mr-1.5">AS OF:</span>
            <span className="text-amber-400 font-bold tabular-nums">
              {formatSecondsToUtc(currentTimeSeconds)} UTC
            </span>
          </div>
        </div>

        {/* Computed Lead Time Badge */}
        <div className="flex items-center gap-2">
          <div className="bg-amber-950/40 border border-amber-600/50 px-2.5 py-1 rounded text-xs flex items-center gap-1.5 font-mono">
            <span className="text-amber-300 font-semibold">Lead Time:</span>
            <span className="text-amber-400 font-bold tracking-wide">{leadTime.computedDisplay}</span>
            <span className="text-[10px] text-amber-500/80">(pre-pub warning to npm release)</span>
          </div>
        </div>
      </div>

      {/* Reconstructed disclaimer notice */}
      <div className="mb-3 text-[11px] text-slate-400 bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-500/80 shrink-0 mt-0.5" />
        <div>
          <span>{reconstructedDisclaimer}</span>
        </div>
      </div>

      {/* Two-Lane Timeline Area */}
      <div className="relative pt-2 pb-4">
        {/* Lane A: Public Web Signals */}
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>Lane A: Public Web Signals (Commits, Comments, Advisories, Blogs)</span>
            <span className="text-[10px] text-slate-500">
              {laneAEvents.filter((e) => e.timeSeconds <= currentTimeSeconds).length} / {laneAEvents.length} visible
            </span>
          </div>
          <div className="relative h-11 bg-slate-950 border border-slate-800 rounded overflow-hidden">
            {laneAEvents.map((ev) => {
              const pct = getPercent(ev.timeSeconds);
              const isPast = ev.timeSeconds <= currentTimeSeconds;
              const isSelected = selectedEvidenceId === ev.id;

              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectEvidence?.(ev.id)}
                  style={{ left: `${pct}%` }}
                  title={`${ev.timestamp} UTC - ${ev.sourceName}: ${ev.category}`}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group transition-transform ${
                    isPast ? 'opacity-100 scale-100' : 'opacity-30 scale-90'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[9px] font-bold border transition-all ${
                      isSelected
                        ? 'bg-amber-400 border-white text-slate-950 ring-2 ring-amber-400'
                        : isPast
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-slate-950'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    {ev.category === 'commit'
                      ? 'C'
                      : ev.category === 'comment'
                      ? 'W'
                      : ev.category === 'advisory'
                      ? 'A'
                      : 'B'}
                  </div>
                  <span className="font-mono text-[8px] text-slate-400 tabular-nums mt-0.5 group-hover:text-amber-300">
                    {ev.timestamp.slice(-8, -3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lane B: Registry Reality */}
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>Lane B: Registry Reality (npm Release, Registry Mirror Events)</span>
            <span className="text-[10px] text-slate-500">
              {laneBEvents.filter((e) => e.timeSeconds <= currentTimeSeconds).length} / {laneBEvents.length} visible
            </span>
          </div>
          <div className="relative h-11 bg-slate-950 border border-slate-800 rounded overflow-hidden">
            {laneBEvents.map((ev) => {
              const pct = getPercent(ev.timeSeconds);
              const isPast = ev.timeSeconds <= currentTimeSeconds;
              const isSelected = selectedEvidenceId === ev.id;

              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectEvidence?.(ev.id)}
                  style={{ left: `${pct}%` }}
                  title={`${ev.timestamp} UTC - ${ev.packageTargeted}@${ev.versionTargeted} published`}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group transition-transform ${
                    isPast ? 'opacity-100 scale-100' : 'opacity-30 scale-90'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[9px] font-bold border transition-all ${
                      isSelected
                        ? 'bg-rose-500 border-white text-white ring-2 ring-rose-500'
                        : isPast
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 hover:bg-rose-500 hover:text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    R
                  </div>
                  <span className="font-mono text-[8px] text-slate-400 tabular-nums mt-0.5 group-hover:text-rose-300">
                    {ev.timestamp.slice(-8, -3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Draggable Scrubber Slider */}
        <div className="relative pt-2">
          <input
            type="range"
            min={minTime}
            max={maxTime}
            value={currentTimeSeconds}
            onChange={handleSliderChange}
            aria-label="Time scrubber for evidence replay"
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1 tabular-nums">
            <span>{formatSecondsToUtc(minTime)} UTC (Start)</span>
            <span className="text-amber-400 font-semibold">
              Current Scrubber: {formatSecondsToUtc(currentTimeSeconds)} UTC
            </span>
            <span>{formatSecondsToUtc(maxTime)} UTC (Full Case)</span>
          </div>
        </div>
      </div>

      {/* Preset step buttons for judge replay */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Replay Quick Jumps:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTimeChange(minTime)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
          >
            <SkipBack className="w-3 h-3" /> Start
          </button>

          {timeline.slice(0, 4).map((ev, i) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onTimeChange(ev.timeSeconds)}
              className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono text-[11px] text-slate-300 transition-colors"
            >
              Step {i + 1} ({ev.timestamp.slice(-8, -3)})
            </button>
          ))}

          <button
            type="button"
            onClick={() => onTimeChange(maxTime)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
          >
            End <SkipForward className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
