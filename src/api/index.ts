// src/api/index.ts
// MLB Stats API integration

import { Batter, LineupInfo, OutcomeCode, ScoreBreakdown } from '../types';
import { formatDateMMDDYYYYInTZ, formatLocalTime } from '../utils/dateUtils';
import { calculateBasePoints, applyBoost } from '../utils/scoringUtils';

const TWINS_TEAM_ID = 142;
const MLB_TZ = 'America/Chicago';

export interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
  };
  teams: {
    home: {
      team: {
        id: number;
        name: string;
      };
    };
    away: {
      team: {
        id: number;
        name: string;
      };
    };
  };
}

export interface LiveGameData {
  gameState: string;
  inningStr: string;
  battersResults: Array<{
    batterId: number;
    outcomes: OutcomeCode[];
    points: number;
    breakdown: ScoreBreakdown;
    boost: number;
    basePoints: number;
  }>;
}

/** Fetch today's Twins lineup from MLB API */
export async function loadTodaysTwinsLineup(): Promise<{
  batters: Batter[];
  lineupInfo: LineupInfo;
  error?: string;
}> {
  const today = new Date();
  const dateParam = formatDateMMDDYYYYInTZ(today, MLB_TZ);

  const schedUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TWINS_TEAM_ID}&date=${encodeURIComponent(dateParam)}`;
  const schedRes = await fetch(schedUrl);
  if (!schedRes.ok) throw new Error(`Schedule HTTP ${schedRes.status}`);
  const schedJson = await schedRes.json();

  const games: any[] = (schedJson?.dates?.[0]?.games ?? []) as any[];
  if (!games.length) {
    throw new Error('No Twins game found for today.');
  }

  const schedGames = games.slice();
  const pick =
    schedGames.find(g => (g?.status?.abstractGameState || '').toLowerCase() === 'live') ||
    schedGames.find(g => ['preview','pre-game','in progress'].includes((g?.status?.abstractGameState || '').toLowerCase())) ||
    schedGames.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())[0];
  const game = pick;
  if (!game) {
    throw new Error('Could not determine today\'s game.');
  }

  const side: 'home' | 'away' = game?.teams?.home?.team?.id === TWINS_TEAM_ID ? 'home' : 'away';
  const gamePk: number = game.gamePk;

  const liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const liveRes = await fetch(liveUrl);
  if (!liveRes.ok) throw new Error(`Live feed HTTP ${liveRes.status}`);
  const liveJson = await liveRes.json();

  const bx = liveJson?.liveData?.boxscore?.teams?.[side];
  const playersObj = bx?.players ?? {};

  let names: string[] = [];
  let idKeys: string[] = [];
  const rawOrder: any[] = Array.isArray(bx?.battingOrder) ? bx.battingOrder : [];
  const asKeys = rawOrder.map((v: any) => {
    const s = String(v);
    if (s.startsWith('ID')) return s;
    const n = Number(s);
    return Number.isFinite(n) ? `ID${n}` : s;
  });

  if (asKeys.length >= 9) {
    idKeys = asKeys.slice(0, 9);
    names = idKeys.map((idKey) => playersObj?.[idKey]?.person?.fullName as string | undefined).filter(Boolean) as string[];
  }

  const batters: Batter[] = [];
  for (let i = 0; i < 9; i++) {
    const name = names[i] || 'TBD';
    const key = idKeys[i];
    const pid = key?.startsWith('ID') ? parseInt(key.slice(2), 10) : undefined;
    batters.push({
      id: i + 1,
      name,
      mlbId: pid
    });
  }

  const lineupInfo: LineupInfo = {
    gamePk,
    opponent: side === 'home' ? game?.teams?.away?.team?.name : game?.teams?.home?.team?.name,
    side,
    firstPitchLocal: formatLocalTime(game?.gameDate, MLB_TZ),
    gameDate: game?.gameDate,
  };

  const error = names.length < 9 ? 'Lineup partially available. You can start; it will fill in as the feed updates.' : undefined;

  return { batters, lineupInfo, error };
}

/** Fetch live game data and calculate scores */
export async function fetchLiveGameData(
  lineupInfo: LineupInfo,
  batters: Batter[],
  playerPicks: number[],
  boosters: Record<number, number>
): Promise<LiveGameData> {
  if (!lineupInfo?.gamePk) {
    throw new Error('Missing game ID. Load lineup first.');
  }

  const liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${lineupInfo.gamePk}/feed/live`;
  const res = await fetch(liveUrl);
  if (!res.ok) throw new Error(`Live feed HTTP ${res.status}`);
  const json = await res.json();

  // Header
  const status = json?.gameData?.status?.abstractGameState || '';
  const inning = json?.liveData?.linescore?.currentInningOrdinal || '';
  const state = json?.liveData?.linescore?.inningState || '';
  const gameState = status;
  const inningStr = [state, inning].filter(Boolean).join(' ');

  const side: 'home' | 'away' = lineupInfo.side;
  const bx = json?.liveData?.boxscore?.teams?.[side];
  const playersObj = bx?.players ?? {};
  const allPlays: any[] = json?.liveData?.plays?.allPlays ?? [];

  // Helper to pull a player's batting stats & plays
  const getStatsForKey = (key: string) => playersObj?.[key]?.stats?.batting ?? {};
  const getPlaysForPid = (pid: number) => allPlays.filter((p: any) => p?.matchup?.batter?.id === pid);

  const battersResults = playerPicks.map((bId) => {
    const batter = batters.find(b => b.id === bId);
    const pid = batter?.mlbId;
    const key = pid ? `ID${pid}` : undefined;
    const s = key ? getStatsForKey(key) : {};
    const plays = pid ? getPlaysForPid(pid) : [];
    const { breakdown, points: basePoints, outcomes } = buildScoreFromStatsAndPlays(s, plays);
    const boostPct = boosters[bId] ?? 0;
    // Apply boost: straight multiplication for positive scores, no boost for negative scores
    const boosted = basePoints > 0 ? Math.round(basePoints * boostPct) : basePoints;
    return { 
      batterId: bId, 
      outcomes, 
      points: boosted, 
      breakdown, 
      boost: boostPct, 
      basePoints 
    };
  });

  return {
    gameState,
    inningStr,
    battersResults
  };
}

/** Build score breakdown from MLB stats and play data */
export function buildScoreFromStatsAndPlays(stats: any, plays: any[]): {
  breakdown: ScoreBreakdown;
  points: number;
  outcomes: OutcomeCode[];
} {
  // Initialize breakdown
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

  const outcomes: OutcomeCode[] = [];

  // Extract basic stats
  breakdown.singles = Number(stats?.hits || 0) - Number(stats?.doubles || 0) - Number(stats?.triples || 0) - Number(stats?.homeRuns || 0);
  breakdown.doubles = Number(stats?.doubles || 0);
  breakdown.triples = Number(stats?.triples || 0);
  breakdown.walks = Number(stats?.baseOnBalls || 0);
  breakdown.strikeouts = Number(stats?.strikeOuts || 0);
  breakdown.gidp = Number(stats?.groundIntoDoublePlay || 0);

  // Analyze home runs by RBI count
  const totalHRs = Number(stats?.homeRuns || 0);
  const totalRBIs = Number(stats?.rbi || 0);
  const totalRuns = Number(stats?.runs || 0);

  // Simple HR categorization (could be improved with play-by-play analysis)
  if (totalHRs > 0) {
    // This is a simplified approach - in reality you'd need to analyze each HR play
    const avgRBIPerHR = totalRBIs / totalHRs;
    if (avgRBIPerHR >= 3.5) {
      breakdown.hr_gs = totalHRs;
    } else if (avgRBIPerHR >= 2.5) {
      breakdown.hr_3r = totalHRs;
    } else if (avgRBIPerHR >= 1.5) {
      breakdown.hr_2r = totalHRs;
    } else {
      breakdown.hr_solo = totalHRs;
    }
  }

  // Non-HR RBIs and runs
  const hrRBIs = totalHRs * (breakdown.hr_gs * 4 + breakdown.hr_3r * 3 + breakdown.hr_2r * 2 + breakdown.hr_solo * 1);
  breakdown.rbi_non_hr = Math.max(0, totalRBIs - hrRBIs);
  breakdown.runs_non_hr = totalRuns; // Simplified - could subtract HR runs

  // Build outcomes array (simplified)
  for (let i = 0; i < breakdown.singles; i++) outcomes.push('1B');
  for (let i = 0; i < breakdown.doubles; i++) outcomes.push('2B');
  for (let i = 0; i < breakdown.triples; i++) outcomes.push('3B');
  for (let i = 0; i < (breakdown.hr_solo + breakdown.hr_2r + breakdown.hr_3r + breakdown.hr_gs); i++) outcomes.push('HR');
  for (let i = 0; i < breakdown.walks; i++) outcomes.push('BB');
  for (let i = 0; i < breakdown.strikeouts; i++) outcomes.push('K');
  for (let i = 0; i < breakdown.gidp; i++) outcomes.push('GIDP');

  const points = calculateBasePoints(breakdown);

  return { breakdown, points, outcomes };
}
