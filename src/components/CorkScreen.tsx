import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameStatus } from '../hooks/useGameStatus';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { UserMenu, type CustomMenuItem } from './UserMenu';
import { Bluetooth, X, WifiOff, RefreshCw, DoorOpen } from 'lucide-react';
import type { DartThrowData } from '../utils/ble/bleConnection';
import { isDevMode } from '../utils/devMode';
import { createClient } from '../utils/supabase/client';

interface CorkScreenProps {
  player1: { id: string; name: string; profilePic?: string; accentColor: string };
  player2: { id: string; name: string; profilePic?: string; accentColor: string };
  gameId: string;
  visiblePlayerId: string;
  isInitiator: boolean;
  onCorkComplete: (firstPlayerId: string) => void;
  onCancel: () => void;
}

interface PlayerCorkState {
  status: 'waiting' | 'thrown';
  score: number | null;
  wasValid: boolean;
  display: string;
}

interface CorkThrowMessage {
  playerId: string;
  score: number;
  wasValid: boolean;
  display: string;
  timestamp: string;
  round: number;
}

// CSS keyframes for animations
const corkKeyframes = `
@keyframes colorSwipeUp {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes colorSwipeDown {
  0% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(100% 0 0 0); }
}
@keyframes winnerPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
@keyframes winnerSlideIn {
  0% { transform: translateX(-100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes tiePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
`;

function getCorkScore(throwData: DartThrowData): { score: number; valid: boolean; display: string } {
  const { segmentType, baseValue } = throwData;
  if (segmentType === 'SINGLE_INNER') return { score: baseValue, valid: true, display: `${baseValue}` };
  if (segmentType === 'BULL') return { score: 25, valid: true, display: 'BULL' };
  if (segmentType === 'DBL_BULL') return { score: 50, valid: true, display: 'D-BULL' };

  let display = '0';
  if (segmentType === 'TRIPLE') display = `T${baseValue} -> 0`;
  else if (segmentType === 'DOUBLE') display = `D${baseValue} -> 0`;
  else if (segmentType === 'SINGLE_OUTER') display = `outer ${baseValue} -> 0`;
  else if (segmentType === 'MISS') display = 'MISS -> 0';
  return { score: 0, valid: false, display };
}

const resolveProfilePicUrl = (pic?: string): string | undefined => {
  if (!pic) return undefined;
  if (pic.startsWith('http')) return pic;
  if (pic.startsWith('/assets') || pic.startsWith('assets')) return `https://llogb.netlify.app${pic.startsWith('/') ? pic : '/' + pic}`;
  if (pic === 'default-pfp.png') return '/default-pfp.png';
  return `https://sndsyxxcnuwjmjgikzgg.supabase.co/storage/v1/object/public/profilepic/${pic}`;
};

const GREY = '#7E7E7E';
const FONT_NAME = "'Helvetica Condensed', 'Helvetica', Arial, sans-serif";
const FONT_SCORE = "'Helvetica Compressed', 'Helvetica', Arial, sans-serif";

export function CorkScreen({ player1, player2, gameId, visiblePlayerId, isInitiator, onCorkComplete, onCancel }: CorkScreenProps) {
  const { lastThrow, isConnected, connect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const remotePlayerId = visiblePlayerId === player1.id ? player2.id : player1.id;
  const remotePlayerName = visiblePlayerId === player1.id ? player2.name : player1.name;

  // Memoize WebRTC options to prevent infinite re-initialization loop
  const webRTCOptions = useMemo(() => ({
    gameId, localPlayerId: visiblePlayerId, remotePlayerId, isInitiator
  }), [gameId, visiblePlayerId, remotePlayerId, isInitiator]);

  const { localStream, remoteStream, connectionState, error, initialize, disconnect: webrtcDisconnect } = useWebRTC(webRTCOptions);

  const { isOpponentOnline, disconnectCountdown, leaveMatch, opponentLeftMessage } = useGameStatus({
    gameId,
    localPlayerId: visiblePlayerId,
    remotePlayerId,
    remotePlayerName,
    onOpponentLeft: onCancel,
    onOpponentDisconnected: () => console.log('[CorkScreen] Opponent disconnected'),
    onOpponentReconnected: () => console.log('[CorkScreen] Opponent reconnected'),
  });

  const [p1State, setP1State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '-' });
  const [p2State, setP2State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '-' });
  const [tieAlert, setTieAlert] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [corkRound, setCorkRound] = useState(1);
  const [myThrowSent, setMyThrowSent] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const devMode = isDevMode();

  // Responsive scaling
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      // Reference: 1180 x 820 from game screens
      setScale(Math.min(w / 1180, h / 820));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Determine if local player is P1 or P2
  const amP1 = visiblePlayerId === player1.id;
  const isP1Local = amP1;

  // Send cork throw to Supabase channel
  const sendCorkThrow = useCallback(async (score: number, wasValid: boolean, display: string) => {
    if (!channelRef.current || myThrowSent) return;

    const message: CorkThrowMessage = {
      playerId: visiblePlayerId,
      score,
      wasValid,
      display,
      timestamp: new Date().toISOString(),
      round: corkRound,
    };

    console.log('[Cork] Sending throw:', message);
    await channelRef.current.send({
      type: 'broadcast',
      event: 'cork_throw',
      payload: message,
    });
    setMyThrowSent(true);

    // Update local state for my throw
    if (amP1) {
      setP1State({ status: 'thrown', score, wasValid, display });
    } else {
      setP2State({ status: 'thrown', score, wasValid, display });
    }
  }, [channelRef, myThrowSent, visiblePlayerId, corkRound, amP1]);

  // Dev mode: simulate a throw
  const simulateThrow = (type: 'inner' | 'bull' | 'dblbull' | 'miss', value: number = 20) => {
    if (myThrowSent) return;

    const segmentTypes: Record<string, DartThrowData['segmentType']> = {
      inner: 'SINGLE_INNER',
      bull: 'BULL',
      dblbull: 'DBL_BULL',
      miss: 'MISS',
    };
    const fakeThrow: DartThrowData = {
      segment: type === 'bull' ? 'BULL' : type === 'dblbull' ? 'DBL_BULL' : `S${value}`,
      score: type === 'bull' ? 25 : type === 'dblbull' ? 50 : type === 'miss' ? 0 : value,
      multiplier: type === 'dblbull' ? 2 : 1,
      baseValue: type === 'bull' || type === 'dblbull' ? 25 : value,
      segmentType: segmentTypes[type],
      dartNum: 1,
      timestamp: new Date().toISOString(),
    };
    const { score, valid, display } = getCorkScore(fakeThrow);
    sendCorkThrow(score, valid, display);
  };

  // Subscribe to cork channel for throw sync
  useEffect(() => {
    const channelName = `cork:${gameId}`;
    console.log(`[Cork] Subscribing to channel: ${channelName}`);

    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'cork_throw' }, ({ payload }) => {
        const msg = payload as CorkThrowMessage;
        console.log('[Cork] Received throw:', msg);

        if (msg.round !== corkRound) {
          console.log('[Cork] Ignoring throw from different round');
          return;
        }

        if (msg.playerId === player1.id) {
          setP1State({ status: 'thrown', score: msg.score, wasValid: msg.wasValid, display: msg.display });
        } else if (msg.playerId === player2.id) {
          setP2State({ status: 'thrown', score: msg.score, wasValid: msg.wasValid, display: msg.display });
        }
      })
      .subscribe((status) => {
        console.log(`[Cork] Channel subscription status: ${status}`);
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [gameId, corkRound, player1.id, player2.id]);

  // Initialize WebRTC
  useEffect(() => { initialize(); return () => { webrtcDisconnect(); }; }, [initialize, webrtcDisconnect]);

  // Request fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } catch {
        // Fullscreen may fail if no user interaction yet
      }
    };
    enterFullscreen();

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  // Attach remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow || winner || myThrowSent) return;

    const throwTime = new Date(lastThrow.timestamp).getTime();
    if (throwTime <= mountTimeRef.current) return;

    if (lastThrow.timestamp === lastTs) return;
    setLastTs(lastThrow.timestamp);

    const { score, valid, display } = getCorkScore(lastThrow);
    sendCorkThrow(score, valid, display);
  }, [lastThrow, lastTs, winner, myThrowSent, sendCorkThrow]);

  // Check for winner when both have thrown
  useEffect(() => {
    if (p1State.status !== 'thrown' || p2State.status !== 'thrown' || p1State.score === null || p2State.score === null || winner) return;

    setRevealed(true);
    setTimeout(() => {
      if (p1State.score! > p2State.score!) {
        setWinner(player1.id);
        setTimeout(() => onCorkComplete(player1.id), 2500);
      } else if (p2State.score! > p1State.score!) {
        setWinner(player2.id);
        setTimeout(() => onCorkComplete(player2.id), 2500);
      } else {
        setTieAlert(true);
        setTimeout(() => {
          setTieAlert(false);
          setRevealed(false);
          setP1State({ status: 'waiting', score: null, wasValid: false, display: '-' });
          setP2State({ status: 'waiting', score: null, wasValid: false, display: '-' });
          setCorkRound(r => r + 1);
          setMyThrowSent(false);
        }, 2500);
      }
    }, 1000);
  }, [p1State, p2State, winner, player1.id, player2.id, onCorkComplete]);

  // Score display logic - hide opponent until both thrown
  const getScoreDisplay = (state: PlayerCorkState, playerId: string): string => {
    if (state.status === 'waiting') return '-';
    if (revealed) return state.display;
    return playerId === visiblePlayerId ? state.display : '-';
  };

  // Score color - profile color when shown, white dash otherwise
  const getScoreColor = (state: PlayerCorkState, playerId: string, accentColor: string): string => {
    if (state.status === 'waiting') return '#FFFFFF';
    if (revealed || playerId === visiblePlayerId) return accentColor;
    return '#FFFFFF';
  };

  const handleConfirmLeave = async () => {
    setShowLeaveConfirm(false);
    await leaveMatch();
    onCancel();
  };

  const handleRefreshVideo = async () => {
    await webrtcDisconnect();
    await initialize();
  };

  // Custom menu items for UserMenu
  const customMenuItems: CustomMenuItem[] = useMemo(() => [
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
  ], []);

  const handleLogoutAction = () => setShowLeaveConfirm(true);

  // Determine states for UI
  const p1HasThrown = p1State.status === 'thrown';
  const p2HasThrown = p2State.status === 'thrown';
  const p1IsWinner = winner === player1.id;
  const p2IsWinner = winner === player2.id;
  const p1IsLoser = winner !== null && !p1IsWinner;
  const p2IsLoser = winner !== null && !p2IsWinner;

  // Camera border logic: gray -> profile color when thrown, bolder for winner
  const getCameraBorderStyle = (hasThrown: boolean, isWinner: boolean, isLoser: boolean, accentColor: string) => {
    if (isLoser) return { borderColor: GREY, borderWidth: '3px', opacity: 0.5 };
    if (isWinner) return { borderColor: accentColor, borderWidth: '5px', opacity: 1 };
    if (hasThrown) return { borderColor: accentColor, borderWidth: '3px', opacity: 1 };
    return { borderColor: GREY, borderWidth: '3px', opacity: 1 };
  };

  // Player bar background gradient
  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';
  const getColorGradient = (accentColor: string) =>
    `linear-gradient(179.4deg, ${accentColor}33 0.52%, rgba(0, 0, 0, 0.2) 95.46%)`;

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Inject keyframes */}
      <style>{corkKeyframes}</style>

      {/* Game screen background overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url('/assets/gamescreenbackground.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-white text-lg font-bold mb-2">Leave Match?</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Your opponent will be notified and the match will be cancelled.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors">
                Stay
              </button>
              <button onClick={handleConfirmLeave} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Disconnected Countdown Overlay */}
      {disconnectCountdown !== null && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-yellow-600 rounded-xl p-6 max-w-sm w-full text-center">
            <WifiOff className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Opponent Disconnected</h2>
            <p className="text-zinc-400 text-sm mb-4">Waiting for {remotePlayerName} to reconnect...</p>
            <div className="text-4xl font-bold text-yellow-500 mb-2">{disconnectCountdown}s</div>
            <p className="text-zinc-500 text-xs">Match will end if they don't return</p>
          </div>
        </div>
      )}

      {/* Opponent Left Message Overlay */}
      {opponentLeftMessage && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-600 rounded-xl p-6 max-w-sm w-full text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Match Ended</h2>
            <p className="text-zinc-400 text-sm">{opponentLeftMessage}</p>
            <p className="text-zinc-500 text-xs mt-3">Returning to lobby...</p>
          </div>
        </div>
      )}

      {/* BLE Disconnected Overlay - skip in dev mode */}
      {!isConnected && !devMode && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-blue-600 rounded-xl p-6 max-w-sm w-full text-center">
            <Bluetooth className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Board Disconnected</h2>
            <p className="text-zinc-400 text-sm mb-4">Your Granboard connection was lost. Reconnect to continue playing.</p>
            <button
              onClick={connect}
              disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Reconnect Board'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="relative flex items-center justify-center shrink-0 z-20"
        style={{ height: `calc(60 * ${scale})`, padding: `calc(10 * ${scale})` }}
      >
        {/* Back button */}
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="absolute left-0 p-2 text-white hover:opacity-80 transition-opacity"
          style={{ left: `calc(10 * ${scale})` }}
          aria-label="Back"
        >
          <ChevronLeft style={{ width: `calc(28 * ${scale})`, height: `calc(28 * ${scale})` }} />
        </button>

        {/* Title */}
        <h1
          className="text-white uppercase tracking-wider font-bold"
          style={{ fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})` }}
        >
          THROW CORK{corkRound > 1 ? ` R${corkRound}` : ''}
        </h1>

        {/* User menu */}
        <div className="absolute right-0" style={{ right: `calc(10 * ${scale})` }}>
          <UserMenu
            onLogout={handleLogoutAction}
            customItems={customMenuItems}
            size="sm"
          />
        </div>
      </div>

      {/* Opponent offline indicator */}
      {!isOpponentOnline && disconnectCountdown === null && (
        <div
          className="bg-yellow-600/20 border-b border-yellow-600 flex items-center justify-center gap-2 z-10"
          style={{ padding: `calc(6 * ${scale})` }}
        >
          <WifiOff style={{ width: `calc(14 * ${scale})`, height: `calc(14 * ${scale})` }} className="text-yellow-500" />
          <span className="text-yellow-500" style={{ fontSize: `calc(14 * ${scale})` }}>{remotePlayerName} appears offline</span>
        </div>
      )}

      {/* Main content - Video feeds */}
      <div className="flex-1 flex items-center justify-center relative z-10" style={{ padding: `calc(20 * ${scale})` }}>
        {/* Tie overlay */}
        {tieAlert && (
          <div
            className="absolute z-50 bg-yellow-600 text-black px-8 py-4 rounded-xl"
            style={{
              animation: 'tiePulse 0.5s ease-in-out infinite',
              fontSize: `calc(28 * ${scale})`,
              fontFamily: FONT_NAME,
              fontWeight: 700,
            }}
          >
            TIE! Both rethrow!
          </div>
        )}

        {/* Video container */}
        <div
          className="flex items-stretch justify-center gap-4 w-full"
          style={{ maxWidth: `calc(900 * ${scale})`, gap: `calc(30 * ${scale})` }}
        >
          {/* Player 1 Video */}
          <div className="flex-1 relative">
            {(() => {
              const borderStyle = getCameraBorderStyle(p1HasThrown, p1IsWinner, p1IsLoser, player1.accentColor);
              return (
                <div
                  className="w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden relative transition-all duration-500"
                  style={{
                    borderStyle: 'solid',
                    borderColor: borderStyle.borderColor,
                    borderWidth: borderStyle.borderWidth,
                    opacity: borderStyle.opacity,
                  }}
                >
                  {isP1Local ? (
                    localStream ? (
                      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500" style={{ fontSize: `calc(14 * ${scale})` }}>
                        {devMode ? 'No camera (dev mode)' : error || 'Starting camera...'}
                      </div>
                    )
                  ) : (
                    remoteStream ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Avatar style={{ width: `calc(60 * ${scale})`, height: `calc(60 * ${scale})` }}>
                          <AvatarImage src={resolveProfilePicUrl(player1.profilePic)} />
                          <AvatarFallback className="bg-zinc-800 text-white" style={{ fontSize: `calc(24 * ${scale})` }}>
                            {player1.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )
                  )}

                  {/* Winner banner overlay */}
                  {p1IsWinner && (
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                      style={{
                        height: `calc(50 * ${scale})`,
                        background: `linear-gradient(90deg, transparent 0%, ${player1.accentColor}CC 20%, ${player1.accentColor}CC 80%, transparent 100%)`,
                        animation: 'winnerSlideIn 0.5s ease-out forwards',
                      }}
                    >
                      <span
                        className="text-white font-bold uppercase tracking-widest"
                        style={{ fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                      >
                        WINNER
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* VS divider */}
          <div className="flex items-center">
            <span
              className="text-zinc-600 font-bold"
              style={{ fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})` }}
            >
              VS
            </span>
          </div>

          {/* Player 2 Video */}
          <div className="flex-1 relative">
            {(() => {
              const borderStyle = getCameraBorderStyle(p2HasThrown, p2IsWinner, p2IsLoser, player2.accentColor);
              return (
                <div
                  className="w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden relative transition-all duration-500"
                  style={{
                    borderStyle: 'solid',
                    borderColor: borderStyle.borderColor,
                    borderWidth: borderStyle.borderWidth,
                    opacity: borderStyle.opacity,
                  }}
                >
                  {!isP1Local ? (
                    localStream ? (
                      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500" style={{ fontSize: `calc(14 * ${scale})` }}>
                        {devMode ? 'No camera (dev mode)' : error || 'Starting camera...'}
                      </div>
                    )
                  ) : (
                    remoteStream ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Avatar style={{ width: `calc(60 * ${scale})`, height: `calc(60 * ${scale})` }}>
                          <AvatarImage src={resolveProfilePicUrl(player2.profilePic)} />
                          <AvatarFallback className="bg-zinc-800 text-white" style={{ fontSize: `calc(24 * ${scale})` }}>
                            {player2.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )
                  )}

                  {/* Winner banner overlay */}
                  {p2IsWinner && (
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                      style={{
                        height: `calc(50 * ${scale})`,
                        background: `linear-gradient(90deg, transparent 0%, ${player2.accentColor}CC 20%, ${player2.accentColor}CC 80%, transparent 100%)`,
                        animation: 'winnerSlideIn 0.5s ease-out forwards',
                      }}
                    >
                      <span
                        className="text-white font-bold uppercase tracking-widest"
                        style={{ fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                      >
                        WINNER
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Player Bars at bottom */}
      <div className="relative z-20" style={{ height: `calc(90 * ${scale})` }}>
        {/* Player 1 Bar - Left */}
        <div style={{
          position: 'absolute',
          width: `calc(450 * ${scale})`,
          height: `calc(90 * ${scale})`,
          left: '0px',
          bottom: '0px',
          borderTopRightRadius: `calc(16 * ${scale})`,
          overflow: 'hidden',
        }}>
          {/* Grey base */}
          <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />

          {/* Color fill overlay with swipe animation */}
          {p1HasThrown && !p1IsLoser && (
            <div
              key={`p1-bar-${corkRound}`}
              style={{
                position: 'absolute',
                inset: 0,
                background: getColorGradient(player1.accentColor),
                animation: 'colorSwipeUp 0.5s ease-out forwards',
              }}
            />
          )}

          {/* Winner bar - bolder */}
          {p1IsWinner && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: player1.accentColor,
            }} />
          )}

          {/* Avatar on left outer edge */}
          <div style={{
            position: 'absolute',
            width: `calc(60 * ${scale})`,
            height: `calc(60 * ${scale})`,
            left: `calc(10 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#000',
            border: `3px solid ${p1HasThrown && !p1IsLoser ? player1.accentColor : GREY}`,
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: 2,
            transition: 'border-color 0.3s ease',
            opacity: p1IsLoser ? 0.5 : 1,
          }}>
            <Avatar className="w-full h-full">
              <AvatarImage src={resolveProfilePicUrl(player1.profilePic)} />
              <AvatarFallback className="bg-zinc-800 text-white">{player1.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>

          {/* Name */}
          <span style={{
            position: 'absolute',
            left: `calc(80 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: FONT_NAME,
            fontWeight: 400,
            fontSize: `calc(28 * ${scale})`,
            color: p1IsLoser ? GREY : (p1HasThrown ? '#FFFFFF' : GREY),
            transition: 'color 0.3s ease',
            zIndex: 3,
          }}>
            {player1.name}
          </span>

          {/* Score on right side of bar */}
          <span style={{
            position: 'absolute',
            right: `calc(20 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(56 * ${scale})`,
            color: getScoreColor(p1State, player1.id, player1.accentColor),
            opacity: p1IsLoser ? 0.5 : 1,
            transition: 'color 0.3s ease',
            zIndex: 3,
          }}>
            {getScoreDisplay(p1State, player1.id)}
          </span>
        </div>

        {/* Player 2 Bar - Right */}
        <div style={{
          position: 'absolute',
          width: `calc(450 * ${scale})`,
          height: `calc(90 * ${scale})`,
          right: '0px',
          bottom: '0px',
          borderTopLeftRadius: `calc(16 * ${scale})`,
          overflow: 'hidden',
        }}>
          {/* Grey base */}
          <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />

          {/* Color fill overlay with swipe animation */}
          {p2HasThrown && !p2IsLoser && (
            <div
              key={`p2-bar-${corkRound}`}
              style={{
                position: 'absolute',
                inset: 0,
                background: getColorGradient(player2.accentColor),
                animation: 'colorSwipeUp 0.5s ease-out forwards',
              }}
            />
          )}

          {/* Winner bar - bolder */}
          {p2IsWinner && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: player2.accentColor,
            }} />
          )}

          {/* Score on left side of bar */}
          <span style={{
            position: 'absolute',
            left: `calc(20 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(56 * ${scale})`,
            color: getScoreColor(p2State, player2.id, player2.accentColor),
            opacity: p2IsLoser ? 0.5 : 1,
            transition: 'color 0.3s ease',
            zIndex: 3,
          }}>
            {getScoreDisplay(p2State, player2.id)}
          </span>

          {/* Name */}
          <span style={{
            position: 'absolute',
            right: `calc(80 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: FONT_NAME,
            fontWeight: 400,
            fontSize: `calc(28 * ${scale})`,
            color: p2IsLoser ? GREY : (p2HasThrown ? '#FFFFFF' : GREY),
            transition: 'color 0.3s ease',
            textAlign: 'right',
            zIndex: 3,
          }}>
            {player2.name}
          </span>

          {/* Avatar on right outer edge */}
          <div style={{
            position: 'absolute',
            width: `calc(60 * ${scale})`,
            height: `calc(60 * ${scale})`,
            right: `calc(10 * ${scale})`,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#000',
            border: `3px solid ${p2HasThrown && !p2IsLoser ? player2.accentColor : GREY}`,
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: 2,
            transition: 'border-color 0.3s ease',
            opacity: p2IsLoser ? 0.5 : 1,
          }}>
            <Avatar className="w-full h-full">
              <AvatarImage src={resolveProfilePicUrl(player2.profilePic)} />
              <AvatarFallback className="bg-zinc-800 text-white">{player2.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Dev Mode Throw Simulator */}
      {devMode && (
        <div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 p-3 bg-orange-900/50 border border-orange-600 rounded-lg z-30"
          style={{ minWidth: `calc(400 * ${scale})` }}
        >
          <p className="text-orange-400 text-xs font-bold mb-2 text-center">
            DEV MODE - Throw Simulator {myThrowSent ? '(Already thrown)' : ''}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[1, 5, 10, 15, 20].map(v => (
              <button
                key={v}
                onClick={() => simulateThrow('inner', v)}
                disabled={myThrowSent}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs rounded"
              >
                {v}
              </button>
            ))}
            <button
              onClick={() => simulateThrow('bull')}
              disabled={myThrowSent}
              className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-green-900 disabled:text-green-700 text-white text-xs rounded"
            >
              BULL
            </button>
            <button
              onClick={() => simulateThrow('dblbull')}
              disabled={myThrowSent}
              className="px-3 py-1 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:text-red-700 text-white text-xs rounded"
            >
              D-BULL
            </button>
            <button
              onClick={() => simulateThrow('miss')}
              disabled={myThrowSent}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 text-zinc-400 text-xs rounded"
            >
              MISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
