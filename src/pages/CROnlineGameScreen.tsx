import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameStatus } from '../hooks/useGameStatus';
import { AppHeader } from '../components/AppHeader';
import { createClient } from '../utils/supabase/client';
import { isDevMode } from '../utils/devMode';
import type { DartThrowData } from '../utils/ble/bleConnection';
import { RefreshCw, DoorOpen } from 'lucide-react';
import { resolveProfilePicUrl } from '../utils/profile';
import { useOnlineThrowSync } from '../hooks/useOnlineThrowSync';

type Target = '20' | '19' | '18' | '17' | '16' | '15' | 'B';
type PlayerId = 'p1' | 'p2';

const TARGETS: Target[] = ['20', '19', '18', '17', '16', '15', 'B'];
const MARK_ICONS: Record<1 | 2 | 3, string> = {
  1: '/assets/CR1Mark.svg',
  2: '/assets/CR2Mark.svg',
  3: '/assets/CR3Mark.svg',
};

interface DartThrow {
  segment: string;
  score: number;
  multiplier: number;
}

type AchievementType =
  | 'win'
  | 'hatTrick'
  | 'threeInBlack'
  | 'ton80'
  | 'threeInBed'
  | 'whiteHorse'
  | null;

interface CROnlineGameScreenProps {
  gameId: string;
  localPlayer: {
    id: string;
    name: string;
    profilePic?: string;
    accentColor: string;
  };
  remotePlayer: {
    id: string;
    name: string;
    profilePic?: string;
    accentColor: string;
  };
  isInitiator: boolean; // true = local sent the challenge
  onLeaveMatch: () => void;
  startingPlayer?: PlayerId;
  onGameComplete?: (winner: PlayerId) => void;
}

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

const FONT_SCORE = "'Helvetica Compressed', sans-serif";
const FONT_NAME = "'Helvetica Condensed', sans-serif";

const FIGMA = {
  frame: { w: 1180, h: 820 },
  bar: { w: 450, h: 90 },
  avatar: 60,
  avatarLeft: 10,
  nameLeft: 80,
  nameSize: 32,
  scoreLeft: 320,
  scoreSize: 72,
};

const ROUND_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];

const ACHIEVEMENT_LABELS: Record<Exclude<AchievementType, null>, string> = {
  win: 'GAME!',
  hatTrick: 'HAT TRICK!',
  threeInBlack: '3 IN THE BLACK!',
  ton80: 'TON 80!',
  threeInBed: '3 IN A BED!',
  whiteHorse: 'WHITE HORSE!',
};

const AWARD_VIDEOS: Partial<Record<Exclude<AchievementType, null>, string>> = {
  hatTrick: '/awards/blue&orange/hattrick.mp4',
  threeInBlack: '/awards/blue&orange/3intheblack.mp4',
  ton80: '/awards/blue&orange/ton80.mp4',
  threeInBed: '/awards/blue&orange/3inabed.mp4',
  whiteHorse: '/awards/blue&orange/whitehorse.mp4',
};

const goodLuckKeyframes = `
@keyframes goodLuckSlide {
  0% { left: 100%; transform: translate(0, -50%); }
  25% { left: 50%; transform: translate(-50%, -50%); }
  75% { left: 50%; transform: translate(-50%, -50%); }
  100% { left: -100%; transform: translate(0, -50%); }
}
@keyframes goodLuckBgSlide {
  0% { left: 100%; width: 40%; transform: translateY(-50%); }
  25% { left: 0; width: 100%; transform: translateY(-50%); }
  75% { left: 0; width: 100%; transform: translateY(-50%); }
  100% { left: -100%; width: 40%; transform: translateY(-50%); }
}
@keyframes colorSwipeUp {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes colorSwipeDown {
  0% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(100% 0 0 0); }
}
@keyframes borderDrainDown {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(calc(118 * 100vw / 1180)); opacity: 0; }
}
@keyframes slideInFromLeft {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}
@keyframes slideOutToLeft {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
@keyframes achievementPulse {
  0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
  15% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
  30% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes achievementFadeIn {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 1; }
}
@keyframes achievementGlow {
  0%, 100% { filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor); }
  50% { filter: drop-shadow(0 0 40px currentColor) drop-shadow(0 0 80px currentColor); }
}
@keyframes winnerFadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes winnerNameSlide {
  0% { transform: translateY(50px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes markPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes circleDraw {
  0% { clip-path: polygon(50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%); }
  12.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 50% 0%); }
  25% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 50% 0%); }
  37.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 50% 0%); }
  50% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 50% 100%, 50% 100%, 50% 0%); }
  62.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 100%, 50% 0%); }
  75% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 50% 0%); }
  87.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
  100% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
}
`;

export function CROnlineGameScreen({
  gameId,
  localPlayer,
  remotePlayer,
  isInitiator,
  onLeaveMatch,
  startingPlayer,
  onGameComplete,
}: CROnlineGameScreenProps) {
  const supabase = createClient();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

  // BLE for throw detection and status
  const { lastThrow, isConnected: bleConnected, connect: bleConnect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const lastProcessedThrowRef = useRef<string | null>(null);
  const playerChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // WebRTC for video - memoize options to prevent infinite re-initialization
  const webRTCOptions = useMemo(() => ({
    gameId,
    localPlayerId: localPlayer.id,
    remotePlayerId: remotePlayer.id,
    isInitiator,
  }), [gameId, localPlayer.id, remotePlayer.id, isInitiator]);

  const { localStream, remoteStream, connectionState, initialize: webrtcInit, disconnect: webrtcDisconnect } = useWebRTC(webRTCOptions);

  // Game status for presence/disconnect detection
  const { isOpponentOnline, disconnectCountdown, leaveMatch, opponentLeftMessage } = useGameStatus({
    gameId,
    localPlayerId: localPlayer.id,
    remotePlayerId: remotePlayer.id,
    remotePlayerName: remotePlayer.name,
    onOpponentLeft: onLeaveMatch,
  });

  // Attach video streams to elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Refresh video handler
  const handleRefreshVideo = useCallback(async () => {
    await webrtcDisconnect();
    await webrtcInit();
  }, [webrtcDisconnect, webrtcInit]);

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

  // Custom menu items for AppHeader
  const customMenuItems = useMemo(() => [
    {
      label: 'Refresh Video',
      icon: RefreshCw,
      onClick: handleRefreshVideo,
    },
    {
      label: 'Leave Match',
      icon: DoorOpen,
      onClick: () => setShowLeaveConfirm(true),
      className: 'focus:bg-red-500/20 focus:text-white text-red-400 cursor-pointer',
    },
  ], [handleRefreshVideo]);

  // For logout action in AppHeader, show leave confirmation
  const handleLogoutAction = () => setShowLeaveConfirm(true);

  // Handle confirm leave
  const handleConfirmLeave = async () => {
    setShowLeaveConfirm(false);
    await leaveMatch();
    onLeaveMatch();
  };

  // Cricket state
  const [marks, setMarks] = useState<Record<PlayerId, Record<Target, number>>>({
    p1: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
    p2: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
  });
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);

  // Game flow state
  const [currentThrower, setCurrentThrower] = useState<'p1' | 'p2'>('p1');
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);
  const [showPlayerChange, setShowPlayerChange] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [showGoodLuck, setShowGoodLuck] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundAnimState, setRoundAnimState] = useState<'in' | 'visible' | 'out'>('in');
  const [roundKey, setRoundKey] = useState(0);
  const [p1ThrewThisRound, setP1ThrewThisRound] = useState(false);
  const [p2ThrewThisRound, setP2ThrewThisRound] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<AchievementType>(null);
  const [gameWinner, setGameWinner] = useState<'p1' | 'p2' | null>(null);
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);

  // MPR tracking
  const [p1DartsThrown, setP1DartsThrown] = useState(0);
  const [p2DartsThrown, setP2DartsThrown] = useState(0);
  const [p1TotalMarks, setP1TotalMarks] = useState(0);
  const [p2TotalMarks, setP2TotalMarks] = useState(0);

  // Track when each player reached their current score (for tiebreaker: who got there first)
  const [p1ScoreReachedRound, setP1ScoreReachedRound] = useState(1);
  const [p2ScoreReachedRound, setP2ScoreReachedRound] = useState(1);

  // Turn tracking for animations
  const [prevThrower, setPrevThrower] = useState<'p1' | 'p2' | null>(null);
  const [turnKey, setTurnKey] = useState(0);
  const [hasHadTurnSwitch, setHasHadTurnSwitch] = useState(false);

  const p1Active = currentThrower === 'p1';
  const p2Active = currentThrower === 'p2';
  const p1Exiting = hasHadTurnSwitch && prevThrower === 'p1' && !p1Active;
  const p2Exiting = hasHadTurnSwitch && prevThrower === 'p2' && !p2Active;

  // Is it local player's turn?
  const isLocalTurn = (localIsP1 && p1Active) || (!localIsP1 && p2Active);

  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';
  const scale = `calc(100vw / ${FIGMA.frame.w})`;

  // Check if a target is dead (both players closed it)
  const isTargetDead = (target: Target): boolean => {
    return marks.p1[target] >= 3 && marks.p2[target] >= 3;
  };

  // MPR = marks per round, where a round = 3 darts
  const p1MPR = p1DartsThrown >= 3 ? (p1TotalMarks / (p1DartsThrown / 3)).toFixed(2) : '0.00';
  const p2MPR = p2DartsThrown >= 3 ? (p2TotalMarks / (p2DartsThrown / 3)).toFixed(2) : '0.00';

  // Display layout: p1 (starting player) always on LEFT, p2 always on RIGHT for both players
  // This ensures both players see the same consistent layout

  // Intro animation - re-runs when showGoodLuck changes (e.g., Play Again)
  useEffect(() => {
    if (!showGoodLuck) return; // Only run when showGoodLuck is true
    const timer = setTimeout(() => {
      setShowGoodLuck(false);
      setIntroComplete(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showGoodLuck]);

  // Track turn changes
  useEffect(() => {
    if (introComplete) {
      if (turnKey > 0) {
        setPrevThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setHasHadTurnSwitch(true);
      }
      setTurnKey(prev => prev + 1);
    }
  }, [currentThrower, introComplete]);

  // Map segment to cricket target
  const mapSegmentToTarget = (segment: string, multiplier: number): { target: Target | null; hitMarks: number } => {
    if (segment === 'MISS') return { target: null, hitMarks: 0 };
    if (segment === 'S25') return { target: 'B', hitMarks: 1 };
    if (segment === 'D25') return { target: 'B', hitMarks: 2 };
    const num = parseInt(segment.slice(1), 10);
    if ([20, 19, 18, 17, 16, 15].includes(num)) {
      return { target: num.toString() as Target, hitMarks: multiplier };
    }
    return { target: null, hitMarks: 0 };
  };

  // Detect cricket achievements
  const detectAchievement = (darts: DartThrow[]): AchievementType => {
    if (darts.length !== 3) return null;
    const segments = darts.map(d => d.segment);

    if (segments.every(s => s === 'T20')) return 'ton80';
    if (segments.every(s => s === 'D25')) return 'threeInBlack';
    if (segments.every(s => s === 'S25' || s === 'D25')) return 'hatTrick';

    const triples = segments.filter(s => s.startsWith('T'));
    if (triples.length === 3) {
      const unique = new Set(triples);
      if (unique.size === 1) return 'threeInBed';
      const cricketTriples = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15'];
      if (triples.every(t => cricketTriples.includes(t)) && unique.size === 3) return 'whiteHorse';
    }

    return null;
  };

  const applyThrowRef = useRef<(segment: string, multiplier: number, isLocal: boolean) => void>(() => {});

  const { sendThrow, sendTurnEnd } = useOnlineThrowSync({
    channelName: `cricket:${gameId}`,
    localPlayerId: localPlayer.id,
    onRemoteThrow: ({ segment, multiplier }) => {
      applyThrowRef.current(segment, multiplier, false);
    },
    onRemoteTurnEnd: () => {
      setShowPlayerChange(true);
    },
  });

  // Apply a throw (from BLE or remote)
  const applyThrow = useCallback((segment: string, multiplier: number, isLocal: boolean) => {
    if (currentDarts.length >= 3 || showPlayerChange || !introComplete || showWinnerScreen) return;

    // Only allow throws from the current thrower
    const expectedLocal = (localIsP1 && currentThrower === 'p1') || (!localIsP1 && currentThrower === 'p2');
    if (isLocal !== expectedLocal) return;

    const { target, hitMarks } = mapSegmentToTarget(segment, multiplier);
    const newDart: DartThrow = { segment, score: 0, multiplier };
    const newDarts = [...currentDarts, newDart];
    setCurrentDarts(newDarts);

    // Count marks for MPR, but don't credit marks beyond closing a dead target
    if (target) {
      const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
      const currentMarks = marks[currentThrower][target];
      const oppMarks = marks[opp][target];
      const cappedMarks = oppMarks >= 3 ? Math.max(0, 3 - currentMarks) : hitMarks;
      if (cappedMarks > 0) {
        if (currentThrower === 'p1') {
          setP1TotalMarks(prev => prev + cappedMarks);
        } else {
          setP2TotalMarks(prev => prev + cappedMarks);
        }
      }
    }

    // Increment darts thrown
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + 1);
    } else {
      setP2DartsThrown(prev => prev + 1);
    }

    // Apply marks if valid target
    if (target) {
      setMarks(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
        const currentMarks = next[currentThrower][target];
        const oppMarks = next[opp][target];

        const newMarks = Math.min(3, currentMarks + hitMarks);
        const overflow = Math.max(0, (currentMarks + hitMarks) - 3);
        next[currentThrower][target] = newMarks;

        // Score points if closed and opponent hasn't closed
        if (newMarks === 3 && oppMarks < 3 && overflow > 0) {
          const value = target === 'B' ? 25 : parseInt(target, 10);
          if (currentThrower === 'p1') {
            setP1Score(s => s + overflow * value);
            setP1ScoreReachedRound(currentRound);
          } else {
            setP2Score(s => s + overflow * value);
            setP2ScoreReachedRound(currentRound);
          }
        } else if (currentMarks >= 3 && oppMarks < 3) {
          const value = target === 'B' ? 25 : parseInt(target, 10);
          if (currentThrower === 'p1') {
            setP1Score(s => s + hitMarks * value);
            setP1ScoreReachedRound(currentRound);
          } else {
            setP2Score(s => s + hitMarks * value);
            setP2ScoreReachedRound(currentRound);
          }
        }

        // Check win
        const allClosed = TARGETS.every(t => next[currentThrower][t] >= 3);
        if (allClosed) {
          const myScore = currentThrower === 'p1' ? p1Score : p2Score;
          const theirScore = currentThrower === 'p1' ? p2Score : p1Score;
          if (myScore >= theirScore) {
            setGameWinner(currentThrower);
            setTimeout(() => setShowWinnerScreen(true), 500);
          }
        }

        return next;
      });
    }

    // Broadcast throw to opponent if local
    if (isLocal) {
      sendThrow({ playerId: localPlayer.id, segment, multiplier });
    }

    // Check achievements & end turn on 3rd dart
    if (newDarts.length === 3) {
      const achievement = detectAchievement(newDarts);
      if (achievement) {
        setActiveAnimation(achievement);
        // 3 seconds to let award videos play fully (button can skip via animationTimeoutRef)
        animationTimeoutRef.current = setTimeout(() => {
          animationTimeoutRef.current = null;
          setActiveAnimation(null);
        }, 3000);
      }
      // Add delay before player change to let dart effects complete (button press skips this)
      playerChangeTimeoutRef.current = setTimeout(() => {
        playerChangeTimeoutRef.current = null;
        setShowPlayerChange(true);
        // Broadcast turn end if local
        if (isLocal) {
          sendTurnEnd({ playerId: localPlayer.id });
        }
      }, 3000);
    }
  }, [currentDarts, currentThrower, introComplete, showPlayerChange, showWinnerScreen, p1Score, p2Score, marks, localIsP1, localPlayer.id, currentRound, sendThrow, sendTurnEnd]);

  // Keep ref in sync so broadcast handler always has latest applyThrow
  useEffect(() => { applyThrowRef.current = applyThrow; }, [applyThrow]);

  const endTurnWithMisses = useCallback(() => {
    if (showPlayerChange || !introComplete || showWinnerScreen) return;
    const expectedLocal = (localIsP1 && currentThrower === 'p1') || (!localIsP1 && currentThrower === 'p2');
    if (!expectedLocal) return;
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
      setShowPlayerChange(true);
    } else {
      const misses = Array.from({ length: remaining }, () => ({ segment: 'MISS', score: 0, multiplier: 0 }));
      setCurrentDarts([...currentDarts, ...misses]);
      if (currentThrower === 'p1') {
        setP1DartsThrown(prev => prev + remaining);
      } else {
        setP2DartsThrown(prev => prev + remaining);
      }
      setShowPlayerChange(true);
    }
    sendTurnEnd({ playerId: localPlayer.id });
  }, [activeAnimation, currentDarts, currentThrower, introComplete, localIsP1, localPlayer.id, showPlayerChange, showWinnerScreen, sendTurnEnd]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow) return;

    // Dedup check MUST come before isLocalTurn check to prevent stale throws
    // from re-processing when the turn switches
    const throwKey = `${lastThrow.segment}-${lastThrow.timestamp}`;
    if (throwKey === lastProcessedThrowRef.current) return;
    lastProcessedThrowRef.current = throwKey;

    if (!isLocalTurn) return;

    console.log('[CROnlineGame] Processing throw:', lastThrow.segment);

    if (lastThrow.segmentType === 'BUTTON' || lastThrow.segment === 'BTN') {
      console.log('[CROnlineGame] Button press detected, ending turn');
      endTurnWithMisses();
      return;
    }

    // Convert BLE segment types to standard format
    let segment = lastThrow.segment;
    if (lastThrow.segmentType === 'BULL') segment = 'S25';
    else if (lastThrow.segmentType === 'DBL_BULL') segment = 'D25';
    const multiplier = lastThrow.multiplier;

    applyThrow(segment, multiplier, true);
  }, [lastThrow, isLocalTurn, localIsP1, currentThrower, applyThrow, endTurnWithMisses]);

  // Handle player change
  useEffect(() => {
    if (showPlayerChange) {
      const timer = setTimeout(() => {
        if (currentThrower === 'p1') {
          setP1ThrewThisRound(true);
        } else {
          setP2ThrewThisRound(true);
        }

        const willCompleteRound = (currentThrower === 'p1' && p2ThrewThisRound) ||
                                   (currentThrower === 'p2' && p1ThrewThisRound);

        // Round 20 limit: If round 20 completes without a winner, determine by tiebreaker
        if (willCompleteRound && currentRound === 20 && !gameWinner) {
          let winner: 'p1' | 'p2';
          if (p1Score > p2Score) {
            // P1 has more points - P1 wins
            winner = 'p1';
          } else if (p2Score > p1Score) {
            // P2 has more points - P2 wins
            winner = 'p2';
          } else if (p1TotalMarks > p2TotalMarks) {
            // Points tied, P1 has more marks - P1 wins
            winner = 'p1';
          } else if (p2TotalMarks > p1TotalMarks) {
            // Points tied, P2 has more marks - P2 wins
            winner = 'p2';
          } else {
            // Points and marks both tied - whoever reached that point total first wins
            winner = p1ScoreReachedRound <= p2ScoreReachedRound ? 'p1' : 'p2';
          }
          setGameWinner(winner);
          setTimeout(() => setShowWinnerScreen(true), 500);
          return;
        }

        if (willCompleteRound) {
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
        setCurrentThrower(t => t === 'p1' ? 'p2' : 'p1');
        setCurrentDarts([]);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showPlayerChange, currentThrower, p1ThrewThisRound, p2ThrewThisRound, currentRound, gameWinner, p1Score, p2Score, p1TotalMarks, p2TotalMarks, p1ScoreReachedRound, p2ScoreReachedRound]);

  const formatDart = (segment: string) => {
    if (segment === 'MISS') return 'MISS';
    if (segment === 'S25') return 'BULL';
    if (segment === 'D25') return 'DBULL';
    return segment;
  };

  // Render mark icon - p1 on left, p2 on right (same view for both players)
  const renderMarkIcon = (player: 'p1' | 'p2', target: Target) => {
    const marksData = marks[player];
    const count = marksData[target];
    if (count === 0) return null;
    const cappedCount = Math.min(3, count) as 1 | 2 | 3;
    const markHeight = `calc(34 * ${scale})`;

    return (
      <div
        key={`${player}-${target}-${cappedCount}`}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: `calc(44 * ${scale})`,
          height: markHeight,
        }}
      >
        <img
          src={MARK_ICONS[1]}
          alt="mark"
          style={{
            position: 'absolute',
            height: markHeight,
            width: 'auto',
            animation: cappedCount === 1 ? 'markPop 0.3s ease-out forwards' : 'none',
          }}
        />
        {cappedCount >= 2 && (
          <img
            src={MARK_ICONS[2]}
            alt="mark"
            style={{
              position: 'absolute',
              height: markHeight,
              width: 'auto',
              animation: 'markPop 0.3s ease-out forwards',
            }}
          />
        )}
        {cappedCount === 3 && (
          <div
            style={{
              position: 'absolute',
              width: `calc(44 * ${scale})`,
              height: `calc(44 * ${scale})`,
              borderRadius: '50%',
              border: `calc(6 * ${scale}) solid #FFFFFF`,
              animation: 'circleDraw 0.4s ease-out forwards',
            }}
          />
        )}
      </div>
    );
  };

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

      {/* AppHeader with BLE status and profile menu */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: '8px 12px', background: '#000000', borderBottom: '1px solid #333' }}>
        <AppHeader
          title="CRICKET"
          bleConnected={bleConnected}
          bleStatus={bleStatus === 'error' ? 'disconnected' : bleStatus}
          onBLEConnect={bleConnect}
          onBLEDisconnect={bleDisconnect}
          onLogout={handleLogoutAction}
          customMenuItems={customMenuItems}
        />
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 12, padding: 24, maxWidth: 320, width: '100%',
          }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Leave Match?</h2>
            <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16 }}>
              Your opponent will be notified and the match will be cancelled.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                style={{
                  flex: 1, padding: '8px 16px', background: '#3f3f46',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Stay
              </button>
              <button
                onClick={handleConfirmLeave}
                style={{
                  flex: 1, padding: '8px 16px', background: '#dc2626',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT SCREEN VIDEO BACKGROUND - P1 always on left, P2 always on right */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
      }}>
        {/* Left half - P1's camera (starting player) */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: '#111',
          borderRight: '2px solid #333',
        }}>
          <video
            ref={localIsP1 ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={localIsP1}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'none',
            }}
          />
        </div>

        {/* Right half - P2's camera */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: '#111',
        }}>
          <video
            ref={localIsP1 ? remoteVideoRef : localVideoRef}
            autoPlay
            playsInline
            muted={!localIsP1}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'none',
            }}
          />
          {/* Connection status indicator */}
          {!isOpponentOnline && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              padding: `calc(20 * ${scale})`,
              borderRadius: `calc(12 * ${scale})`,
              textAlign: 'center',
            }}>
              <div style={{ color: '#ff4444', fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})` }}>
                Opponent Disconnected
              </div>
              {disconnectCountdown && (
                <div style={{ color: '#fff', fontFamily: FONT_NAME, fontSize: `calc(48 * ${scale})`, marginTop: `calc(10 * ${scale})` }}>
                  {disconnectCountdown}s
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* CRICKET SCOREBOARD - Center */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: `calc(90 * ${scale})`,
        bottom: `calc(130 * ${scale})`,
        transform: 'translateX(-50%)',
        width: `calc(400 * ${scale})`,
        zIndex: 10,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          borderRadius: `calc(12 * ${scale})`,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
        }}>
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          <div />
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `calc(5 * ${scale}) 0`,
          overflow: 'hidden',
        }}>
          {TARGETS.map(target => {
            const dead = isTargetDead(target);
            return (
              <div
                key={target}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  alignItems: 'center',
                  flex: '1 1 0',
                  minHeight: 0,
                  opacity: dead ? 0.35 : 1,
                  filter: dead ? 'grayscale(100%)' : 'none',
                  transition: 'opacity 0.5s ease-out, filter 0.5s ease-out',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {renderMarkIcon('p1', target)}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontFamily: FONT_SCORE,
                  fontSize: `calc(38 * ${scale})`,
                  fontWeight: 700,
                  color: dead ? 'rgba(255, 255, 255, 0.4)' : '#FFFFFF',
                  textShadow: dead ? 'none' : '-2px 2px 4px rgba(0, 0, 0, 0.5)',
                }}>
                  {target === 'B' ? 'B' : target}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {renderMarkIcon('p2', target)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GOOD LUCK Animation */}
      {showGoodLuck && (
        <>
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            height: `calc(260 * ${scale})`,
            width: '40%',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(12px)',
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
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: `calc(8 * ${scale})`,
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
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(12px)',
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

      {/* Darts display */}
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

      {/* Player 1 Bar - Left (starting player, same for both views) */}
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
          <div key={`p1-exit-${turnKey}`} style={{
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
          backgroundColor: '#000',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && p1Active && (
          <div key={`p1-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p1.profilePic) ? `url(${resolveProfilePicUrl(p1.profilePic)})` : 'none',
            backgroundColor: '#000',
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
            backgroundColor: '#000',
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
          {introComplete && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p1Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              MPR: {p1MPR}
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

      {/* Player 2 Bar - Right (second player, same for both views) */}
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
          <div key={`p2-exit-${turnKey}`} style={{
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
          {introComplete && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p2Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              MPR: {p2MPR}
            </span>
          )}
        </div>
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          backgroundImage: resolveProfilePicUrl(p2.profilePic) ? `url(${resolveProfilePicUrl(p2.profilePic)})` : 'none',
          backgroundColor: '#000',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && p2Active && (
          <div key={`p2-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            backgroundImage: resolveProfilePicUrl(p2.profilePic) ? `url(${resolveProfilePicUrl(p2.profilePic)})` : 'none',
            backgroundColor: '#000',
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
            backgroundColor: '#000',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: `2px solid ${p2.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
      </div>

      {/* Achievement Animation */}
      {activeAnimation && (() => {
        const activeAccentColor = currentThrower === 'p1' ? p1.accentColor : p2.accentColor;
        return (
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
              background: `radial-gradient(circle, ${withAlpha(activeAccentColor, 0.2)} 0%, transparent 70%)`,
              animation: 'achievementFadeIn 7s ease-out forwards',
            }} />
            {/* Achievement text - only show if no video */}
            {!AWARD_VIDEOS[activeAnimation] && (
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(120 * ${scale})`, lineHeight: 1,
                color: activeAccentColor,
                textShadow: `0 0 30px ${activeAccentColor}, 0 0 60px ${activeAccentColor}, -4px 4px 8px rgba(0, 0, 0, 0.8)`,
                whiteSpace: 'nowrap',
                animation: 'achievementPulse 7s ease-out forwards, achievementGlow 0.5s ease-in-out infinite',
              }}>
                {ACHIEVEMENT_LABELS[activeAnimation]}
              </div>
            )}
          </div>
        );
      })()}

      {/* Winner Screen */}
      {showWinnerScreen && gameWinner && (() => {
        const winnerAccentColor = gameWinner === 'p1' ? p1.accentColor : p2.accentColor;
        const winnerName = gameWinner === 'p1' ? p1.name : p2.name;
        const winnerFinalScore = gameWinner === 'p1' ? p1Score : p2Score;
        const loserFinalScore = gameWinner === 'p1' ? p2Score : p1Score;
        return (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 300,
            background: 'rgba(0, 0, 0, 0.9)', animation: 'winnerFadeIn 0.5s ease-out forwards',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at center, ${withAlpha(winnerAccentColor, 0.25)} 0%, transparent 60%)`,
            }} />
            <div style={{
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(60 * ${scale})`, lineHeight: 1,
              color: 'rgba(255, 255, 255, 0.6)', letterSpacing: `calc(20 * ${scale})`,
              marginBottom: `calc(20 * ${scale})`,
              animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.2s', opacity: 0,
            }}>
              WINNER
            </div>
            <div style={{
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(160 * ${scale})`, lineHeight: 1,
              color: winnerAccentColor,
              textShadow: `0 0 40px ${winnerAccentColor}, 0 0 80px ${winnerAccentColor}, -6px 6px 12px rgba(0, 0, 0, 0.8)`,
              animation: 'winnerNameSlide 0.8s ease-out forwards', animationDelay: '0.4s', opacity: 0,
            }}>
              {winnerName}
            </div>
            <div style={{
              fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, color: 'rgba(255, 255, 255, 0.5)',
              marginTop: `calc(30 * ${scale})`,
              animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.6s', opacity: 0,
            }}>
              Final: {winnerFinalScore} - {loserFinalScore}
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
                    color: '#FFFFFF', background: winnerAccentColor,
                    border: 'none', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                  boxShadow: `0 0 30px ${(gameWinner === 'p1' ? p1.accentColor : p2.accentColor)}80`,
                }}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={async () => { await leaveMatch(); onLeaveMatch(); }}
                style={{
                  padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                  fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.7)', background: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                }}
              >
                Exit to Lobby
              </button>
            )}
            </div>
          </div>
        );
      })()}

      {/* Opponent Left Message */}
      {opponentLeftMessage && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 400, background: 'rgba(0, 0, 0, 0.9)',
        }}>
          <div style={{
            fontFamily: FONT_NAME, fontSize: `calc(32 * ${scale})`, color: '#ff4444',
            textAlign: 'center',
          }}>
            {opponentLeftMessage}
          </div>
        </div>
      )}

      {/* DEV MODE: Dart Simulator */}
      {isDevMode() && (
        <DartSimulator
          onThrow={(segment, _score, multiplier) => applyThrow(segment, multiplier, true)}
          disabled={showPlayerChange || !introComplete || showWinnerScreen || !!activeAnimation || !isLocalTurn}
        />
      )}
    </div>
  );
}

// Dev mode dart simulator (only shown in dev mode)
function DartSimulator({ onThrow, disabled }: { onThrow: (segment: string, score: number, multiplier: number) => void; disabled: boolean }) {
  const [multiplierMode, setMultiplierMode] = useState<'single' | 'double' | 'triple'>('single');
  const [expanded, setExpanded] = useState(true);

  const handleNumberClick = (num: number) => {
    if (disabled) return;
    const mult = multiplierMode === 'triple' ? 3 : multiplierMode === 'double' ? 2 : 1;
    const prefix = multiplierMode === 'triple' ? 'T' : multiplierMode === 'double' ? 'D' : 'S';
    onThrow(`${prefix}${num}`, num * mult, mult);
  };

  const handleBullClick = (isDouble: boolean) => {
    if (disabled) return;
    if (isDouble) {
      onThrow('D25', 50, 2);
    } else {
      onThrow('S25', 25, 1);
    }
  };

  const handleMissClick = () => {
    if (disabled) return;
    onThrow('MISS', 0, 0);
  };

  const cricketNumbers = [20, 19, 18, 17, 16, 15];

  return (
    <div style={{
      position: 'fixed',
      bottom: expanded ? 0 : '-220px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      maxWidth: '90vw',
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(12px)',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderBottom: 'none',
      padding: '12px 16px 16px',
      zIndex: 500,
      transition: 'bottom 0.3s ease-out',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'absolute',
          top: '-32px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderBottom: 'none',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          padding: '6px 20px',
          color: '#fff',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: "'Helvetica Condensed', sans-serif",
        }}
      >
        {expanded ? 'Hide Simulator' : 'Show Simulator'}
      </button>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
        {(['single', 'double', 'triple'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMultiplierMode(mode)}
            disabled={disabled}
            style={{
              padding: '6px 16px',
              background: multiplierMode === mode ? (mode === 'triple' ? '#FF4444' : mode === 'double' ? '#44FF44' : '#6600FF') : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
              textTransform: 'uppercase',
            }}
          >
            {mode === 'single' ? 'Single (S)' : mode === 'double' ? 'Double (D)' : 'Triple (T)'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
        {cricketNumbers.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            style={{
              width: '44px',
              height: '36px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => handleBullClick(false)}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: '#228B22',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          BULL (25)
        </button>
        <button
          onClick={() => handleBullClick(true)}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: '#FF4444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          D-BULL (50)
        </button>
        <button
          onClick={handleMissClick}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: 'rgba(100, 100, 100, 0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          MISS
        </button>
      </div>
    </div>
  );
}

export default CROnlineGameScreen;
