import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { createClient } from '../utils/supabase/client';

interface RemoteDubsSetupProps {
  onBack: () => void;
  onContinue: (partnerId: string) => void;
  accentColor: string;
  userId: string;
}

interface FriendProfile {
  id: string;
  granboard_name: string;
  profilepic: string | null;
  profilecolor: string;
  status: 'online' | 'in_game' | 'offline';
}

export function RemoteDubsSetup({
  onBack,
  onContinue,
  accentColor,
  userId,
}: RemoteDubsSetupProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    fetchMutualFriendsOnline();

    // Set up real-time subscription for friend status updates
    const subscription = supabase
      .channel('friend_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'player',
          table: 'player_profiles',
        },
        () => {
          fetchMutualFriendsOnline();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const fetchMutualFriendsOnline = async () => {
    try {
      setLoading(true);

      // Query friends table from player schema where:
      // 1. User is either player_id or friend_id
      // 2. Status is 'accepted'
      const { data: friendships, error: friendsError } = await supabase
        .schema('player')
        .from('friends')
        .select('player_id, friend_id, player_granboard_name, friend_granboard_name')
        .eq('status', 'accepted')
        .or(`player_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendsError) {
        console.error('Error fetching friends:', friendsError);
        setFriends([]);
        return;
      }

      // Get the friend IDs (the other person in each friendship)
      const friendIds = (friendships || []).map((friendship: any) => {
        return friendship.player_id === userId ? friendship.friend_id : friendship.player_id;
      });

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Fetch the profiles of all friends who are currently active (online or in_game)
      const { data: friendProfiles, error: profilesError } = await supabase
        .schema('player')
        .from('player_profiles')
        .select('id, granboard_name, profilepic, profilecolor, is_active, last_seen')
        .in('id', friendIds);

      if (profilesError) {
        console.error('Error fetching friend profiles:', profilesError);
        setFriends([]);
        return;
      }

      // Process the profiles and determine their online status
      const processedFriends: FriendProfile[] = (friendProfiles || [])
        .map((profile: any) => {
          // Only include friends who are active (is_active = true)
          if (!profile.is_active) return null;

          // Check if they're in a game (you'll need to implement this based on your game tables)
          // For now, we'll assume everyone who is active is 'online'
          // You can add a query to check if they have an active game session
          
          return {
            id: profile.id,
            granboard_name: profile.granboard_name,
            profilepic: profile.profilepic,
            profilecolor: profile.profilecolor,
            status: 'online', // Default to online for active users
          };
        })
        .filter((f): f is FriendProfile => f !== null);

      setFriends(processedFriends);
    } catch (err) {
      console.error('Error in fetchMutualFriendsOnline:', err);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const getProfilePicUrl = (profilepic: string | null) => {
    if (!profilepic) return null;
    if (profilepic.startsWith('http')) return profilepic;

    const { data: urlData } = supabase.storage.from('profilepic').getPublicUrl(profilepic);

    return urlData.publicUrl;
  };

  const handleScroll = (direction: 'left' | 'right') => {
    const scrollAmount = 200;
    setScrollPosition((prev) =>
      direction === 'left' ? Math.max(0, prev - scrollAmount) : prev + scrollAmount
    );
  };

  const handleContinue = () => {
    if (selectedFriend && selectedFriend.status === 'online') {
      onContinue(selectedFriend.id);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      <div className="h-full flex flex-col p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="p-2 text-white hover:opacity-80 transition-opacity"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <h1
            className="text-3xl text-white"
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 'bold',
              color: accentColor,
            }}
          >
            Select Remote Partner
          </h1>

          <div style={{ width: '100px' }} />
        </div>

        {/* Info Text */}
        <p
          className="text-gray-300 text-center mb-6 px-8"
          style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
        >
          Make sure you're friends with your partner on the LowLife App before attempting to pair for dubs play.
        </p>

        {/* Friends Horizontal Scroll */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading friends...</div>
          ) : friends.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                No friends are currently online
              </p>
              <button
                onClick={fetchMutualFriendsOnline}
                className="mt-4 px-6 py-3 rounded-lg text-white transition-all"
                style={{
                  backgroundColor: accentColor,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                }}
              >
                Refresh
              </button>
            </div>
          ) : (
            <>
              <div className="relative w-full max-w-[900px]">
                {/* Left Arrow */}
                {scrollPosition > 0 && (
                  <button
                    onClick={() => handleScroll('left')}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-black/80 text-white hover:bg-black transition-all"
                    style={{ marginLeft: '-20px' }}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Friends List */}
                <div className="overflow-hidden">
                  <div
                    className="flex gap-6 transition-transform duration-300 py-8"
                    style={{ transform: `translateX(-${scrollPosition}px)` }}
                  >
                    {friends.map((friend) => {
                      const isInGame = friend.status === 'in_game';
                      const isSelected = selectedFriend?.id === friend.id;

                      return (
                        <button
                          key={friend.id}
                          onClick={() => !isInGame && setSelectedFriend(friend)}
                          disabled={isInGame}
                          className="flex flex-col items-center gap-3 transition-all hover:scale-105"
                          style={{
                            minWidth: '140px',
                            opacity: isInGame ? 0.4 : 1,
                            cursor: isInGame ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {/* Avatar with glow for online status */}
                          <div className="relative">
                            <Avatar
                              className="w-24 h-24 border-4"
                              style={{
                                borderColor: isSelected ? accentColor : friend.profilecolor,
                                filter: isInGame ? 'grayscale(100%)' : 'none',
                                boxShadow:
                                  !isInGame && !isSelected
                                    ? `0 0 30px ${friend.profilecolor}`
                                    : isSelected
                                    ? `0 0 40px ${accentColor}`
                                    : 'none',
                              }}
                            >
                              <AvatarImage src={getProfilePicUrl(friend.profilepic) || undefined} />
                              <AvatarFallback className="bg-white/10 text-white text-2xl">
                                {friend.granboard_name?.charAt(0) || 'F'}
                              </AvatarFallback>
                            </Avatar>

                            {/* Status badge */}
                            {isInGame && (
                              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                                <Badge
                                  variant="secondary"
                                  className="backdrop-blur-sm bg-red-500/80 text-white border-0 text-xs"
                                >
                                  In Game
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Name */}
                          <p
                            className="text-white text-center"
                            style={{
                              fontFamily: 'Helvetica, Arial, sans-serif',
                              fontWeight: isSelected ? 'bold' : 'normal',
                              color: isInGame ? '#6b7280' : 'white',
                            }}
                          >
                            {friend.granboard_name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Arrow */}
                {friends.length > 4 && (
                  <button
                    onClick={() => handleScroll('right')}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-black/80 text-white hover:bg-black transition-all"
                    style={{ marginRight: '-20px' }}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Selected Friend Display */}
              {selectedFriend && (
                <div className="mt-8 text-center">
                  <p className="text-gray-400 mb-2" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    Selected Partner:
                  </p>
                  <p
                    className="text-2xl text-white"
                    style={{
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      color: accentColor,
                    }}
                  >
                    {selectedFriend.granboard_name}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedFriend || selectedFriend.status === 'in_game'}
          className="w-full py-4 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: accentColor,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 'bold',
            boxShadow: selectedFriend ? `0 0 20px ${accentColor}60` : 'none',
          }}
        >
          Send Invite
        </button>
      </div>
    </div>
  );
}
