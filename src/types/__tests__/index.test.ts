// src/types/__tests__/index.test.ts
// Tests for type definitions

import { Phase, Batter, Player, LineupInfo, AppState } from '../index';

describe('Types', () => {
  test('Phase type includes all expected values', () => {
    const validPhases: Phase[] = ['setup', 'draft', 'play', 'live', 'results'];
    
    // This test ensures the Phase type is properly defined
    validPhases.forEach(phase => {
      expect(typeof phase).toBe('string');
    });
  });

  test('Batter interface has required fields', () => {
    const batter: Batter = {
      id: 1,
      name: 'Test Player',
      mlbId: 12345
    };

    expect(batter.id).toBe(1);
    expect(batter.name).toBe('Test Player');
    expect(batter.mlbId).toBe(12345);
  });

  test('Player interface has required fields', () => {
    const player: Player = {
      id: 1,
      name: 'You',
      picks: [1, 2, 3]
    };

    expect(player.id).toBe(1);
    expect(player.name).toBe('You');
    expect(player.picks).toEqual([1, 2, 3]);
  });

  test('LineupInfo type has required fields', () => {
    const lineupInfo: LineupInfo = {
      gamePk: 12345,
      opponent: 'Test Team',
      side: 'home'
    };

    expect(lineupInfo.gamePk).toBe(12345);
    expect(lineupInfo.opponent).toBe('Test Team');
    expect(lineupInfo.side).toBe('home');
  });

  test('AppState interface has required fields', () => {
    const appState: AppState = {
      phase: 'setup',
      batters: [],
      players: [],
      boosters: {},
      lineupInfo: null,
      gameState: '',
      inningStr: '',
      previousScores: {},
      previousTotalScore: 0,
      savedAt: Date.now()
    };

    expect(appState.phase).toBe('setup');
    expect(Array.isArray(appState.batters)).toBe(true);
    expect(Array.isArray(appState.players)).toBe(true);
    expect(typeof appState.boosters).toBe('object');
    expect(typeof appState.savedAt).toBe('number');
  });
});
