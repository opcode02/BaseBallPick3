// src/game/index.ts
// Game state management and business logic

import { AppState, LineupInfo } from '../types';
import { isDraftingAllowed as utilIsDraftingAllowed } from '../utils/dateUtils';
import { storage, saveAppState, clearAppState } from '../storage';

const TWINS_TEAM_ID = 142;
const MLB_TZ = 'America/Chicago';

export { saveAppState, clearAppState };

/** Check if drafting is still allowed (game hasn't started + 5 minutes) */
export function isDraftingAllowed(gameDate?: string): boolean {
  return utilIsDraftingAllowed(gameDate);
}

/** Check if score viewing is still allowed for drafted users (until 10 minutes before next game) */
export async function isScoreViewingAllowed(): Promise<boolean> {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format date for API call
    const tomorrowDateParam = tomorrow.toISOString().split('T')[0];
    const schedUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TWINS_TEAM_ID}&date=${encodeURIComponent(tomorrowDateParam)}`;
    const schedRes = await fetch(schedUrl);
    
    if (!schedRes.ok) {
      // If we can't check tomorrow's games, allow viewing for safety
      return true;
    }
    
    const schedJson = await schedRes.json();
    const games: any[] = (schedJson?.dates?.[0]?.games ?? []) as any[];
    
    if (!games.length) {
      // No game tomorrow, allow viewing
      return true;
    }
    
    // Find the earliest game tomorrow
    const earliestGame = games.sort((a, b) => 
      new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
    )[0];
    
    if (!earliestGame?.gameDate) {
      // Can't determine next game time, allow viewing for safety
      return true;
    }
    
    const nextGameStart = new Date(earliestGame.gameDate);
    const now = new Date();
    const tenMinutesBeforeNextGame = new Date(nextGameStart.getTime() - 10 * 60 * 1000);
    
    return now < tenMinutesBeforeNextGame;
  } catch {
    // If anything fails, allow viewing for safety
    return true;
  }
}

/** Load app state with validation and expiration checks */
export async function loadAppState(): Promise<AppState | null> {
  try {
    console.log('Attempting to load saved state...');
    const savedState = await storage.getItem('pick3_app_state');
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
      await storage.removeItem('pick3_app_state');
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
        await storage.removeItem('pick3_app_state');
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
          const gameEndTime = new Date(game.gameDate);
          const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
          return gameEndTime > thirtyMinutesAgo;
        }
        
        return false;
      });

      if (!hasActiveOrRecentGames) {
        console.log('No active or recent games today, clearing old state');
        await storage.removeItem('pick3_app_state');
        return null;
      }
    } catch (e) {
      console.log('Could not check games today, restoring state anyway');
    }

    return state;
  } catch (e) {
    console.warn('Failed to load app state:', e);
    return null;
  }
}
