import { useState, useEffect, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { createClient } from '../utils/supabase/client';
import { playSound } from '../utils/sounds';
import { REQUEST_TIMEOUT_MS } from '../utils/constants';

const REQUEST_TIMEOUT_SECONDS = REQUEST_TIMEOUT_MS / 1000;

interface ChallengerStats {
  granid: string | null;
  overallLetter: string | null;
  overallNumeric: number;
  mprLetter: string | null;
  mprNumeric: number;
  pprLetter: string | null;
  pprNumeric: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
}

interface IncomingRequestModalProps {
  request: {
    id: string;
    player1_id: string;
    player1_granboard_name: string;
    game_type?: string;
    game_config?: {
      legs?: number;
      games?: string[];
      handicap?: boolean;
      format?: {
        inOut?: 'do' | 'mo' | 'mimo' | 'dido' | null;
        bull?: 'full' | 'split' | null;
      };
    };
  };
  onAccept: () => void;
  onDecline: () => void;
  onTimeout?: () => void; // Called when request times out
  bleConnected?: boolean;
  onBLEConnect?: () => Promise<{ success: boolean; error?: string }>;
}

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function IncomingRequestModal({ request, onAccept, onDecline, onTimeout, bleConnected = true, onBLEConnect }: IncomingRequestModalProps) {
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileColor, setProfileColor] = useState('#a855f7');
  const [stats, setStats] = useState<ChallengerStats | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(REQUEST_TIMEOUT_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOutRef = useRef(false);

  const supabase = createClient();

  // Countdown timer
  useEffect(() => {
    setTimeRemaining(REQUEST_TIMEOUT_SECONDS);
    hasTimedOutRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer expired
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (!hasTimedOutRef.current) {
            hasTimedOutRef.current = true;
            onTimeout?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [request.id, onTimeout]);

  // Play incoming request sound when modal is shown
  useEffect(() => {
    playSound('gameRequest');
  }, [request.id]);

  // Parse game config
  const gameConfig = request.game_config;
  const legs = gameConfig?.legs || 1;
  const games = gameConfig?.games || [];
  const handicap = gameConfig?.handicap || false;
  const format = gameConfig?.format;

  // Format display
  const formatLabel = useMemo(() => {
    const parts: string[] = [];
    if (format?.inOut) {
      const inOutLabels: Record<string, string> = { do: 'Do', mo: 'Mo', mimo: 'MiMo', dido: 'DiDo' };
      parts.push(inOutLabels[format.inOut] || '');
    }
    if (format?.bull) {
      parts.push(format.bull === 'full' ? 'Full Bull' : 'Split Bull');
    }
    return parts.length > 0 ? parts.join(' / ') : null;
  }, [format]);

  // Games display
  const gamesDisplay = useMemo(() => {
    if (games.length === 0) return request.game_type || '501';
    if (legs === 1) return games[0] || '501';
    return `${legs} Legs: ${games.filter(g => g).join(', ')}`;
  }, [games, legs, request.game_type]);

  useEffect(() => {
    async function fetchChallengerData() {
      try {
        const playerId = request.player1_id;

        // Helper to resolve profile pic URL
        const resolveProfilePicUrl = (pic: string): string => {
          if (pic.startsWith('http')) {
            return pic;
          } else if (pic.includes('LowLifeStore')) {
            const path = pic.startsWith('/') ? pic : `/${pic}`;
            return `https://www.lowlifesofgranboard.com${path}`;
          } else if (pic.startsWith('/assets') || pic.startsWith('assets') || pic === 'default-pfp.png') {
            return pic.startsWith('/') ? pic : `/${pic}`;
          } else {
            const { data: urlData } = supabase.storage.from('profilepic').getPublicUrl(pic);
            return urlData.publicUrl;
          }
        };

        // Try player schema first
        let isYouth = false;
        const playerSchema = (supabase as any).schema('player');
        const { data: playerProfile, error: playerError } = await playerSchema
          .from('player_profiles')
          .select('id, profilepic, profilecolor')
          .eq('id', playerId)
          .single();

        if (playerError || !playerProfile) {
          // Try youth schema
          isYouth = true;
          const youthSchema = (supabase as any).schema('youth');
          const { data: youthProfile } = await youthSchema
            .from('youth_profiles')
            .select('id, profilepic, profilecolor')
            .eq('id', playerId)
            .single();

          if (youthProfile) {
            if (youthProfile.profilepic) setProfilePic(resolveProfilePicUrl(youthProfile.profilepic));
            if (youthProfile.profilecolor) setProfileColor(youthProfile.profilecolor);
          }
        } else {
          if (playerProfile.profilepic) setProfilePic(resolveProfilePicUrl(playerProfile.profilepic));
          if (playerProfile.profilecolor) setProfileColor(playerProfile.profilecolor);
        }

        // Fetch stats
        const statsSchema = isYouth ? (supabase as any).schema('youth') : (supabase as any).schema('player');
        const { data: statsData } = await statsSchema
          .from(isYouth ? 'youth_stats' : 'player_stats')
          .select('granid, overall_letter, overall_numeric, mpr_letter, mpr_numeric, ppr_letter, ppr_numeric, solo_games_played, solo_wins, solo_win_rate')
          .eq('id', playerId)
          .single();

        if (statsData) {
          setStats({
            granid: statsData.granid || null,
            overallLetter: statsData.overall_letter || null,
            overallNumeric: statsData.overall_numeric || 0,
            mprLetter: statsData.mpr_letter || null,
            mprNumeric: statsData.mpr_numeric || 0,
            pprLetter: statsData.ppr_letter || null,
            pprNumeric: statsData.ppr_numeric || 0,
            gamesPlayed: statsData.solo_games_played || 0,
            wins: statsData.solo_wins || 0,
            winRate: statsData.solo_win_rate || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching challenger data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchChallengerData();
  }, [request.player1_id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div
        className="rounded-lg border bg-zinc-900/90 overflow-hidden w-[360px] max-w-full"
        style={{
          borderColor: profileColor,
          boxShadow: `0 0 30px ${hexToRgba(profileColor, 0.5)}`,
        }}
      >
        {/* Countdown Timer Bar */}
        <div className="relative h-2 bg-zinc-800">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(timeRemaining / REQUEST_TIMEOUT_SECONDS) * 100}%`,
              backgroundColor: timeRemaining <= 3 ? '#ef4444' : profileColor,
            }}
          />
        </div>

        {/* Timer Display */}
        <div className="text-center py-2 border-b" style={{ borderColor: profileColor }}>
          <span
            className="text-sm font-bold"
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              color: timeRemaining <= 3 ? '#ef4444' : '#fff',
            }}
          >
            {timeRemaining}s to respond
          </span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: profileColor }}>
          <Avatar
            className="w-14 h-14 border-2"
            style={{
              borderColor: profileColor,
              boxShadow: `0 0 20px ${hexToRgba(profileColor, 0.6)}`,
            }}
          >
            <AvatarImage src={profilePic || undefined} />
            <AvatarFallback className="bg-white/10 text-white text-xl">
              {request.player1_granboard_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2
              className="text-xl"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', color: profileColor }}
            >
              {request.player1_granboard_name}
            </h2>
            {stats?.granid && (
              <p className="text-gray-400 text-xs" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                {stats.granid}
              </p>
            )}
            <p className="text-gray-300 text-sm mt-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              wants to play!
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="px-4 py-3 border-b" style={{ borderColor: profileColor }}>
          {loading ? (
            <div className="text-gray-400 text-sm text-center" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Loading stats...
            </div>
          ) : stats ? (
            <>
              {/* Rating Cards - 3 columns */}
              <div className="grid grid-cols-3 gap-4 mb-3">
                {/* 01 AVG */}
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    01 AVG
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: profileColor }}
                  >
                    {stats.pprLetter || '--'}
                  </div>
                  <div className="text-sm text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.pprNumeric > 0 ? stats.pprNumeric.toFixed(2) : '--'}
                  </div>
                </div>

                {/* OVERALL */}
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    OVERALL
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: profileColor }}
                  >
                    {stats.overallLetter || '--'}
                  </div>
                  <div className="text-sm text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.overallNumeric > 0 ? stats.overallNumeric.toFixed(2) : '--'}
                  </div>
                </div>

                {/* CR AVG */}
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    CR AVG
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: profileColor }}
                  >
                    {stats.mprLetter || '--'}
                  </div>
                  <div className="text-sm text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.mprNumeric > 0 ? stats.mprNumeric.toFixed(2) : '--'}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[1px] w-full mb-3" style={{ backgroundColor: profileColor }} />

              {/* Game Stats */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Games</span>
                  <div className="text-white font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.gamesPlayed}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Wins</span>
                  <div className="text-white font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.wins}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Win Rate</span>
                  <div className="text-white font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {stats.winRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-sm text-center" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              No stats available
            </div>
          )}
        </div>

        {/* Game Format Section */}
        <div className="px-4 py-3 border-b" style={{ borderColor: profileColor }}>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            Requested Format
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-lg" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                {gamesDisplay}
              </div>
              {formatLabel && (
                <div className="text-gray-400 text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  {formatLabel}
                </div>
              )}
            </div>

            {/* Handicap indicator */}
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                backgroundColor: handicap ? hexToRgba(profileColor, 0.2) : 'rgba(255,255,255,0.05)',
                color: handicap ? profileColor : '#666',
                border: `1px solid ${handicap ? profileColor : '#333'}`,
              }}
            >
              Handicap {handicap ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-4">
          <button
            onClick={onDecline}
            className="flex-1 py-3 rounded-lg text-white transition-all hover:scale-[1.02]"
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 'bold',
              backgroundColor: '#dc2626',
              boxShadow: '0 0 15px rgba(220, 38, 38, 0.4)',
            }}
          >
            Decline
          </button>
          <button
            onClick={bleConnected ? onAccept : onBLEConnect}
            disabled={!bleConnected && !onBLEConnect}
            className={`flex-1 py-3 rounded-lg text-white transition-all ${bleConnected ? 'hover:scale-[1.02]' : 'opacity-70 cursor-pointer'}`}
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 'bold',
              backgroundColor: bleConnected ? '#16a34a' : '#52525b',
              boxShadow: bleConnected ? '0 0 15px rgba(22, 163, 74, 0.4)' : 'none',
            }}
          >
            {bleConnected ? 'Accept' : 'Reconnect to accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
