import { useState, useEffect } from 'react';
import { ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { createClient } from '../utils/supabase/client';
import { UserMenu } from '../components/UserMenu';

interface LocalDubsSetupProps {
  onBack: () => void;
  onContinue: (partnerId: string, userGoesFirst: boolean) => void;
  accentColor: string;
  userId: string;
  userProfilePic: string | null;
  userName: string;
  onLogout: () => void;
}

interface PlayerProfile {
  id: string;
  granboard_name: string;
  profilepic: string | null;
  profilecolor: string;
}

export function LocalDubsSetup({
  onBack,
  onContinue,
  accentColor,
  userId,
  userProfilePic,
  userName,
  onLogout,
}: LocalDubsSetupProps) {
  const [selectedPartner, setSelectedPartner] = useState<PlayerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userGoesFirst, setUserGoesFirst] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAvailablePlayers();
  }, []);

  const fetchAvailablePlayers = async () => {
    try {
      setLoading(true);
      
      // Query both player and youth profiles
      const { data: playerData, error: playerError } = await supabase
        .from('player_profiles')
        .select('id, granboard_name, profilepic, profilecolor')
        .neq('id', userId)
        .order('granboard_name');

      const { data: youthData, error: youthError } = await supabase
        .schema('youth')
        .from('youth_profiles')
        .select('id, granboard_name, profilepic, profilecolor')
        .neq('id', userId)
        .order('granboard_name');

      // Combine both datasets
      const allPlayers: PlayerProfile[] = [
        ...(playerData || []),
        ...(youthData || []),
      ];

      setAvailablePlayers(allPlayers);
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = availablePlayers.filter((player) =>
    player.granboard_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = () => {
    if (selectedPartner) {
      onContinue(selectedPartner.id, userGoesFirst);
    }
  };

  const getProfilePicUrl = (profilepic: string | null) => {
    if (!profilepic) return null;
    if (profilepic.startsWith('http')) return profilepic;
    
    const { data: urlData } = supabase.storage
      .from('profilepic')
      .getPublicUrl(profilepic);
    
    return urlData.publicUrl;
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      <div className="h-full flex flex-col p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
            style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
          >
            <ArrowLeft className="w-6 h-6" />
            <span>Back</span>
          </button>

          <h1
            className="text-3xl text-white"
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 'bold',
              color: accentColor,
            }}
          >
            Local Doubles Setup
          </h1>

          <UserMenu
            profilePic={userProfilePic}
            accentColor={accentColor}
            userName={userName}
            onLogout={onLogout}
          />
        </div>

        {/* Team Display */}
        <div className="mb-8">
          <div className="rounded-lg border backdrop-blur-sm bg-white/5 p-6" style={{ borderColor: accentColor }}>
            <h2
              className="text-xl text-white mb-4 text-center"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              Your Team
            </h2>

            <div className="flex items-center justify-center gap-8">
              {/* User */}
              <div className="flex flex-col items-center">
                <Avatar className="w-24 h-24 border-4 mb-2" style={{ borderColor: accentColor }}>
                  <AvatarImage src={userProfilePic || undefined} />
                  <AvatarFallback className="bg-white/10 text-white text-2xl">
                    {userName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <p
                  className="text-white mb-2"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                >
                  {userName || 'You'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUserGoesFirst(true)}
                    className="px-4 py-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: userGoesFirst ? accentColor : 'rgba(255, 255, 255, 0.1)',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      color: 'white',
                    }}
                  >
                    First
                  </button>
                  <button
                    onClick={() => setUserGoesFirst(false)}
                    className="px-4 py-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: !userGoesFirst ? accentColor : 'rgba(255, 255, 255, 0.1)',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      color: 'white',
                    }}
                  >
                    Second
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="text-white text-2xl" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                +
              </div>

              {/* Partner */}
              <div className="flex flex-col items-center">
                {selectedPartner ? (
                  <>
                    <Avatar
                      className="w-24 h-24 border-4 mb-2"
                      style={{ borderColor: selectedPartner.profilecolor || '#4b5563' }}
                    >
                      <AvatarImage src={getProfilePicUrl(selectedPartner.profilepic) || undefined} />
                      <AvatarFallback className="bg-white/10 text-white text-2xl">
                        {selectedPartner.granboard_name?.charAt(0) || 'P'}
                      </AvatarFallback>
                    </Avatar>
                    <p
                      className="text-white mb-2"
                      style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    >
                      {selectedPartner.granboard_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUserGoesFirst(false)}
                        className="px-4 py-2 rounded-lg transition-all"
                        style={{
                          backgroundColor: !userGoesFirst ? accentColor : 'rgba(255, 255, 255, 0.1)',
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          fontWeight: 'bold',
                          color: 'white',
                        }}
                      >
                        First
                      </button>
                      <button
                        onClick={() => setUserGoesFirst(true)}
                        className="px-4 py-2 rounded-lg transition-all"
                        style={{
                          backgroundColor: userGoesFirst ? accentColor : 'rgba(255, 255, 255, 0.1)',
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          fontWeight: 'bold',
                          color: 'white',
                        }}
                      >
                        Second
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="w-24 h-24 border-4 border-dashed rounded-full mb-2 flex items-center justify-center"
                      style={{ borderColor: '#4b5563' }}
                    >
                      <span className="text-4xl text-gray-500">?</span>
                    </div>
                    <p className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                      Select Partner
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg backdrop-blur-sm bg-white/10 border text-white placeholder-gray-400 focus:outline-none focus:ring-2"
              style={{
                borderColor: '#4b5563',
                fontFamily: 'Helvetica, Arial, sans-serif',
              }}
            />
          </div>
          <button
            onClick={fetchAvailablePlayers}
            className="p-3 rounded-lg backdrop-blur-sm bg-white/10 border text-white hover:bg-white/20 transition-colors"
            style={{ borderColor: '#4b5563' }}
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Available Players List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading players...</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>No players found</p>
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedPartner(player)}
                className="w-full rounded-lg border backdrop-blur-sm bg-white/5 p-4 hover:bg-white/10 transition-all text-left"
                style={{
                  borderColor: selectedPartner?.id === player.id ? accentColor : '#4b5563',
                  boxShadow:
                    selectedPartner?.id === player.id ? `0 0 20px ${accentColor}40` : 'none',
                }}
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    className="w-16 h-16 border-2"
                    style={{ borderColor: player.profilecolor || '#4b5563' }}
                  >
                    <AvatarImage src={getProfilePicUrl(player.profilepic) || undefined} />
                    <AvatarFallback className="bg-white/10 text-white">
                      {player.granboard_name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3
                      className="text-white"
                      style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    >
                      {player.granboard_name || 'Unknown'}
                    </h3>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedPartner}
          className="w-full py-4 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: accentColor,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 'bold',
            boxShadow: selectedPartner ? `0 0 20px ${accentColor}60` : 'none',
          }}
        >
          Continue to Lobby
        </button>
      </div>
    </div>
  );
}
