// src/utils/pure-dateUtils.ts
// Pure utility functions without any external dependencies

/** Format date as MM/DD/YYYY in a target time zone */
export function formatDateMMDDYYYYInTZ(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const mm = parts.find((p) => p.type === 'month')?.value ?? '01';
    const dd = parts.find((p) => p.type === 'day')?.value ?? '01';
    const yyyy = parts.find((p) => p.type === 'year')?.value ?? '2000';
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return '01/01/2000';
  }
}

/** Format a friendly local time for display */
export function formatLocalTime(dateStr: string | undefined, timeZone: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { 
      timeZone, 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }).format(d);
  } catch {
    return undefined;
  }
}

/** Check if drafting is still allowed (game hasn't started + 5 minutes) */
export function isDraftingAllowed(gameDate?: string, currentTime?: Date): boolean {
  if (!gameDate) return true;
  try {
    const gameStart = new Date(gameDate);
    if (isNaN(gameStart.getTime())) return true; // Invalid date, allow drafting
    
    const now = currentTime || new Date();
    const fiveMinutesAfterStart = new Date(gameStart.getTime() + 5 * 60 * 1000);
    return now < fiveMinutesAfterStart;
  } catch {
    return true;
  }
}
