// src/history/__tests__/index.test.ts
// Tests for historical score tracking functionality

import { addGameToHistory, getRecentGames, getHistoricalStats, clearHistoricalData, loadHistoricalData } from '../index';
import { Player, Batter, LineupInfo, HistoricalGame } from '../../types';

// Mock storage
const mockStorage = new Map<string, string>();
jest.mock('../../storage', () => ({
  storage: {
    async setItem(key: string, value: string) {
      mockStorage.set(key, value);
    },
    async getItem(key: string) {
      return mockStorage.get(key) || null;
    },
    async removeItem(key: string) {
      mockStorage.delete(key);
    },
  },
}));

describe('Historical Data Management', () => {
  beforeEach(() => {
    mockStorage.clear();
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(1630454400000); // Fixed timestamp
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadHistoricalData', () => {
    it('should return empty data when no history exists', async () => {
      const data = await loadHistoricalData();
      expect(data).toEqual({
        games: [],
        stats: {
          totalGames: 0,
          averageScore: 0,
          bestScore: 0,
        },
        lastUpdated: 1630454400000,
      });
    });

    it('should load existing historical data', async () => {
      const existingData = {
        games: [
          {
            id: 'test-game',
            date: '2025-08-31',
            gamePk: 12345,
            opponent: 'Guardians',
            side: 'home' as const,
            gameStatus: 'Final',
            players: [],
            completedAt: 1630454400000,
          },
        ],
        stats: {
          totalGames: 1,
          averageScore: 50,
          bestScore: 50,
        },
        lastUpdated: 1630454400000,
      };
      
      mockStorage.set('pick3_historical_data', JSON.stringify(existingData));
      
      const data = await loadHistoricalData();
      expect(data.games).toHaveLength(1);
      expect(data.stats.totalGames).toBe(1);
    });

    it('should handle corrupted storage data gracefully', async () => {
      mockStorage.set('pick3_historical_data', 'invalid json');
      
      const data = await loadHistoricalData();
      expect(data.games).toEqual([]);
      expect(data.stats.totalGames).toBe(0);
    });
  });

  describe('addGameToHistory', () => {
    const mockPlayers: Player[] = [
      {
        id: 1,
        name: 'You',
        picks: [1, 2, 3],
        results: [
          {
            batterId: 1,
            outcomes: ['1B', 'HR'],
            points: 60,
            basePoints: 50,
            boost: 20,
            breakdown: {
              singles: 1,
              doubles: 0,
              triples: 0,
              hr_solo: 1,
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
            },
          },
          {
            batterId: 2,
            outcomes: ['K'],
            points: -5,
            basePoints: -5,
            boost: 30,
          },
          {
            batterId: 3,
            outcomes: ['2B'],
            points: 100,
            basePoints: 20,
            boost: 50,
          },
        ],
        score: 155,
      },
    ];

    const mockBatters: Batter[] = [
      { id: 1, name: 'Byron Buxton', mlbId: 621439 },
      { id: 2, name: 'Carlos Correa', mlbId: 621043 },
      { id: 3, name: 'Jose Miranda', mlbId: 669304 },
    ];

    const mockLineupInfo: LineupInfo = {
      gamePk: 12345,
      opponent: 'Guardians',
      side: 'home',
      firstPitchLocal: '7:10 PM',
      gameDate: '2025-08-31T00:10:00Z',
    };

    it('should add a new game to history', async () => {
      await addGameToHistory(mockPlayers, mockBatters, mockLineupInfo, 'Final', { twins: 7, opponent: 4 });
      
      const data = await loadHistoricalData();
      expect(data.games).toHaveLength(1);
      
      const game = data.games[0];
      expect(game.id).toBe('12345_2025-08-31');
      expect(game.opponent).toBe('Guardians');
      expect(game.finalScore).toEqual({ twins: 7, opponent: 4 });
      expect(game.players).toHaveLength(1);
      expect(game.players[0].totalScore).toBe(155);
      expect(game.players[0].picks).toHaveLength(3);
    });

    it('should update existing game if it already exists', async () => {
      // Add game first time
      await addGameToHistory(mockPlayers, mockBatters, mockLineupInfo, 'Live');
      
      // Update same game
      const updatedPlayers = [{ ...mockPlayers[0], score: 200 }];
      await addGameToHistory(updatedPlayers, mockBatters, mockLineupInfo, 'Final', { twins: 10, opponent: 2 });
      
      const data = await loadHistoricalData();
      expect(data.games).toHaveLength(1); // Should still be 1 game
      
      const game = data.games[0];
      expect(game.gameStatus).toBe('Final');
      expect(game.finalScore).toEqual({ twins: 10, opponent: 2 });
      expect(game.players[0].totalScore).toBe(200);
    });

    it('should update statistics correctly', async () => {
      await addGameToHistory(mockPlayers, mockBatters, mockLineupInfo, 'Final');
      
      const data = await loadHistoricalData();
      expect(data.stats.totalGames).toBe(1);
      expect(data.stats.averageScore).toBe(155);
      expect(data.stats.bestScore).toBe(155);
      expect(data.stats.favoritePlayer).toBe('Byron Buxton'); // First player alphabetically with same pick count
    });

    it('should handle multiple games and calculate stats correctly', async () => {
      // Add first game
      await addGameToHistory(mockPlayers, mockBatters, mockLineupInfo, 'Final');
      
      // Add second game with different lineup and scores
      const secondLineup = { ...mockLineupInfo, gamePk: 12346, gameDate: '2025-09-01T00:10:00Z' };
      const secondPlayers = [{ ...mockPlayers[0], score: 75 }];
      
      await addGameToHistory(secondPlayers, mockBatters, secondLineup, 'Final');
      
      const data = await loadHistoricalData();
      expect(data.stats.totalGames).toBe(2);
      expect(data.stats.averageScore).toBe(115); // (155 + 75) / 2
      expect(data.stats.bestScore).toBe(155);
    });
  });

  describe('getRecentGames', () => {
    it('should return empty array when no games exist', async () => {
      const games = await getRecentGames();
      expect(games).toEqual([]);
    });

    it('should return games in reverse chronological order', async () => {
      // Add games with different dates
      const lineup1 = { gamePk: 1, opponent: 'Team A', side: 'home' as const, gameDate: '2025-08-30T00:10:00Z' };
      const lineup2 = { gamePk: 2, opponent: 'Team B', side: 'away' as const, gameDate: '2025-08-31T00:10:00Z' };
      const lineup3 = { gamePk: 3, opponent: 'Team C', side: 'home' as const, gameDate: '2025-09-01T00:10:00Z' };
      
      const players = [{ id: 1, name: 'You', picks: [], score: 0 }] as Player[];
      const batters = [] as Batter[];
      
      await addGameToHistory(players, batters, lineup1, 'Final');
      await addGameToHistory(players, batters, lineup2, 'Final');
      await addGameToHistory(players, batters, lineup3, 'Final');
      
      const games = await getRecentGames();
      expect(games).toHaveLength(3);
      expect(games[0].opponent).toBe('Team C'); // Most recent
      expect(games[1].opponent).toBe('Team B');
      expect(games[2].opponent).toBe('Team A'); // Oldest
    });

    it('should respect the limit parameter', async () => {
      // Add 5 games
      for (let i = 1; i <= 5; i++) {
        const lineup = { gamePk: i, opponent: `Team ${i}`, side: 'home' as const, gameDate: `2025-08-${25 + i}T00:10:00Z` };
        const players = [{ id: 1, name: 'You', picks: [], score: 0 }] as Player[];
        const batters = [] as Batter[];
        await addGameToHistory(players, batters, lineup, 'Final');
      }
      
      const games = await getRecentGames(3);
      expect(games).toHaveLength(3);
      expect(games[0].opponent).toBe('Team 5'); // Most recent
    });
  });

  describe('getHistoricalStats', () => {
    it('should return empty stats when no games exist', async () => {
      const stats = await getHistoricalStats();
      expect(stats).toEqual({
        totalGames: 0,
        averageScore: 0,
        bestScore: 0,
      });
    });
  });

  describe('clearHistoricalData', () => {
    it('should remove all historical data from storage', async () => {
      // Add some data first
      const lineup = { gamePk: 1, opponent: 'Team A', side: 'home' as const };
      const players = [{ id: 1, name: 'You', picks: [], score: 100 }] as Player[];
      const batters = [] as Batter[];
      
      await addGameToHistory(players, batters, lineup, 'Final');
      
      // Verify data exists
      const beforeClear = await loadHistoricalData();
      expect(beforeClear.games).toHaveLength(1);
      
      // Clear data
      await clearHistoricalData();
      
      // Verify data is gone
      const afterClear = await loadHistoricalData();
      expect(afterClear.games).toHaveLength(0);
    });
  });
});
