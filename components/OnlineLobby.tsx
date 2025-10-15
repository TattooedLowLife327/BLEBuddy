import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { createClient } from '../utils/supabase/client';
import { PlayerGameSetup } from './PlayerGameSetup';
import { UserMenu } from './UserMenu';

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
}

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
}: OnlineLobbyProps) {
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<AvailablePlayer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();

  const CARDS_PER_PAGE = 8;

  // Check if youth player can access
  const canAccess = !isYouthPlayer || hasParentPaired;

  // Join lobby on mount
  useEffect(() => {
    if (!canAccess) return;

    async function joinLobby() {
      try {
        console.log('Joining online lobby...');
        
        // Insert current user into online_lobby (public schema)
        const { error: insertError } = await (supabase as any)
          .schema('public')
          .from('online_lobby')
          .insert({
            player_id: userId,
            is_youth_player: isYouthPlayer,
            is_doubles_team: isDoublesTeam,
            partner_id: partnerId || null,
            status: 'waiting',
            last_seen: new Date().toISOString(),
          });

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
        .schema('public')
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
  }, [canAccess, userId, isYouthPlayer, isDoublesTeam, partnerId]);

  // Heartbeat: update last_seen every 30 seconds
  useEffect(() => {
    if (!canAccess) return;

    const heartbeatInterval = setInterval(async () => {
      const { error } = await (supabase as any)
        .schema('public')
        .from('online_lobby')
        .update({ last_seen: new Date().toISOString() })
        .eq('player_id', userId);

      if (error) {
        console.error('Heartbeat error:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [canAccess, userId]);

  // Fetch available players
  const fetchAvailablePlayers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching available players...');

      const { data: lobbyData, error: lobbyError } = await (supabase as any)
        .schema('public')
        .from('online_lobby')
        .select('*')
        .eq('status', 'waiting')
        .neq('player_id', userId)
        .order('last_seen', { ascending: false })
        .order('created_at', { ascending: false });

      if (lobbyError) {
        console.error('Error fetching lobby data:', lobbyError);
        setAvailablePlayers([]);
        return;
      }

      if (!lobbyData || lobbyData.length === 0) {
        console.log('No players in lobby');
        setAvailablePlayers([]);
        return;
      }

      const playersWithData = await Promise.all(
        lobbyData.map(async lobbyEntry => {
          const playerId = lobbyEntry.player_id;
          const isYouth = lobbyEntry.is_youth_player;

          const profileQuery = isYouth
            ? (supabase as any).schema('youth').from('youth_profiles')
            : supabase.from('player_profiles');

          const { data: profileData, error: profileError } = await profileQuery
            .select('granboard_name, profilepic, profilecolor')
            .eq('id', playerId)
            .single();

          if (profileError) {
            console.error(`Error fetching profile for ${playerId}:`, profileError);
            return null;
          }

          const statsQuery = isYouth
            ? (supabase as any).schema('youth').from('youth_stats')
            : supabase.from('player_stats');

          const { data: statsData, error: statsError } = await statsQuery
            .select('mpr_numeric, ppr_numeric, overall_numeric, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
            .eq('id', playerId)
            .single();

          if (statsError) {
            console.error(`Error fetching stats for ${playerId}:`, statsError);
            return null;
          }

          let partnerDisplayName: string | undefined;
          if (lobbyEntry.is_doubles_team && lobbyEntry.partner_id) {
            const partnerQuery = isYouth
              ? (supabase as any).schema('youth').from('youth_profiles')
              : supabase.from('player_profiles');

            const { data: partnerData } = await partnerQuery
              .select('granboard_name')
              .eq('id', lobbyEntry.partner_id)
              .single();

            if (partnerData) {
              partnerDisplayName = partnerData.granboard_name;
            }
          }

          return {
            id: lobbyEntry.id,
            player_id: playerId,
            granboardName: profileData.granboard_name || 'Unknown',
            profilePic: profileData.profilepic || undefined,
            mprNumeric: statsData.mpr_numeric || 0,
            pprNumeric: statsData.ppr_numeric || 0,
            overallNumeric: statsData.overall_numeric || 0,
            accentColor: profileData.profilecolor || '#a855f7',
            isDoublesTeam: lobbyEntry.is_doubles_team || false,
            partnerId: lobbyEntry.partner_id || undefined,
            partnerName: partnerDisplayName,
            soloGamesPlayed: statsData.solo_games_played || 0,
            soloWins: statsData.solo_wins || 0,
            soloWinRate: statsData.solo_win_rate || 0,
            soloHighestCheckout: statsData.solo_highest_checkout || 0,
            lastSeen: lobbyEntry.last_seen || lobbyEntry.created_at,
          } as AvailablePlayer & { lastSeen?: string };
        })
      );

      const validPlayers = playersWithData
        .filter((p): p is AvailablePlayer & { lastSeen?: string } => p !== null)
        .sort((a, b) => {
          const timeA = a.lastSeen ?? '';
          const timeB = b.lastSeen ?? '';
          return timeB.localeCompare(timeA);
        })
        .map(({ lastSeen, ...rest }) => rest);

      setAvailablePlayers(validPlayers);
    } catch (err) {
      console.error('Error in fetchAvailablePlayers:', err);
      setAvailablePlayers([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase, userId]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCurrentPage(0);
    await fetchAvailablePlayers();
  }, [fetchAvailablePlayers]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }

    fetchAvailablePlayers();

    const channel = supabase
      .channel('online-lobby-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'online_lobby',
        },
        () => {
          fetchAvailablePlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, supabase, fetchAvailablePlayers]);

  // Calculate pagination
  const totalPages = Math.ceil(availablePlayers.length / CARDS_PER_PAGE);
  const startIndex = currentPage * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const currentPlayers = availablePlayers.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handlePlayerClick = (player: AvailablePlayer) => {
    setSelectedPlayer(player);
  };

  const handleCloseSetup = () => {
    setSelectedPlayer(null);
  };

  const handleStartGame = async (gameConfig: any) => {
    console.log('Starting game with config:', gameConfig);
    console.log('Against player:', selectedPlayer);
    
    // TODO: Create game in active_games table
    try {
      const schema = isYouthPlayer ? 'youth' : 'player';
      const { data: gameData, error: gameError } = await (supabase as any)
        .schema(schema)
        .from('active_games')
        .insert({
          player1_id: userId,
          player1_is_youth: isYouthPlayer,
          player1_partner_id: partnerId || null,
          player2_id: selectedPlayer!.player_id,
          player2_is_youth: selectedPlayer!.isDoublesTeam ? false : isYouthPlayer, // TODO: get actual youth status
          player2_partner_id: selectedPlayer!.partnerId || null,
          medley_type: gameConfig.medleyType,
          games_config: gameConfig.games,
          handicap_enabled: gameConfig.handicap,
          in_option: gameConfig.inOption,
          out_option: gameConfig.outOption,
          bull_option: gameConfig.bullOption,
          status: 'pending',
        })
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
      } else {
        console.log('Game created:', gameData);
        // TODO: Navigate to game screen or show waiting for acceptance
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
      <div className="h-screen w-full overflow-hidden bg-black">
        <div className="h-full flex flex-col p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="p-2 text-white hover:opacity-80 transition-opacity"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <h1
            className="text-3xl text-white"
            style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', color: accentColor }}
          >
            Online Lobby
          </h1>

          <div className="flex items-center gap-4">
            {isDoublesTeam && partnerName && (
              <div className="text-right">
                <p className="text-sm text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  Team with
                </p>
                <p className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                  {partnerName}
                </p>
              </div>
            )}
            <button
              onClick={handleManualRefresh}
              className="p-2 text-white hover:opacity-80 transition-opacity rounded-full border border-white/10"
              aria-label="Refresh lobby"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <UserMenu
              profilePic={profilePic}
              accentColor={accentColor}
              userName={userName}
              onLogout={onLogout}
            />
          </div>
        </div>

        {/* Players Grid with Pagination */}
        <div className="flex-1 flex flex-col justify-center px-2 relative">
          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading available players...
            </div>
          ) : availablePlayers.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                No players available. Waiting for opponents...
              </p>
            </div>
          ) : (
            <>
              {/* Left Chevron */}
              {currentPage > 0 && (
                <button
                  onClick={handlePrevPage}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-3 text-white hover:opacity-80 transition-opacity"
                  aria-label="Previous page"
                  style={{ marginLeft: '-20px' }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              )}

              {/* Players Grid - 2 rows x 4 columns */}
              <div className="grid grid-cols-4 gap-4 auto-rows-fr">
                {currentPlayers.map((player) => {
                  const playerAccentColor = player.accentColor;
                  const hexToRgbaPlayer = (hex: string, alpha: number) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                  };

                  return (
                    <div
                      key={player.id}
                      onClick={() => handlePlayerClick(player)}
                      className="rounded-lg border backdrop-blur-sm bg-black p-4 flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-transform"
                      style={{
                        borderColor: playerAccentColor,
                        boxShadow: `0 0 20px ${hexToRgbaPlayer(playerAccentColor, 0.6)}, 0 0 40px ${hexToRgbaPlayer(playerAccentColor, 0.35)}, inset 0 0 20px ${hexToRgbaPlayer(playerAccentColor, 0.15)}`,
                      }}
                    >
                      {/* Profile Picture */}
                      <Avatar 
                        className="w-20 h-20 border-4 mb-3" 
                        style={{ 
                          borderColor: playerAccentColor,
                          boxShadow: `0 0 30px ${hexToRgbaPlayer(playerAccentColor, 0.8)}`,
                        }}
                      >
                        <AvatarImage src={player.profilePic} />
                        <AvatarFallback className="bg-white/10 text-white text-xl">
                          {player.granboardName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Granboard Name */}
                      <h3
                        className="text-white mb-1"
                        style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                      >
                        {player.granboardName}
                      </h3>

                      {/* Team indicator */}
                      {player.isDoublesTeam && player.partnerName && (
                        <p className="text-xs text-gray-400 mb-2" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                          + {player.partnerName}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex gap-4 text-gray-300 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs mb-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                            01 AVG
                          </p>
                          <p className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                            {player.mprNumeric.toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                            CR AVG
                          </p>
                          <p className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                            {player.pprNumeric.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Chevron */}
              {currentPage < totalPages - 1 && (
                <button
                  onClick={handleNextPage}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-3 text-white hover:opacity-80 transition-opacity"
                  aria-label="Next page"
                  style={{ marginRight: '-20px' }}
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              )}

              {/* Page Indicator */}
              {totalPages > 1 && (
                <div className="text-center mt-4 text-gray-400 text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  Page {currentPage + 1} of {totalPages}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  </>
  );
}
