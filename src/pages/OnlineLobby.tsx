import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { createClient } from '../utils/supabase/client';
import { PlayerGameSetup } from '../components/PlayerGameSetup';
import { IncomingRequestModal } from '../components/IncomingRequestModal';
import { AppHeader } from '../components/AppHeader';
import { type GameData } from '../contexts/GameContext';
import type { GameConfiguration } from '../types/game';
import { checkCameraAvailable } from '../utils/webrtc/peerConnection';
import { resolveProfilePicUrl, resolveSkinUrl } from '../utils/profile';
import { PlayerCardTop } from '../components/PlayerCardTop';
import {
  REQUEST_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_DURATION_S,
  IDLE_CHECK_INTERVAL_MS,
  LOBBY_HEARTBEAT_INTERVAL_MS,
} from '../utils/constants';

const normalizeGameType = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.toLowerCase();
};

const derivePrimaryGameType = (config: GameConfiguration): string => {
  const first = config.games.find(game => game) || '501';
  return config.legs > 1 ? 'medley' : first;
};

const deriveLegsToWin = (legs: number): number => {
  return Math.max(1, Math.ceil(legs / 2));
};

const deriveDoubleOut = (config: GameConfiguration): boolean => {
  return config.format.inOut === 'do' || config.format.inOut === 'dido';
};

interface MissedRequest {
  id: string;
  challengerName: string;
  challengerId: string;
  timestamp: string;
  schema?: 'player' | 'youth';
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
  onOpenSettings?: () => void;
  onAddMissedRequest?: (request: MissedRequest) => void;
  bleConnected?: boolean;
  bleStatus?: 'disconnected' | 'scanning' | 'connecting' | 'connected';
  onBLEConnect?: () => Promise<{ success: boolean; error?: string }>;
  onBLEDisconnect?: () => Promise<void>;
}

type PlayerStatus = 'waiting' | 'idle' | 'in_match';

export type LobbyType = 'main' | 'ladies' | 'youth';

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

interface AvailablePlayer {
  id: string;
  player_id: string;
  granboardName: string;
  profilePic?: string;
  mprNumeric: number;
  pprNumeric: number;
  overallNumeric: number;
  mprLetter?: string;
  pprLetter?: string;
  overallLetter?: string;
  accentColor: string;
  isDoublesTeam: boolean;
  partnerId?: string;
  partnerName?: string;
  status: PlayerStatus;
  idleTimeRemaining?: number; // seconds remaining in idle countdown (0-300)
  granid?: string;
  friendCount?: number;
  onlineGameCount?: number;
  gender?: string | null;
  isYouth?: boolean;
  skin?: string | null;
}

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
  onOpenSettings,
  onAddMissedRequest,
  bleConnected,
  bleStatus,
  onBLEConnect,
  onBLEDisconnect,
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
  const [blockingGame, setBlockingGame] = useState<{ id: string; status: string; created_at: string; completed_at: string | null } | null>(null);
  const [requestResultMessage, setRequestResultMessage] = useState<{ type: 'timeout' | 'declined'; name: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [checkingCamera, setCheckingCamera] = useState(true);
  const outgoingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();
  const [searchParams] = useSearchParams();
  const lobbyType: LobbyType = (searchParams.get('type') === 'ladies' || searchParams.get('type') === 'youth')
    ? searchParams.get('type') as 'ladies' | 'youth'
    : 'main';

  // Check if user already has an active game - returns the blocking game or null
  const checkForExistingGame = async (): Promise<{ id: string; status: string; created_at: string; completed_at: string | null } | null> => {
    try {
      // Aggressive cleanup of ALL old/stale games for this user
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Delete ALL games older than 2 hours (stuck games from crashes, etc.)
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .lt('created_at', twoHoursAgo);

      // Delete stale pending games (unanswered requests older than 5 min)
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'pending')
        .lt('created_at', fiveMinutesAgo);

      // Delete cancelled/declined/abandoned games (they shouldn't block new games)
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['cancelled', 'declined', 'abandoned']);

      // Now check for actually active games: status is active AND completed_at is null
      // BUT: Don't block on 'pending' if user is player2 (that's an incoming request, not a blocking game)

      // First check for accepted/playing games (these always block)
      const { data: activeGames } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .select('id, status, created_at, completed_at')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['accepted', 'playing'])
        .is('completed_at', null)
        .limit(1);

      if (activeGames && activeGames.length > 0) {
        return activeGames[0];
      }

      // Then check for pending games where user is player1 (outgoing challenges block)
      const { data: outgoingPending } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .select('id, status, created_at, completed_at')
        .eq('player1_id', userId)
        .eq('status', 'pending')
        .is('completed_at', null)
        .limit(1);

      return outgoingPending && outgoingPending.length > 0 ? outgoingPending[0] : null;
    } catch {
      return null;
    }
  };

  const lastActivityRef = useRef<number>(Date.now());
  const idleWarningShownRef = useRef<boolean>(false);
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Card scale is now fixed at 1 - we use CSS grid auto-fit for responsive layout
  useEffect(() => {
    setCardScale(1);
  }, []);

  // Reset activity timestamp on any user interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning is showing, dismiss it and reset
    if (showIdleWarning) {
      setShowIdleWarning(false);
      idleWarningShownRef.current = false;
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
        .update({ status: 'waiting', last_seen: new Date().toISOString(), idle_started_at: null })
        .eq('player_id', userId);
    }
  }, [showIdleWarning, supabase, userId]);

  // Start 5-minute countdown when warning shows; boot user from lobby when it hits zero
  const startIdleCountdown = useCallback(() => {
    setIdleCountdown(IDLE_WARNING_DURATION_S); // 5:00 – display immediately
    idleCountdownIntervalRef.current = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          if (idleCountdownIntervalRef.current) {
            clearInterval(idleCountdownIntervalRef.current);
            idleCountdownIntervalRef.current = null;
          }
          // Remove from lobby then navigate away so user is dead in lobby
          (supabase as any)
            .schema('companion')
            .from('online_lobby')
            .delete()
            .eq('player_id', userId)
            .then(() => {
              console.log('[OnlineLobby] Idle timeout – removed from lobby');
              onBack();
            })
            .catch((err: unknown) => {
              console.error('[OnlineLobby] Error removing idle user from lobby:', err);
              onBack();
            });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onBack, supabase, userId]);

  // Idle detection: after 15 min show "Are you still there?" and start 5 min countdown (ref avoids effect re-run clearing the countdown)
  useEffect(() => {
    if (!canAccess || cameraError || checkingCamera) return;

    idleCheckIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity >= IDLE_TIMEOUT_MS && !idleWarningShownRef.current) {
        idleWarningShownRef.current = true;
        console.log('[OnlineLobby] User idle for 15 minutes – showing warning and starting 5 min countdown');
        setShowIdleWarning(true);
        const now = new Date().toISOString();
        (supabase as any)
          .schema('companion')
          .from('online_lobby')
          .update({ status: 'idle', last_seen: now, idle_started_at: now })
          .eq('player_id', userId);
        startIdleCountdown();
      }
    }, IDLE_CHECK_INTERVAL_MS);

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
  }, [canAccess, cameraError, checkingCamera, resetActivity, startIdleCountdown, supabase, userId]);

  // Check camera availability on mount - required for online play
  useEffect(() => {
    if (!canAccess) return;

    async function verifyCameraAccess() {
      setCheckingCamera(true);
      const result = await checkCameraAvailable();
      if (!result.available) {
        setCameraError(result.error || 'Camera access required for online play.');
      } else {
        setCameraError(null);
      }
      setCheckingCamera(false);
    }

    verifyCameraAccess();
  }, [canAccess]);

  const cleanupStaleGames = useCallback(async () => {
    try {
      // Aggressive cleanup of ALL old/stale games for this user
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Delete ALL games older than 2 hours (stuck games from crashes, etc.)
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .lt('created_at', twoHoursAgo);

      // Delete stale pending games (unanswered requests older than 5 min)
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'pending')
        .lt('created_at', fiveMinutesAgo);

      // Delete cancelled/declined/abandoned games
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['cancelled', 'declined', 'abandoned']);
    } catch (err) {
      console.error('[OnlineLobby] Error during stale game cleanup:', err);
    }
  }, [supabase, userId]);

  // Join lobby on mount (only if camera is available)
  useEffect(() => {
    if (!canAccess || cameraError || checkingCamera) return;

    async function joinLobby() {
      try {
        console.log('Joining online lobby...');

        // Perform shared stale game cleanup once on lobby join
        await cleanupStaleGames();

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
        .then(({ error }: { error: any }) => {
          if (error) {
            console.error('Error leaving lobby:', error);
          } else {
            console.log('Left lobby');
          }
        });
    };
  }, [canAccess, cameraError, checkingCamera, userId, userName, isYouthPlayer, isDoublesTeam, partnerId, partnerName, cleanupStaleGames]);

  // Heartbeat: update last_seen every 30 seconds
  useEffect(() => {
    if (!canAccess || cameraError || checkingCamera) return;

    const heartbeatInterval = setInterval(async () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      const { error } = await (supabase as any)
        .schema('companion')
        .from('online_lobby')
        .update({ last_seen: new Date().toISOString() })
        .eq('player_id', userId);

      if (error) {
        console.error('Heartbeat error:', error);
      }
    }, LOBBY_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeatInterval);
  }, [canAccess, cameraError, checkingCamera, userId]);

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
            lobbyData.map(async (lobbyEntry: any) => {
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

              const profileSchema = isYouth
                ? (supabase as any).schema('youth')
                : (supabase as any).schema('player');
              const profileTable = isYouth ? 'youth_profiles' : 'player_profiles';

              const { data: rawProfileData, error: profileError } = await profileSchema
                .from(profileTable)
                .select('granboard_name, profilepic, profilecolor, gender, skin')
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
                gender?: string | null;
                skin?: string | null;
              }) || null;

              const statsSchema = isYouth
                ? (supabase as any).schema('youth')
                : (supabase as any).schema('player');
              const statsTable = isYouth ? 'youth_stats' : 'player_stats';

              const { data: rawStatsData, error: statsError } = await statsSchema
                .from(statsTable)
                .select('granid, mpr_numeric, ppr_numeric, overall_numeric, mpr_letter, ppr_letter, overall_letter, online_game_count, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
                .eq('id', playerId)
                .single();

              if (statsError) {
                console.error(`Error fetching stats for ${playerId}:`, statsError);
                return null;
              }

              const statsData = (rawStatsData as {
                granid: string | null;
                mpr_numeric: number | null;
                ppr_numeric: number | null;
                overall_numeric: number | null;
                mpr_letter: string | null;
                ppr_letter: string | null;
                overall_letter: string | null;
                online_game_count: number | null;
                solo_games_played: number | null;
                solo_wins: number | null;
                solo_win_rate: number | null;
                solo_highest_checkout: number | null;
              }) || null;

              let partnerDisplayName: string | undefined;
              if (lobbyEntry.partner_id) {
                const partnerSchema = isYouth
                  ? (supabase as any).schema('youth')
                  : (supabase as any).schema('player');
                const partnerTable = isYouth ? 'youth_profiles' : 'player_profiles';

                const { data: rawPartnerData } = await partnerSchema
                  .from(partnerTable)
                  .select('granboard_name')
                  .eq('id', lobbyEntry.partner_id)
                  .single();

                const partnerData = rawPartnerData as { granboard_name: string | null } | null;

                if (partnerData?.granboard_name) {
                  partnerDisplayName = partnerData.granboard_name;
                }
              }

              // Fetch friend count
              let playerFriendCount = 0;
              try {
                const { count } = await (supabase as any)
                  .schema('player')
                  .from('friends')
                  .select('*', { count: 'exact', head: true })
                  .eq('status', 'accepted')
                  .or(`player_id.eq.${playerId},friend_id.eq.${playerId}`);
                playerFriendCount = count || 0;
              } catch { /* ignore */ }

              const skinUrl = resolveSkinUrl(profileData?.skin ?? null);

              return {
                id: lobbyEntry.id,
                player_id: playerId,
                granboardName: profileData?.granboard_name || 'Unknown',
                profilePic: profileData?.profilepic || undefined,
                mprNumeric: statsData?.mpr_numeric ?? 0,
                pprNumeric: statsData?.ppr_numeric ?? 0,
                overallNumeric: statsData?.overall_numeric ?? 0,
                mprLetter: statsData?.mpr_letter || undefined,
                pprLetter: statsData?.ppr_letter || undefined,
                overallLetter: statsData?.overall_letter || undefined,
                accentColor: profileData?.profilecolor || '#a855f7',
                isDoublesTeam: !!lobbyEntry.partner_id,
                partnerId: lobbyEntry.partner_id || undefined,
                partnerName: partnerDisplayName,
                status: playerStatus,
                idleTimeRemaining,
                granid: statsData?.granid || undefined,
                friendCount: playerFriendCount,
                onlineGameCount: statsData?.online_game_count ?? 0,
                gender: profileData?.gender ?? null,
                isYouth: isYouth,
                skin: skinUrl ?? undefined,
              } as AvailablePlayer;
            })
          );

        let validPlayers = playersWithData.filter((p): p is AvailablePlayer => p !== null);
        // Filter by lobby type: ladies only female; youth only youth accounts
        if (lobbyType === 'ladies') {
          validPlayers = validPlayers.filter((p) => p.gender === 'female');
        } else if (lobbyType === 'youth') {
          validPlayers = validPlayers.filter((p) => p.isYouth === true);
        }
        allPlayers = [...allPlayers, ...validPlayers];
      } else {
        console.log('No players in lobby');
      }

      const sorted = sortByStatus(allPlayers);
      setAvailablePlayers(sorted);
    } catch (err) {
      console.error('Error in fetchAvailablePlayers:', err);
      setAvailablePlayers([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase, userId, lobbyType]);

  const lastRefreshRef = useRef<number>(0);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    // Basic rate-limiting: ignore refreshes more often than every 3 seconds
    if (now - lastRefreshRef.current < 3000 || isRefreshing) {
      return;
    }
    lastRefreshRef.current = now;
    setIsRefreshing(true);
    await fetchAvailablePlayers();
  }, [fetchAvailablePlayers, isRefreshing]);

  // Initial fetch and when lobby type changes
  useEffect(() => {
    if (!canAccess || cameraError || checkingCamera) return;
    fetchAvailablePlayers();
  }, [canAccess, cameraError, checkingCamera, lobbyType, fetchAvailablePlayers]);

  // Listen for incoming game requests
  useEffect(() => {
    if (!canAccess || cameraError || checkingCamera) return;

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
  }, [canAccess, cameraError, checkingCamera, supabase, userId]);

  // Listen for response to our outgoing game request
  useEffect(() => {
    if (!pendingOutgoingRequest) return;

    // Set up 7-second timeout for the request
    outgoingTimeoutRef.current = setTimeout(async () => {
      // Request timed out
      const opponentName = pendingOutgoingRequest.player2_granboard_name;
      setRequestResultMessage({ type: 'timeout', name: opponentName });

      // Cancel the request
      try {
        await (supabase as any)
          .schema('companion')
          .from('active_games')
          .delete()
          .eq('id', pendingOutgoingRequest.id);
      } catch (err) {
        console.error('Error cleaning up timed out request:', err);
      }

      setPendingOutgoingRequest(null);
    }, REQUEST_TIMEOUT_MS);

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

          // Clear the timeout since we got a response
          if (outgoingTimeoutRef.current) {
            clearTimeout(outgoingTimeoutRef.current);
            outgoingTimeoutRef.current = null;
          }

          if (newStatus === 'accepted') {
            // Fetch opponent profile data before navigating
            const fetchOpponentProfile = async () => {
              let opponentPic: string | undefined;
              let opponentColor = '#a855f7';
              try {
                // Try player schema first
                const playerSchema = (supabase as any).schema('player');
                const { data: playerProfile } = await playerSchema
                  .from('player_profiles')
                  .select('profilepic, profilecolor')
                  .eq('id', pendingOutgoingRequest.player2_id)
                  .single();

                if (playerProfile) {
                  opponentPic = playerProfile.profilepic || undefined;
                  opponentColor = playerProfile.profilecolor || '#a855f7';
                } else {
                  // Try youth schema
                  const youthSchema = (supabase as any).schema('youth');
                  const { data: youthProfile } = await youthSchema
                    .from('youth_profiles')
                    .select('profilepic, profilecolor')
                    .eq('id', pendingOutgoingRequest.player2_id)
                    .single();
                  if (youthProfile) {
                    opponentPic = youthProfile.profilepic || undefined;
                    opponentColor = youthProfile.profilecolor || '#a855f7';
                  }
                }
              } catch (err) {
                console.error('Error fetching opponent profile:', err);
              }
              return { opponentPic, opponentColor };
            };

            fetchOpponentProfile().then(({ opponentPic, opponentColor }) => {
              if (onGameAccepted) {
                onGameAccepted({
                  gameId: pendingOutgoingRequest.id,
                  opponentId: pendingOutgoingRequest.player2_id,
                  opponentName: pendingOutgoingRequest.player2_granboard_name,
                  opponentProfilePic: opponentPic,
                  opponentAccentColor: opponentColor,
                  isInitiator: true,
                  gameType: normalizeGameType(pendingOutgoingRequest.game_type),
                  gameConfig: pendingOutgoingRequest.game_config || null,
                });
              }
              setPendingOutgoingRequest(null);
            });
          } else if (newStatus === 'declined') {
            setRequestResultMessage({ type: 'declined', name: pendingOutgoingRequest.player2_granboard_name });
            setPendingOutgoingRequest(null);
          } else if (newStatus === 'expired') {
            setRequestResultMessage({ type: 'timeout', name: pendingOutgoingRequest.player2_granboard_name });
            setPendingOutgoingRequest(null);
          }
        }
      )
      .subscribe();

    return () => {
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
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
    if (!bleConnected) return;

    // Check if user already has an active game
    const existingGame = await checkForExistingGame();
    if (existingGame) {
      setBlockingGame(existingGame);
      setIncomingRequest(null);
      return;
    }

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
        let gameMeta: { game_type?: string | null; game_config?: GameConfiguration | null } | null = null;
        try {
          const { data } = await (supabase as any)
            .schema('companion')
            .from('active_games')
            .select('game_type, game_config')
            .eq('id', incomingRequest.id)
            .single();
          gameMeta = data || null;
        } catch (metaErr) {
          console.error('Error loading game metadata:', metaErr);
        }
        // Fetch opponent profile data before navigating
        let opponentPic: string | undefined;
        let opponentColor = '#a855f7';
        try {
          // Try player schema first
          const playerSchema = (supabase as any).schema('player');
          const { data: playerProfile } = await playerSchema
            .from('player_profiles')
            .select('profilepic, profilecolor')
            .eq('id', incomingRequest.player1_id)
            .single();

          if (playerProfile) {
            opponentPic = playerProfile.profilepic || undefined;
            opponentColor = playerProfile.profilecolor || '#a855f7';
          } else {
            // Try youth schema
            const youthSchema = (supabase as any).schema('youth');
            const { data: youthProfile } = await youthSchema
              .from('youth_profiles')
              .select('profilepic, profilecolor')
              .eq('id', incomingRequest.player1_id)
              .single();
            if (youthProfile) {
              opponentPic = youthProfile.profilepic || undefined;
              opponentColor = youthProfile.profilecolor || '#a855f7';
            }
          }
        } catch (profileErr) {
          console.error('Error fetching opponent profile:', profileErr);
        }

        // Navigate to cork screen - we are NOT the initiator (we accepted)
        if (onGameAccepted) {
          onGameAccepted({
            gameId: incomingRequest.id,
            opponentId: incomingRequest.player1_id,
            opponentName: incomingRequest.player1_granboard_name,
            opponentProfilePic: opponentPic,
            opponentAccentColor: opponentColor,
            isInitiator: false,
            gameType: normalizeGameType(gameMeta?.game_type),
            gameConfig: gameMeta?.game_config || null,
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
      // Update to 'declined' first so opponent gets notified via realtime
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ status: 'declined' })
        .eq('id', incomingRequest.id);

      // Then delete immediately so it doesn't block future requests
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .eq('id', incomingRequest.id);

      console.log('Game declined and cleaned up');
    } catch (err) {
      console.error('Error in handleDeclineGame:', err);
    }

    setIncomingRequest(null);
  };

  // Handle timeout on incoming request (receiver didn't respond in time)
  const handleIncomingTimeout = useCallback(async () => {
    if (!incomingRequest) return;

    const requestId = incomingRequest.id;
    const challengerName = incomingRequest.player1_granboard_name;
    const challengerId = incomingRequest.player1_id;

    // Add to missed requests (default to player schema)
    if (onAddMissedRequest) {
      onAddMissedRequest({
        id: requestId,
        challengerName,
        challengerId,
        timestamp: new Date().toISOString(),
        schema: 'player',
      });
    }

    // Update status to 'expired' so requester knows it timed out
    try {
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ status: 'expired' })
        .eq('id', requestId);

      // Then delete
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .eq('id', requestId);

      console.log('Incoming request timed out and cleaned up');
    } catch (err) {
      console.error('Error handling incoming timeout:', err);
    }

    setIncomingRequest(null);
  }, [incomingRequest, onAddMissedRequest, supabase]);

  const handleStartGame = async (gameConfig: GameConfiguration) => {
    if (!bleConnected) {
      return; // Block send when disconnected; setup modal already disables button
    }
    console.log('Starting game with config:', gameConfig);
    console.log('Against player:', selectedPlayer);

    // Check if user already has an active game
    const existingGame = await checkForExistingGame();
    if (existingGame) {
      setBlockingGame(existingGame);
      setSelectedPlayer(null);
      return;
    }

    const gameType = derivePrimaryGameType(gameConfig);
    const legsToWin = deriveLegsToWin(gameConfig.legs);
    const doubleOut = deriveDoubleOut(gameConfig);

    // Create game in active_games table. Solo vs solo: partner ids null, is_doubles false.
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
          game_type: gameType,
          legs_to_win: legsToWin,
          double_out: doubleOut,
          game_config: gameConfig,
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

  // Show camera check loading
  if (checkingCamera) {
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
            <Camera className="w-12 h-12 mx-auto mb-4 text-white animate-pulse" />
            <h2
              className="text-2xl mb-4 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Checking Camera...
            </h2>
            <p className="text-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Verifying camera access for online play.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show camera error if no camera available
  if (cameraError) {
    return (
      <div className="h-screen w-full overflow-hidden bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div
            className="rounded-lg border p-8 text-center backdrop-blur-sm bg-white/5"
            style={{
              borderColor: '#dc2626',
              boxShadow: `0 0 20px rgba(220, 38, 38, 0.3)`,
            }}
          >
            <Camera className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2
              className="text-2xl mb-4 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Camera Required
            </h2>
            <p className="text-gray-300 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              {cameraError}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={async () => {
                  setCheckingCamera(true);
                  const result = await checkCameraAvailable();
                  if (!result.available) {
                    setCameraError(result.error || 'Camera access required for online play.');
                  } else {
                    setCameraError(null);
                  }
                  setCheckingCamera(false);
                }}
                className="px-6 py-3 rounded-lg text-white transition-colors bg-zinc-700 hover:bg-zinc-600"
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                }}
              >
                Try Again
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 rounded-lg text-white transition-colors"
                style={{
                  backgroundColor: '#dc2626',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                }}
              >
                Go Back
              </button>
            </div>
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
          bleConnected={bleConnected}
          onBLEConnect={onBLEConnect}
        />
      )}

      {/* Incoming Game Request Modal */}
      {incomingRequest && (
        <IncomingRequestModal
          request={incomingRequest}
          onAccept={handleAcceptGame}
          onDecline={handleDeclineGame}
          onTimeout={handleIncomingTimeout}
          bleConnected={bleConnected}
          onBLEConnect={onBLEConnect}
        />
      )}

      {/* Request Result Message Modal */}
      {requestResultMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className="rounded-lg border p-8 text-center backdrop-blur-sm bg-black max-w-md mx-4"
            style={{
              borderColor: requestResultMessage.type === 'declined' ? '#dc2626' : '#f59e0b',
              boxShadow: `0 0 40px ${requestResultMessage.type === 'declined' ? 'rgba(220, 38, 38, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
            }}
          >
            <h2
              className="text-2xl mb-4"
              style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 'bold',
                color: requestResultMessage.type === 'declined' ? '#dc2626' : '#f59e0b',
              }}
            >
              {requestResultMessage.type === 'declined' ? 'Request Denied' : 'Request Timed Out'}
            </h2>
            <p className="text-gray-300 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              {requestResultMessage.type === 'declined'
                ? <><span className="text-white font-bold">{requestResultMessage.name}</span> declined your game request.</>
                : <><span className="text-white font-bold">{requestResultMessage.name}</span> didn't respond in time.</>
              }
            </p>
            <button
              onClick={() => setRequestResultMessage(null)}
              className="px-6 py-3 rounded-lg text-white transition-colors"
              style={{
                backgroundColor: requestResultMessage.type === 'declined' ? '#dc2626' : '#f59e0b',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 'bold',
              }}
            >
              OK
            </button>
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
              onClick={async () => {
                // Cancel the request - update first for notification, then delete
                const gameId = pendingOutgoingRequest.id;
                setPendingOutgoingRequest(null);
                try {
                  await (supabase as any)
                    .schema('companion')
                    .from('active_games')
                    .update({ status: 'cancelled' })
                    .eq('id', gameId);
                  await (supabase as any)
                    .schema('companion')
                    .from('active_games')
                    .delete()
                    .eq('id', gameId);
                } catch (err) {
                  console.error('Error cancelling game:', err);
                }
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
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-zinc-900 border border-yellow-600 rounded-xl p-6 max-w-sm w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* Already In Match Error Modal */}
      {blockingGame && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-zinc-900 border border-red-600 rounded-xl p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-white text-lg font-bold mb-2">Already In A Match</h2>
            <p className="text-zinc-400 text-sm mb-2">
              You have an active match blocking new games.
            </p>
            <p className="text-zinc-500 text-xs mb-4">
              Status: {blockingGame.status} | Created: {new Date(blockingGame.created_at).toLocaleTimeString()}
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  // Clear this specific blocking game from DB AND local storage
                  try {
                    await (supabase as any)
                      .schema('companion')
                      .from('active_games')
                      .delete()
                      .eq('id', blockingGame.id);
                    // Also clear local storage to prevent rejoin prompts
                    sessionStorage.removeItem('blebuddy_game');
                    localStorage.removeItem('bb-abandoned-game');
                    console.log('Cleared blocking game:', blockingGame.id);
                  } catch (err) {
                    console.error('Error clearing game:', err);
                  }
                  setBlockingGame(null);
                }}
                className="flex-1 px-4 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
              >
                Clear This Match
              </button>
              <button
                onClick={() => setBlockingGame(null)}
                className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-screen w-full overflow-hidden bg-black">
        <div className="h-full flex flex-col px-8 py-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <AppHeader
          title="Online Lobby"
          onBack={onBack}
          bleConnected={bleConnected}
          bleStatus={bleStatus}
          onBLEConnect={onBLEConnect}
          onBLEDisconnect={onBLEDisconnect}
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
          onLogout={handleLogout}
          onOpenSettings={onOpenSettings}
        />

        {/* Full-screen disconnect overlay: app theme; send/accept are already blocked */}
        {!bleConnected && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
            style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
          >
            <div
              className="rounded-xl border-[3px] bg-zinc-900/95 p-8 max-w-md w-full text-center shadow-xl"
              style={{
                borderColor: accentColor,
                boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 14px ${hexToRgba(accentColor, 0.35)}`,
              }}
            >
              <h2 className="text-xl font-bold text-white mb-2">Board disconnected</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Reconnect your Granboard to send or accept game requests.
              </p>
              <button
                type="button"
                onClick={() => onBLEConnect?.()}
                disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
                className="w-full py-3 rounded-lg text-white font-bold transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 14px ${hexToRgba(accentColor, 0.4)}`,
                }}
              >
                {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Reconnect'}
              </button>
            </div>
          </div>
        )}

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
              className={`grid transition-opacity duration-200 gap-4 md:gap-6 lg:gap-8 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}
              style={{ justifyItems: 'center' }}
            >
              {sortByStatus(availablePlayers).map((player) => {
                const playerAccentColor = player.accentColor;
                const isIdle = player.status === 'idle';
                const isInMatch = player.status === 'in_match';

                // Calculate idle progress (0-1, where 1 = full time remaining)
                const idleProgress = isIdle && player.idleTimeRemaining !== undefined
                  ? player.idleTimeRemaining / IDLE_WARNING_DURATION_S
                  : 0;

                // SVG countdown border for idle
                const strokeDasharray = 500;
                const strokeDashoffset = strokeDasharray * (1 - idleProgress);

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-center w-[240px] h-[300px] md:w-[260px] md:h-[300px]"
                  >
                    <div
                      onClick={() => !isInMatch && handlePlayerClick(player)}
                      className={`relative rounded-xl overflow-hidden w-full h-full ${isInMatch ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'} transition-transform origin-center`}
                      style={{
                        filter: isIdle || isInMatch ? 'grayscale(0.7) brightness(0.6)' : 'none',
                        width: '100%',
                        height: '100%',
                        minHeight: 300,
                        border: '3px solid',
                        borderColor: playerAccentColor,
                        backgroundColor: 'rgba(24, 24, 27, 0.95)',
                        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 14px ${hexToRgba(playerAccentColor, 0.35)}`,
                      }}
                    >
                      {/* SVG countdown border for idle players */}
                      {isIdle && (
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none z-10"
                          viewBox="0 0 100 155"
                          preserveAspectRatio="none"
                        >
                          <rect
                            x="2"
                            y="2"
                            width="96"
                            height="151"
                            rx="6"
                            ry="6"
                            fill="none"
                            stroke={playerAccentColor}
                            strokeWidth="2"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: 'stroke-dashoffset 1s linear' }}
                          />
                        </svg>
                      )}

                      <PlayerCardTop
                        variant="panel"
                        llogbBadge
                        data={{
                          granboardName: player.granboardName,
                          profilePic: player.profilePic,
                          accentColor: playerAccentColor,
                          skin: player.skin ?? undefined,
                          granid: player.granid ?? null,
                          friendCount: player.friendCount,
                          onlineGameCount: player.onlineGameCount,
                          pprLetter: player.pprLetter ?? null,
                          pprNumeric: player.pprNumeric,
                          overallLetter: player.overallLetter ?? null,
                          overallNumeric: player.overallNumeric,
                          mprLetter: player.mprLetter ?? null,
                          mprNumeric: player.mprNumeric,
                          partnerName: player.partnerName ?? null,
                        }}
                        resolvedProfilePic={resolveProfilePicUrl(player.profilePic)}
                      />
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
