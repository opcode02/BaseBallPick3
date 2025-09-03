// src/history/index.ts
// Historical score tracking and management

import { storage } from '../storage';
import { HistoricalData, HistoricalGame, HistoricalPlayer, Player, Batter, LineupInfo } from '../types';

const HISTORY_STORAGE_KEY = 'pick3_historical_data';

/**
 * Load historical data from storage
 */
export async function loadHistoricalData(): Promise<HistoricalData> {
  try {
    const data = await storage.getItem(HISTORY_STORAGE_KEY);
    if (!data) {
      return createEmptyHistoricalData();
    }
    
    const parsed: HistoricalData = JSON.parse(data);
    
    // Validate structure
    if (!parsed.games || !Array.isArray(parsed.games)) {
      return createEmptyHistoricalData();
    }
    
    return parsed;
  } catch (e) {
    console.warn('Failed to load historical data:', e);
    return createEmptyHistoricalData();
  }
}

/**
 * Save historical data to storage
 */
export async function saveHistoricalData(data: HistoricalData): Promise<void> {
  try {
    const dataToSave = {
      ...data,
      lastUpdated: Date.now(),
    };
    await storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(dataToSave));
    console.log('Historical data saved successfully');
  } catch (e) {
    console.warn('Failed to save historical data:', e);
  }
}

/**
 * Add a completed game to historical data
 */
export async function addGameToHistory(
  players: Player[],
  batters: Batter[],
  lineupInfo: LineupInfo,
  gameStatus: string,
  finalScore?: { twins: number; opponent: number }
): Promise<void> {
  try {
    const historicalData = await loadHistoricalData();
    
    // Create game ID from gamePk and date
    const gameDate = lineupInfo.gameDate ? new Date(lineupInfo.gameDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const gameId = `${lineupInfo.gamePk}_${gameDate}`;
    
    // Check if game already exists
    const existingGameIndex = historicalData.games.findIndex(g => g.id === gameId);
    
    // Transform player data for historical storage
    const historicalPlayers: HistoricalPlayer[] = players.map(player => ({
      name: player.name,
      picks: (player.results || []).map(result => {
        const batter = batters.find(b => b.id === result.batterId);
        return {
          batterId: result.batterId,
          batterName: batter?.name || `Batter ${result.batterId}`,
          mlbId: batter?.mlbId,
          points: result.points,
          basePoints: result.basePoints || 0,
          boost: result.boost || 0,
          breakdown: result.breakdown,
        };
      }),
      totalScore: player.score || 0,
    }));
    
    const historicalGame: HistoricalGame = {
      id: gameId,
      date: gameDate,
      gamePk: lineupInfo.gamePk,
      opponent: lineupInfo.opponent,
      side: lineupInfo.side,
      finalScore,
      gameStatus,
      players: historicalPlayers,
      completedAt: Date.now(),
    };
    
    if (existingGameIndex >= 0) {
      // Update existing game
      historicalData.games[existingGameIndex] = historicalGame;
      console.log('Updated existing game in history:', gameId);
    } else {
      // Add new game
      historicalData.games.push(historicalGame);
      console.log('Added new game to history:', gameId);
    }
    
    // Sort games by date (newest first)
    historicalData.games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Update statistics
    updateHistoricalStats(historicalData);
    
    await saveHistoricalData(historicalData);
  } catch (e) {
    console.warn('Failed to add game to history:', e);
  }
}

/**
 * Get recent games (last N games)
 */
export async function getRecentGames(limit: number = 10): Promise<HistoricalGame[]> {
  try {
    const historicalData = await loadHistoricalData();
    return historicalData.games.slice(0, limit);
  } catch (e) {
    console.warn('Failed to get recent games:', e);
    return [];
  }
}

/**
 * Get historical statistics
 */
export async function getHistoricalStats(): Promise<HistoricalData['stats']> {
  try {
    const historicalData = await loadHistoricalData();
    return historicalData.stats;
  } catch (e) {
    console.warn('Failed to get historical stats:', e);
    return {
      totalGames: 0,
      averageScore: 0,
      bestScore: 0,
    };
  }
}

/**
 * Clear all historical data
 */
export async function clearHistoricalData(): Promise<void> {
  try {
    await storage.removeItem(HISTORY_STORAGE_KEY);
    console.log('Historical data cleared');
  } catch (e) {
    console.warn('Failed to clear historical data:', e);
  }
}

/**
 * Create empty historical data structure
 */
function createEmptyHistoricalData(): HistoricalData {
  return {
    games: [],
    stats: {
      totalGames: 0,
      averageScore: 0,
      bestScore: 0,
    },
    lastUpdated: Date.now(),
  };
}

/**
 * Update historical statistics based on game data
 */
function updateHistoricalStats(data: HistoricalData): void {
  const games = data.games;
  
  if (games.length === 0) {
    data.stats = {
      totalGames: 0,
      averageScore: 0,
      bestScore: 0,
    };
    return;
  }
  
  // Calculate statistics across all players in all games
  const allPlayerScores: number[] = [];
  let bestScore = 0;
  let bestGameId: string | undefined;
  const playerPickCounts: Record<string, number> = {};
  
  games.forEach(game => {
    game.players.forEach(player => {
      allPlayerScores.push(player.totalScore);
      
      if (player.totalScore > bestScore) {
        bestScore = player.totalScore;
        bestGameId = game.id;
      }
      
      // Count player picks for favorite player
      player.picks.forEach(pick => {
        const playerName = pick.batterName;
        playerPickCounts[playerName] = (playerPickCounts[playerName] || 0) + 1;
      });
    });
  });
  
  // Calculate average score
  const totalScore = allPlayerScores.reduce((sum, score) => sum + score, 0);
  const averageScore = totalScore / allPlayerScores.length;
  
  // Find most picked player
  let favoritePlayer: string | undefined;
  let maxPicks = 0;
  Object.entries(playerPickCounts).forEach(([playerName, count]) => {
    if (count > maxPicks) {
      maxPicks = count;
      favoritePlayer = playerName;
    }
  });
  
  data.stats = {
    totalGames: games.length,
    averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
    bestScore,
    bestGame: bestGameId,
    favoritePlayer,
  };
}
