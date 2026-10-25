/**
 * Time and Lead-Time calculation utilities for DepShield Incident Room
 */

/**
 * Parses time from an ISO string or a HH:mm:ss timestamp into seconds from start of day (or epoch).
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    return Math.floor(date.getTime() / 1000);
  }
  
  // Format: "HH:mm:ss"
  const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }

  return 0;
}

/**
 * Computes lead time between an early public signal and registry publication.
 * Returns both seconds and compact format like "32m23s".
 */
export function computeLeadTime(
  earlierTime: string,
  laterTime: string
): { totalSeconds: number; formatted: string } {
  const t1 = parseTimeToSeconds(earlierTime);
  const t2 = parseTimeToSeconds(laterTime);

  const diff = Math.max(0, t2 - t1);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}h${minutes}m${seconds}s`;
  } else {
    formatted = `${minutes}m${seconds}s`;
  }

  return {
    totalSeconds: diff,
    formatted,
  };
}

/**
 * Formats a UTC ISO timestamp into clean tabular monospace "HH:mm:ss UTC".
 */
export function formatUtcTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      // Fallback if already time string
      return isoString;
    }
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss} UTC`;
  } catch {
    return isoString;
  }
}

/**
 * Formats full UTC date and time: "YYYY-MM-DD HH:mm:ss UTC"
 */
export function formatFullUtcDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const yyyy = d.getUTCFullYear();
    const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss} UTC`;
  } catch {
    return isoString;
  }
}
