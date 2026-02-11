import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Bluetooth } from 'lucide-react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameStatus } from '../hooks/useGameStatus';
import { isDevMode } from '../utils/devMode';
import type { DartThrowData } from '../utils/ble/bleConnection';
import type { GameConfiguration, GameInOut } from '../types/game';
import { getCheckoutSuggestion } from '../utils/checkoutSolver';
import { playSound } from '../utils/sounds';
import { createClient } from '../utils/supabase/client';
import { useOnlineThrowSync } from '../hooks/useOnlineThrowSync';
import { resolveProfilePicUrl } from '../utils/profile';

interface DartThrow {
  segment: string;
  score: number;
  multiplier: number;
}

interface PlayerInfo {
  id: string;
  name: string;
  profilePic?: string;
  accentColor: string;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  const c = hex.trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const r = h.length >= 6 ? parseInt(h.slice(0, 2), 16) : parseInt(h[0] + h[0], 16);
    const g = h.length >= 6 ? parseInt(h.slice(2, 4), 16) : parseInt(h[1] + h[1], 16);
    const b = h.length >= 6 ? parseInt(h.slice(4, 6), 16) : parseInt(h[2] + h[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 0, 0, ${alpha})`;
}

// Snapshot of state before a single dart throw (for undo)
interface DartSnapshot {
  p1Score: number;
  p2Score: number;
  currentThrower: 'p1' | 'p2';
  currentDarts: DartThrow[];
  roundScore: number;
  p1HasStarted: boolean;
  p2HasStarted: boolean;
}

// Achievement types for animations
// - win: Player reaches exactly 0
// - bust: Player goes below 0 or can't finish legally
// - hatTrick: 3 bulls in one turn (any combo S25/D25)
// - threeInBlack: 3 double bulls (D25 D25 D25)
// - ton80: T20 T20 T20 (180)
// - threeInBed: 3 in same triple space (01), or 3 in cricket marks (cricket)
// - whiteHorse: Cricket only, 3 DIFFERENT triples
// - shanghai: 01 only, same number with S + D + T (e.g., S20 D20 T20)
// - highTon: 150+ in a round
// - lowTon: 100-149 in a round
type AchievementType =
  | 'win'
  | 'bust'
  | 'hatTrick'
  | 'threeInBlack'
  | 'ton80'
  | 'threeInBed'
  | 'whiteHorse'
  | 'shanghai'
  | 'highTon'
  | 'lowTon'
  | null;

const INACTIVE = '#7E7E7E';

// Safe color alpha helper - handles any hex length, rgb(), whitespace, null
const withAlpha = (color: string, alpha: number): string => {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    let r, g, b;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0]+hex[0], 16);
      g = parseInt(hex[1]+hex[1], 16);
      b = parseInt(hex[2]+hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return `rgba(0, 0, 0, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  const hslMatch = c.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) return `hsla(${hslMatch[1].replace(/,\s*[\d.]+\s*$/, '')}, ${alpha})`;
  return `rgba(0, 0, 0, ${alpha})`;
};

// Figma fonts (loaded via @font-face in globals.css)
const FONT_SCORE = "'Helvetica Compressed', sans-serif";
const FONT_NAME = "'Helvetica Condensed', sans-serif";

// Figma frame: 1180 x 820
// Bar: 513 x 118, avatar 75px, name 40px, score 96px
const FIGMA = {
  frame: { w: 1180, h: 820 },
  bar: { w: 513, h: 118 },
  avatar: 75,
  avatarLeft: 12,
  nameLeft: 100,
  nameSize: 40,
  scoreLeft: 373,
  scoreSize: 96,
};

const ROUND_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];

// Achievement display names
const ACHIEVEMENT_LABELS: Record<Exclude<AchievementType, null>, string> = {
  win: 'GAME!',
  bust: 'BUST!',
  hatTrick: 'HAT TRICK!',
  threeInBlack: '3 IN THE BLACK!',
  ton80: 'TON 80!',
  threeInBed: '3 IN A BED!',
  whiteHorse: 'WHITE HORSE!',
  shanghai: 'SHANGHAI!',
  highTon: 'HIGH TON!',
  lowTon: 'LOW TON!',
};

const AWARD_VIDEOS: Partial<Record<Exclude<AchievementType, null>, string>> = {
  hatTrick: '/awards/blue&orange/hattrick.mp4',
  threeInBlack: '/awards/blue&orange/3intheblack.mp4',
  ton80: '/awards/blue&orange/ton80.mp4',
  threeInBed: '/awards/blue&orange/3inabed.mp4',
  whiteHorse: '/awards/blue&orange/whitehorse.mp4',
  shanghai: '/awards/blue&orange/shanghai.mp4',
  highTon: '/awards/blue&orange/highton.mp4',
  lowTon: '/awards/blue&orange/lowton.mp4',
};


// Checkout suggestions for 01 games (Double Out)
// Checkout suggestions are handled by the dynamic solver.

// Checkout table kept for reference; runtime uses dynamic solver.

// CSS keyframes for the GOOD LUCK animation and color reveal
const goodLuckKeyframes = `
@keyframes goodLuckSlide {
  0% {
    left: 100%;
    transform: translate(0, -50%);
  }
  25% {
    left: 50%;
    transform: translate(-50%, -50%);
  }
  75% {
    left: 50%;
    transform: translate(-50%, -50%);
  }
  100% {
    left: -100%;
    transform: translate(0, -50%);
  }
}

@keyframes goodLuckBgSlide {
  0% {
    left: 100%;
    width: 40%;
    transform: translateY(-50%);
  }
  25% {
    left: 0;
    width: 100%;
    transform: translateY(-50%);
  }
  75% {
    left: 0;
    width: 100%;
    transform: translateY(-50%);
  }
  100% {
    left: -100%;
    width: 40%;
    transform: translateY(-50%);
  }
}

@keyframes colorSwipeUp {
  0% {
    clip-path: inset(100% 0 0 0);
  }
  100% {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes colorSwipeDown {
  0% {
    clip-path: inset(0 0 0 0);
  }
  100% {
    clip-path: inset(100% 0 0 0);
  }
}

@keyframes borderDrainDown {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(calc(118 * 100vw / 1180));
    opacity: 0;
  }
}

@keyframes slideInFromLeft {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes slideOutToLeft {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}

@keyframes achievementPulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0;
  }
  15% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@keyframes achievementFadeIn {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 1; }
}

@keyframes achievementGlow {
  0%, 100% {
    filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor);
  }
  50% {
    filter: drop-shadow(0 0 40px currentColor) drop-shadow(0 0 80px currentColor);
  }
}

@keyframes winnerFadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes winnerNameSlide {
  0% {
    transform: translateY(50px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes winnerConfetti {
  0% {
    transform: translateY(-10px) rotate(0deg);
  }
  50% {
    transform: translateY(10px) rotate(180deg);
  }
  100% {
    transform: translateY(-10px) rotate(360deg);
  }
}

@keyframes doubleBullFade {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
`;

interface GameScreenProps {
  gameId: string;
  localPlayer: PlayerInfo;
  remotePlayer: PlayerInfo;
  isInitiator: boolean;
  gameConfig?: GameConfiguration | null;
  onLeaveMatch?: () => void;
  gameType?: string;
  startingPlayer?: 'p1' | 'p2';
  onGameComplete?: (winner: 'p1' | 'p2') => void;
}

export function O1OnlineGameScreen({
  gameId,
  localPlayer,
  remotePlayer,
  isInitiator,
  gameConfig,
  onLeaveMatch,
  gameType,
  startingPlayer,
  onGameComplete,
}: GameScreenProps) {
  const supabase = createClient();

  // BLE integration
  const { lastThrow, isConnected, simulateThrow: bleSimulateThrow, status: bleStatus, connect: bleConnect, disconnect: bleDisconnect, clearLEDs } = useBLE();
  const devMode = isDevMode();
  const lastProcessedThrowRef = useRef<string | null>(null);
  const playerChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const webRTCOptions = useMemo(() => ({
    gameId,
    localPlayerId: localPlayer.id,
    remotePlayerId: remotePlayer.id,
    isInitiator,
  }), [gameId, localPlayer.id, remotePlayer.id, isInitiator]);

  const { localStream, remoteStream, initialize: webrtcInit, disconnect: webrtcDisconnect } = useWebRTC(webRTCOptions);

  const { disconnectCountdown, leaveMatch } = useGameStatus({
    gameId,
    localPlayerId: localPlayer.id,
    remotePlayerId: remotePlayer.id,
    remotePlayerName: remotePlayer.name,
    onOpponentLeft: () => onLeaveMatch?.(),
  });

  // Determine which player is p1/p2 based on startingPlayer (cork winner)
  // P1 (LEFT) = whoever goes first (cork winner)
  // P2 (RIGHT) = whoever goes second
  // startingPlayer is 'p1' or 'p2' where p1=initiator, p2=accepter (from App.tsx mapping)
  // isInitiator tells us if the local player is the initiator (p1 in App.tsx's convention)
  const localIsP1 = startingPlayer
    ? startingPlayer === (isInitiator ? 'p1' : 'p2')
    : isInitiator;
  const p1 = localIsP1 ? localPlayer : remotePlayer;
  const p2 = localIsP1 ? remotePlayer : localPlayer;

  const resolvedGameType = useMemo(() => {
    const raw = gameType || gameConfig?.games?.find(entry => entry) || '501';
    const normalized = typeof raw === 'string' ? raw.toUpperCase() : '501';
    return normalized === '301' ? '301' : '501';
  }, [gameType, gameConfig?.games]);

  const startScore = resolvedGameType === '301' ? 301 : 501;

  const [p1Score, setP1Score] = useState(startScore);
  const [p2Score, setP2Score] = useState(startScore);
  // Track score at the **start of each turn** so 01 bust can correctly
  // revert to the score before the turn (not just before the last dart).
  const p1TurnStartScoreRef = useRef(startScore);
  const p2TurnStartScoreRef = useRef(startScore);
  const [currentThrower, setCurrentThrower] = useState<'p1' | 'p2'>('p1');
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [showPlayerChange, setShowPlayerChange] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [showGoodLuck, setShowGoodLuck] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundAnimState, setRoundAnimState] = useState<'in' | 'visible' | 'out'>('in');
  const [roundKey, setRoundKey] = useState(0);
  const [p1ThrewThisRound, setP1ThrewThisRound] = useState(false);
  const [p2ThrewThisRound, setP2ThrewThisRound] = useState(false);
  const [dartHistory, setDartHistory] = useState<DartSnapshot[]>([]);
  const [undosRemaining, setUndosRemaining] = useState(3);
  const [activeAnimation, setActiveAnimation] = useState<AchievementType>(null);
  const [gameWinner, setGameWinner] = useState<'p1' | 'p2' | null>(null);
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);
  const [showDoubleBullEffect, setShowDoubleBullEffect] = useState(false);
  const [doubleBullEffectKey, setDoubleBullEffectKey] = useState(0);

  // 80% Stat Tracking
  const [p1DartsThrown, setP1DartsThrown] = useState(0);
  const [p2DartsThrown, setP2DartsThrown] = useState(0);
  const [eightyPercentTriggered, setEightyPercentTriggered] = useState(false);
  const [p1FrozenPPR, setP1FrozenPPR] = useState<number | null>(null);
  const [p2FrozenPPR, setP2FrozenPPR] = useState<number | null>(null);

  // Track if each player has "started" (hit their first valid in for DI/MIMO modes)
  const [p1HasStarted, setP1HasStarted] = useState(false);
  const [p2HasStarted, setP2HasStarted] = useState(false);

  // Track when each player reached their current score (for tiebreaker: who got there first)
  const [p1ScoreReachedRound, setP1ScoreReachedRound] = useState(1);
  const [p2ScoreReachedRound, setP2ScoreReachedRound] = useState(1);

  // Game settings
  const [inMode, setInMode] = useState<'open' | 'master' | 'double'>('open');
  const [outMode, setOutMode] = useState<'open' | 'master' | 'double'>('master');
  const [splitBull, setSplitBull] = useState(false);

  const currentScore = currentThrower === 'p1' ? p1Score : p2Score;

  const isOhOneGame = true;
  const isCricketGame = false;

  // 80% threshold
  const eightyPercentThreshold = startScore === 501 ? 100 : 50;

  // Calculate live PPR
  const p1LivePPR = p1DartsThrown > 0 ? ((startScore - p1Score) / p1DartsThrown) * 3 : 0;
  const p2LivePPR = p2DartsThrown > 0 ? ((startScore - p2Score) / p2DartsThrown) * 3 : 0;

  // Display PPR
  const p1DisplayPPR = eightyPercentTriggered && p1FrozenPPR !== null ? p1FrozenPPR : p1LivePPR;
  const p2DisplayPPR = eightyPercentTriggered && p2FrozenPPR !== null ? p2FrozenPPR : p2LivePPR;


  // Detect achievements
  const detectAchievement = useCallback((darts: DartThrow[], totalScore: number, didBust: boolean, didWin: boolean): AchievementType => {
    if (darts.length !== 3) return didBust ? 'bust' : didWin ? 'win' : null;
    if (didBust) return 'bust';
    if (didWin) return 'win';
    const segments = darts.map(d => d.segment);
    if (segments.every(s => s === 'T20')) return 'ton80';
    if (segments.every(s => s === 'D25')) return 'threeInBlack';
    if (isOhOneGame) {
      const getBaseNumber = (seg: string): number | null => {
        if (seg === 'S25' || seg === 'D25' || seg === 'MISS') return null;
        const match = seg.match(/[SDT](\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };
      const baseNumbers = segments.map(getBaseNumber);
      if (baseNumbers.every(n => n !== null && n === baseNumbers[0])) {
        const prefixes = segments.map(s => s[0]);
        if (prefixes.includes('S') && prefixes.includes('D') && prefixes.includes('T')) return 'shanghai';
      }
    }
    if (isCricketGame) {
      const triples = segments.filter(s => s.startsWith('T'));
      if (triples.length === 3) {
        const uniqueTriples = new Set(triples);
        if (uniqueTriples.size === 3) return 'whiteHorse';
      }
    }
    const bullCount = segments.filter(s => s === 'S25' || s === 'D25').length;
    if (bullCount === 3) return 'hatTrick';
    const triples = segments.filter(s => s.startsWith('T'));
    if (triples.length === 3 && triples[0] === triples[1] && triples[1] === triples[2]) {
      if (isOhOneGame) return 'threeInBed';
      else if (isCricketGame) {
        const cricketNumbers = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15'];
        if (cricketNumbers.includes(triples[0])) return 'threeInBed';
      }
    }
    if (totalScore >= 150) return 'highTon';
    if (totalScore >= 100) return 'lowTon';
    if (didBust) return 'bust';
    return null;
  }, [isOhOneGame, isCricketGame]);

  // Trigger achievement animation (3 seconds to let award videos play fully, button can cancel)
  const triggerAchievement = useCallback((achievement: AchievementType, winner?: 'p1' | 'p2') => {
    if (!achievement) return;
    setActiveAnimation(achievement);
    // Clear animation after 3 seconds (use ref so button can cancel)
    animationTimeoutRef.current = setTimeout(() => {
      animationTimeoutRef.current = null;
      setActiveAnimation(null);
      if (achievement === 'win' && winner) {
        setGameWinner(winner);
        setTimeout(() => { playSound('gameEnd'); setShowWinnerScreen(true); }, 300);
      }
    }, 3000);
  }, []);

  // Undo last dart
  const handleUndo = useCallback(() => {
    if (dartHistory.length === 0 || undosRemaining <= 0) return;
    const prevState = dartHistory[dartHistory.length - 1];
    setP1Score(prevState.p1Score);
    setP2Score(prevState.p2Score);
    setCurrentThrower(prevState.currentThrower);
    setCurrentDarts(prevState.currentDarts);
    setRoundScore(prevState.roundScore);
    setP1HasStarted(prevState.p1HasStarted);
    setP2HasStarted(prevState.p2HasStarted);
    setDartHistory(prev => prev.slice(0, -1));
    setUndosRemaining(prev => prev - 1);
  }, [dartHistory, undosRemaining]);

  // Intro animation timer - re-runs when showGoodLuck changes (e.g., Play Again)
  useEffect(() => {
    if (!showGoodLuck) return; // Only run when showGoodLuck is true
    const timer = setTimeout(() => {
      playSound('gameStart');
      setShowGoodLuck(false);
      setIntroComplete(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showGoodLuck]);

  // Double bull effect auto-hide
  useEffect(() => {
    if (!showDoubleBullEffect) return;
    const timer = setTimeout(() => {
      setShowDoubleBullEffect(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [showDoubleBullEffect, doubleBullEffectKey]);

  useEffect(() => {
    if (showPlayerChange) {
      clearLEDs();
      const timer = setTimeout(() => {
        if (currentThrower === 'p1') setP1ThrewThisRound(true);
        else setP2ThrewThisRound(true);
        if (isOhOneGame && !eightyPercentTriggered) {
          const playerScore = currentThrower === 'p1' ? p1Score : p2Score;
          if (playerScore <= eightyPercentThreshold) {
            setEightyPercentTriggered(true);
            const p1PPR = p1DartsThrown > 0 ? ((startScore - p1Score) / p1DartsThrown) * 3 : 0;
            const p2PPR = p2DartsThrown > 0 ? ((startScore - p2Score) / p2DartsThrown) * 3 : 0;
            setP1FrozenPPR(p1PPR);
            setP2FrozenPPR(p2PPR);
          }
        }
        const willCompleteRound = (currentThrower === 'p1' && p2ThrewThisRound) ||
                                   (currentThrower === 'p2' && p1ThrewThisRound);

        // Round 20 limit: If round 20 completes without a winner, determine by tiebreaker
        if (willCompleteRound && currentRound === 20 && !gameWinner) {
          let winner: 'p1' | 'p2';
          if (p1Score < p2Score) {
            // P1 has lower score (closer to 0) - P1 wins
            winner = 'p1';
          } else if (p2Score < p1Score) {
            // P2 has lower score (closer to 0) - P2 wins
            winner = 'p2';
          } else {
            // Scores tied - whoever reached that score first wins
            winner = p1ScoreReachedRound <= p2ScoreReachedRound ? 'p1' : 'p2';
          }
          setGameWinner(winner);
          setTimeout(() => { playSound('gameEnd'); setShowWinnerScreen(true); }, 500);
          return;
        }

        if (willCompleteRound) {
          if (currentRound + 1 === 20) playSound('lastRound');
          setRoundAnimState('out');
          setTimeout(() => {
            setCurrentRound(prev => prev + 1);
            setRoundKey(prev => prev + 1);
            setP1ThrewThisRound(false);
            setP2ThrewThisRound(false);
            setRoundAnimState('in');
          }, 500);
        }
        setShowPlayerChange(false);
        setCurrentThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setCurrentDarts([]);
        setRoundScore(0);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showPlayerChange, currentThrower, p1ThrewThisRound, p2ThrewThisRound, isOhOneGame, eightyPercentTriggered, p1Score, p2Score, eightyPercentThreshold, p1DartsThrown, p2DartsThrown, startScore, currentRound, gameWinner, p1ScoreReachedRound, p2ScoreReachedRound]);

  // Is it local player's turn?
  const p1Active = currentThrower === 'p1';
  const p2Active = currentThrower === 'p2';
  const isLocalTurn = (localIsP1 && p1Active) || (!localIsP1 && p2Active);

  const throwDart = useCallback((segment: string, score: number, multiplier: number, isLocal: boolean = true) => {
    if (currentDarts.length >= 3 || showPlayerChange || !introComplete) return;

    // First dart of this turn: remember the score at turn start so a bust
    // can roll the player back to this value (standard 01 behavior).
    if (currentDarts.length === 0) {
      if (currentThrower === 'p1') {
        p1TurnStartScoreRef.current = p1Score;
      } else {
        p2TurnStartScoreRef.current = p2Score;
      }
    }

    // Only allow throws from the current thrower
    const expectedLocal = (localIsP1 && currentThrower === 'p1') || (!localIsP1 && currentThrower === 'p2');
    if (isLocal !== expectedLocal) return;

    const hasStarted = currentThrower === 'p1' ? p1HasStarted : p2HasStarted;
    const setHasStarted = currentThrower === 'p1' ? setP1HasStarted : setP2HasStarted;
    const snapshot: DartSnapshot = {
      p1Score, p2Score, currentThrower, currentDarts: [...currentDarts], roundScore, p1HasStarted, p2HasStarted,
    };
    setDartHistory(prev => [...prev, snapshot]);
    const isDouble = multiplier === 2;
    const isTriple = multiplier === 3;
    const isSingleBull = segment === 'S25';
    const isDoubleBull = segment === 'D25';
    const isAnyBull = isSingleBull || isDoubleBull;
    const isValidIn = inMode === 'open' ||
                      (inMode === 'master' && (isDouble || isTriple || isAnyBull)) ||
                      (inMode === 'double' && isDouble);
    let effectiveScore = score;
    let playerStartsNow = false;
    if (!hasStarted) {
      if (isValidIn && score > 0) {
        playerStartsNow = true;
        effectiveScore = score;
      } else {
        effectiveScore = 0;
      }
    }
    const potentialNewScore = currentScore - effectiveScore;
    const isValidOut = outMode === 'open' ||
                       (outMode === 'master' && (isDouble || isTriple || isAnyBull)) ||
                       (outMode === 'double' && isDouble);
    const isBust = potentialNewScore < 0 ||
                   potentialNewScore === 1 ||
                   (potentialNewScore === 0 && !isValidOut);
    const newDart: DartThrow = { segment, score: effectiveScore, multiplier };
    const newDarts = [...currentDarts, newDart];
    const newRoundScore = roundScore + effectiveScore;
    playSound('dart');
    if (currentThrower === 'p1') setP1DartsThrown(prev => prev + 1);
    else setP2DartsThrown(prev => prev + 1);

    // Broadcast throw to opponent if local (actual send wired via useOnlineThrowSync)
    if (isLocal) {
      sendThrow({
        playerId: localPlayer.id,
        segment,
        score,
        multiplier,
      });
    }

    if (isBust) {
      // On bust, full turn is invalid: score should go back to what it was
      // at the **start of the turn**, not just before this last dart.
      if (currentThrower === 'p1') {
        setP1Score(p1TurnStartScoreRef.current);
      } else {
        setP2Score(p2TurnStartScoreRef.current);
      }

      setCurrentDarts(newDarts);
      playSound('bust');
      const achievement = detectAchievement(newDarts, newRoundScore, true, false);
      triggerAchievement(achievement);
      // Use timeout ref so button can cancel it
      playerChangeTimeoutRef.current = setTimeout(() => {
        playerChangeTimeoutRef.current = null;
        playSound('playerChange');
        setShowPlayerChange(true);
        // Broadcast turn end if local
        if (isLocal) {
          sendTurnEnd({ playerId: localPlayer.id });
        }
      }, 3000);
      return;
    }
    const didWin = potentialNewScore === 0;
    setCurrentDarts(newDarts);
    setRoundScore(newRoundScore);
    // Update score and track when this score was reached (for tiebreaker)
    if (currentThrower === 'p1') {
      if (potentialNewScore !== p1Score) {
        setP1Score(potentialNewScore);
        setP1ScoreReachedRound(currentRound);
      }
    } else {
      if (potentialNewScore !== p2Score) {
        setP2Score(potentialNewScore);
        setP2ScoreReachedRound(currentRound);
      }
    }
    if (playerStartsNow) setHasStarted(true);
    if (newDarts.length === 3 || didWin) {
      const achievement = detectAchievement(newDarts, newRoundScore, false, didWin);
      if (achievement) {
        if (didWin) { playSound('out'); playSound('win'); }
        else playSound('achievement');
        setShowDoubleBullEffect(false);
        const winner = didWin ? currentThrower : undefined;
        triggerAchievement(achievement, winner);
        if (!didWin) {
          // Use timeout ref so button can cancel it
          playerChangeTimeoutRef.current = setTimeout(() => {
            playerChangeTimeoutRef.current = null;
            playSound('playerChange');
            setShowPlayerChange(true);
            // Broadcast turn end if local
            if (isLocal) {
              sendTurnEnd({ playerId: localPlayer.id });
            }
          }, 3000);
        }
        return;
      }
    }
    // Trigger double bull effect if no achievement and segment is D25
    if (!didWin && segment === 'D25') {
      setShowDoubleBullEffect(true);
      setDoubleBullEffectKey(prev => prev + 1);
    }
    // Add delay before player change to let dart effects complete (button press skips this)
    if (newDarts.length === 3) {
      playerChangeTimeoutRef.current = setTimeout(() => {
        playerChangeTimeoutRef.current = null;
        playSound('playerChange');
        setShowPlayerChange(true);
        // Broadcast turn end if local
        if (isLocal) {
          sendTurnEnd({ playerId: localPlayer.id });
        }
      }, 3000);
    }
  }, [currentDarts, currentScore, currentThrower, roundScore, showPlayerChange, introComplete, p1Score, p2Score, p1HasStarted, p2HasStarted, inMode, outMode, detectAchievement, triggerAchievement, currentRound, localIsP1, localPlayer.id, sendThrow, sendTurnEnd]);

  // Keep ref in sync for broadcast handler
  const throwDartRef = useRef(throwDart);
  useEffect(() => { throwDartRef.current = throwDart; }, [throwDart]);

  // Shared realtime throw synchronization (Supabase channel)
  const { sendThrow, sendTurnEnd } = useOnlineThrowSync({
    channelName: `o1:${gameId}`,
    localPlayerId: localPlayer.id,
    onRemoteThrow: ({ segment, score = 0, multiplier }) => {
      throwDartRef.current(segment, score, multiplier, false);
    },
    onRemoteTurnEnd: () => {
      playSound('playerChange');
      setShowPlayerChange(true);
    },
  });

  const endTurnWithMisses = useCallback(() => {
    if (showPlayerChange || !introComplete || showWinnerScreen) return;
    // Only local player can end turn with misses
    const expectedLocal = (localIsP1 && currentThrower === 'p1') || (!localIsP1 && currentThrower === 'p2');
    if (!expectedLocal) return;
    playSound('missClick');
    // Clear any pending player change timeout (button press = instant change)
    if (playerChangeTimeoutRef.current) {
      clearTimeout(playerChangeTimeoutRef.current);
      playerChangeTimeoutRef.current = null;
    }
    // Clear any pending animation timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    // Clear any active animation (button skips it)
    if (activeAnimation) {
      setActiveAnimation(null);
    }
    const remaining = Math.max(0, 3 - currentDarts.length);
    if (remaining === 0) {
      playSound('playerChange');
      setShowPlayerChange(true);
    } else {
      const misses = Array.from({ length: remaining }, () => ({ segment: 'MISS', score: 0, multiplier: 0 }));
      setCurrentDarts([...currentDarts, ...misses]);
      if (currentThrower === 'p1') {
        setP1DartsThrown(prev => prev + remaining);
      } else {
        setP2DartsThrown(prev => prev + remaining);
      }
      playSound('playerChange');
      setShowPlayerChange(true);
    }
    // Broadcast turn end to opponent
    if (throwChannelRef.current) {
      throwChannelRef.current.send({
        type: 'broadcast',
        event: 'turn_end',
        payload: { playerId: localPlayer.id },
      });
    }
  }, [activeAnimation, currentDarts, currentThrower, introComplete, localIsP1, localPlayer.id, showPlayerChange, showWinnerScreen]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow) return;
    // Dedup check MUST come before isLocalTurn check to prevent stale throws
    // from re-processing when the turn switches
    if (lastThrow.timestamp === lastProcessedThrowRef.current) return;
    lastProcessedThrowRef.current = lastThrow.timestamp;
    if (!isLocalTurn) return;
    if (lastThrow.segmentType === 'BUTTON' || lastThrow.segment === 'BTN') {
      endTurnWithMisses();
      return;
    }
    let segment = lastThrow.segment;
    if (lastThrow.segmentType === 'BULL') segment = 'S25';
    else if (lastThrow.segmentType === 'DBL_BULL') segment = 'D25';

    // In Full Bull mode, single bull scores 50 (same as double bull)
    let score = lastThrow.score;
    if (!splitBull && segment === 'S25') {
      score = 50;
    }

    throwDart(segment, score, lastThrow.multiplier, true);
  }, [lastThrow, throwDart, endTurnWithMisses, splitBull, isLocalTurn]);

  // Dev mode throw simulator
  const handleDevSimulateThrow = useCallback(() => {
    if (!devMode) return;
    bleSimulateThrow();
  }, [devMode, bleSimulateThrow]);

  // Connect local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  // Connect remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    webrtcInit();
    return () => {
      webrtcDisconnect();
    };
  }, [webrtcInit, webrtcDisconnect]);

  // Prevent browser back button and refresh during game
  useEffect(() => {
    // Block back button by pushing state and handling popstate
    const blockBackButton = () => {
      window.history.pushState(null, '', window.location.href);
    };

    const handlePopState = () => {
      blockBackButton();
    };

    // Warn on refresh/close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    // Initialize
    blockBackButton();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Refresh video handler
  const handleRefreshVideo = useCallback(async () => {
    await webrtcDisconnect();
    await webrtcInit();
  }, [webrtcDisconnect, webrtcInit]);

  const formatDart = (segment: string) => {
    if (segment === 'MISS') return 'MISS';
    if (segment === 'D25') return 'DBULL';
    if (segment === 'S25') return 'BULL';
    return segment;
  };

  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';

  // Track previous thrower for exit animations
  const [prevThrower, setPrevThrower] = useState<'p1' | 'p2' | null>(null);
  const [turnKey, setTurnKey] = useState(0);
  const [hasHadTurnSwitch, setHasHadTurnSwitch] = useState(false);

  useEffect(() => {
    if (introComplete) {
      if (turnKey > 0) {
        setPrevThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setHasHadTurnSwitch(true);
      }
      setTurnKey(prev => prev + 1);
    }
  }, [currentThrower, introComplete]);

  const p1Exiting = hasHadTurnSwitch && prevThrower === 'p1' && !p1Active;
  const p2Exiting = hasHadTurnSwitch && prevThrower === 'p2' && !p2Active;
  const scale = `calc(100vw / ${FIGMA.frame.w})`;

  useEffect(() => {
    const inOut = (gameConfig?.format?.inOut || null) as GameInOut | null;
    if (!inOut) return;
    if (inOut === 'mimo') {
      setInMode('master');
      setOutMode('master');
    } else if (inOut === 'dido') {
      setInMode('double');
      setOutMode('double');
    } else if (inOut === 'mo') {
      setInMode('open');
      setOutMode('master');
    } else if (inOut === 'do') {
      setInMode('open');
      setOutMode('double');
    }
  }, [gameConfig?.format?.inOut]);

  useEffect(() => {
    if (!gameConfig?.format?.bull) return;
    setSplitBull(gameConfig.format.bull === 'split');
  }, [gameConfig?.format?.bull]);

  useEffect(() => {
    if (outMode === 'open') {
      setOutMode('master');
    }
  }, [outMode]);

  useEffect(() => {
    if (inMode === 'double' || outMode === 'double') {
      setSplitBull(true);
    }
  }, [inMode, outMode]);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: '#000000',
      overflow: 'hidden',
    }}>
      <style>{goodLuckKeyframes}</style>

      {/* Background image */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: "url('/assets/gamescreenbackground.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Full-screen opponent disconnected overlay: 60s timer, Leave or wait */}
      {disconnectCountdown !== null && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 400,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: FONT_NAME,
        }}>
          <div style={{
            maxWidth: 360,
            width: '100%',
            background: 'rgba(24, 24, 27, 0.95)',
            border: `3px solid ${localPlayer.accentColor}`,
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 14px ${hexToRgba(localPlayer.accentColor, 0.35)}`,
          }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
              Opponent disconnected
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>
              They have 60 seconds to rejoin. If the timer reaches 0 you'll be returned to the lobby.
            </p>
            <div style={{ color: localPlayer.accentColor, fontSize: 48, fontWeight: 'bold', marginBottom: 20 }}>
              {disconnectCountdown}s
            </div>
            <button
              type="button"
              onClick={async () => {
                await leaveMatch();
                onLeaveMatch?.();
              }}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 8,
                border: 'none',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 16,
                cursor: 'pointer',
                backgroundColor: localPlayer.accentColor,
                boxShadow: `0 0 14px ${hexToRgba(localPlayer.accentColor, 0.4)}`,
              }}
            >
              Leave match
            </button>
            <p style={{ color: '#71717a', fontSize: 12, marginTop: 12 }}>
              Or wait for them to rejoin before the timer ends.
            </p>
          </div>
        </div>
      )}

      {/* Background - Split Screen Video Feeds */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
      }}>
        {/* P1 Camera - Left Half (starting player, same for both views) */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: '#000',
          borderRight: `2px solid ${p1Active ? p1.accentColor : 'rgba(255, 255, 255, 0.2)'}`,
          transition: 'border-color 0.3s ease-out',
        }}>
          <video
            ref={localIsP1 ? localVideoRef : remoteVideoRef}
            autoPlay
            muted={localIsP1}
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'none',
              display: (localIsP1 ? localStream : remoteStream) ? 'block' : 'none',
            }}
          />
          {!(localIsP1 ? localStream : remoteStream) && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_NAME,
              fontSize: `calc(24 * ${scale})`,
              color: 'rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none',
            }}>
              {p1.name}
            </div>
          )}
          {p1Active && (
            <div style={{
              position: 'absolute',
              inset: 0,
              boxShadow: `inset 0 0 80px ${withAlpha(p1.accentColor, 0.25)}`,
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* P2 Camera - Right Half (second player, same for both views) */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: '#000',
          borderLeft: `2px solid ${p2Active ? p2.accentColor : 'rgba(255, 255, 255, 0.2)'}`,
          transition: 'border-color 0.3s ease-out',
        }}>
          <video
            ref={localIsP1 ? remoteVideoRef : localVideoRef}
            autoPlay
            muted={!localIsP1}
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'none',
              display: (localIsP1 ? remoteStream : localStream) ? 'block' : 'none',
            }}
          />
          {!(localIsP1 ? remoteStream : localStream) && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_NAME,
              fontSize: `calc(24 * ${scale})`,
              color: 'rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none',
            }}>
              {p2.name}
            </div>
          )}
          {p2Active && (
            <div style={{
              position: 'absolute',
              inset: 0,
              boxShadow: `inset 0 0 80px ${withAlpha(p2.accentColor, 0.25)}`,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>

      {/* Dark overlay for better UI visibility */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
      }} />

      {/* Double bull hit effect */}
      {showDoubleBullEffect && (
        <video
          key={doubleBullEffectKey}
          src="/hiteffects/blue&orange/dbull.mp4"
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 1,
            zIndex: 120,
            pointerEvents: 'none',
            animation: 'doubleBullFade 2s ease-out forwards',
          }}
        />
      )}

      {/* Match Format / Checkout Display - Top Center */}
      {(() => {
        const dartsRemaining = Math.max(0, 3 - currentDarts.length);
        const checkoutSuggestion = getCheckoutSuggestion(currentScore, {
          outMode,
          splitBull,
          dartsRemaining,
        });
        const showCheckout = !!checkoutSuggestion;
        const formatLabel =
          inMode === 'double' && outMode === 'double' ? 'DOUBLE IN/OUT' :
          inMode === 'double' && outMode === 'open' ? 'DOUBLE IN' :
          inMode === 'open' && outMode === 'double' ? 'DOUBLE OUT' :
          inMode === 'master' && outMode === 'master' ? 'MASTER IN/OUT' :
          inMode === 'master' && outMode === 'open' ? 'MASTER IN' :
          inMode === 'open' && outMode === 'master' ? 'MASTER OUT' :
          'OPEN';
        const bullLabel = splitBull ? 'SPLIT' : 'FULL';
        return (
        <div style={{
          position: 'absolute',
          top: `calc(20 * ${scale})`,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `calc(4 * ${scale})`,
          padding: `calc(8 * ${scale}) calc(16 * ${scale})`,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: `calc(8 * ${scale})`,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 50,
        }}>
          {showCheckout ? (
            <>
              <div style={{
                fontFamily: FONT_NAME,
                fontWeight: 700,
                fontSize: `calc(28 * ${scale})`,
                color: '#FFFFFF',
                textShadow: '-2px 2px 4px rgba(0, 0, 0, 0.5)',
              }}>
                {checkoutSuggestion}
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: `calc(12 * ${scale})`,
                color: 'rgba(255, 255, 255, 0.5)',
              }}>
                {outMode === 'master' ? 'MASTER OUT' : 'CHECKOUT'}
              </div>
            </>
          ) : (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: `calc(8 * ${scale})`,
                fontFamily: FONT_NAME,
                fontSize: `calc(16 * ${scale})`,
                color: 'rgba(255, 255, 255, 0.5)',
              }}>
                <span>{formatLabel} | {bullLabel}</span>
              </div>
            </>
          )}
        </div>
        );
      })()}

      {/* Center score */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '40%',
        transform: 'translate(-50%, -50%)',
        fontFamily: FONT_SCORE,
        fontWeight: 300,
        fontSize: `calc(320 * ${scale})`,
        lineHeight: 1,
        color: '#FFFFFF',
        textShadow: '-6px 6px 9.7px rgba(0, 0, 0, 0.78)',
        zIndex: 10,
      }}>
        {currentThrower === 'p1' ? p1Score : p2Score}
      </div>

      {/* GOOD LUCK! Animation */}
      {showGoodLuck && (
        <>
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            height: `calc(260 * ${scale})`,
            width: '40%',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 99,
            animation: 'goodLuckBgSlide 4s ease-in-out forwards',
          }} />
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translate(0, -50%)',
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(200 * ${scale})`,
            lineHeight: 1,
            color: '#FFFFFF',
            textShadow: '-6px 6px 9.7px rgba(0, 0, 0, 0.78)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            animation: 'goodLuckSlide 4s ease-in-out forwards',
          }}>
            GOOD LUCK!
          </div>
        </>
      )}

      {/* Round Indicator */}
      {introComplete && (
        <div
          key={`round-${roundKey}`}
          style={{
            position: 'absolute',
            top: `calc(80 * ${scale})`,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            zIndex: 50,
            animation: roundAnimState === 'out'
              ? 'slideOutToLeft 0.5s ease-in forwards'
              : roundAnimState === 'in'
                ? 'slideInFromLeft 0.5s ease-out forwards'
                : 'none',
          }}
        >
          <div style={{
            padding: `calc(12 * ${scale}) calc(24 * ${scale})`,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: `0 calc(8 * ${scale}) calc(8 * ${scale}) 0`,
          }}>
            <span style={{
              fontFamily: FONT_SCORE,
              fontWeight: 300,
              fontSize: `calc(48 * ${scale})`,
              lineHeight: 1,
              color: '#FFFFFF',
              textShadow: '-3px 3px 5px rgba(0, 0, 0, 0.78)',
              whiteSpace: 'nowrap',
            }}>
              ROUND {ROUND_WORDS[currentRound - 1] || currentRound}
            </span>
          </div>
        </div>
      )}

      {/* Darts above active player */}
      {currentDarts.length > 0 && introComplete && (
        <>
          {currentDarts.map((dart, i) => {
            const thirdCenters = [85.5, 256.5, 427.5];
            const centerPos = thirdCenters[i];
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  bottom: `calc(${FIGMA.bar.h - 4} * ${scale})`,
                  ...(p1Active
                    ? { left: `calc(${centerPos} * ${scale})`, transform: 'translateX(-50%)' }
                    : { right: `calc(${centerPos} * ${scale})`, transform: 'translateX(50%)' }
                  ),
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontFamily: FONT_NAME,
                  fontWeight: 500,
                  fontSize: `calc(28 * ${scale})`,
                  color: '#FFFFFF',
                }}>
                  {formatDart(dart.segment)}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Player 1 Bar - Left */}
      <div style={{
        position: 'absolute',
        width: `calc(${FIGMA.bar.w} * ${scale})`,
        height: `calc(${FIGMA.bar.h} * ${scale})`,
        left: '0px',
        bottom: '0px',
        borderTopRightRadius: `calc(16 * ${scale})`,
        overflow: 'hidden',
        borderTop: `2px solid ${introComplete && p1Active ? p1.accentColor : INACTIVE}`,
        borderRight: `2px solid ${introComplete && p1Active ? p1.accentColor : INACTIVE}`,
        transition: 'border-color 0.3s ease',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {introComplete && p1Active && (
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: p1.accentColor, transition: 'width 0.2s ease-out', zIndex: 5,
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-progress-exit-${turnKey}`} style={{
            position: 'absolute', top: 0, left: 0, height: '3px', width: '100%',
            background: p1.accentColor, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p1Active && (
          <div key={`p1-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(p1.accentColor, 0.25)} 0%, ${withAlpha(p1.accentColor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-bar-exit-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(p1.accentColor, 0.25)} 0%, ${withAlpha(p1.accentColor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          backgroundImage: resolveProfilePicUrl(p1.profilePic) ? `url(${resolveProfilePicUrl(p1.profilePic)})` : 'none',
          backgroundColor: '#000000',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && p1Active && (
          <div key={`p1-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p1.profilePic) ? `url(${resolveProfilePicUrl(p1.profilePic)})` : 'none',
            backgroundColor: '#000000',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: `2px solid ${p1.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-avatar-exit-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p1.profilePic) ? `url(${resolveProfilePicUrl(p1.profilePic)})` : 'none',
            backgroundColor: '#000000',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: `2px solid ${p1.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        <div style={{
          position: 'absolute', left: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p1Active ? '#FFFFFF' : INACTIVE,
          }}>
            {p1.name}
          </span>
          {introComplete && isOhOneGame && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p1Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              PPR: {p1DisplayPPR.toFixed(1)}{eightyPercentTriggered ? ' (80%)' : ''}
            </span>
          )}
        </div>
        <span style={{
          position: 'absolute', left: `calc(${FIGMA.scoreLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, color: p1Active ? '#FFFFFF' : INACTIVE,
          textShadow: p1Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p1Score}
        </span>
      </div>

      {/* Player 2 Bar - Right */}
      <div style={{
        position: 'absolute',
        width: `calc(${FIGMA.bar.w} * ${scale})`,
        height: `calc(${FIGMA.bar.h} * ${scale})`,
        right: '0px',
        bottom: '0px',
        borderTopLeftRadius: `calc(16 * ${scale})`,
        overflow: 'hidden',
        borderTop: `2px solid ${introComplete && p2Active ? p2.accentColor : INACTIVE}`,
        borderLeft: `2px solid ${introComplete && p2Active ? p2.accentColor : INACTIVE}`,
        transition: 'border-color 0.3s ease',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {introComplete && p2Active && (
          <div style={{
            position: 'absolute', top: 0, right: 0, height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: p2.accentColor, transition: 'width 0.2s ease-out', zIndex: 5,
          }} />
        )}
        {introComplete && p2Exiting && (
          <div key={`p2-progress-exit-${turnKey}`} style={{
            position: 'absolute', top: 0, right: 0, height: '3px', width: '100%',
            background: p2.accentColor, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p2Active && (
          <div key={`p2-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(p2.accentColor, 0.25)} 0%, ${withAlpha(p2.accentColor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p2Exiting && (
          <div key={`p2-bar-exit-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(p2.accentColor, 0.25)} 0%, ${withAlpha(p2.accentColor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        <span style={{
          position: 'absolute', left: `calc(20 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, color: p2Active ? '#FFFFFF' : INACTIVE,
          textShadow: p2Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p2Score}
        </span>
        <div style={{
          position: 'absolute', right: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p2Active ? '#FFFFFF' : INACTIVE,
          }}>
            {p2.name}
          </span>
          {introComplete && isOhOneGame && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p2Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              PPR: {p2DisplayPPR.toFixed(1)}{eightyPercentTriggered ? ' (80%)' : ''}
            </span>
          )}
        </div>
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          backgroundImage: resolveProfilePicUrl(p2.profilePic) ? `url(${resolveProfilePicUrl(p2.profilePic)})` : 'none',
          backgroundColor: '#000000',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && p2Active && (
          <div key={`p2-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p2.profilePic) ? `url(${resolveProfilePicUrl(p2.profilePic)})` : 'none',
            backgroundColor: '#000000',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: `2px solid ${p2.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && p2Exiting && (
          <div key={`p2-avatar-exit-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p2.profilePic) ? `url(${resolveProfilePicUrl(p2.profilePic)})` : 'none',
            backgroundColor: '#000000',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: `2px solid ${p2.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
      </div>

      {/* BLE Status - Top Left */}
      <button
        onClick={async () => {
          if (isConnected) {
            await bleDisconnect();
          } else {
            await bleConnect();
          }
        }}
        disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
        style={{
          position: 'absolute',
          top: `calc(20 * ${scale})`,
          left: `calc(20 * ${scale})`,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: `calc(6 * ${scale})`,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: 'none',
          borderRadius: `calc(8 * ${scale})`,
          padding: `calc(8 * ${scale}) calc(12 * ${scale})`,
          cursor: bleStatus === 'connecting' || bleStatus === 'scanning' ? 'default' : 'pointer',
        }}
      >
        <Bluetooth
          size={16}
          style={{
            color: isConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444',
          }}
        />
        <span style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: `calc(12 * ${scale})`,
          color: isConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444',
        }}>
          {isConnected ? 'Connected' : bleStatus === 'connecting' ? 'Connecting...' : bleStatus === 'scanning' ? 'Scanning...' : 'Disconnected'}
        </span>
      </button>

      {/* Hamburger Menu */}
      <div style={{ position: 'absolute', top: `calc(20 * ${scale})`, right: `calc(20 * ${scale})`, zIndex: 100 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: `calc(44 * ${scale})`, height: `calc(44 * ${scale})`,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            gap: `calc(6 * ${scale})`, padding: `calc(8 * ${scale})`,
          }}
        >
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: `calc(50 * ${scale})`, right: 0,
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)', borderRadius: `calc(8 * ${scale})`,
            border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden', minWidth: `calc(160 * ${scale})`,
          }}>
            {devMode && (
              <button
                onClick={() => { handleDevSimulateThrow(); setMenuOpen(false); }}
                style={{
                  width: '100%', padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                  background: 'transparent', border: 'none', color: '#FFA500',
                  fontFamily: FONT_NAME, fontSize: `calc(18 * ${scale})`, fontWeight: 500,
                  textAlign: 'left', cursor: 'pointer',
                }}
              >
                🎯 Simulate Throw
              </button>
            )}
            <button
              onClick={() => { handleRefreshVideo(); setMenuOpen(false); }}
              style={{
                width: '100%', padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent', border: 'none',
                borderTop: devMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                color: '#FFFFFF',
                fontFamily: FONT_NAME, fontSize: `calc(18 * ${scale})`, fontWeight: 500,
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              Refresh Video
            </button>
            <button
              onClick={() => { handleUndo(); setMenuOpen(false); }}
              disabled={dartHistory.length === 0 || undosRemaining <= 0}
              style={{
                width: '100%', padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent', border: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                color: (dartHistory.length === 0 || undosRemaining <= 0) ? '#555' : '#FFFFFF',
                fontFamily: FONT_NAME, fontSize: `calc(18 * ${scale})`, fontWeight: 500,
                textAlign: 'left', cursor: (dartHistory.length === 0 || undosRemaining <= 0) ? 'not-allowed' : 'pointer',
                opacity: (dartHistory.length === 0 || undosRemaining <= 0) ? 0.5 : 1,
              }}
            >
              Undo Dart ({undosRemaining} left)
            </button>
            <button
              onClick={async () => { setMenuOpen(false); await leaveMatch(); onLeaveMatch?.(); }}
              style={{
                width: '100%', padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent', border: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF4444',
                fontFamily: FONT_NAME, fontSize: `calc(18 * ${scale})`, fontWeight: 500,
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              Leave Game
            </button>
          </div>
        )}
      </div>

      {/* Achievement Animation Overlay */}
      {activeAnimation && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, pointerEvents: 'none',
        }}>
          {/* Award video - full screen, plays for full 3 seconds */}
          {AWARD_VIDEOS[activeAnimation] && (
            <video
              key={activeAnimation}
              src={AWARD_VIDEOS[activeAnimation]}
              autoPlay
              muted
              playsInline
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 201,
                animation: 'achievementFadeIn 7s ease-out forwards',
              }}
            />
          )}
          {/* Backdrop glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle, ${(currentThrower === 'p1' ? p1.accentColor : p2.accentColor)}33 0%, transparent 70%)`,
            animation: 'achievementFadeIn 7s ease-out forwards',
          }} />
          {/* Achievement text - only show if no video */}
          {!AWARD_VIDEOS[activeAnimation] && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(120 * ${scale})`, lineHeight: 1,
              color: (currentThrower === 'p1' ? p1.accentColor : p2.accentColor),
              textShadow: `0 0 30px ${(currentThrower === 'p1' ? p1.accentColor : p2.accentColor)}, 0 0 60px ${(currentThrower === 'p1' ? p1.accentColor : p2.accentColor)}, -4px 4px 8px rgba(0, 0, 0, 0.8)`,
              whiteSpace: 'nowrap',
              animation: 'achievementPulse 7s ease-out forwards, achievementGlow 0.5s ease-in-out infinite',
            }}>
              {ACHIEVEMENT_LABELS[activeAnimation]}
            </div>
          )}
        </div>
      )}

      {/* Winners Screen Overlay */}
      {showWinnerScreen && gameWinner && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 300,
          background: 'rgba(0, 0, 0, 0.9)', animation: 'winnerFadeIn 0.5s ease-out forwards',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at center, ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}40 0%, transparent 60%)`,
          }} />
          <div style={{
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(60 * ${scale})`, lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.6)', letterSpacing: `calc(20 * ${scale})`,
            marginBottom: `calc(20 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.2s', opacity: 0,
          }}>
            GAME WINNER
          </div>
          <div style={{
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(160 * ${scale})`, lineHeight: 1,
            color: (gameWinner === 'p1' ? p1.accentColor : p2.accentColor),
            textShadow: `0 0 40px ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}, 0 0 80px ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}, -6px 6px 12px rgba(0, 0, 0, 0.8)`,
            animation: 'winnerNameSlide 0.8s ease-out forwards', animationDelay: '0.4s', opacity: 0,
          }}>
            {(gameWinner === 'p1' ? p1.name : p2.name)}
          </div>
          <div style={{
            fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, color: 'rgba(255, 255, 255, 0.5)',
            marginTop: `calc(30 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.6s', opacity: 0,
          }}>
            Final: {gameWinner === 'p1' ? p1Score : p2Score} - {gameWinner === 'p1' ? p2Score : p1Score}
          </div>
          <div style={{
            display: 'flex', gap: `calc(20 * ${scale})`, marginTop: `calc(60 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.8s', opacity: 0,
          }}>
            {onGameComplete ? (
              <button
                onClick={() => {
                  setShowWinnerScreen(false);
                  setGameWinner(null);
                  onGameComplete(gameWinner);
                }}
                style={{
                  padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                  fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                  color: '#FFFFFF', background: (gameWinner === 'p1' ? p1.accentColor : p2.accentColor),
                  border: 'none', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                  boxShadow: `0 0 30px ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}80`,
                }}
              >
                Continue
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setShowWinnerScreen(false);
                    setGameWinner(null);
                    setP1Score(startScore);
                    setP2Score(startScore);
                    setCurrentDarts([]);
                    setRoundScore(0);
                    setCurrentRound(1);
                    setP1ThrewThisRound(false);
                    setP2ThrewThisRound(false);
                    setP1HasStarted(false);
                    setP2HasStarted(false);
                    setDartHistory([]);
                    setUndosRemaining(3);
                    setCurrentThrower('p1');
                    setShowGoodLuck(true);
                    setIntroComplete(false);
                    setP1DartsThrown(0);
                    setP2DartsThrown(0);
                    setEightyPercentTriggered(false);
                    setP1FrozenPPR(null);
                    setP2FrozenPPR(null);
                  }}
                  style={{
                    padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                    fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                    color: '#FFFFFF', background: (gameWinner === 'p1' ? p1.accentColor : p2.accentColor),
                    border: 'none', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                    boxShadow: `0 0 30px ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}80`,
                  }}
                >
                  Rematch
                </button>
                <button
                  onClick={() => { setShowWinnerScreen(false); setGameWinner(null); }}
                  style={{
                    padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                    fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.7)', background: 'transparent',
                    border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                  }}
                >
                  Exit to Lobby
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default O1OnlineGameScreen;
