// src/storage/index.ts
// AsyncStorage wrapper and app state persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from '../types';
import { isScoreViewingAllowed } from '../game';

const STORAGE_KEY = 'pick3_app_state';

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Failed to save to storage:', e);
    }
  },
  
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Failed to read from storage:', e);
      return null;
    }
  },
  
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to remove from storage:', e);
    }
  }
};

export async function loadAppState(): Promise<AppState | null> {
  try {
    console.log('Attempting to load saved state...');
    const savedState = await storage.getItem(STORAGE_KEY);
    if (!savedState) {
      console.log('No saved state found');
      return null;
    }
    
    const state: AppState = JSON.parse(savedState);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    console.log('Found saved state:', {
      phase: state.phase,
      picks: state.players?.[0]?.picks?.length,
      savedAt: new Date(state.savedAt).toLocaleString(),
      ageHours: Math.round((now - state.savedAt) / (60 * 60 * 1000))
    });
    
    // Don't restore if state is too old
    if (now - state.savedAt > maxAge) {
      console.log('Saved state is too old, clearing it');
      await storage.removeItem(STORAGE_KEY);
      return null;
    }

    // If user has drafted and is in results phase, check if score viewing is still allowed
    const hasDrafted = state.players?.[0]?.picks?.length > 0;
    const isInResultsPhase = state.phase === 'results' || state.phase === 'live';
    
    if (hasDrafted && isInResultsPhase) {
      console.log('User has drafted and is viewing results, checking score viewing window...');
      const scoreViewingStillAllowed = await isScoreViewingAllowed();
      
      if (!scoreViewingStillAllowed) {
        console.log('Score viewing window has ended (10 minutes before next game), clearing state');
        await storage.removeItem(STORAGE_KEY);
        return null;
      }
      
      console.log('Score viewing still allowed, restoring state');
      return state;
    }

    // For non-results phases, check if there are any active games or recently finished games today
    try {
      const today = new Date().toISOString().split('T')[0];
      const gamesResponse = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=game(content(editorial(recap))),decision,person,probablePitcher,stats,homeRuns,previousPlay,game(content(media(epg))),seriesStatus(useOverride=true)`);
      const gamesData = await gamesResponse.json();
      
      const hasActiveOrRecentGames = gamesData.dates?.[0]?.games?.some((game: any) => {
        const gameStatus = game.status?.abstractGameState;
        
        // Game is active if it's live or preview (starting soon)
        if (gameStatus === 'Live' || gameStatus === 'Preview') {
          return true;
        }
        
        // Game is recently finished if it ended within 30 minutes
        if (gameStatus === 'Final') {
          const gameEndTime = new Date(game.gameDate).getTime() + (3 * 60 * 60 * 1000); // Estimate 3 hour game duration
          return (now - gameEndTime) <= (30 * 60 * 1000); // 30 minutes
        }
        
        return false;
      });
      
      if (!hasActiveOrRecentGames) {
        console.log('No active or recently finished games today, clearing saved state');
        await storage.removeItem(STORAGE_KEY);
        return null;
      }
      
      console.log('Found active or recently finished games, restoring state');
    } catch (gameCheckError) {
      console.log('Error checking game status, allowing state restore anyway:', gameCheckError);
      // If we can't check games, allow restore to be safe
    }
    
    return state;
  } catch (e) {
    console.warn('Failed to load app state:', e);
    return null;
  }
}

export async function saveAppState(state: Partial<AppState>): Promise<void> {
  try {
    const stateToSave: AppState = {
      ...state as AppState,
      savedAt: Date.now(),
    };
    console.log('Saving app state:', {
      phase: stateToSave.phase,
      picks: stateToSave.players?.[0]?.picks?.length,
      boosters: Object.keys(stateToSave.boosters || {}).length,
      savedAt: new Date(stateToSave.savedAt).toLocaleTimeString()
    });
    await storage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    console.log('State saved successfully');
  } catch (e) {
    console.warn('Failed to save app state:', e);
  }
}

export async function clearAppState(): Promise<void> {
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear app state:', e);
  }
}
