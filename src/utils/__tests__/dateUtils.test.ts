// src/utils/__tests__/dateUtils.test.ts

import { formatDateMMDDYYYYInTZ, formatLocalTime, isDraftingAllowed } from '../dateUtils';

describe('Pure Date Utils', () => {
  describe('formatDateMMDDYYYYInTZ', () => {
    test('formats date correctly for Chicago timezone', () => {
      const date = new Date('2025-08-31T15:30:00Z');
      const result = formatDateMMDDYYYYInTZ(date, 'America/Chicago');
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    test('handles invalid timezone gracefully', () => {
      const date = new Date('2025-08-31T15:30:00Z');
      const result = formatDateMMDDYYYYInTZ(date, 'Invalid/Timezone');
      expect(result).toBe('01/01/2000');
    });
  });

  describe('formatLocalTime', () => {
    test('formats time correctly', () => {
      const dateStr = '2025-08-31T19:30:00Z';
      const result = formatLocalTime(dateStr, 'America/Chicago');
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    test('returns undefined for undefined input', () => {
      const result = formatLocalTime(undefined, 'America/Chicago');
      expect(result).toBeUndefined();
    });

    test('returns undefined for invalid date string', () => {
      const result = formatLocalTime('invalid-date', 'America/Chicago');
      expect(result).toBeUndefined();
    });
  });

  describe('isDraftingAllowed', () => {
    const mockCurrentTime = new Date('2025-08-31T20:00:00Z');

    test('returns true when no game date provided', () => {
      expect(isDraftingAllowed()).toBe(true);
      expect(isDraftingAllowed(undefined)).toBe(true);
    });

    test('returns true when game has not started yet', () => {
      const gameDate = '2025-08-31T20:30:00Z';
      expect(isDraftingAllowed(gameDate, mockCurrentTime)).toBe(true);
    });

    test('returns true when game started less than 5 minutes ago', () => {
      const gameDate = '2025-08-31T19:58:00Z';
      expect(isDraftingAllowed(gameDate, mockCurrentTime)).toBe(true);
    });

    test('returns false when game started more than 5 minutes ago', () => {
      const gameDate = '2025-08-31T19:50:00Z';
      expect(isDraftingAllowed(gameDate, mockCurrentTime)).toBe(false);
    });

    test('returns true for invalid date string', () => {
      expect(isDraftingAllowed('invalid-date', mockCurrentTime)).toBe(true);
    });
  });
});
