/**
 * Safely format a dynamic registration close date from MongoDB
 * Returns structured formatted strings in IST, or null if date is not available.
 * 
 * @param {string|Date|null} dateVal 
 * @returns {{ badge: string, full: string, dateOnly: string, timeOnly: string, raw: Date } | null}
 */
export function formatDeadline(dateVal) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;

    const dateStr = d.toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).toUpperCase();

    const timeStr = d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return {
      badge: `${dateStr} • ${timeStr} IST`,
      full: `${dateStr} (${timeStr} IST)`,
      dateOnly: dateStr,
      timeOnly: `${timeStr} IST`,
      raw: d
    };
  } catch {
    return null;
  }
}
