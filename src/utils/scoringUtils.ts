// src/utils/pure-scoringUtils.ts
// Pure scoring utilities without external dependencies

export type OutcomeCode = 'OUT' | '1B' | '2B' | '3B' | 'HR' | 'BB' | 'HBP' | 'K' | 'GIDP' | 'FC' | 'RBI' | 'R';

export interface ScoreBreakdown {
  singles: number;
  doubles: number;
  triples: number;
  hr_solo: number;
  hr_2r: number;
  hr_3r: number;
  hr_gs: number;
  walks: number;
  hbp: number;
  rbi_non_hr: number;
  runs_non_hr: number;
  strikeouts: number;
  gidp: number;
  fielders_choice: number;
}

export const PTS = {
  SINGLE: 10,
  DOUBLE: 20,
  TRIPLE: 30,
  HR_SOLO: 40,
  HR_2R: 45,
  HR_3R: 50,
  HR_GS: 80,
  WALK: 5,
  HBP: 5,
  RBI_NON_HR: 15,
  RUN_NON_HR: 15,
  K: -5,
  GIDP: -10,
  FC: 2,
} as const;

export function applyBoost(basePoints: number, boostPercent: number): number {
  return basePoints > 0 ? Math.round(basePoints * boostPercent) : basePoints;
}

export function calculateBasePoints(breakdown: ScoreBreakdown): number {
  return (
    breakdown.singles * PTS.SINGLE +
    breakdown.doubles * PTS.DOUBLE +
    breakdown.triples * PTS.TRIPLE +
    breakdown.hr_solo * PTS.HR_SOLO +
    breakdown.hr_2r * PTS.HR_2R +
    breakdown.hr_3r * PTS.HR_3R +
    breakdown.hr_gs * PTS.HR_GS +
    breakdown.walks * PTS.WALK +
    breakdown.hbp * PTS.HBP +
    breakdown.rbi_non_hr * PTS.RBI_NON_HR +
    breakdown.runs_non_hr * PTS.RUN_NON_HR +
    breakdown.strikeouts * PTS.K +
    breakdown.gidp * PTS.GIDP +
    breakdown.fielders_choice * PTS.FC
  );
}
