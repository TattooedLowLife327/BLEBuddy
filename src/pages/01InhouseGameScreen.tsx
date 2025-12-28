import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { isDevMode } from '../utils/devMode';
import { getCheckoutSuggestion } from '../utils/checkoutSolver';
import type { DartThrowData } from '../utils/ble/bleConnection';

interface DartThrow {
  segment: string;
  score: number;
  multiplier: number;
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

// Figma exact colors
const P1_ACTIVE = '#6600FF';
const P2_ACTIVE = '#FB00FF';
const INACTIVE = '#7E7E7E';

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

const PLAYERS = {
  p1: { id: 'p1', name: 'PLAYER1', profilecolor: '#6600FF' },
  p2: { id: 'p2', name: 'PLAYER2', profilecolor: '#FB00FF' },
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
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 0;
  }
  20% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  80% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
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
`;

interface GameScreenProps {
  onLeaveMatch?: () => void;
  backgroundImage?: string;
  gameType?: string;
  startingPlayer?: 'p1' | 'p2';
  onGameComplete?: (winner: 'p1' | 'p2') => void;
}

export function O1InhouseGameScreen({
  onLeaveMatch,
  backgroundImage = '/assets/gamescreenbackground.png',
  gameType,
  startingPlayer,
  onGameComplete,
}: GameScreenProps) {
  // BLE integration
  const { lastThrow, isConnected, simulateThrow: bleSimulateThrow } = useBLE();
  const devMode = isDevMode();
  const lastProcessedThrowRef = useRef<string | null>(null);

  const resolvedGameType = useMemo(() => {
    const raw = gameType || '501';
    const normalized = typeof raw === 'string' ? raw.toUpperCase() : '501';
    return normalized === '301' ? '301' : '501';
  }, [gameType]);

  const startScore = resolvedGameType === '301' ? 301 : 501;

  const [p1Score, setP1Score] = useState(startScore);
  const [p2Score, setP2Score] = useState(startScore);
  const [currentThrower, setCurrentThrower] = useState<'p1' | 'p2'>(() => startingPlayer || 'p1');
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

  // 80% Stat Tracking
  // For 01: PPR = (startScore - currentScore) / dartsThrown
  // For Cricket: MPR = totalMarks / rounds
  const [p1DartsThrown, setP1DartsThrown] = useState(0);
  const [p2DartsThrown, setP2DartsThrown] = useState(0);
  const [eightyPercentTriggered, setEightyPercentTriggered] = useState(false); // Has 80% been reached?
  const [p1FrozenPPR, setP1FrozenPPR] = useState<number | null>(null); // Frozen PPR at 80%
  const [p2FrozenPPR, setP2FrozenPPR] = useState<number | null>(null);

  // Track if each player has "started" (hit their first valid in for DI/MIMO modes)
  const [p1HasStarted, setP1HasStarted] = useState(false);
  const [p2HasStarted, setP2HasStarted] = useState(false);

  // Game settings: Separate IN and OUT modes (any combo allowed)
  // Open = any dart, Master = double/triple/any bull, Double = outer double or D25 only
  const [inMode] = useState<'open' | 'master' | 'double'>('open'); // Demo: Open In
  const [outMode, setOutMode] = useState<'open' | 'master' | 'double'>('master'); // Demo: Master Out
  const [splitBull, setSplitBull] = useState(false); // Demo: Full Bull (50/50)

  const currentScore = currentThrower === 'p1' ? p1Score : p2Score;

  const isOhOneGame = true;
  const isCricketGame = false;

  // 80% threshold: points remaining when stats should freeze
  // 301: <=50 remaining (scored >=251)
  // 501: <=100 remaining (scored >=401)
  const eightyPercentThreshold = startScore === 501 ? 100 : 50;

  // Calculate live PPR for each player (Points Per Round = points scored / darts thrown * 3)
  // PPR = (startScore - currentScore) / dartsThrown * 3
  const p1LivePPR = p1DartsThrown > 0 ? ((startScore - p1Score) / p1DartsThrown) * 3 : 0;
  const p2LivePPR = p2DartsThrown > 0 ? ((startScore - p2Score) / p2DartsThrown) * 3 : 0;

  // Display PPR: use frozen value if 80% triggered, otherwise live
  const p1DisplayPPR = eightyPercentTriggered && p1FrozenPPR !== null ? p1FrozenPPR : p1LivePPR;
  const p2DisplayPPR = eightyPercentTriggered && p2FrozenPPR !== null ? p2FrozenPPR : p2LivePPR;

  // Detect achievements based on the 3 darts thrown
  // Priority: win > ton80 > threeInBlack > shanghai > whiteHorse > hatTrick > threeInBed > highTon > lowTon > bust
  const detectAchievement = useCallback((darts: DartThrow[], totalScore: number, didBust: boolean, didWin: boolean): AchievementType => {
    if (darts.length !== 3) return didBust ? 'bust' : didWin ? 'win' : null;

    // Bust blocks positive achievements
    if (didBust) return 'bust';

    // Win takes precedence
    if (didWin) return 'win';

    // Extract dart info
    const segments = darts.map(d => d.segment);

    // Ton 80: T20 T20 T20 (exactly 180)
    if (segments.every(s => s === 'T20')) return 'ton80';

    // 3 in the Black: D25 D25 D25 (3 double bulls)
    if (segments.every(s => s === 'D25')) return 'threeInBlack';

    // Shanghai (01 only): Same number with S + D + T (e.g., S20 D20 T20)
    if (isOhOneGame) {
      // Extract base numbers from segments
      const getBaseNumber = (seg: string): number | null => {
        if (seg === 'S25' || seg === 'D25' || seg === 'MISS') return null;
        const match = seg.match(/[SDT](\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };
      const baseNumbers = segments.map(getBaseNumber);
      // All same number and we have S, D, T of it
      if (baseNumbers.every(n => n !== null && n === baseNumbers[0])) {
        const prefixes = segments.map(s => s[0]);
        if (prefixes.includes('S') && prefixes.includes('D') && prefixes.includes('T')) {
          return 'shanghai';
        }
      }
    }

    // White Horse (Cricket only): 3 DIFFERENT triples
    if (isCricketGame) {
      const triples = segments.filter(s => s.startsWith('T'));
      if (triples.length === 3) {
        const uniqueTriples = new Set(triples);
        if (uniqueTriples.size === 3) return 'whiteHorse';
      }
    }

    // Hat Trick: 3 bulls (any combo of S25/D25)
    const bullCount = segments.filter(s => s === 'S25' || s === 'D25').length;
    if (bullCount === 3) return 'hatTrick';

    // 3 in a Bed: 3 in same triple space
    // For 01: any triple
    // For Cricket: must be cricket numbers (20, 19, 18, 17, 16, 15)
    const triples = segments.filter(s => s.startsWith('T'));
    if (triples.length === 3 && triples[0] === triples[1] && triples[1] === triples[2]) {
      if (isOhOneGame) {
        return 'threeInBed';
      } else if (isCricketGame) {
        const cricketNumbers = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15'];
        if (cricketNumbers.includes(triples[0])) {
          return 'threeInBed';
        }
      }
    }

    // High Ton: 150+ in a round
    if (totalScore >= 150) return 'highTon';

    // Low Ton: 100-149 in a round
    if (totalScore >= 100) return 'lowTon';

    // Bust (if nothing else)
    if (didBust) return 'bust';

    return null;
  }, [isOhOneGame, isCricketGame]);

  // Trigger achievement animation
  const triggerAchievement = useCallback((achievement: AchievementType, winner?: 'p1' | 'p2') => {
    if (!achievement) return;
    setActiveAnimation(achievement);
    // Clear animation after it completes
    setTimeout(() => {
      setActiveAnimation(null);
      // If it was a win, show the winners screen after animation
      if (achievement === 'win' && winner) {
        setGameWinner(winner);
        // Small delay before showing winners screen for dramatic effect
        setTimeout(() => setShowWinnerScreen(true), 300);
      }
    }, 2000);
  }, []);

  // Undo last dart (max 3 per game)
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

  // Intro animation timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGoodLuck(false);
      setIntroComplete(true);
    }, 4000); // Animation duration
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showPlayerChange) {
      const timer = setTimeout(() => {
        // Track who threw this round
        if (currentThrower === 'p1') {
          setP1ThrewThisRound(true);
        } else {
          setP2ThrewThisRound(true);
        }

        // 80% Stat Check: At end of player's turn, check if they crossed threshold
        // If ANY player reaches 80%, freeze BOTH players' stats immediately
        if (isOhOneGame && !eightyPercentTriggered) {
          const playerScore = currentThrower === 'p1' ? p1Score : p2Score;
          if (playerScore <= eightyPercentThreshold) {
            // First player to reach 80% - freeze both stats
            setEightyPercentTriggered(true);
            // Calculate and freeze PPR for both players at this moment
            const p1PPR = p1DartsThrown > 0 ? ((startScore - p1Score) / p1DartsThrown) * 3 : 0;
            const p2PPR = p2DartsThrown > 0 ? ((startScore - p2Score) / p2DartsThrown) * 3 : 0;
            setP1FrozenPPR(p1PPR);
            setP2FrozenPPR(p2PPR);
          }
        }

        // Check if round is complete (both players threw)
        const willCompleteRound = (currentThrower === 'p1' && p2ThrewThisRound) ||
                                   (currentThrower === 'p2' && p1ThrewThisRound);

        if (willCompleteRound) {
          // Start round exit animation
          setRoundAnimState('out');
          setTimeout(() => {
            setCurrentRound(prev => prev + 1);
            setRoundKey(prev => prev + 1);
            setP1ThrewThisRound(false);
            setP2ThrewThisRound(false);
            setRoundAnimState('in');
          }, 500); // Wait for exit animation
        }

        setShowPlayerChange(false);
        setCurrentThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setCurrentDarts([]);
        setRoundScore(0);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showPlayerChange, currentThrower, p1ThrewThisRound, p2ThrewThisRound, isOhOneGame, eightyPercentTriggered, p1Score, p2Score, eightyPercentThreshold, p1DartsThrown, p2DartsThrown, startScore]);

  const throwDart = useCallback((segment: string, score: number, multiplier: number) => {
    if (currentDarts.length >= 3 || showPlayerChange || !introComplete) return;

    const hasStarted = currentThrower === 'p1' ? p1HasStarted : p2HasStarted;
    const setHasStarted = currentThrower === 'p1' ? setP1HasStarted : setP2HasStarted;

    // Save snapshot BEFORE this dart (for undo)
    const snapshot: DartSnapshot = {
      p1Score,
      p2Score,
      currentThrower,
      currentDarts: [...currentDarts],
      roundScore,
      p1HasStarted,
      p2HasStarted,
    };
    setDartHistory(prev => [...prev, snapshot]);

    // Check dart types
    const isDouble = multiplier === 2; // Outer ring doubles AND D25 (double bull)
    const isTriple = multiplier === 3;
    const isSingleBull = segment === 'S25';
    const isDoubleBull = segment === 'D25';
    const isAnyBull = isSingleBull || isDoubleBull;

    // Valid IN check based on inMode:
    // - open: any dart
    // - master: double, triple, or any bull (S25/D25)
    // - double: outer ring double OR double bull (D25) only - NOT single bull
    const isValidIn = inMode === 'open' ||
                      (inMode === 'master' && (isDouble || isTriple || isAnyBull)) ||
                      (inMode === 'double' && isDouble); // D25 is multiplier 2, so isDouble covers it

    // If player hasn't started and this isn't a valid in, dart counts but scores 0
    let effectiveScore = score;
    let playerStartsNow = false;

    if (!hasStarted) {
      if (isValidIn && score > 0) {
        // Player starts with this dart
        playerStartsNow = true;
        effectiveScore = score;
      } else {
        // Dart thrown but doesn't count toward score
        effectiveScore = 0;
      }
    }

    // Valid OUT check based on outMode:
    // - open: any dart that makes score exactly 0
    // - master: double, triple, or any bull AND makes score exactly 0
    // - double: outer ring double OR double bull (D25) AND makes score exactly 0
    const potentialNewScore = currentScore - effectiveScore;
    const isValidOut = outMode === 'open' ||
                       (outMode === 'master' && (isDouble || isTriple || isAnyBull)) ||
                       (outMode === 'double' && isDouble); // D25 is multiplier 2

    // Bust conditions:
    // 1. Score goes below 0
    // 2. Score lands on exactly 1 (can't finish with 1 remaining)
    // 3. Score lands on 0 but the dart wasn't a valid out
    const isBust = potentialNewScore < 0 ||
                   potentialNewScore === 1 ||
                   (potentialNewScore === 0 && !isValidOut);

    const newDart: DartThrow = { segment, score: effectiveScore, multiplier };
    const newDarts = [...currentDarts, newDart];
    const newRoundScore = roundScore + effectiveScore;

    // Track darts thrown for PPR calculation
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + 1);
    } else {
      setP2DartsThrown(prev => prev + 1);
    }

    if (isBust) {
      // Show the dart but don't update score, then switch players
      setCurrentDarts(newDarts);
      // Trigger bust achievement
      const achievement = detectAchievement(newDarts, newRoundScore, true, false);
      triggerAchievement(achievement);
      setTimeout(() => setShowPlayerChange(true), 2000); // Wait for animation
      return;
    }

    // Check for win (score reaches exactly 0)
    const didWin = potentialNewScore === 0;

    // Update state
    setCurrentDarts(newDarts);
    setRoundScore(newRoundScore);
    if (currentThrower === 'p1') setP1Score(potentialNewScore);
    else setP2Score(potentialNewScore);

    // Mark player as started if they just hit a valid in
    if (playerStartsNow) {
      setHasStarted(true);
    }

    // Check for achievements on 3rd dart or win
    if (newDarts.length === 3 || didWin) {
      const achievement = detectAchievement(newDarts, newRoundScore, false, didWin);
      if (achievement) {
        // Pass winner for win achievements (single game = show winner screen after)
        const winner = didWin ? currentThrower : undefined;
        triggerAchievement(achievement, winner);
        // Don't show player change on win - winners screen will show
        if (!didWin) {
          setTimeout(() => setShowPlayerChange(true), 2000); // Wait for animation
        }
        return;
      }
    }

    if (newDarts.length === 3) setShowPlayerChange(true);
  }, [currentDarts, currentScore, currentThrower, roundScore, showPlayerChange, introComplete, p1Score, p2Score, p1HasStarted, p2HasStarted, inMode, outMode, detectAchievement, triggerAchievement]);

  const endTurnWithMisses = useCallback(() => {
    if (showPlayerChange || !introComplete || showWinnerScreen || !!activeAnimation) return;
    const remaining = Math.max(0, 3 - currentDarts.length);
    if (remaining === 0) {
      setShowPlayerChange(true);
      return;
    }
    const misses = Array.from({ length: remaining }, () => ({ segment: 'MISS', score: 0, multiplier: 0 }));
    setCurrentDarts([...currentDarts, ...misses]);
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + remaining);
    } else {
      setP2DartsThrown(prev => prev + remaining);
    }
    setShowPlayerChange(true);
  }, [activeAnimation, currentDarts, currentThrower, introComplete, showPlayerChange, showWinnerScreen]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow) return;
    if (lastThrow.timestamp === lastProcessedThrowRef.current) return;
    lastProcessedThrowRef.current = lastThrow.timestamp;
    if (lastThrow.segmentType === 'BUTTON' || lastThrow.segment === 'BTN') {
      endTurnWithMisses();
      return;
    }

    let segment = lastThrow.segment;
    if (lastThrow.segmentType === 'BULL') segment = 'S25';
    else if (lastThrow.segmentType === 'DBL_BULL') segment = 'D25';

    throwDart(segment, lastThrow.score, lastThrow.multiplier);
  }, [lastThrow, throwDart, endTurnWithMisses]);

  const handleDevSimulateThrow = useCallback(() => {
    if (!devMode) return;
    bleSimulateThrow();
  }, [devMode, bleSimulateThrow]);

  const formatDart = (segment: string) => {
    if (segment === 'MISS') return 'MISS';
    if (segment === 'S25' || segment === 'D25') {
      if (!splitBull) return 'BULL';
      return segment === 'D25' ? 'DBULL' : 'BULL';
    }
    return segment;
  };

  const p1Active = currentThrower === 'p1';
  const p2Active = currentThrower === 'p2';

  // Grey gradient for inactive/intro state
  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';

  // Track previous thrower for exit animations
  const [prevThrower, setPrevThrower] = useState<'p1' | 'p2' | null>(null);
  const [turnKey, setTurnKey] = useState(0);
  const [hasHadTurnSwitch, setHasHadTurnSwitch] = useState(false);

  // Track turn changes - only set prevThrower after actual turn switch (not on initial intro)
  useEffect(() => {
    if (introComplete) {
      // Only track as exit if there was a previous turn (not initial intro)
      if (turnKey > 0) {
        setPrevThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setHasHadTurnSwitch(true);
      }
      setTurnKey(prev => prev + 1);
    }
  }, [currentThrower, introComplete]);

  // Determine if each player is exiting (was active, now inactive) - only after first turn switch
  const p1Exiting = hasHadTurnSwitch && prevThrower === 'p1' && !p1Active;
  const p2Exiting = hasHadTurnSwitch && prevThrower === 'p2' && !p2Active;

  // Scale factor based on viewport vs Figma frame
  // Use vw for width-based scaling
  const scale = `calc(100vw / ${FIGMA.frame.w})`;

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
      {/* Inject keyframes */}
      <style>{goodLuckKeyframes}</style>

      {/* BACKGROUND IMAGE (instead of split-screen video) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

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
          {/* Show checkout when score < 150, otherwise show match format */}
          {showCheckout ? (
            <>
              {/* Checkout suggestion */}
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
              {/* Settings row - abbreviated format, hide opens and fat bull */}
              {/* Combine in/out modes: MiMo, DiDo, MiDo, DiMo, or single Mi/Mo/Di/Do */}
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
        top: '50%',
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
          {/* Glassmorphic background bar */}
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
          {/* Text */}
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

      {/* Round Indicator - Upper Left */}
      {introComplete && (
        <div
          key={`round-${roundKey}`}
          style={{
            position: 'absolute',
            top: `calc(20 * ${scale})`,
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
          {/* Glassmorphic background */}
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

      {/* Darts above active player - each centered over its 1/3 of the bar */}
      {currentDarts.length > 0 && introComplete && (
        <>
          {currentDarts.map((dart, i) => {
            // Bar width is 513px, divide into thirds
            // Centers at: 85.5 (1/6), 256.5 (3/6), 427.5 (5/6)
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
      }}>
        {/* Grey base layer - always visible */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: greyGradient,
        }} />
        {/* Dart progress border - top edge, 1/3 per dart when active, swipes down on exit */}
        {introComplete && p1Active && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: P1_ACTIVE,
            transition: 'width 0.2s ease-out',
            zIndex: 5,
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-progress-exit-${turnKey}`} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '3px',
            width: '100%',
            background: P1_ACTIVE,
            zIndex: 5,
            animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Colored layer - swipes up when active, swipes down when exiting */}
        {introComplete && (p1Active || p1Exiting) && (
          <div key={`p1-bar-${turnKey}`} style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(179.4deg, rgba(102, 0, 255, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)',
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Avatar - grey base */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`,
          height: `calc(${FIGMA.avatar} * ${scale})`,
          left: `calc(${FIGMA.avatarLeft} * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#000000',
          border: `3px solid ${INACTIVE}`,
          borderRadius: '50%',
          zIndex: 1,
        }} />
        {/* Avatar - colored overlay */}
        {introComplete && (p1Active || p1Exiting) && (
          <div key={`p1-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`,
            height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#000000',
            border: `3px solid ${P1_ACTIVE}`,
            borderRadius: '50%',
            zIndex: 2,
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Name + PPR */}
        <div style={{
          position: 'absolute',
          left: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME,
            fontWeight: 400,
            fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p1Active ? '#FFFFFF' : INACTIVE,
          }}>
            {PLAYERS.p1.name}
          </span>
          {introComplete && isOhOneGame && (
            <span style={{
              fontFamily: FONT_NAME,
              fontWeight: 400,
              fontSize: `calc(16 * ${scale})`,
              color: p1Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              PPR: {p1DisplayPPR.toFixed(1)}{eightyPercentTriggered ? ' (80%)' : ''}
            </span>
          )}
        </div>
        {/* Score */}
        <span style={{
          position: 'absolute',
          left: `calc(${FIGMA.scoreLeft} * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE,
          fontWeight: 300,
          fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1,
          color: p1Active ? '#FFFFFF' : INACTIVE,
          textShadow: p1Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none',
          zIndex: 3,
        }}>
          {p1Score}
        </span>
      </div>

      {/* Player 2 Bar - Right (mirrored) */}
      <div style={{
        position: 'absolute',
        width: `calc(${FIGMA.bar.w} * ${scale})`,
        height: `calc(${FIGMA.bar.h} * ${scale})`,
        right: '0px',
        bottom: '0px',
        borderTopLeftRadius: `calc(16 * ${scale})`,
        overflow: 'hidden',
      }}>
        {/* Grey base layer - always visible */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: greyGradient,
        }} />
        {/* Dart progress border - top edge, 1/3 per dart when active, swipes down on exit */}
        {introComplete && p2Active && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: P2_ACTIVE,
            transition: 'width 0.2s ease-out',
            zIndex: 5,
          }} />
        )}
        {introComplete && p2Exiting && (
          <div key={`p2-progress-exit-${turnKey}`} style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '3px',
            width: '100%',
            background: P2_ACTIVE,
            zIndex: 5,
            animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Colored layer - swipes up when active, swipes down when exiting */}
        {introComplete && (p2Active || p2Exiting) && (
          <div key={`p2-bar-${turnKey}`} style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(179.4deg, rgba(251, 0, 255, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)',
            animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Score - on left for P2 */}
        <span style={{
          position: 'absolute',
          left: `calc(20 * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE,
          fontWeight: 300,
          fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1,
          color: p2Active ? '#FFFFFF' : INACTIVE,
          textShadow: p2Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none',
          zIndex: 3,
        }}>
          {p2Score}
        </span>
        {/* Name + PPR - in middle for P2 */}
        <div style={{
          position: 'absolute',
          right: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME,
            fontWeight: 400,
            fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p2Active ? '#FFFFFF' : INACTIVE,
          }}>
            {PLAYERS.p2.name}
          </span>
          {introComplete && isOhOneGame && (
            <span style={{
              fontFamily: FONT_NAME,
              fontWeight: 400,
              fontSize: `calc(16 * ${scale})`,
              color: p2Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              PPR: {p2DisplayPPR.toFixed(1)}{eightyPercentTriggered ? ' (80%)' : ''}
            </span>
          )}
        </div>
        {/* Avatar - grey base */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`,
          height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#000000',
          border: `3px solid ${INACTIVE}`,
          borderRadius: '50%',
          zIndex: 1,
        }} />
        {/* Avatar - colored overlay */}
        {introComplete && (p2Active || p2Exiting) && (
          <div key={`p2-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`,
            height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#000000',
            border: `3px solid ${P2_ACTIVE}`,
            borderRadius: '50%',
            zIndex: 2,
            animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
      </div>

      {/* Hamburger Menu - Top Right */}
      <div style={{ position: 'absolute', top: `calc(20 * ${scale})`, right: `calc(20 * ${scale})`, zIndex: 100 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: `calc(44 * ${scale})`,
            height: `calc(44 * ${scale})`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: `calc(6 * ${scale})`,
            padding: `calc(8 * ${scale})`,
          }}
        >
          {/* 3 horizontal lines */}
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFFFFF', borderRadius: '2px' }} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: `calc(50 * ${scale})`,
            right: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: `calc(8 * ${scale})`,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            minWidth: `calc(160 * ${scale})`,
          }}>
            {/* Dev Mode Simulate Throw */}
            {devMode && (
              <button
                onClick={() => {
                  handleDevSimulateThrow();
                  setMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                  background: 'transparent',
                  border: 'none',
                  color: '#FFA500',
                  fontFamily: FONT_NAME,
                  fontSize: `calc(18 * ${scale})`,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 165, 0, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🎯 Simulate Throw
              </button>
            )}
            {/* Undo Dart */}
            <button
              onClick={() => {
                handleUndo();
                setMenuOpen(false);
              }}
              disabled={dartHistory.length === 0 || undosRemaining <= 0}
              style={{
                width: '100%',
                padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent',
                border: 'none',
                borderTop: devMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                color: (dartHistory.length === 0 || undosRemaining <= 0) ? '#555' : '#FFFFFF',
                fontFamily: FONT_NAME,
                fontSize: `calc(18 * ${scale})`,
                fontWeight: 500,
                textAlign: 'left',
                cursor: (dartHistory.length === 0 || undosRemaining <= 0) ? 'not-allowed' : 'pointer',
                opacity: (dartHistory.length === 0 || undosRemaining <= 0) ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (dartHistory.length > 0 && undosRemaining > 0) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Undo Dart ({undosRemaining} left)
            </button>
            {/* Leave Game */}
            <button
              onClick={() => {
                setMenuOpen(false);
                onLeaveMatch?.();
              }}
              style={{
                width: '100%',
                padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#FF4444',
                fontFamily: FONT_NAME,
                fontSize: `calc(18 * ${scale})`,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Leave Game
            </button>
          </div>
        )}
      </div>

      {/* Achievement Animation Overlay */}
      {activeAnimation && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          pointerEvents: 'none',
        }}>
          {/* Backdrop flash */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle, ${PLAYERS[currentThrower].profilecolor}33 0%, transparent 70%)`,
            animation: 'achievementPulse 2s ease-out forwards',
          }} />
          {/* Achievement text */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(120 * ${scale})`,
            lineHeight: 1,
            color: PLAYERS[currentThrower].profilecolor,
            textShadow: `0 0 30px ${PLAYERS[currentThrower].profilecolor}, 0 0 60px ${PLAYERS[currentThrower].profilecolor}, -4px 4px 8px rgba(0, 0, 0, 0.8)`,
            whiteSpace: 'nowrap',
            animation: 'achievementPulse 2s ease-out forwards, achievementGlow 0.5s ease-in-out infinite',
          }}>
            {ACHIEVEMENT_LABELS[activeAnimation]}
          </div>
        </div>
      )}

      {/* Winners Screen Overlay */}
      {showWinnerScreen && gameWinner && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          background: 'rgba(0, 0, 0, 0.9)',
          animation: 'winnerFadeIn 0.5s ease-out forwards',
        }}>
          {/* Winner glow background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at center, ${PLAYERS[gameWinner].profilecolor}40 0%, transparent 60%)`,
          }} />

          {/* WINNER label */}
          <div style={{
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(60 * ${scale})`,
            lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.6)',
            letterSpacing: `calc(20 * ${scale})`,
            marginBottom: `calc(20 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards',
            animationDelay: '0.2s',
            opacity: 0,
          }}>
            GAME WINNER
          </div>

          {/* Winner name */}
          <div style={{
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(160 * ${scale})`,
            lineHeight: 1,
            color: PLAYERS[gameWinner].profilecolor,
            textShadow: `0 0 40px ${PLAYERS[gameWinner].profilecolor}, 0 0 80px ${PLAYERS[gameWinner].profilecolor}, -6px 6px 12px rgba(0, 0, 0, 0.8)`,
            animation: 'winnerNameSlide 0.8s ease-out forwards',
            animationDelay: '0.4s',
            opacity: 0,
          }}>
            {PLAYERS[gameWinner].name}
          </div>

          {/* Final score */}
          <div style={{
            fontFamily: FONT_NAME,
            fontSize: `calc(28 * ${scale})`,
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: `calc(30 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards',
            animationDelay: '0.6s',
            opacity: 0,
          }}>
            Final: {gameWinner === 'p1' ? p1Score : p2Score} - {gameWinner === 'p1' ? p2Score : p1Score}
          </div>

          {/* Button row */}
          <div style={{
            display: 'flex',
            gap: `calc(20 * ${scale})`,
            marginTop: `calc(60 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards',
            animationDelay: '0.8s',
            opacity: 0,
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
                  fontFamily: FONT_NAME,
                  fontSize: `calc(24 * ${scale})`,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  background: PLAYERS[gameWinner].profilecolor,
                  border: 'none',
                  borderRadius: `calc(12 * ${scale})`,
                  cursor: 'pointer',
                  boxShadow: `0 0 30px ${PLAYERS[gameWinner].profilecolor}80`,
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
                    setCurrentThrower(startingPlayer || 'p1');
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
                    fontFamily: FONT_NAME,
                    fontSize: `calc(24 * ${scale})`,
                    fontWeight: 500,
                    color: '#FFFFFF',
                    background: PLAYERS[gameWinner].profilecolor,
                    border: 'none',
                    borderRadius: `calc(12 * ${scale})`,
                    cursor: 'pointer',
                    boxShadow: `0 0 30px ${PLAYERS[gameWinner].profilecolor}80`,
                  }}
                >
                  Rematch
                </button>
                <button
                  onClick={() => {
                    setShowWinnerScreen(false);
                    setGameWinner(null);
                  }}
                  style={{
                    padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                    fontFamily: FONT_NAME,
                    fontSize: `calc(24 * ${scale})`,
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.7)',
                    background: 'transparent',
                    border: `2px solid rgba(255, 255, 255, 0.3)`,
                    borderRadius: `calc(12 * ${scale})`,
                    cursor: 'pointer',
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

export default O1InhouseGameScreen;
