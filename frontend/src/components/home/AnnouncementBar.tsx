'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'depshield_announcement_dismissed';

function subscribeStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function getDismissedSnapshot(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot(): boolean {
  return true; // Match server render (hidden initially to prevent hydration mismatch)
}

export function AnnouncementBar() {
  const [localDismissed, setLocalDismissed] = useState(false);
  const isDismissedFromStorage = useSyncExternalStore(
    subscribeStorage,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );

  const handleDismiss = () => {
    setLocalDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  if (isDismissedFromStorage || localDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Announcement"
      className="relative z-50 flex h-9 w-full items-center justify-between border-b border-[#3C3C42]/50 bg-[#121214] px-4 text-xs font-medium text-[#BDBDC1] transition-opacity duration-200"
    >
      <div className="flex-1 text-center">
        <a
          href="#demo"
          className="group inline-flex items-center gap-2 hover:text-[#EFEFF0] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84] rounded px-1"
        >
          <span className="flex items-center gap-1.5 font-semibold text-[#EFEFF0] rounded-full bg-[#3C3C42]/30 border border-[#3C3C42]/60 px-2 py-0.5 text-[11px]">
            <Sparkles className="h-3 w-3 text-[#EFEFF0]" />
            DepShield v0.2
          </span>
          <span className="hidden sm:inline text-[#BDBDC1] group-hover:text-[#EFEFF0] transition-colors">
            Automated early-warning intelligence for npm dependencies &bull; Explore interactive threat telemetry
          </span>
          <span className="sm:hidden text-[#BDBDC1]">
            Explore live threat telemetry
          </span>
          <ArrowRight className="h-3 w-3 text-[#7D7E84] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#EFEFF0]" />
        </a>
      </div>

      <button
        onClick={handleDismiss}
        type="button"
        aria-label="Dismiss announcement banner"
        className="ml-2 rounded p-1 text-[#7D7E84] hover:bg-[#3C3C42]/40 hover:text-[#EFEFF0] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7D7E84]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
