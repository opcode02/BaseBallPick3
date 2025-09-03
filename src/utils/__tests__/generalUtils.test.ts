// src/utils/__tests__/generalUtils.test.ts

import { initials, normalizeBoostersToHundred, validateBoostersComplete } from '../generalUtils';

describe('Pure General Utils', () => {
  describe('initials', () => {
    test('returns initials for two-word names', () => {
      expect(initials('John Doe')).toBe('JD');
      expect(initials('Jane Smith')).toBe('JS');
    });

    test('returns single initial for one-word names', () => {
      expect(initials('Madonna')).toBe('M');
      expect(initials('Cher')).toBe('C');
    });

    test('handles multiple spaces between words', () => {
      expect(initials('John   Doe')).toBe('JD');
      expect(initials('Mary  Jane  Watson')).toBe('MJ');
    });

    test('handles empty or undefined names', () => {
      expect(initials('')).toBe('?');
      expect(initials(undefined)).toBe('?');
      expect(initials('   ')).toBe('?');
    });

    test('converts to uppercase', () => {
      expect(initials('john doe')).toBe('JD');
      expect(initials('jane smith')).toBe('JS');
    });
  });

  describe('normalizeBoostersToHundred', () => {
    test('normalizes boosters for 3 picks to sum to 100', () => {
      const pickedIds = [1, 2, 3];
      const currentBoosters = { 1: 30, 2: 30, 3: 40 };
      
      const result = normalizeBoostersToHundred(1, 50, pickedIds, currentBoosters);
      
      expect(result[1]).toBe(50);
      expect(result[2] + result[3]).toBe(50);
      expect(result[1] + result[2] + result[3]).toBe(100);
    });

    test('preserves ratio of other picks when possible', () => {
      const pickedIds = [1, 2, 3];
      const currentBoosters = { 1: 20, 2: 40, 3: 40 };
      
      const result = normalizeBoostersToHundred(1, 60, pickedIds, currentBoosters);
      
      expect(result[1]).toBe(60);
      expect(result[2]).toBe(20);
      expect(result[3]).toBe(20);
      expect(result[1] + result[2] + result[3]).toBe(100);
    });

    test('splits evenly when other picks have zero values', () => {
      const pickedIds = [1, 2, 3];
      const currentBoosters = { 1: 0, 2: 0, 3: 0 };
      
      const result = normalizeBoostersToHundred(1, 40, pickedIds, currentBoosters);
      
      expect(result[1]).toBe(40);
      expect(result[2]).toBe(30);
      expect(result[3]).toBe(30);
      expect(result[1] + result[2] + result[3]).toBe(100);
    });

    test('clamps target value to 0-100 range', () => {
      const pickedIds = [1, 2, 3];
      const currentBoosters = { 1: 33, 2: 33, 3: 34 };
      
      const resultHigh = normalizeBoostersToHundred(1, 150, pickedIds, currentBoosters);
      expect(resultHigh[1]).toBe(100);
      expect(resultHigh[2]).toBe(0);
      expect(resultHigh[3]).toBe(0);
      
      const resultLow = normalizeBoostersToHundred(1, -50, pickedIds, currentBoosters);
      expect(resultLow[1]).toBe(0);
      expect(resultLow[2] + resultLow[3]).toBe(100);
    });

    test('returns current boosters if not exactly 3 picks', () => {
      const currentBoosters = { 1: 50, 2: 50 };
      
      const result2Picks = normalizeBoostersToHundred(1, 75, [1, 2], currentBoosters);
      expect(result2Picks).toEqual(currentBoosters);
      
      const result4Picks = normalizeBoostersToHundred(1, 75, [1, 2, 3, 4], currentBoosters);
      expect(result4Picks).toEqual(currentBoosters);
    });
  });

  describe('validateBoostersComplete', () => {
    test('returns true for valid complete boosters', () => {
      const pickedIds = [1, 2, 3];
      const boosters = { 1: 33, 2: 33, 3: 34 };
      
      expect(validateBoostersComplete(pickedIds, boosters)).toBe(true);
    });

    test('returns false when not exactly 3 picks', () => {
      const boosters = { 1: 50, 2: 50 };
      
      expect(validateBoostersComplete([1, 2], boosters)).toBe(false);
      expect(validateBoostersComplete([1, 2, 3, 4], boosters)).toBe(false);
    });

    test('returns false when boosters do not sum to 100', () => {
      const pickedIds = [1, 2, 3];
      
      const boosters99 = { 1: 33, 2: 33, 3: 33 };
      expect(validateBoostersComplete(pickedIds, boosters99)).toBe(false);
      
      const boosters101 = { 1: 34, 2: 34, 3: 33 };
      expect(validateBoostersComplete(pickedIds, boosters101)).toBe(false);
    });

    test('returns false when any booster is not finite', () => {
      const pickedIds = [1, 2, 3];
      
      const boostersWithNaN = { 1: NaN, 2: 50, 3: 50 };
      expect(validateBoostersComplete(pickedIds, boostersWithNaN)).toBe(false);
    });
  });
});
