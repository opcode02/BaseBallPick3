// src/utils/__tests__/scoringUtils.test.ts

import { applyBoost, calculateBasePoints, PTS, ScoreBreakdown } from '../scoringUtils';

describe('Pure Scoring Utils', () => {
  describe('applyBoost', () => {
    test('applies boost to positive scores', () => {
      expect(applyBoost(100, 1.5)).toBe(150);
      expect(applyBoost(100, 0.5)).toBe(50);
      expect(applyBoost(100, 2.0)).toBe(200);
    });

    test('does not apply boost to negative scores', () => {
      expect(applyBoost(-50, 1.5)).toBe(-50);
      expect(applyBoost(-10, 2.0)).toBe(-10);
      expect(applyBoost(-100, 0.5)).toBe(-100);
    });

    test('handles zero scores', () => {
      expect(applyBoost(0, 1.5)).toBe(0);
      expect(applyBoost(0, 2.0)).toBe(0);
    });

    test('rounds to nearest integer', () => {
      expect(applyBoost(33, 1.5)).toBe(50);
      expect(applyBoost(67, 1.5)).toBe(101);
    });
  });

  describe('calculateBasePoints', () => {
    test('calculates points for basic stats', () => {
      const breakdown: ScoreBreakdown = {
        singles: 2,
        doubles: 1,
        triples: 0,
        hr_solo: 1,
        hr_2r: 0,
        hr_3r: 0,
        hr_gs: 0,
        walks: 1,
        hbp: 0,
        rbi_non_hr: 2,
        runs_non_hr: 1,
        strikeouts: 1,
        gidp: 0,
        fielders_choice: 1,
      };

      const expected = 
        2 * PTS.SINGLE +     // 20
        1 * PTS.DOUBLE +     // 20
        1 * PTS.HR_SOLO +    // 40
        1 * PTS.WALK +       // 5
        2 * PTS.RBI_NON_HR + // 30
        1 * PTS.RUN_NON_HR + // 15
        1 * PTS.K +          // -5
        1 * PTS.FC;          // 2

      expect(calculateBasePoints(breakdown)).toBe(expected);
    });

    test('calculates points for different HR types', () => {
      const breakdown: ScoreBreakdown = {
        singles: 0,
        doubles: 0,
        triples: 0,
        hr_solo: 1,
        hr_2r: 1,
        hr_3r: 1,
        hr_gs: 1,
        walks: 0,
        hbp: 0,
        rbi_non_hr: 0,
        runs_non_hr: 0,
        strikeouts: 0,
        gidp: 0,
        fielders_choice: 0,
      };

      const expected = PTS.HR_SOLO + PTS.HR_2R + PTS.HR_3R + PTS.HR_GS;
      expect(calculateBasePoints(breakdown)).toBe(expected);
    });

    test('handles negative events', () => {
      const breakdown: ScoreBreakdown = {
        singles: 0,
        doubles: 0,
        triples: 0,
        hr_solo: 0,
        hr_2r: 0,
        hr_3r: 0,
        hr_gs: 0,
        walks: 0,
        hbp: 0,
        rbi_non_hr: 0,
        runs_non_hr: 0,
        strikeouts: 3,
        gidp: 2,
        fielders_choice: 0,
      };

      const expected = 3 * PTS.K + 2 * PTS.GIDP; // -15 + -20 = -35
      expect(calculateBasePoints(breakdown)).toBe(expected);
    });

    test('handles empty breakdown', () => {
      const breakdown: ScoreBreakdown = {
        singles: 0,
        doubles: 0,
        triples: 0,
        hr_solo: 0,
        hr_2r: 0,
        hr_3r: 0,
        hr_gs: 0,
        walks: 0,
        hbp: 0,
        rbi_non_hr: 0,
        runs_non_hr: 0,
        strikeouts: 0,
        gidp: 0,
        fielders_choice: 0,
      };

      expect(calculateBasePoints(breakdown)).toBe(0);
    });
  });
});
