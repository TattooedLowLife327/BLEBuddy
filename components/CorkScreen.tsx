import { useState, useEffect, useRef } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { DartThrowData } from '../utils/ble/bleConnection';

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

function getCorkScore(throwData: DartThrowData): { score: number; valid: boolean; display: string } {
  const { segmentType, baseValue } = throwData;
  if (segmentType === 'SINGLE_INNER') return { score: baseValue, valid: true, display: `${baseValue}` };
  if (segmentType === 'BULL') return { score: 25, valid: true, display: 'BULL' };
  if (segmentType === 'DBL_BULL') return { score: 50, valid: true, display: 'D-BULL' };
  
  let display = '0';
  if (segmentType === 'TRIPLE') display = `T${baseValue} → 0`;
  else if (segmentType === 'DOUBLE') display = `D${baseValue} → 0`;
  else if (segmentType === 'SINGLE_OUTER') display = `outer ${baseValue} → 0`;
  else if (segmentType === 'MISS') display = 'MISS → 0';
  return { score: 0, valid: false, display };
}

const resolveProfilePicUrl = (pic?: string): string | undefined => {
  if (!pic) return undefined;
  if (pic.startsWith('http')) return pic;
  if (pic.startsWith('/assets') || pic.startsWith('assets')) return `https://llogb.netlify.app${pic.startsWith('/') ? pic : '/' + pic}`;
  if (pic === 'default-pfp.png') return '/default-pfp.png';
  return `https://sndsyxxcnuwjmjgikzgg.supabase.co/storage/v1/object/public/profilepic/${pic}`;
};

export function CorkScreen({ player1, player2, gameId, visiblePlayerId, isInitiator, onCorkComplete, onCancel }: CorkScreenProps) {
  const { lastThrow, isConnected } = useBLE();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const remotePlayerId = visiblePlayerId === player1.id ? player2.id : player1.id;
  const { localStream, remoteStream, connectionState, error, initialize, disconnect } = useWebRTC({
    gameId, localPlayerId: visiblePlayerId, remotePlayerId, isInitiator
  });

  const [p1State, setP1State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '—' });
  const [p2State, setP2State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '—' });
  const [tieAlert, setTieAlert] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [currentThrower, setCurrentThrower] = useState<1 | 2>(1);
  const [lastTs, setLastTs] = useState<string | null>(null);

  useEffect(() => { initialize(); return () => { disconnect(); }; }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!lastThrow || lastThrow.timestamp === lastTs || winner) return;
    setLastTs(lastThrow.timestamp);
    const { score, valid, display } = getCorkScore(lastThrow);
    if (currentThrower === 1 && p1State.status === 'waiting') {
      setP1State({ status: 'thrown', score, wasValid: valid, display });
      setCurrentThrower(2);
    } else if (currentThrower === 2 && p2State.status === 'waiting') {
      setP2State({ status: 'thrown', score, wasValid: valid, display });
    }
  }, [lastThrow]);

  useEffect(() => {
    if (p1State.status !== 'thrown' || p2State.status !== 'thrown' || p1State.score === null || p2State.score === null || winner) return;
    setRevealed(true);
    setTimeout(() => {
      if (p1State.score! > p2State.score!) { setWinner(player1.id); setTimeout(() => onCorkComplete(player1.id), 2000); }
      else if (p2State.score! > p1State.score!) { setWinner(player2.id); setTimeout(() => onCorkComplete(player2.id), 2000); }
      else {
        setTieAlert(true);
        setTimeout(() => {
          setTieAlert(false); setRevealed(false);
          setP1State({ status: 'waiting', score: null, wasValid: false, display: '—' });
          setP2State({ status: 'waiting', score: null, wasValid: false, display: '—' });
          setCurrentThrower(1);
        }, 2500);
      }
    }, 1000);
  }, [p1State, p2State]);

  const getDisplay = (state: PlayerCorkState, pid: string) => {
    if (state.status === 'waiting') return '—';
    if (revealed) return state.display;
    return pid === visiblePlayerId ? state.display : '✓';
  };

  const isP1Local = player1.id === visiblePlayerId;

  const renderPlayer = (player: typeof player1, state: PlayerCorkState, pNum: 1 | 2, isLocal: boolean) => {
    const isThrowing = currentThrower === pNum && state.status === 'waiting';
    const showResult = revealed || player.id === visiblePlayerId;
    const borderColor = isThrowing ? 'border-white' : state.status === 'thrown' && showResult ? (state.wasValid ? 'border-green-500/50' : 'border-red-500/50') : 'border-zinc-700';

    return (
      <div className={`flex-1 p-4 rounded-2xl border-2 ${borderColor}`} style={{ backgroundColor: 'rgba(39,39,42,0.5)' }}>
        <div className="flex flex-col items-center">
          <div className="w-full aspect-video bg-zinc-900 rounded-lg mb-3 overflow-hidden relative" style={{ borderColor: player.accentColor, borderWidth: '2px' }}>
            {isLocal ? (
              localStream ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">{error || 'Starting camera...'}</div>
            ) : (
              remoteStream ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Avatar className="w-16 h-16"><AvatarImage src={resolveProfilePicUrl(player.profilePic)} /><AvatarFallback className="bg-zinc-800 text-white text-xl">{player.name.charAt(0)}</AvatarFallback></Avatar>
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-white font-semibold text-sm truncate">{player.name}</p>
            </div>
          </div>
          <p className={`text-sm mb-2 ${isThrowing ? 'text-yellow-400' : 'text-zinc-400'}`}>
            {state.status === 'thrown' ? (revealed ? '' : 'Thrown!') : isThrowing ? 'Throw now!' : 'Waiting...'}
          </p>
          <div className="text-3xl font-bold" style={{ color: state.status === 'waiting' ? '#71717a' : showResult ? (state.wasValid ? '#22c55e' : '#ef4444') : '#a1a1aa' }}>
            {getDisplay(state, player.id)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">CORK FOR FIRST</h1>
        <p className="text-zinc-500 text-xs">Inner singles & bulls = face value | Others = 0</p>
      </div>

      {tieAlert && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-yellow-600 text-black px-8 py-4 rounded-xl animate-pulse"><p className="text-xl font-bold">TIE! Both rethrow!</p></div>}
      {winner && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-xl"><p className="text-xl font-bold">{winner === player1.id ? player1.name : player2.name} throws first!</p></div>}

      <div className="flex items-stretch justify-center gap-4 w-full max-w-4xl">
        {renderPlayer(player1, p1State, 1, isP1Local)}
        <div className="flex items-center"><div className="text-zinc-600 text-xl font-bold">VS</div></div>
        {renderPlayer(player2, p2State, 2, !isP1Local)}
      </div>

      <div className="mt-4 text-center">
        {!isConnected ? <p className="text-red-400 text-xs">⚠️ Board not connected</p> : <p className="text-green-400 text-xs">✓ Board connected</p>}
        <p className="text-zinc-600 text-xs mt-1">Video: {connectionState}</p>
      </div>

      <button onClick={onCancel} className="mt-4 px-6 py-2 text-zinc-400 hover:text-white text-sm">Cancel</button>
    </div>
  );
}
