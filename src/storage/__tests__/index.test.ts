// src/storage/__tests__/index.test.ts
// Tests for storage functionality

// Mock AsyncStorage before importing anything else
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock the game module
jest.mock('../../game', () => ({
  isScoreViewingAllowed: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

import { storage, saveAppState, clearAppState, loadAppState } from '../index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isScoreViewingAllowed } from '../../game';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockIsScoreViewingAllowed = isScoreViewingAllowed as jest.MockedFunction<typeof isScoreViewingAllowed>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storage wrapper', () => {
    test('setItem calls AsyncStorage.setItem', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storage.setItem('test-key', 'test-value');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
    });

    test('getItem calls AsyncStorage.getItem', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('test-value');

      const result = await storage.getItem('test-key');

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
    });

    test('removeItem calls AsyncStorage.removeItem', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);

      await storage.removeItem('test-key');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    test('handles AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect(storage.setItem('test-key', 'test-value')).resolves.toBeUndefined();
    });
  });

  describe('saveAppState', () => {
    test('saves app state with timestamp', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      const mockState = {
        phase: 'setup' as const,
        batters: [],
        players: [],
        boosters: {},
        lineupInfo: null,
        gameState: '',
        inningStr: '',
        previousScores: {},
        previousTotalScore: 0,
        savedAt: 0,
      };

      await saveAppState(mockState);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'pick3_app_state',
        expect.stringContaining('"phase":"setup"')
      );

      // Check that savedAt was updated
      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData.savedAt).toBeGreaterThan(mockState.savedAt);
    });
  });

  describe('clearAppState', () => {
    test('removes app state from storage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);

      await clearAppState();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
    });
  });

  describe('loadAppState', () => {
    const mockValidState = {
      phase: 'setup' as const,
      batters: [],
      players: [{ picks: ['player1', 'player2'] }],
      boosters: {},
      lineupInfo: null,
      gameState: '',
      inningStr: '',
      previousScores: {},
      previousTotalScore: 0,
      savedAt: Date.now() - (1000 * 60 * 30), // 30 minutes ago
    };

    test('returns null when no saved state exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await loadAppState();

      expect(result).toBeNull();
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('pick3_app_state');
    });

    test('returns null and clears storage when state is too old (>24 hours)', async () => {
      const oldState = {
        ...mockValidState,
        savedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldState));
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);

      const result = await loadAppState();

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
    });

    test('handles JSON parse errors gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await loadAppState();

      expect(result).toBeNull();
    });

    test('handles AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await loadAppState();

      expect(result).toBeNull();
    });

    describe('drafted user in results phase', () => {
      test('returns state when score viewing is still allowed', async () => {
        const draftedResultsState = {
          ...mockValidState,
          phase: 'results' as const,
          players: [{ picks: ['player1', 'player2'] }],
        };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(draftedResultsState));
        mockIsScoreViewingAllowed.mockResolvedValue(true);

        const result = await loadAppState();

        expect(result).toEqual(draftedResultsState);
        expect(mockIsScoreViewingAllowed).toHaveBeenCalled();
      });

      test('clears state and returns null when score viewing window has ended', async () => {
        const draftedResultsState = {
          ...mockValidState,
          phase: 'results' as const,
          players: [{ picks: ['player1', 'player2'] }],
        };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(draftedResultsState));
        mockIsScoreViewingAllowed.mockResolvedValue(false);
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);

        const result = await loadAppState();

        expect(result).toBeNull();
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
      });

      test('works for live phase as well as results phase', async () => {
        const draftedLiveState = {
          ...mockValidState,
          phase: 'live' as const,
          players: [{ picks: ['player1', 'player2'] }],
        };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(draftedLiveState));
        mockIsScoreViewingAllowed.mockResolvedValue(true);

        const result = await loadAppState();

        expect(result).toEqual(draftedLiveState);
      });
    });

    describe('non-results phase with game checks', () => {
      const setupState = {
        ...mockValidState,
        phase: 'setup' as const,
        players: [{ picks: [] }], // No picks yet
      };

      test('returns state when active games exist', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Live' },
              gameDate: '2025-08-31T19:00:00Z'
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toEqual(setupState);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('statsapi.mlb.com'));
      });

      test('returns state when preview games exist', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Preview' },
              gameDate: '2025-08-31T19:00:00Z'
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toEqual(setupState);
      });

      test('returns state when recently finished games exist (within 30 min)', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        
        // Game that ended 20 minutes ago (3 hour game duration + 20 min = game ended 20 min ago)
        const gameStartTime = new Date(Date.now() - (3 * 60 * 60 * 1000) - (20 * 60 * 1000));
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Final' },
              gameDate: gameStartTime.toISOString()
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toEqual(setupState);
      });

      test('clears state when no active or recent games exist', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Final' },
              gameDate: '2025-08-31T10:00:00Z' // Game ended too long ago
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toBeNull();
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
      });

      test('clears state when no games exist today', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);
        
        const mockGamesResponse = {
          dates: []
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toBeNull();
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
      });

      test('allows state restore when game API check fails', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await loadAppState();

        expect(result).toEqual(setupState);
      });
    });

    describe('edge cases', () => {
      const setupState = {
        ...mockValidState,
        phase: 'setup' as const,
        players: [{ picks: [] }], // No picks yet
      };

      test('handles state with no players array', async () => {
        const stateWithoutPlayers = {
          ...mockValidState,
          players: undefined,
        };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stateWithoutPlayers));
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Live' }
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toEqual(stateWithoutPlayers);
      });

      test('handles state with empty players array', async () => {
        const stateWithEmptyPlayers = {
          ...mockValidState,
          players: [],
        };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stateWithEmptyPlayers));
        
        const mockGamesResponse = {
          dates: [{
            games: [{
              status: { abstractGameState: 'Live' }
            }]
          }]
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        expect(result).toEqual(stateWithEmptyPlayers);
      });

      test('handles malformed game API response', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(setupState));
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);
        
        const mockGamesResponse = {
          // Missing dates array
        };
        
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockGamesResponse),
        } as Response);

        const result = await loadAppState();

        // When dates array is missing, the games check should clear state
        expect(result).toBeNull();
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('pick3_app_state');
      });
    });
  });
});
