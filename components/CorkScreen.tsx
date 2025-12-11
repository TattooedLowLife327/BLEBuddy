import { useState, useEffect } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { DartThrowData, SegmentType } from '../utils/ble/bleConnection';

interface CorkScreenProps {
  player1: {
    id: string;
    name: string;
    profilePic?: string;
    accentColor: string;
  };
  player2: {
visiblePlayerId: string; // Which player is viewing this screen
  player2: {
    id: string;
    name: string;
    profilePic?: string;
    accentColor: string;
  };
  visiblePlayerId: string; // Which player is viewing this screen
  onCorkComplete: (firstPlayerId: string) => void;
  onCancel: () => void;
}

type CorkStatus = 'waiting' | 'thrown';

interface PlayerCorkState {
  status: CorkStatus;
  score: number | null;
  lastThrow: DartThrowData | null;
  wasValid: boolean;
  display: string;
}

// Calculate cork score from throw data
// Valid = face value, Invalid = 0
function getCorkScore(throwData: DartThrowData): { score: number; valid: boolean; display: string } {
  const { segmentType, baseValue } = throwData;
  
  if (segmentType === 'SINGLE_INNER') {
    return { score: baseValue, valid: true, display: `${baseValue}` };
  }
  
  if (segmentType === 'BULL') {
    return { score: 25, valid: true, display: 'BULL' };
  }
  
  if (segmentType === 'DBL_BULL') {
    return { score: 50, valid: true, display: 'D-BULL' };
  }
  
  // Invalid throws = 0 points
  let display = '0';
  switch (segmentType) {
    case 'TRIPLE':
      display = `T${baseValue} → 0`;
      break;
    case 'DOUBLE':
      display = `D${baseValue} → 0`;
      break;
    case 'SINGLE_OUTER':
      display = `outer ${baseValue} → 0`;
      break;
    case 'MISS':
      display = 'MISS → 0';
      break;
    default:
      display = '0';
  }
  
  return { score: 0, valid: false, display };
}

// Resolve profile pic URL
const resolveProfilePicUrl = (profilepic: string | undefined): string | undefined => {
  if (!profilepic) return undefined;
  if (profilepic.startsWith('http')) return profilepic;
  if (profilepic.startsWith('/assets') || profilepic.startsWith('assets')) {
    const path = profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
    return `https://llogb.netlify.app${path}`;
  }
  if (profilepic === 'default-pfp.png') return '/default-pfp.png';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sndsyxxcnuwjmjgikzgg.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profilepic/${profilepic}`;
};

export function CorkScreen({ player1, player2, visiblePlayerId, onCorkComplete, onCancel }: CorkScreenProps) {
  const { lastThrow, isConnected } = useBLE();
  
  const [player1State, setPlayer1State] = useState<PlayerCorkState>({
    status: 'waiting',
    score: null,
    lastThrow: null,
    wasValid: false,
    display: '—',
  });
  
  const [player2State, setPlayer2State] = useState<PlayerCorkState>({
    status: 'waiting',
    score: null,
    lastThrow: null,
    wasValid: false,
    display: '—',
  });
  
  const [tieAlert, setTieAlert] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false); // Both thrown, show results
  
  // Track which player's turn
  const [currentThrower, setCurrentThrower] = useState<1 | 2>(1);
  
  // Track last processed throw to avoid duplicates
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<string | null>(null);
  
  // Process incoming throws
  useEffect(() => {
    if (!lastThrow) return;
    if (lastThrow.timestamp === lastProcessedTimestamp) return;
    if (winner) return;
    
    setLastProcessedTimestamp(lastThrow.timestamp);
    
    const { score, valid, display } = getCorkScore(lastThrow);
    
    if (currentThrower === 1 && player1State.status === 'waiting') {
      setPlayer1State({
        status: 'thrown',
        score,
        lastThrow,
        wasValid: valid,
        display,
      });
      setCurrentThrower(2);
    } else if (currentThrower === 2 && player2State.status === 'waiting') {
      setPlayer2State({
        status: 'thrown',
        score,
        lastThrow,
        wasValid: valid,
        display,
      });
    }
  }, [lastThrow]);
  
  // Check for winner when both have thrown
  useEffect(() => {
    if (player1State.status !== 'thrown' || player2State.status !== 'thrown') return;
    if (player1State.score === null || player2State.score === null) return;
    if (winner) return;
    
    // Reveal both scores
    setRevealed(true);
    
    const score1 = player1State.score;
    const score2 = player2State.score;
    
    // Short delay to show scores before announcing winner
    setTimeout(() => {
      if (score1 > score2) {
        setWinner(player1.id);
        setTimeout(() => onCorkComplete(player1.id), 2000);
      } else if (score2 > score1) {
        setWinner(player2.id);
        setTimeout(() => onCorkComplete(player2.id), 2000);
      } else {
        // TIE - reset for rethrow
        setTieAlert(true);
        setTimeout(() => {
          setTieAlert(false);
          setRevealed(false);
          setPlayer1State({ status: 'waiting', score: null, lastThrow: null, wasValid: false, display: '—' });
          setPlayer2State({ status: 'waiting', score: null, lastThrow: null, wasValid: false, display: '—' });
          setCurrentThrower(1);
        }, 2500);
      }
    }, 1000);
  }, [player1State, player2State]);
  
  // Determine what to show for each player
  const getScoreDisplay = (state: PlayerCorkState, playerId: string): string => {
    // Not thrown yet
    if (state.status === 'waiting') return '—';
    
    // Both have thrown - reveal all
    if (revealed) return state.display;
    
    // Only show YOUR score, hide opponent's
    if (playerId === visiblePlayerId) {
      return state.display;
    }
    
    // Opponent has thrown but not revealed yet
    return '✓';
  };
  
  const getStatusText = (state: PlayerCorkState, playerNum: 1 | 2): string => {
    if (state.status === 'thrown') {
      if (revealed) return '';
      return 'Thrown!';
    }
    if (currentThrower === playerNum) return 'Throw now!';
    return 'Waiting...';
  };
  
  const getCardStyle = (state: PlayerCorkState, playerId: string, playerNum: 1 | 2) => {
    const isCurrentThrower = currentThrower === playerNum && state.status === 'waiting';
    const isMe = playerId === visiblePlayerId;
    
    if (isCurrentThrower) {
      return {
        border: 'border-white shadow-lg shadow-white/20',
        bg: 'rgba(39, 39, 42, 0.5)',
      };
    }
    
    if (state.status === 'thrown') {
      // Only show color coding when revealed OR if it's your own score
      if (revealed || isMe) {
        return {
          border: state.wasValid ? 'border-green-500/50' : 'border-red-500/50',
          bg: state.wasValid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        };
      }
      // Opponent thrown but hidden
      return {
        border: 'border-zinc-500',
        bg: 'rgba(39, 39, 42, 0.5)',
      };
    }
    
    return {
      border: 'border-zinc-700',
      bg: 'rgba(39, 39, 42, 0.5)',
    };
  };
  
  const getScoreColor = (state: PlayerCorkState, playerId: string): string => {
    if (state.status === 'waiting') return '#71717a';
    
    const isMe = playerId === visiblePlayerId;
    
    if (revealed || isMe) {
      return state.wasValid ? '#22c55e' : '#ef4444';
    }
    
    // Opponent - just show checkmark in neutral color
    return '#a1a1aa';
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">CORK FOR FIRST</h1>
        <p className="text-zinc-400 text-sm">
          Inner singles & bulls = face value
        </p>
        <p className="text-zinc-500 text-xs mt-1">
          Triples, doubles, outer singles, miss = 0
        </p>
      </div>
      
      {/* Tie alert */}
      {tieAlert && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-yellow-600 text-black px-8 py-4 rounded-xl shadow-2xl animate-pulse">
          <p className="text-xl font-bold text-center">TIE! Both rethrow!</p>
        </div>
      )}
      
      {/* Winner announcement */}
      {winner && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-xl shadow-2xl">
          <p className="text-xl font-bold text-center">
            {winner === player1.id ? player1.name : player2.name} throws first!
          </p>
        </div>
      )}
      
      {/* Players */}
      <div className="flex items-center justify-center gap-8 w-full max-w-2xl">
        {/* Player 1 */}
        {(() => {
          const style = getCardStyle(player1State, player1.id, 1);
          return (
            <div 
              className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-300 ${style.border}`}
              style={{ backgroundColor: style.bg }}
            >
              <div className="flex flex-col items-center">
                <Avatar 
                  className="w-20 h-20 border-4 mb-3"
                  style={{ borderColor: player1.accentColor }}
                >
                  <AvatarImage src={resolveProfilePicUrl(player1.profilePic)} />
                  <AvatarFallback className="bg-zinc-800 text-white text-2xl">
                    {player1.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-white font-semibold text-lg mb-1">{player1.name}</p>
                <p className={`text-sm mb-4 ${currentThrower === 1 && player1State.status === 'waiting' ? 'text-yellow-400' : 'text-zinc-400'}`}>
                  {getStatusText(player1State, 1)}
                </p>
                <div 
                  className="text-4xl font-bold text-center"
                  style={{ color: getScoreColor(player1State, player1.id) }}
                >
                  {getScoreDisplay(player1State, player1.id)}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* VS */}
        <div className="text-zinc-600 text-2xl font-bold">VS</div>
        
        {/* Player 2 */}
        {(() => {
          const style = getCardStyle(player2State, player2.id, 2);
          return (
            <div 
              className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-300 ${style.border}`}
              style={{ backgroundColor: style.bg }}
            >
              <div className="flex flex-col items-center">
                <Avatar 
                  className="w-20 h-20 border-4 mb-3"
                  style={{ borderColor: player2.accentColor }}
                >
                  <AvatarImage src={resolveProfilePicUrl(player2.profilePic)} />
                  <AvatarFallback className="bg-zinc-800 text-white text-2xl">
                    {player2.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-white font-semibold text-lg mb-1">{player2.name}</p>
                <p className={`text-sm mb-4 ${currentThrower === 2 && player2State.status === 'waiting' ? 'text-yellow-400' : 'text-zinc-400'}`}>
                  {getStatusText(player2State, 2)}
                </p>
                <div 
                  className="text-4xl font-bold text-center"
                  style={{ color: getScoreColor(player2State, player2.id) }}
                >
                  {getScoreDisplay(player2State, player2.id)}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* BLE Status */}
      <div className="mt-8 text-center">
        {!isConnected ? (
          <p className="text-red-400 text-sm">⚠️ Board not connected - Connect to Granboard first</p>
        ) : (
          <p className="text-green-400 text-sm">✓ Board connected - Throw when ready</p>
        )}
      </div>
      
      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="mt-6 px-6 py-2 text-zinc-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
