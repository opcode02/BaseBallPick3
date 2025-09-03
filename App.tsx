// App.tsx
// Pick 3 Baseball — Expo/React Native
// Live Twins mode with enhanced scoring from MLB Stats API plays + boxscore.
// Single‑player build: one user per app instance; compare scores externally.
//
// Boosters: you get 100 booster points to split across your 3 picks.
// NEW behavior: a batter's positive score is multiplied by the boost percentage.
// Example: 33% => ×33. Negative scores are not boosted.
// Sliders always keep the total at 100.
//
// Scoring (requested):
// 1B +10, 2B +20, 3B +30,
// HR (solo) +40, 2R HR +45, 3R HR +50, Grand Slam +80,
// BB +5, HBP +5,
// RBI (non-HR) +15, Run Scored (non-HR) +15,
// Strikeout −5, GIDP −10, Fielder's Choice +2.

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  AppState as RNAppState,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Slider from '@react-native-community/slider';

import { saveAppState, clearAppState, loadAppState } from './src/storage';
import { loadTodaysTwinsLineup, buildScoreFromStatsAndPlays } from './src/api';
import { isScoreViewingAllowed } from './src/game';
import { addGameToHistory, getRecentGames, getHistoricalStats, clearHistoricalData } from './src/history';
import { isDraftingAllowed } from './src/utils/dateUtils';
import { initials } from './src/utils/generalUtils';
import { LineupInfo, Phase, Batter, ScoreBreakdown, PlayerPickResult, Player, Scoring, HistoricalGame } from './src/types';

// ------------------------- Constants -------------------------

const DEFAULT_SCORING: Scoring = { single: 1, double: 2, triple: 3, homer: 4, walk: 1 }; // legacy UI only

const DEFAULT_BATTERS: Batter[] = Array.from({ length: 9 }).map((_, i) => ({ id: i + 1, name: `Batter ${i + 1}` }));

const PICKS_PER_PLAYER = 3;

// ------------------------- Helpers -------------------------

/** Small headshot with graceful fallbacks */
function Headshot({ pid, name, size, style }: { pid?: number; name?: string; size: number; style?: any }) {
  const [idx, setIdx] = useState(0);
  const urls = pid ? [
    // Modern MLB Photos CDN
    `https://img.mlbstatic.com/mlb-photos/image/upload/w_${Math.max(60, Math.floor(size * 2))},q_auto:best/v1/people/${pid}/headshot/67/current`,
    // Older path (sometimes works)
    `https://securea.mlb.com/mlb/images/players/head_shot/${pid}.jpg`,
  ] : [];

  if (pid && idx < urls.length) {
    return (
      <Image
        source={{ uri: urls[idx] }}
        onError={() => setIdx(idx + 1)}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2A315D' }, style]}
      />
    );
  } else {
    // Fallback initials
    return (
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2A315D', alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ color: '#BFD1FF', fontWeight: '800', fontSize: Math.floor(size * 0.45) }}>{initials(name)}</Text>
      </View>
    );
  }
}

/** Animated score display with visual feedback for changes */
function AnimatedScore({ score, isUpdated, style }: { score: number; isUpdated: boolean; style?: any }) {
  const animatedValue = useRef(new Animated.Value(1)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isUpdated) {
      // Flash background and scale animation
      Animated.sequence([
        Animated.parallel([
          Animated.timing(backgroundOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 1.2,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(backgroundOpacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [isUpdated, animatedValue, backgroundOpacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: backgroundOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(76, 111, 255, 0)', 'rgba(76, 111, 255, 0.3)'],
          }),
          borderRadius: 8,
          paddingHorizontal: 4,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <Animated.Text
        style={[
          {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 14,
            textAlign: 'center',
          },
          {
            transform: [{ scale: animatedValue }],
            backgroundColor: 'transparent',
          },
        ]}
      >
        {score} pts
      </Animated.Text>
    </Animated.View>
  );
}

/** Simple History View Component */
function HistoryView({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [recentGames, setRecentGames] = useState<HistoricalGame[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistoryData() {
      try {
        setLoading(true);
        const [games, historicalStats] = await Promise.all([
          getRecentGames(10),
          getHistoricalStats()
        ]);
        setRecentGames(games);
        setStats(historicalStats);
      } catch (e) {
        console.warn('Failed to load history:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistoryData();
  }, []);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all historical game data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await clearHistoricalData();
            setRecentGames([]);
            setStats({ totalGames: 0, averageScore: 0, bestScore: 0 });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Game History</Text>
        <TouchableOpacity onPress={onClose} style={styles.btnSecondary}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {/* Statistics Card */}
          {stats && stats.totalGames > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Stats</Text>
              <Text style={styles.hint}>Total Games: {stats.totalGames}</Text>
              <Text style={styles.hint}>Average Score: {stats.averageScore} pts</Text>
              <Text style={styles.hint}>Best Score: {stats.bestScore} pts</Text>
              {stats.favoritePlayer && (
                <Text style={styles.hint}>Most Picked: {stats.favoritePlayer}</Text>
              )}
            </View>
          )}

          {/* Recent Games */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Games</Text>
            {recentGames.length === 0 ? (
              <Text style={styles.hint}>No games recorded yet. Complete a game to see it here!</Text>
            ) : (
              recentGames.map((game, index) => (
                <View key={game.id} style={styles.resultRow}>
                  <View style={styles.rowBetween}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>
                      {new Date(game.date).toLocaleDateString()} vs {game.opponent}
                    </Text>
                    {game.finalScore && (
                      <Text style={styles.hint}>
                        {game.finalScore.twins}-{game.finalScore.opponent}
                      </Text>
                    )}
                  </View>
                  {game.players.map(player => (
                    <View key={player.name} style={{ marginTop: 4 }}>
                      <Text style={{ color: 'white' }}>
                        {player.name}: {player.totalScore} pts
                      </Text>
                      <Text style={styles.hint}>
                        {player.picks.map(p => p.batterName).join(', ')}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>

          {/* Clear History Button */}
          {recentGames.length > 0 && (
            <TouchableOpacity style={styles.btnGhost} onPress={handleClearHistory}>
              <Text style={[styles.btnGhostText, { color: '#FFB3B3' }]}>Clear All History</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Animated row for player results with update indicators */
function AnimatedPlayerRow({ children, isUpdated }: { children: React.ReactNode; isUpdated: boolean }) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isUpdated) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(borderColorAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(backgroundAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(borderColorAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(backgroundAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ]),
      ]).start();
    }
  }, [isUpdated, borderColorAnim, backgroundAnim]);

  return (
    <Animated.View
      style={[
        styles.resultRow,
        {
          borderColor: borderColorAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#1E2A66', '#4C6FFF'],
          }),
          backgroundColor: backgroundAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#0E132A', 'rgba(76, 111, 255, 0.1)'],
          }),
          borderWidth: 2,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ------------------------- Screens -------------------------

export default function App() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [batters, setBatters] = useState<Batter[]>(DEFAULT_BATTERS);
  // Single player only
  const [players, setPlayers] = useState<Player[]>([{ id: 1, name: 'You', picks: [] }]);
  const [scoring, setScoring] = useState<Scoring>({ ...DEFAULT_SCORING }); // legacy, left for UI
  const [currentDrafter] = useState(0); // always 0 in single‑player

  // Boosters: batterId -> 0..100 (must sum to 100 across the 3 picks)
  const [boosters, setBoosters] = useState<Record<number, number>>({});

  // Lineup state
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [lineupInfo, setLineupInfo] = useState<LineupInfo | null>(null);

  // Live scoring state
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [gameState, setGameState] = useState<string>('');
  const [inningStr, setInningStr] = useState<string>('');
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  
  // Score change tracking for visual feedback
  const [previousScores, setPreviousScores] = useState<Record<number, number>>({});
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<number>>(new Set());
  const [previousTotalScore, setPreviousTotalScore] = useState<number>(0);
  const [totalScoreUpdated, setTotalScoreUpdated] = useState<boolean>(false);
  
  // Score viewing window tracking
  const [scoreViewingAllowed, setScoreViewingAllowed] = useState<boolean>(true);

  // Computed booster helpers
  const pickedIds = players[0]?.picks ?? [];
  const boosterUsed = pickedIds.reduce((sum, id) => sum + (boosters[id] ?? 0), 0);
  const boostersComplete = pickedIds.length === 3 && boosterUsed === 100 && pickedIds.every(id => Number.isFinite(boosters[id]));
  // Check if drafting is still allowed (game hasn't started + 5 minutes)
  const draftingAllowed = isDraftingAllowed(lineupInfo?.gameDate);

  // Function to force save current state
  const forcesSaveState = useCallback(() => {
    const stateToSave = {
      phase,
      batters,
      players,
      boosters,
      lineupInfo,
      gameState,
      inningStr,
      previousScores,
      previousTotalScore,
      scoreViewingAllowed,
    };
    console.log('Force saving state:', phase, players[0]?.picks?.length, 'picks');
    saveAppState(stateToSave);
  }, [phase, batters, players, boosters, lineupInfo, gameState, inningStr, previousScores, previousTotalScore, scoreViewingAllowed]);

  // Function to check if any games completed while app was backgrounded
  const checkForCompletedGames = useCallback(async () => {
    // Only check if we have active picks and lineup info
    if (!lineupInfo?.gamePk || !players[0]?.picks?.length || phase === 'setup') {
      return;
    }

    try {
      console.log('Checking for completed games...');
      const liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${lineupInfo.gamePk}/feed/live`;
      const res = await fetch(liveUrl);
      if (!res.ok) return;
      
      const json = await res.json();
      const status = json?.gameData?.status?.abstractGameState || '';
      
      // If game is completed and we're not in results phase, save to history
      if ((status === 'Final' || status === 'Completed') && phase !== 'results') {
        console.log('Found completed game, saving to history...');
        
        // Get the final scores and stats
        const side: 'home' | 'away' = lineupInfo.side;
        const bx = json?.liveData?.boxscore?.teams?.[side];
        const playersObj = bx?.players ?? {};
        const allPlays: any[] = json?.liveData?.plays?.allPlays ?? [];
        
        // Build final results
        const p = players[0];
        const results = p.picks.map((bId) => {
          const batter = batters.find(b => b.id === bId);
          const pid = batter?.mlbId;
          const key = pid ? `ID${pid}` : undefined;
          const s = key ? (playersObj?.[key]?.stats?.batting ?? {}) : {};
          const plays = pid ? allPlays.filter((p: any) => p?.matchup?.batter?.id === pid) : [];
          const { breakdown, points: basePoints } = buildScoreFromStatsAndPlays(s, plays);
          const boostPct = boosters[bId] ?? 0;
          const boosted = basePoints > 0 ? Math.round(basePoints * boostPct) : basePoints;
          return { batterId: bId, outcomes: [], points: boosted, breakdown, boost: boostPct, basePoints } as PlayerPickResult;
        });
        
        const total = results.reduce((acc, r) => acc + r.points, 0);
        
        // Extract final score
        const homeScore = json?.liveData?.linescore?.teams?.home?.runs;
        const awayScore = json?.liveData?.linescore?.teams?.away?.runs;
        const finalScore = (homeScore !== undefined && awayScore !== undefined) ? {
          twins: lineupInfo.side === 'home' ? homeScore : awayScore,
          opponent: lineupInfo.side === 'home' ? awayScore : homeScore,
        } : undefined;
        
        // Save to history
        await addGameToHistory([{ ...p, results, score: total }], batters, lineupInfo, status, finalScore);
        
        // Update app state to results
        setPlayers([{ ...p, results, score: total }]);
        setGameState(status);
        setPhase('results');
        
        // Notify user
        Alert.alert(
          'Game Completed!', 
          `Your final score: ${total} points. The game has been saved to your history.`,
          [{ text: 'View Results', onPress: () => {} }]
        );
      }
    } catch (e) {
      console.warn('Failed to check for completed games:', e);
    }
  }, [lineupInfo, players, phase, batters, boosters]);

  useEffect(() => { 
    fetchLineup(); 
    // Restore app state on launch
    restoreAppState();
  }, []);
  
  // Check score viewing window periodically when in results phase
  useEffect(() => {
    if (phase !== 'results' && phase !== 'live') return;
    
    const hasDrafted = players[0]?.picks?.length > 0;
    if (!hasDrafted) return;
    
    let mounted = true;
    
    const checkScoreViewingStatus = async () => {
      if (!mounted) return;
      
      const allowed = await isScoreViewingAllowed();
      if (!mounted) return;
      
      setScoreViewingAllowed(allowed);
      
      if (!allowed) {
        // Score viewing window has ended, reset to fresh state
        Alert.alert(
          'New Game Preparation', 
          'Score viewing has ended to prepare for the next game. Starting fresh!',
          [{ text: 'OK', onPress: resetAll }]
        );
      }
    };
    
    // Check immediately
    checkScoreViewingStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkScoreViewingStatus, 5 * 60 * 1000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [phase, players[0]?.picks?.length]);
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('App state changed to:', nextAppState);
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        forcesSaveState();
      } else if (nextAppState === 'active') {
        // App came back to foreground - check if any games completed while backgrounded
        checkForCompletedGames();
      }
    };

    const subscription = RNAppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [forcesSaveState, checkForCompletedGames]);

  // Restore saved state
  async function restoreAppState() {
    const savedState = await loadAppState();
    if (savedState) {
      console.log('Restoring saved state:', savedState.phase, savedState.players?.[0]?.picks?.length);
      
      // Restore state regardless of current phase (app might have been backgrounded)
      setPhase(savedState.phase || 'setup');
      setBatters(savedState.batters || DEFAULT_BATTERS);
      setPlayers(savedState.players || [{ id: 1, name: 'You', picks: [] }]);
      setBoosters(savedState.boosters || {});
      setLineupInfo(savedState.lineupInfo || null);
      setGameState(savedState.gameState || '');
      setInningStr(savedState.inningStr || '');
      setPreviousScores(savedState.previousScores || {});
      setPreviousTotalScore(savedState.previousTotalScore || 0);
      setScoreViewingAllowed(savedState.scoreViewingAllowed ?? true);
      
      // Show a brief notification that state was restored
      if (savedState.phase !== 'setup' || savedState.players?.[0]?.picks?.length > 0) {
        setTimeout(() => {
          Alert.alert('Progress Restored', 'Your previous draft and game progress has been restored!');
        }, 1000);
      }
      
      // Check if any games completed while app was closed
      setTimeout(() => {
        checkForCompletedGames();
      }, 2000); // Wait 2 seconds to let state settle
    } else {
      console.log('No saved state found');
    }
  }

  // Auto-save state when important things change
  useEffect(() => {
    // Save state more aggressively - even in setup if there are picks or boosters
    const hasProgress = phase !== 'setup' || 
                       players[0]?.picks.length > 0 || 
                       Object.keys(boosters).length > 0 ||
                       lineupInfo !== null;
    
    if (hasProgress) {
      const stateToSave = {
        phase,
        batters,
        players,
        boosters,
        lineupInfo,
        gameState,
        inningStr,
        previousScores,
        previousTotalScore,
        scoreViewingAllowed,
      };
      console.log('Auto-saving state:', phase, players[0]?.picks?.length, 'picks');
      saveAppState(stateToSave);
    }
  }, [phase, players, boosters, batters, lineupInfo, gameState, inningStr, previousScores, previousTotalScore, scoreViewingAllowed]);  // Keep boosters always summing to 100 via sliders
  function setBoosterWithNormalization(targetId: number, rawValue: number) {
    const picks = players[0]?.picks ?? [];
    if (picks.length !== 3) return; // only normalize when 3 picks exist
    const [a, b, c] = picks;
    const ids = [a, b, c];
    const clamped = Math.max(0, Math.min(100, Math.round(rawValue)));

    // Current values
    const cur = {
      [a]: boosters[a] ?? 0,
      [b]: boosters[b] ?? 0,
      [c]: boosters[c] ?? 0,
    } as Record<number, number>;

    // Assign target first
    cur[targetId] = clamped;
    const others = ids.filter(id => id !== targetId);
    const remaining = 100 - clamped;

    // Sum of other two current values (before scaling)
    const otherSum = (boosters[others[0]] ?? 0) + (boosters[others[1]] ?? 0);

    let newOther1 = 0, newOther2 = 0;
    if (otherSum <= 0) {
      // Split remaining evenly
      newOther1 = Math.floor(remaining / 2);
      newOther2 = remaining - newOther1;
    } else {
      // Preserve ratio of the other two
      newOther1 = Math.round(remaining * (boosters[others[0]] ?? 0) / otherSum);
      newOther2 = remaining - newOther1; // ensure exact 100
    }

    const next: Record<number, number> = { ...boosters };
    next[targetId] = clamped;
    next[others[0]] = newOther1;
    next[others[1]] = newOther2;

    setBoosters(next);
  }

  async function copyScoreToClipboard() {
    try {
      const p = players[0];
      const picksLine = `Picks: ${p?.picks.map(id => batters.find(b => b.id === id)?.name || `#${id}`).join(', ') || '—'}`;
      const boostsLine = p?.picks?.map(id => `${batters.find(b=>b.id===id)?.name ?? `#${id}`}: ${(boosters[id] ?? 0)}%`).join(' • ') || '';
      const gameLine = lineupInfo ? `Game: MIN ${lineupInfo.side === 'home' ? 'vs' : '@'} ${lineupInfo.opponent} ${gameState ? `(${gameState}${inningStr ? ' ' + inningStr : ''})` : ''}` : 'Game: —';
      const results = p?.results ?? [];
      const perBatter = results.map(r => {
        const b = batters.find(bb => bb.id === r.batterId);
        const d: any = r.breakdown;
        const boostPct = boosters[r.batterId] ?? r.boost ?? 0;
        if (!d) return `- ${b?.name ?? `#${r.batterId}`} — ${r.points} pts (boost +${boostPct}%)`;
        const parts: string[] = [];
        if (d.singles) parts.push(`1B:${d.singles}`);
        if (d.doubles) parts.push(`2B:${d.doubles}`);
        if (d.triples) parts.push(`3B:${d.triples}`);
        if ((d.hr_solo + d.hr_2r + d.hr_3r + d.hr_gs) > 0) parts.push(`HR s:${d.hr_solo}/2:${d.hr_2r}/3:${d.hr_3r}/gs:${d.hr_gs}`);
        if (d.walks) parts.push(`BB:${d.walks}`);
        if (d.hbp) parts.push(`HBP:${d.hbp}`);
        if (d.rbi_non_hr) parts.push(`RBI(nHR):${d.rbi_non_hr}`);
        if (d.runs_non_hr) parts.push(`R(nHR):${d.runs_non_hr}`);
        if (d.strikeouts) parts.push(`K:${d.strikeouts}`);
        if (d.gidp) parts.push(`GIDP:${d.gidp}`);
        if (d.fielders_choice) parts.push(`FC:${d.fielders_choice}`);
        return `- ${b?.name ?? `#${r.batterId}`} — ${r.points} pts (boost +${boostPct}%) (${parts.join(' ')})`;
      }).join('\n');
      const total = `Total: ${p?.score ?? 0} pts`;
      const header = 'Pick 3 — My Score';
      const text = [header, total, gameLine, picksLine, boostsLine ? `Boosters: ${boostsLine}` : '', perBatter].filter(Boolean).join('\n');
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Score summary copied to clipboard. Paste it anywhere!');
    } catch (e) {
      Alert.alert('Could not copy', 'Something went wrong creating the summary.');
    }
  }

  function resetAll() {
    setPhase('setup');
    setBatters(DEFAULT_BATTERS.map(b => ({ ...b })));
    setPlayers([{ id: 1, name: 'You', picks: [] }]);
    setScoring({ ...DEFAULT_SCORING });
    setLineupError(null);
    setLineupInfo(null);
    setLiveError(null);
    setLiveLoading(false);
    setLastUpdated(null);
    setGameState('');
    setInningStr('');
    setBoosters({});
    setPreviousScores({});
    setPreviousTotalScore(0);
    setRecentlyUpdated(new Set());
    setTotalScoreUpdated(false);
    setScoreViewingAllowed(true);
    // Clear saved state
    clearAppState();
  }

  // ---------------- Lineup Loading ----------------

  async function fetchLineup() {
    try {
      setLineupLoading(true);
      setLineupError(null);
      const result = await loadTodaysTwinsLineup();
      setBatters(result.batters);
      setLineupInfo(result.lineupInfo);
      if (result.error) {
        setLineupError(result.error);
      }
    } catch (e: any) {
      setLineupError(e?.message || 'Failed to load lineup.');
    } finally {
      setLineupLoading(false);
    }
  }

  // ---------------- Draft actions ----------------

  function togglePick(batterId: number) {
    // Prevent drafting if game has started + 5 minutes
    if (!draftingAllowed) {
      Alert.alert('Drafting Closed', 'The game started more than 5 minutes ago. You can no longer make picks or changes.');
      return;
    }
    
    setPlayers(ps => {
      const p = ps[0];
      if (!p) return ps;
      const hasIt = p.picks.includes(batterId);
      const nextPicks = hasIt ? p.picks.filter(id => id !== batterId) : [...p.picks, batterId];
      if (!hasIt && nextPicks.length > PICKS_PER_PLAYER) return ps; // cap 3 picks
      // prune boosters if a pick is removed
      setBoosters(prev => {
        const copy = { ...prev };
        if (hasIt) delete copy[batterId];
        return copy;
      });
      return [{ ...p, picks: nextPicks }];
    });
  }

  function startDraft() {
    setPlayers(ps => ps.map(p => ({ ...p, picks: [], results: undefined, score: undefined })));
    setBoosters({});
    setPhase('draft');
  }

  function finishDraft() {
    const p = players[0];
    if (!p || p.picks.length !== PICKS_PER_PLAYER) {
      Alert.alert('Pick 3', 'Select exactly 3 batters to continue.');
      return;
    }
    // Pre-fill boosters evenly (34/33/33)
    const even = [34, 33, 33];
    const alloc: Record<number, number> = {};
    p.picks.forEach((id, idx) => { alloc[id] = even[idx] ?? 0; });
    setBoosters(alloc);
    setPhase('play');
  }

  function newDraftSameSetup() {
    setPlayers(ps => ps.map(p => ({ ...p, picks: [], results: undefined, score: undefined })));
    setBoosters({});
    setPhase('draft');
  }

  // ---------------- Live Scoring ----------------

  async function fetchAndScoreLiveOnce() {
    if (!lineupInfo?.gamePk) { setLiveError('Missing game ID. Load lineup first.'); return; }
    try {
      setLiveError(null);
      setLiveLoading(true);
      const liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${lineupInfo.gamePk}/feed/live`;
      const res = await fetch(liveUrl);
      if (!res.ok) throw new Error(`Live feed HTTP ${res.status}`);
      const json = await res.json();

      // Header
      const status = json?.gameData?.status?.abstractGameState || '';
      const inning = json?.liveData?.linescore?.currentInningOrdinal || '';
      const state = json?.liveData?.linescore?.inningState || '';
      setGameState(status);
      setInningStr([state, inning].filter(Boolean).join(' '));

      const side: 'home' | 'away' = lineupInfo.side;
      const bx = json?.liveData?.boxscore?.teams?.[side];
      const playersObj = bx?.players ?? {};
      const allPlays: any[] = json?.liveData?.plays?.allPlays ?? [];

      // Helper to pull a player's batting stats & plays
      const getStatsForKey = (key: string) => playersObj?.[key]?.stats?.batting ?? {};
      const getPlaysForPid = (pid: number) => allPlays.filter((p: any) => p?.matchup?.batter?.id === pid);

      const p = players[0];
      const results = p.picks.map((bId) => {
        const batter = batters.find(b => b.id === bId);
        const pid = batter?.mlbId;
        const key = pid ? `ID${pid}` : undefined;
        const s = key ? getStatsForKey(key) : {};
        const plays = pid ? getPlaysForPid(pid) : [];
        const { breakdown, points: basePoints, outcomes } = buildScoreFromStatsAndPlays(s, plays);
        const boostPct = boosters[bId] ?? 0;
        // Apply boost: straight multiplication for positive scores, no boost for negative scores
        const boosted = basePoints > 0 ? Math.round(basePoints * boostPct) : basePoints;
        return { batterId: bId, outcomes, points: boosted, breakdown, boost: boostPct, basePoints } as PlayerPickResult;
      });
      const total = results.reduce((acc, r) => acc + r.points, 0);
      
      // Track score changes for visual feedback
      const newScores: Record<number, number> = {};
      const updatedBatters = new Set<number>();
      const hasPreviousScores = Object.keys(previousScores).length > 0;
      
      results.forEach(r => {
        newScores[r.batterId] = r.points;
        const prevScore = previousScores[r.batterId];
        
        // Only mark as updated if we have previous scores AND the score actually changed
        if (hasPreviousScores && prevScore !== undefined && r.points !== prevScore) {
          updatedBatters.add(r.batterId);
        }
      });
      
      // Check if total score changed
      const totalChanged = hasPreviousScores && total !== previousTotalScore;
      
      setPreviousScores(newScores);
      setPreviousTotalScore(total);
      
      // Only set updated indicators if there are actual changes
      if (updatedBatters.size > 0) {
        // Add newly updated batters to the existing set
        setRecentlyUpdated(prev => {
          const newSet = new Set([...prev, ...updatedBatters]);
          return newSet;
        });
        
        // Clear only these specific batters after 3 seconds
        updatedBatters.forEach(batterId => {
          setTimeout(() => {
            setRecentlyUpdated(prev => {
              const newSet = new Set(prev);
              newSet.delete(batterId);
              return newSet;
            });
          }, 3000);
        });
      }
      
      // Handle total score animation separately
      if (totalChanged) {
        setTotalScoreUpdated(true);
        
        // Clear total score animation after 3 seconds
        setTimeout(() => {
          setTotalScoreUpdated(false);
        }, 3000);
      }
      
      setPlayers([{ ...p, results, score: total }]);
      setLastUpdated(Date.now());

      // Check if game is completed and save to history
      if (status === 'Final' || status === 'Completed') {
        // Extract final score from the game data
        const homeScore = json?.liveData?.linescore?.teams?.home?.runs;
        const awayScore = json?.liveData?.linescore?.teams?.away?.runs;
        const finalScore = (homeScore !== undefined && awayScore !== undefined) ? {
          twins: lineupInfo.side === 'home' ? homeScore : awayScore,
          opponent: lineupInfo.side === 'home' ? awayScore : homeScore,
        } : undefined;
        
        // Save game to history (only if we have player results)
        if (results.length > 0) {
          addGameToHistory([{ ...p, results, score: total }], batters, lineupInfo, status, finalScore)
            .catch(e => console.warn('Failed to save game to history:', e));
        }
        
        setPhase('results');
      }
    } catch (e: any) {
      setLiveError(e?.message || 'Failed to fetch live data.');
    } finally {
      setLiveLoading(false);
    }
  }

  function startLiveScoring() {
    if (!lineupInfo?.gamePk) {
      Alert.alert('Load lineup first', 'Tap Refresh on the Twins lineup card, then try again.');
      return;
    }
    if (!boostersComplete) {
      Alert.alert('Assign boosters', 'Distribute all 100 booster points across your 3 picks before starting.');
      return;
    }
    setPhase('live');
  }

  useEffect(() => {
    if (phase !== 'live') return;
    let mounted = true;
    fetchAndScoreLiveOnce();
    const t = setInterval(() => { if (mounted) fetchAndScoreLiveOnce(); }, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [phase, lineupInfo, players[0]?.picks.join(','), batters.map(b=>b.mlbId).join(','), boosters]);

  // ---------------- UI ----------------

  return (
    <SafeAreaView style={styles.safe}>
      {showHistory ? (
        <HistoryView onClose={() => setShowHistory(false)} />
      ) : (
        <>
          {phase === 'setup' && (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Pick 3 — Baseball</Text>
          <Text style={styles.subtitle}>Setup</Text>

          {/* Lineup loader */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Today's Twins Lineup</Text>
              <TouchableOpacity style={styles.btnSecondary} onPress={fetchLineup} disabled={lineupLoading}>
                {lineupLoading ? (
                  <View style={[styles.row, { gap: 6 }]}>
                    <ActivityIndicator />
                    <Text style={styles.btnText}>Loading…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Refresh</Text>
                )}
              </TouchableOpacity>
            </View>
            {lineupInfo && (
              <>
                <Text style={styles.hint}>
                  {`vs ${lineupInfo.side === 'home' ? '—' : '@'} ${lineupInfo.opponent}`}
                  {lineupInfo.firstPitchLocal ? ` • First pitch: ${lineupInfo.firstPitchLocal}` : ''}
                </Text>
                {lineupInfo.gameDate && (
                  <Text style={[styles.hint, { color: draftingAllowed ? '#8FA1FF' : '#FFB3B3' }]}>
                    {draftingAllowed 
                      ? '⏰ Drafting closes 5 minutes after first pitch'
                      : '🔒 Drafting window has closed (5+ minutes after first pitch)'
                    }
                  </Text>
                )}
              </>
            )}
            {lineupError && <Text style={[styles.hint, { color: '#FFB3B3' }]}>{lineupError}</Text>}
            <Text style={styles.hint}>If the lineup isn't posted yet, this will fill in later — you can still edit names below.</Text>
          </View>

          {/* Batters (auto-filled) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Batters (9)</Text>
            <View style={{ gap: 8 }}>
              {batters.map((b) => (
                <View key={b.id} style={styles.row}>
                  <Text style={{ width: 30, fontWeight: '600', color: 'white' }}>{`#${b.id}`}</Text>
                  <Headshot pid={b.mlbId} name={b.name} size={32} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={b.name}
                    onChangeText={(t) => setBatters(bs => bs.map(bb => bb.id === b.id ? { ...bb, name: t } : bb))}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Scoring (read-only mapping) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scoring</Text>
            <Text style={styles.hint}>1B +10 • 2B +20 • 3B +30</Text>
            <Text style={styles.hint}>HR: solo +40 • 2R +45 • 3R +50 • GS +80</Text>
            <Text style={styles.hint}>BB +5 • HBP +5</Text>
            <Text style={styles.hint}>RBI (non‑HR) +15 • Run (non‑HR) +15</Text>
            <Text style={styles.hint}>K −5 • GIDP −10 • Fielder’s Choice +2</Text>
          </View>

          {!draftingAllowed && lineupInfo?.gameDate && (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { color: '#FFB3B3' }]}>⚠️ Drafting Closed</Text>
              <Text style={styles.hint}>
                Drafting is no longer allowed. The game started more than 5 minutes ago.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.btnPrimary, { opacity: draftingAllowed ? 1 : 0.5 }]} 
            onPress={startDraft}
            disabled={!draftingAllowed}
          >
            <Text style={styles.btnPrimaryText}>
              {draftingAllowed ? 'Start Draft' : 'Drafting Closed'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.rowBetween, { marginTop: 12 }]}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowHistory(true)}>
              <Text style={styles.btnText}>View History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={resetAll}>
              <Text style={styles.btnGhostText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {phase === 'draft' && (
        <View style={[styles.container, { flex: 1, paddingBottom: 0 }] }>
          <Text style={styles.title}>Draft</Text>
          <Text style={styles.subtitle}>Pick {PICKS_PER_PLAYER} batters — just you!</Text>

          {!draftingAllowed && lineupInfo?.gameDate && (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { color: '#FFB3B3' }]}>⚠️ Drafting Period Ended</Text>
              <Text style={styles.hint}>
                The game started more than 5 minutes ago. You can no longer make new picks or changes.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 4 }]}>Now drafting:</Text>
            <Text style={styles.nowDrafting}>You</Text>
            <Text style={styles.hint}>Selected: {players[0]?.picks.length}/{PICKS_PER_PLAYER} • Tip: select exactly {PICKS_PER_PLAYER} to continue</Text>
          </View>

          <FlatList
            data={batters}
            keyExtractor={(b) => String(b.id)}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 120 }}
            renderItem={({ item }) => {
              const isSelectedByMe = players[0]?.picks.includes(item.id);
              const isDisabled = !draftingAllowed;
              return (
                <TouchableOpacity
                  style={[
                    styles.batterRow, 
                    isSelectedByMe && styles.batterRowSelected,
                    isDisabled && styles.batterRowDisabled
                  ]}
                  onPress={() => togglePick(item.id)}
                  disabled={isDisabled}
                >
                  <View style={[styles.rowBetween]}> 
                    <View style={[styles.row, { gap: 12 }]}> 
                      <Headshot pid={item.mlbId} name={item.name} size={32} />
                      <Text style={[styles.batterName, isDisabled && { color: '#666' }]}>{`#${item.id} ${item.name}`}</Text>
                    </View>
                    <Text style={[styles.batterPickStatus, isDisabled && { color: '#666' }]}>
                      {isDisabled ? 'Unavailable' : isSelectedByMe ? 'Selected' : 'Available'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Sticky action bar */}
          {(() => {
            const canContinue = (players[0]?.picks.length ?? 0) === PICKS_PER_PLAYER;
            return (
              <View style={styles.stickyBar}>
                <View style={styles.rowBetween}>
                  <TouchableOpacity style={styles.btnGhost} onPress={() => setPhase('setup')}>
                    <Text style={styles.btnGhostText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { opacity: canContinue ? 1 : 0.5 }]}
                    onPress={finishDraft}
                    disabled={!canContinue}
                  >
                    <Text style={styles.btnPrimaryText}>Next: Boosters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>
      )}

      {phase === 'play' && (
        <View style={styles.container}>
          <Text style={styles.title}>Play</Text>
          <Text style={styles.subtitle}>Assign boosters with the sliders (must total 100), then start live scoring.</Text>

          {/* Boosters card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Boosters</Text>
              <Text style={styles.hint}>Total: 100%</Text>
            </View>
            {pickedIds.map((id) => {
              const b = batters.find(bb => bb.id === id);
              const val = boosters[id] ?? 0;
              return (
                <View key={id} style={{ marginVertical: 6 }}>
                  <View style={styles.rowBetween}>
                    <View style={[styles.row, { gap: 8 }]}>
                      <Headshot pid={b?.mlbId} name={b?.name} size={28} />
                      <Text style={{ fontWeight: '700', color: 'white' }}>{b?.name ?? `#${id}`}</Text>
                    </View>
                    <Text style={styles.hint}>{val}%</Text>
                  </View>
                  <Slider
                    value={val}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    onValueChange={(v: number) => setBoosterWithNormalization(id, v)}
                  />
                </View>
              );
            })}
            <Text style={styles.hint}>Each batter's positive points are multiplied by <Text style={{fontWeight:'700', color:'white'}}>boost%</Text>. Negative scores are not boosted.</Text>
          </View>

          {/* Picks */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Picks</Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', color: 'white' }}>You</Text>
              <Text style={styles.hint}>
                {players[0]?.picks.map(id => `${batters.find(b => b.id === id)?.name ?? ''} (${boosters[id] ?? 0}%)`).join('  •  ')}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.btnPrimary, { opacity: boostersComplete ? 1 : 0.5 }]} onPress={startLiveScoring} disabled={!boostersComplete}>
            <Text style={styles.btnPrimaryText}>Start Live Scoring</Text>
          </TouchableOpacity>

          <View style={[styles.rowBetween, { marginTop: 12 }]} >
            <TouchableOpacity 
              style={[styles.btnGhost, { opacity: draftingAllowed ? 1 : 0.5 }]} 
              onPress={() => setPhase('draft')}
              disabled={!draftingAllowed}
            >
              <Text style={styles.btnGhostText}>
                {draftingAllowed ? 'Back to Draft' : 'Draft Closed'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={() => setPhase('setup')}>
              <Text style={styles.btnGhostText}>Edit Setup</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === 'live' && (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Live Scoring</Text>
          <Text style={styles.subtitle}>{gameState || '—'}{inningStr ? ` • ${inningStr}` : ''}</Text>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Scores (auto-refresh 15s)</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btnSecondary} onPress={fetchAndScoreLiveOnce} disabled={liveLoading}>
                  {liveLoading ? (
                    <View style={[styles.row, { gap: 6 }]}>
                      <ActivityIndicator />
                      <Text style={styles.btnText}>Refreshing…</Text>
                    </View>
                  ) : (
                    <Text style={styles.btnText}>Refresh Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {lastUpdated && (
              <Text style={styles.hint}>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</Text>
            )}
            {liveError && <Text style={[styles.hint, { color: '#FFB3B3' }]}>{liveError}</Text>}
          </View>

          {/* Single player score card */}
          {(() => {
            const p = players[0];
            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Score</Text>
                  <AnimatedScore score={p?.score ?? 0} isUpdated={totalScoreUpdated} />
                </View>
                {(p?.results ?? []).map((r) => {
                  const batter = batters.find(b => b.id === r.batterId);
                  const d = r.breakdown as ScoreBreakdown | undefined;
                  const hrLine = d ? `HR: solo ${d.hr_solo} • 2R ${d.hr_2r} • 3R ${d.hr_3r} • GS ${d.hr_gs}` : '';
                  const isUpdated = recentlyUpdated.has(r.batterId);
                  return (
                    <AnimatedPlayerRow key={`${p?.id}-${r.batterId}`} isUpdated={isUpdated}>
                      <View style={[styles.row, { gap: 10 }]}> 
                        <Headshot pid={batter?.mlbId} name={batter?.name} size={36} />
                        <View style={{ flex: 1 }}> 
                          <View style={[styles.rowBetween, { alignItems: 'flex-start' }]}>
                            <Text style={{ fontWeight: '600', color: 'white' }}>{`${batter?.name ?? ''} (+${r.boost ?? boosters[r.batterId] ?? 0}%)`}</Text>
                            {isUpdated && (
                              <View style={styles.updateIndicator}>
                                <Text style={styles.updateIndicatorText}>NEW!</Text>
                              </View>
                            )}
                          </View>
                          {d ? (
                            <>
                              <Text style={styles.hint}>1B:{d.singles} • 2B:{d.doubles} • 3B:{d.triples} • BB:{d.walks} • HBP:{d.hbp}</Text>
                              <Text style={styles.hint}>{hrLine}</Text>
                              <Text style={styles.hint}>RBI(non‑HR):{d.rbi_non_hr} • Run(non‑HR):{d.runs_non_hr} • K:{d.strikeouts} • GIDP:{d.gidp} • FC:{d.fielders_choice}</Text>
                              <Text style={styles.hint}>Base: {r.basePoints} • Boosted: {r.points}</Text>
                            </>
                          ) : (
                            <Text style={styles.hint}>Base: {r.basePoints ?? 0} • Boosted: {r.points}</Text>
                          )}
                        </View>
                      </View>
                    </AnimatedPlayerRow>
                  );
                })}
              </View>
            );
          })()}

          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setPhase('play')}>
              <Text style={styles.btnText}>Stop Live Scoring</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={copyScoreToClipboard}>
              <Text style={styles.btnText}>Share my score</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={resetAll}>
              <Text style={styles.btnGhostText}>Reset Everything</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {phase === 'results' && (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.subtitle}>
            {gameState || 'Final'}{inningStr ? ` • ${inningStr}` : ''} 
          </Text>

          {scoreViewingAllowed && (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { color: '#BFD1FF' }]}>📊 Score Viewing Window</Text>
              <Text style={styles.hint}>
                You can view your scores until 10 minutes before the next game starts.
              </Text>
            </View>
          )}

          {(() => {
            const p = players[0];
            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Score</Text>
                  <Text style={styles.scoreBadge}>{p?.score ?? 0} pts</Text>
                </View>
                {(p?.results ?? []).map((r) => {
                  const batter = batters.find(b => b.id === r.batterId);
                  const d = r.breakdown as ScoreBreakdown | undefined;
                  return (
                    <View key={`${p?.id}-${r.batterId}`} style={styles.resultRow}>
                      <View style={[styles.row, { gap: 10 }]}> 
                        <Headshot pid={batter?.mlbId} name={batter?.name} size={36} />
                        <View style={{ flex: 1 }}> 
                          <Text style={{ fontWeight: '600', color: 'white' }}>{`${batter?.name ?? ''} (+${r.boost ?? boosters[r.batterId] ?? 0}%)`}</Text>
                          {d && (
                            <Text style={styles.hint}>
                              {`1B:${d.singles} 2B:${d.doubles} 3B:${d.triples} | HR(solo:${d.hr_solo} 2R:${d.hr_2r} 3R:${d.hr_3r} GS:${d.hr_gs}) | BB:${d.walks} HBP:${d.hbp} | RBI(nHR):${d.rbi_non_hr} R(nHR):${d.runs_non_hr} | K:${d.strikeouts} GIDP:${d.gidp} FC:${d.fielders_choice} | Base:${r.basePoints} Boosted:${r.points}`}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.btnSecondary} onPress={copyScoreToClipboard}>
              <Text style={styles.btnText}>Share my score</Text>
            </TouchableOpacity>
            {draftingAllowed && (
              <TouchableOpacity style={styles.btnSecondary} onPress={newDraftSameSetup}>
                <Text style={styles.btnText}>New Draft (Same Setup)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnGhost} onPress={resetAll}>
              <Text style={styles.btnGhostText}>Reset Everything</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
        </>
      )}
    </SafeAreaView>
  );
}

// ------------------------- Styles -------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1020' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 16, color: '#C8D0FF', marginBottom: 4 },
  card: {
    backgroundColor: '#121735', borderRadius: 16, padding: 12, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: { color: 'white', fontWeight: '800', fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { backgroundColor: '#0E132A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: 'white', borderWidth: 1, borderColor: '#24307A' },
  label: { color: '#A7B1FF', marginBottom: 6, fontSize: 12 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12 },
  btnPrimary: { backgroundColor: '#4C6FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: '800', fontSize: 16 },
  btnSecondary: { backgroundColor: '#1C254B', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  btnText: { color: 'white', fontWeight: '700' },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 8 },
  btnGhostText: { color: '#B8C0FF', fontWeight: '700' },
  smallBtn: { backgroundColor: '#2A2F55', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  smallBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },
  hint: { color: '#8FA1FF' },
  nowDrafting: { color: 'white', fontSize: 20, fontWeight: '800' },
  batterRow: { backgroundColor: '#121735', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#21308F' },
  batterRowDisabled: { opacity: 0.5 },
  batterRowSelected: { borderColor: '#4C6FFF', backgroundColor: '#0F1D55' },
  batterName: { color: 'white', fontWeight: '700' },
  batterPickStatus: { color: '#AAB5FF', marginTop: 4 },
  scoreBadge: { backgroundColor: '#0F1D55', color: 'white', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  resultRow: { backgroundColor: '#0E132A', borderRadius: 12, padding: 10, gap: 4, marginTop: 8, borderWidth: 1, borderColor: '#1E2A66' },
  chip: { alignSelf: 'flex-start', backgroundColor: '#2240FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginTop: 6 },
  chipText: { color: 'white', fontWeight: '800', fontSize: 12 },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#0B1020F2', borderTopWidth: 1, borderTopColor: '#21308F' },
  updateIndicator: { backgroundColor: '#4C6FFF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  updateIndicatorText: { color: 'white', fontWeight: '800', fontSize: 10 },
});

