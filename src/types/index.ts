// src/types/index.ts
// Type definitions for the Pick 3 Baseball app

export type OutcomeCode = 'OUT' | '1B' | '2B' | '3B' | 'HR' | 'BB' | 'HBP' | 'K' | 'GIDP' | 'FC' | 'RBI' | 'R';

export type Phase = 'setup' | 'draft' | 'play' | 'live' | 'results';

export interface Scoring { // legacy (not used for live scoring now)
  single: number;
  double: number;
  triple: number;
  homer: number;
  walk: number;
}

export interface Batter {
  id: number;
  name: string;
  mlbId?: number; // MLB playerId when lineup is loaded
}

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

export interface PlayerPickResult {
  batterId: number;
  outcomes: OutcomeCode[]; // compact log (kept for UI)
  points: number; // boosted points
  breakdown?: ScoreBreakdown; // detailed stat buckets used to score
  boost?: number; // percent 0..100 used for this batter
  basePoints?: number; // points before boost
}

export interface Player {
  id: number;
  name: string;
  picks: number[]; // batter ids
  results?: PlayerPickResult[]; // updated by live scoring
  score?: number;
}

export type LineupInfo = {
  gamePk: number;
  opponent: string;
  side: 'home' | 'away';
  firstPitchLocal?: string;
  gameDate?: string; // raw ISO date string from MLB API
};

export interface AppState {
  phase: Phase;
  batters: Batter[];
  players: Player[];
  boosters: Record<number, number>;
  lineupInfo: LineupInfo | null;
  gameState: string;
  inningStr: string;
  previousScores: Record<number, number>;
  previousTotalScore: number;
  savedAt: number; // timestamp to check if state is still relevant
  scoreViewingAllowed?: boolean;
}

// Historical Score Tracking Types

export interface HistoricalPlayer {
  name: string;
  picks: Array<{
    batterId: number;
    batterName: string;
    mlbId?: number;
    points: number;
    basePoints: number;
    boost: number;
    breakdown?: ScoreBreakdown;
  }>;
  totalScore: number;
}

export interface HistoricalGame {
  id: string; // unique identifier (e.g., gamePk + date)
  date: string; // ISO date string
  gamePk: number;
  opponent: string;
  side: 'home' | 'away';
  finalScore?: {
    twins: number;
    opponent: number;
  };
  gameStatus: string; // Final, Completed, etc.
  players: HistoricalPlayer[];
  completedAt: number; // timestamp when game was completed
}

export interface HistoricalData {
  games: HistoricalGame[];
  stats: {
    totalGames: number;
    averageScore: number;
    bestScore: number;
    bestGame?: string; // game id
    favoritePlayer?: string; // most picked player name
  };
  lastUpdated: number;
}
