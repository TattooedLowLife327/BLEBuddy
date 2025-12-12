import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { createClient } from '../utils/supabase/client';
import { PlayerGameSetup } from '../components/PlayerGameSetup';
import { AppHeader } from '../components/AppHeader';
import { type GameData } from '../contexts/GameContext';

// Resolve profile pic URL from various formats
const resolveProfilePicUrl = (profilepic: string | undefined): string | undefined => {
  if (!profilepic) return undefined;

  // Already a full URL
  if (profilepic.startsWith('http')) return profilepic;

  // Local asset path (store purchases or default)
  if (profilepic.startsWith('/assets') || profilepic.startsWith('assets') || profilepic === 'default-pfp.png') {
    return profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
  }

  // Storage path - construct Supabase public URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sndsyxxcnuwjmjgikzgg.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profilepic/${profilepic}`;
};

interface MissedRequest {
  id: string;
  challengerName: string;
  challengerId: string;
  timestamp: string;
}

interface OnlineLobbyProps {
  onBack: () => void;
  accentColor: string;
  userId: string;
  isYouthPlayer: boolean;
  hasParentPaired: boolean;
  isDoublesTeam?: boolean;
  partnerId?: string;
  partnerName?: string;
  profilePic: string | null;
  userName: string;
  onLogout: () => void;
  onGameAccepted?: (gameData: GameData) => void;
  missedRequests?: MissedRequest[];
  onClearMissedRequests?: () => void;
}

type PlayerStatus = 'waiting' | 'idle' | 'in_match';

interface AvailablePlayer {
  id: string;
  player_id: string;
  granboardName: string;
  profilePic?: string;
  mprNumeric: number;
  pprNumeric: number;
  overallNumeric: number;
  accentColor: string;
  isDoublesTeam: boolean;
  partnerId?: string;
  partnerName?: string;
  status: PlayerStatus;
  idleTimeRemaining?: number; // seconds remaining in idle countdown (0-300)
}

// Mock players for development UI
const MOCK_PLAYERS: AvailablePlayer[] = [
  { id: 'mock-1', player_id: 'mock-1', granboardName: 'DartMaster99', profilePic: undefined, mprNumeric: 2.8, pprNumeric: 45.2, overallNumeric: 75, accentColor: '#ef4444', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-2', player_id: 'mock-2', granboardName: 'TripleTwenty', profilePic: undefined, mprNumeric: 3.1, pprNumeric: 52.8, overallNumeric: 82, accentColor: '#22c55e', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-3', player_id: 'mock-3', granboardName: 'BullseyeQueen', profilePic: undefined, mprNumeric: 2.5, pprNumeric: 38.5, overallNumeric: 68, accentColor: '#3b82f6', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-4', player_id: 'mock-4', granboardName: 'SteelTipSteve', profilePic: undefined, mprNumeric: 2.9, pprNumeric: 48.1, overallNumeric: 78, accentColor: '#f59e0b', isDoublesTeam: false, status: 'idle', idleTimeRemaining: 180 },
  { id: 'mock-5', player_id: 'mock-5', granboardName: 'NineDarter', profilePic: undefined, mprNumeric: 3.5, pprNumeric: 61.2, overallNumeric: 91, accentColor: '#ec4899', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-6', player_id: 'mock-6', granboardName: 'CricketKing', profilePic: undefined, mprNumeric: 2.2, pprNumeric: 35.0, overallNumeric: 62, accentColor: '#8b5cf6', isDoublesTeam: true, partnerName: 'DartBuddy', status: 'waiting' },
  { id: 'mock-7', player_id: 'mock-7', granboardName: 'CheckoutChamp', profilePic: undefined, mprNumeric: 2.7, pprNumeric: 44.3, overallNumeric: 73, accentColor: '#06b6d4', isDoublesTeam: false, status: 'idle', idleTimeRemaining: 60 },
  { id: 'mock-8', player_id: 'mock-8', granboardName: 'T20Hunter', profilePic: undefined, mprNumeric: 3.0, pprNumeric: 50.5, overallNumeric: 80, accentColor: '#84cc16', isDoublesTeam: false, status: 'in_match' },
  { id: 'mock-9', player_id: 'mock-9', granboardName: 'DoubleTrouble', profilePic: undefined, mprNumeric: 2.4, pprNumeric: 40.2, overallNumeric: 66, accentColor: '#f97316', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-10', player_id: 'mock-10', granboardName: 'LegFinisher', profilePic: undefined, mprNumeric: 2.6, pprNumeric: 42.8, overallNumeric: 70, accentColor: '#14b8a6', isDoublesTeam: false, status: 'in_match' },
  { id: 'mock-11', player_id: 'mock-11', granboardName: 'ArrowAce', profilePic: undefined, mprNumeric: 2.9, pprNumeric: 47.5, overallNumeric: 76, accentColor: '#a855f7', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-12', player_id: 'mock-12', granboardName: 'ShanghaiSam', profilePic: undefined, mprNumeric: 2.3, pprNumeric: 36.8, overallNumeric: 64, accentColor: '#eab308', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-13', player_id: 'mock-13', granboardName: 'TonMachine', profilePic: undefined, mprNumeric: 3.2, pprNumeric: 55.0, overallNumeric: 85, accentColor: '#10b981', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-14', player_id: 'mock-14', granboardName: 'FinishFirst', profilePic: undefined, mprNumeric: 2.7, pprNumeric: 43.5, overallNumeric: 72, accentColor: '#f43f5e', isDoublesTeam: false, status: 'waiting' },
  { id: 'mock-15', player_id: 'mock-15', granboardName: 'BoardBoss', profilePic: undefined, mprNumeric: 3.0, pprNumeric: 51.2, overallNumeric: 81, accentColor: '#0ea5e9', isDoublesTeam: false, status: 'waiting' },
];

export function OnlineLobby({
  onBack,
  accentColor,
  userId,
  isYouthPlayer,
  hasParentPaired,
  isDoublesTeam = false,
  partnerId,
  partnerName,
  profilePic,
  userName,
  onLogout,
  onGameAccepted,
  missedRequests = [],
  onClearMissedRequests,
}: OnlineLobbyProps) {
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<AvailablePlayer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<any | null>(null);
  const [pendingOutgoingRequest, setPendingOutgoingRequest] = useState<any | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(300); // 5 minutes in seconds
  const [cardScale, setCardScale] = useState(1);
  const supabase = createClient();

  const lastActivityRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const IDLE_WARNING_DURATION_S = 300; // 5 minutes in seconds
  const USE_MOCK_DATA = true; // Toggle for development UI
  const INCLUDE_REAL_PLAYERS = true; // Show real DB players alongside mock data

  // Wrap logout to clean up lobby entry first
  const handleLogout = useCallback(async () => {
    try {
      await (supabase as any)
        .schema('companion')
        .from('online_lobby')
        .delete()
        .eq('player_id', userId);
      console.log('Cleaned up lobby entry on logout');
    } catch (err) {
      console.error('Error cleaning up lobby on logout:', err);
    }
    onLogout();
  }, [supabase, userId, onLogout]);

  // Check if youth player can access
  const canAccess = !isYouthPlayer || hasParentPaired;

  // Calculate card scale based on viewport
  useEffect(() => {
    const calculateScale = () => {
      // Check if we're in portrait mode (CSS rotates to landscape)
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;

      // When in portrait, CSS rotates content so swap width/height for calculations
      const viewWidth = isPortrait ? window.innerHeight : window.innerWidth;
      const viewHeight = isPortrait ? window.innerWidth : window.innerHeight;

      // Base card is 120x160px, target 5 columns with gaps
      const availableWidth = viewWidth - 64; // px-8 = 32px each side
      const availableHeight = viewHeight - 120; // header + py-4 padding
      const cardBaseWidth = 120;
      const cardBaseHeight = 160;
      const columns = 5;
      const rows = 2;
      const gap = 12;

      const maxWidthScale = (availableWidth - (gap * (columns - 1))) / (cardBaseWidth * columns);
      const maxHeightScale = (availableHeight - gap) / (cardBaseHeight * rows);

      setCardScale(Math.min(maxWidthScale, maxHeightScale, 2)); // Cap at 2x
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    // Also listen for orientation changes
    const orientationQuery = window.matchMedia('(orientation: portrait)');
    orientationQuery.addEventListener('change', calculateScale);
    return () => {
      window.removeEventListener('resize', calculateScale);
      orientationQuery.removeEventListener('change', calculateScale);
    };
  }, []);

  // Reset activity timestamp on any user interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning is showing, dismiss it and reset
    if (showIdleWarning) {
      setShowIdleWarning(false);
      setIdleCountdown(IDLE_WARNING_DURATION_S);
      // Clear countdown interval
      if (idleCountdownIntervalRef.current) {
        clearInterval(idleCountdownIntervalRef.current);
        idleCountdownIntervalRef.current = null;
      }
      // Update status back to 'waiting' in database
      (supabase as any)
        .schema('companion')
        .from('online_lobby')
        .update({ status: 'waiting', last_seen: new Date().toISOString() })
        .eq('player_id', userId);
    }
  }, [showIdleWarning, supabase, userId]);

  // Start idle countdown when warning shows
  const startIdleCountdown = useCallback(() => {
    setIdleCountdown(IDLE_WARNING_DURATION_S);
    idleCountdownIntervalRef.current = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          // Time's up - remove from lobby
          if (idleCountdownIntervalRef.current) {
            clearInterval(idleCountdownIntervalRef.current);
            idleCountdownIntervalRef.current = null;
          }
          onBack(); // Leave lobby
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onBack]);

  // Idle detection effect
  useEffect(() => {
    if (!canAccess) return;

    // Check for idle every 30 seconds
    idleCheckIntervalRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity >= IDLE_TIMEOUT_MS && !showIdleWarning) {
        console.log('[OnlineLobby] User idle for 15 minutes, showing warning');
        setShowIdleWarning(true);
        // Update status to 'idle' in database
        (supabase as any)
          .schema('companion')
          .from('online_lobby')
          .update({ status: 'idle', last_seen: new Date().toISOString() })
          .eq('player_id', userId);
        startIdleCountdown();
      }
    }, 30000); // Check every 30 seconds

    // Activity listeners
    const handleActivity = () => resetActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity, true);

    return () => {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
      }
      if (idleCountdownIntervalRef.current) {
        clearInterval(idleCountdownIntervalRef.current);
      }
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity, true);
    };
  }, [canAccess, showIdleWarning, resetActivity, startIdleCountdown, supabase, userId]);

  // Join lobby on mount
  useEffect(() => {
    if (!canAccess) return;

    async function joinLobby() {
      try {
        console.log('Joining online lobby...');
        
        // Insert current user into online_lobby (companion schema)
        const { error: insertError } = await (supabase as any)
          .schema('companion')
          .from('online_lobby')
          .upsert({
            player_id: userId,
            granboard_name: userName || 'Unknown',
            is_youth: isYouthPlayer,
            partner_id: partnerId || null,
            partner_granboard_name: partnerName || null,
            status: 'waiting',
            last_seen: new Date().toISOString(),
          }, { onConflict: 'player_id' });

        if (insertError) {
          console.error('Error joining lobby:', insertError);
        } else {
          console.log('Successfully joined lobby');
        }
      } catch (err) {
        console.error('Error in joinLobby:', err);
      }
    }

    joinLobby();

    // Cleanup: leave lobby when component unmounts
    return () => {
      (supabase as any)
        .schema('companion')
        .from('online_lobby')
        .delete()
        .eq('player_id', userId)
        .then(({ error }) => {
          if (error) {
            console.error('Error leaving lobby:', error);
          } else {
            console.log('Left lobby');
          }
        });
    };
  }, [canAccess, userId, userName, isYouthPlayer, isDoublesTeam, partnerId, partnerName]);

  // Heartbeat: update last_seen every 30 seconds
  useEffect(() => {
    if (!canAccess) return;

    const heartbeatInterval = setInterval(async () => {
      const { error } = await (supabase as any)
        .schema('companion')
        .from('online_lobby')
        .update({ last_seen: new Date().toISOString() })
        .eq('player_id', userId);

      if (error) {
        console.error('Heartbeat error:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [canAccess, userId]);

  // Sort players by status priority: waiting -> idle -> in_match
  const sortByStatus = (players: AvailablePlayer[]) => {
    const statusPriority: Record<PlayerStatus, number> = { waiting: 0, idle: 1, in_match: 2 };
    return [...players].sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
  };

  // Fetch available players
  const fetchAvailablePlayers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching available players...');

      let allPlayers: AvailablePlayer[] = [];

      // Add mock players if enabled
      if (USE_MOCK_DATA) {
        allPlayers = [...MOCK_PLAYERS];
      }

      // Fetch real players from database (either in addition to mock, or exclusively)
      if (!USE_MOCK_DATA || INCLUDE_REAL_PLAYERS) {
        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch all statuses (waiting, idle, in_match) - filter out current user
        // Also filter out stale entries (last_seen > 2 minutes ago)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: lobbyData, error: lobbyError } = await (supabase as any)
          .schema('companion')
          .from('online_lobby')
          .select('*')
          .in('status', ['waiting', 'idle', 'in_match'])
          .neq('player_id', userId)
          .gte('last_seen', twoMinutesAgo)
          .order('last_seen', { ascending: false })
          .order('created_at', { ascending: false });

        if (lobbyError) {
          console.error('Error fetching lobby data:', lobbyError);
        } else if (lobbyData && lobbyData.length > 0) {
          const playersWithData = await Promise.all(
            lobbyData.map(async lobbyEntry => {
              const playerId = lobbyEntry.player_id;
              const isYouth = lobbyEntry.is_youth;
              const playerStatus = (lobbyEntry.status as PlayerStatus) || 'waiting';

              // Calculate idle time remaining for idle players
              let idleTimeRemaining: number | undefined;
              if (playerStatus === 'idle' && lobbyEntry.idle_started_at) {
                const idleStarted = new Date(lobbyEntry.idle_started_at).getTime();
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - idleStarted) / 1000);
                idleTimeRemaining = Math.max(0, IDLE_WARNING_DURATION_S - elapsedSeconds);
              }

              const profileQuery = isYouth
                ? (supabase as any).schema('youth').from('youth_profiles')
                : supabase.from('player_profiles');

              const { data: rawProfileData, error: profileError } = await profileQuery
                .select('granboard_name, profilepic, profilecolor')
                .eq('id', playerId)
                .single();

              if (profileError) {
                console.error(`Error fetching profile for ${playerId}:`, profileError);
                return null;
              }

              const profileData = (rawProfileData as {
                granboard_name: string | null;
                profilepic: string | null;
                profilecolor: string | null;
              }) || null;

              const statsQuery = isYouth
                ? (supabase as any).schema('youth').from('youth_stats')
                : supabase.from('player_stats');

              const { data: rawStatsData, error: statsError } = await statsQuery
                .select('mpr_numeric, ppr_numeric, overall_numeric, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
                .eq('id', playerId)
                .single();

              if (statsError) {
                console.error(`Error fetching stats for ${playerId}:`, statsError);
                return null;
              }

              const statsData = (rawStatsData as {
                mpr_numeric: number | null;
                ppr_numeric: number | null;
                overall_numeric: number | null;
                solo_games_played: number | null;
                solo_wins: number | null;
                solo_win_rate: number | null;
                solo_highest_checkout: number | null;
              }) || null;

              let partnerDisplayName: string | undefined;
              if (lobbyEntry.partner_id) {
                const partnerQuery = isYouth
                  ? (supabase as any).schema('youth').from('youth_profiles')
                  : supabase.from('player_profiles');

                const { data: rawPartnerData } = await partnerQuery
                  .select('granboard_name')
                  .eq('id', lobbyEntry.partner_id)
                  .single();

                const partnerData = rawPartnerData as { granboard_name: string | null } | null;

                if (partnerData?.granboard_name) {
                  partnerDisplayName = partnerData.granboard_name;
                }
              }

              return {
                id: lobbyEntry.id,
                player_id: playerId,
                granboardName: profileData?.granboard_name || 'Unknown',
                profilePic: profileData?.profilepic || undefined,
                mprNumeric: statsData?.mpr_numeric ?? 0,
                pprNumeric: statsData?.ppr_numeric ?? 0,
                overallNumeric: statsData?.overall_numeric ?? 0,
                accentColor: profileData?.profilecolor || '#a855f7',
                isDoublesTeam: !!lobbyEntry.partner_id,
                partnerId: lobbyEntry.partner_id || undefined,
                partnerName: partnerDisplayName,
                status: playerStatus,
                idleTimeRemaining,
              } as AvailablePlayer;
            })
          );

          const validPlayers = playersWithData.filter((p): p is AvailablePlayer => p !== null);
          // Add real players to the combined list
          allPlayers = [...allPlayers, ...validPlayers];
        } else {
          console.log('No real players in lobby');
        }
      }

      // Sort all players (mock + real combined) by status
      const sorted = sortByStatus(allPlayers);
      setAvailablePlayers(sorted);
    } catch (err) {
      console.error('Error in fetchAvailablePlayers:', err);
      // If error, at least show mock players if enabled
      if (USE_MOCK_DATA) {
        setAvailablePlayers(sortByStatus(MOCK_PLAYERS));
      } else {
        setAvailablePlayers([]);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase, userId]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAvailablePlayers();
  }, [fetchAvailablePlayers]);

  // Initial fetch only - no auto-polling
  useEffect(() => {
    if (!canAccess) return;
    fetchAvailablePlayers();
  }, [canAccess]);

  // Listen for incoming game requests
  useEffect(() => {
    if (!canAccess) return;

    const supabaseAny = supabase as any;
    const gameChannel = supabaseAny
      .channel('incoming-game-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'companion',
          table: 'active_games',
          filter: `player2_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log('Incoming game request:', payload);
          setIncomingRequest(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabaseAny.removeChannel(gameChannel);
    };
  }, [canAccess, supabase, userId]);

  // Listen for response to our outgoing game request
  useEffect(() => {
    if (!pendingOutgoingRequest) return;

    const supabaseAny = supabase as any;
    const responseChannel = supabaseAny
      .channel('outgoing-game-response')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'companion',
          table: 'active_games',
          filter: `id=eq.${pendingOutgoingRequest.id}`,
        },
        (payload: any) => {
          console.log('Game response received:', payload);
          const newStatus = payload.new.status;

          if (newStatus === 'accepted') {
            // Navigate to cork screen - we are the initiator
            if (onGameAccepted) {
              onGameAccepted({
                gameId: pendingOutgoingRequest.id,
                opponentId: pendingOutgoingRequest.player2_id,
                opponentName: pendingOutgoingRequest.player2_granboard_name,
                opponentProfilePic: undefined, // Will be fetched
                opponentAccentColor: '#a855f7', // Default, will be fetched
                isInitiator: true,
              });
            }
            setPendingOutgoingRequest(null);
          } else if (newStatus === 'declined') {
            alert(`${pendingOutgoingRequest.player2_granboard_name} declined the game.`);
            setPendingOutgoingRequest(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseAny.removeChannel(responseChannel);
    };
  }, [supabase, pendingOutgoingRequest]);


  const handlePlayerClick = (player: AvailablePlayer) => {
    setSelectedPlayer(player);
  };

  const handleCloseSetup = () => {
    setSelectedPlayer(null);
  };

  const handleAcceptGame = async () => {
    if (!incomingRequest) return;

    try {
      const { error } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', incomingRequest.id);

      if (error) {
        console.error('Error accepting game:', error);
      } else {
        console.log('Game accepted!');
        // Navigate to cork screen - we are NOT the initiator (we accepted)
        if (onGameAccepted) {
          onGameAccepted({
            gameId: incomingRequest.id,
            opponentId: incomingRequest.player1_id,
            opponentName: incomingRequest.player1_granboard_name,
            opponentProfilePic: undefined,
            opponentAccentColor: '#a855f7',
            isInitiator: false,
          });
        }
      }
    } catch (err) {
      console.error('Error in handleAcceptGame:', err);
    }

    setIncomingRequest(null);
  };

  const handleDeclineGame = async () => {
    if (!incomingRequest) return;
    
    try {
      const { error } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ status: 'declined' })
        .eq('id', incomingRequest.id);

      if (error) {
        console.error('Error declining game:', error);
      } else {
        console.log('Game declined');
      }
    } catch (err) {
      console.error('Error in handleDeclineGame:', err);
    }
    
    setIncomingRequest(null);
  };

  const handleStartGame = async (gameConfig: any) => {
    console.log('Starting game with config:', gameConfig);
    console.log('Against player:', selectedPlayer);
    
    // Create game in active_games table
    try {
      const { data: gameData, error: gameError } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .insert({
          player1_id: userId,
          player1_granboard_name: userName || 'Unknown',
          player2_id: selectedPlayer!.player_id,
          player2_granboard_name: selectedPlayer!.granboardName,
          is_doubles: isDoublesTeam || selectedPlayer!.isDoublesTeam,
          player1_partner_id: partnerId || null,
          player2_partner_id: selectedPlayer!.partnerId || null,
          status: 'pending',
        })
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
      } else {
        console.log('Game created:', gameData);
        setPendingOutgoingRequest(gameData);
      }
    } catch (err) {
      console.error('Error in handleStartGame:', err);
    }
    
    setSelectedPlayer(null);
  };

  if (!canAccess) {
    return (
      <div className="h-screen w-full overflow-hidden bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div
            className="rounded-lg border p-8 text-center backdrop-blur-sm bg-white/5"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 20px rgba(168, 85, 247, 0.3)`,
            }}
          >
            <h2
              className="text-2xl mb-4 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Parent Pairing Required
            </h2>
            <p className="text-gray-300 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Youth players need to be paired with a parent account to access online play.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-lg text-white transition-colors"
              style={{
                backgroundColor: accentColor,
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 'bold',
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {selectedPlayer && (
        <PlayerGameSetup
          player={selectedPlayer}
          onClose={handleCloseSetup}
          onStartGame={handleStartGame}
          isDoublesTeam={isDoublesTeam}
          partnerName={partnerName}
          userId={userId}
          isYouthPlayer={isYouthPlayer}
        />
      )}

      {/* Incoming Game Request Modal */}
      {incomingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className="rounded-lg border p-8 text-center backdrop-blur-sm bg-black max-w-md mx-4"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 40px rgba(168, 85, 247, 0.5)`,
            }}
          >
            <h2
              className="text-2xl mb-4 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              🎯 Game Request!
            </h2>
            <p className="text-gray-300 mb-2" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              <span className="text-white font-bold">{incomingRequest.player1_granboard_name}</span>
            </p>
            <p className="text-gray-400 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              wants to play!
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDeclineGame}
                className="px-6 py-3 rounded-lg text-white transition-colors bg-red-600 hover:bg-red-700"
                style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
              >
                Decline
              </button>
              <button
                onClick={handleAcceptGame}
                className="px-6 py-3 rounded-lg text-white transition-colors bg-green-600 hover:bg-green-700"
                style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for Response Modal */}
      {pendingOutgoingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className="rounded-lg border p-8 text-center backdrop-blur-sm bg-black max-w-md mx-4"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 40px rgba(168, 85, 247, 0.5)`,
            }}
          >
            <h2
              className="text-2xl mb-4 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Waiting...
            </h2>
            <p className="text-gray-300 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Waiting for <span className="text-white font-bold">{pendingOutgoingRequest.player2_granboard_name}</span> to respond...
            </p>
            <button
              onClick={() => {
                // Cancel the request
                (supabase as any)
                  .schema('companion')
                  .from('active_games')
                  .update({ status: 'cancelled' })
                  .eq('id', pendingOutgoingRequest.id)
                  .then(() => setPendingOutgoingRequest(null));
              }}
              className="px-6 py-3 rounded-lg text-white transition-colors bg-gray-600 hover:bg-gray-700"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Idle Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-zinc-900 border border-yellow-600 rounded-xl p-6 max-w-sm w-full mx-4 text-center">
            <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Are You Still There?</h2>
            <p className="text-zinc-400 text-sm mb-4">
              You've been idle for 15 minutes. Tap anywhere to stay in the lobby.
            </p>
            <div className="text-3xl font-bold text-yellow-500 mb-4">
              {Math.floor(idleCountdown / 60)}:{(idleCountdown % 60).toString().padStart(2, '0')}
            </div>
            <button
              onClick={resetActivity}
              className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-black font-semibold rounded-lg transition-colors"
            >
              I'm Still Here
            </button>
          </div>
        </div>
      )}

      <div className="h-screen w-full overflow-hidden bg-black">
        <div className="h-full flex flex-col px-8 py-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <AppHeader
          title="Online Lobby"
          onBack={onBack}
          showRefresh={true}
          isRefreshing={isRefreshing}
          onRefresh={handleManualRefresh}
          missedRequests={missedRequests.map(r => ({
            id: r.id,
            fromPlayerId: r.challengerId,
            fromPlayerName: r.challengerName,
            createdAt: r.timestamp,
          }))}
          onClearMissedRequests={onClearMissedRequests}
          profilePic={profilePic}
          accentColor={accentColor}
          userName={userName}
          onLogout={handleLogout}
        />

        {/* Players Grid - Vertical Scrolling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-hidden">
          {loading ? (
            <div className="text-center text-gray-400 py-12 w-full">
              Loading available players...
            </div>
          ) : availablePlayers.length === 0 ? (
            <div className="text-center text-gray-400 py-12 w-full">
              <p style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                No players available. Waiting for opponents...
              </p>
            </div>
          ) : (
            <div
              className={`grid grid-cols-5 transition-opacity duration-200 ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}
              style={{
                columnGap: `${12 * cardScale}px`,
                rowGap: `${24 * cardScale}px`,
                justifyContent: 'center',
              }}
            >
              {availablePlayers.map((player) => {
                const playerAccentColor = player.accentColor;
                const isIdle = player.status === 'idle';
                const isInMatch = player.status === 'in_match';
                const isWaiting = player.status === 'waiting';

                // Calculate idle progress (0-1, where 1 = full time remaining)
                const idleProgress = isIdle && player.idleTimeRemaining !== undefined
                  ? player.idleTimeRemaining / IDLE_WARNING_DURATION_S
                  : 0;

                // SVG circle properties for countdown border
                const strokeDasharray = 400;
                const strokeDashoffset = strokeDasharray * (1 - idleProgress);

                const hexToRgbaPlayer = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-center"
                    style={{
                      width: `${120 * cardScale}px`,
                      height: `${160 * cardScale}px`,
                    }}
                  >
                    <div
                      onClick={() => !isInMatch && handlePlayerClick(player)}
                      className={`relative rounded-lg overflow-hidden ${isInMatch ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.05]'} transition-transform origin-center`}
                      style={{
                        filter: isIdle || isInMatch ? 'grayscale(0.7) brightness(0.6)' : 'none',
                        width: '120px',
                        height: '160px',
                        transform: `scale(${cardScale})`,
                      }}
                    >
                    {/* SVG Countdown Border for Idle Players */}
                    {isIdle && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="96"
                          height="96"
                          rx="8"
                          ry="8"
                          fill="none"
                          stroke={playerAccentColor}
                          strokeWidth="3"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          style={{
                            transition: 'stroke-dashoffset 1s linear',
                          }}
                        />
                      </svg>
                    )}

                    {/* Card Background with border */}
                    <div
                      className={`absolute inset-0 rounded-lg border bg-zinc-900/90 ${isIdle ? 'border-zinc-600' : ''}`}
                      style={{
                        borderColor: isIdle ? '#52525b' : playerAccentColor,
                        boxShadow: isWaiting
                          ? `0 0 12px ${hexToRgbaPlayer(playerAccentColor, 0.4)}`
                          : 'none',
                      }}
                    />

                    {/* Card Content - Vertical layout */}
                    <div className="relative z-[5] flex flex-col items-center p-3">
                      {/* Profile Picture */}
                      <div className="relative mb-2">
                        {isWaiting && (
                          <div
                            className="absolute inset-0 rounded-full blur-md"
                            style={{
                              backgroundColor: playerAccentColor,
                              opacity: 0.5,
                              transform: 'scale(1.2)',
                            }}
                          />
                        )}
                        <Avatar
                          className="relative w-12 h-12 border-2"
                          style={{
                            borderColor: isIdle ? '#52525b' : playerAccentColor,
                          }}
                        >
                          <AvatarImage src={resolveProfilePicUrl(player.profilePic)} />
                          <AvatarFallback className="bg-zinc-800 text-white text-sm">
                            {player.granboardName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Granboard Name */}
                      <h3
                        className="text-white text-xs font-bold truncate max-w-full text-center"
                        style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                      >
                        {player.granboardName}
                      </h3>

                      {/* Team indicator */}
                      {player.isDoublesTeam && player.partnerName && (
                        <p className="text-[10px] text-gray-400 truncate max-w-full text-center" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                          + {player.partnerName}
                        </p>
                      )}

                      {/* Status indicator for idle/in_match */}
                      {isIdle && (
                        <p className="text-yellow-500 text-[10px] font-semibold">IDLE</p>
                      )}
                      {isInMatch && (
                        <p className="text-red-400 text-[10px] font-semibold">IN MATCH</p>
                      )}

                      {/* Stats - no background, just text */}
                      {isWaiting && (
                        <p className="text-[10px] text-gray-500 mt-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                          {player.mprNumeric.toFixed(1)} / {player.pprNumeric.toFixed(1)}
                        </p>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
}
