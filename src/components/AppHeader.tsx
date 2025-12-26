import { useState, useEffect } from 'react';
import { ChevronLeft, RefreshCw, Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { UserMenu, type CustomMenuItem } from './UserMenu';
import { createClient } from '../utils/supabase/client';

const bluetoothIcon = '/assets/dashboardicon.png';

type GameRequestNotification = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  createdAt: string;
};

interface AppHeaderProps {
  title: string;
  // Back button (optional - for pages like OnlineLobby)
  onBack?: () => void;
  // BLE status (optional - for Dashboard)
  bleConnected?: boolean;
  bleStatus?: 'disconnected' | 'scanning' | 'connecting' | 'connected';
  onBLEConnect?: () => Promise<{ success: boolean; error?: string }>;
  onBLEDisconnect?: () => Promise<void>;
  // Refresh button (optional - for OnlineLobby)
  showRefresh?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  // Notifications (optional)
  missedRequests?: GameRequestNotification[];
  onClearMissedRequests?: () => void;
  // User menu actions
  onLogout: () => void;
  onOpenSettings?: () => void;
  customMenuItems?: CustomMenuItem[];
}

export function AppHeader({
  title,
  onBack,
  bleConnected,
  bleStatus,
  onBLEConnect,
  onBLEDisconnect,
  showRefresh,
  isRefreshing,
  onRefresh,
  missedRequests = [],
  onClearMissedRequests,
  onLogout,
  onOpenSettings,
  customMenuItems,
}: AppHeaderProps) {
  const [profilepic, setProfilepic] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState('#a855f7');
  const [userName, setUserName] = useState('');

  const supabase = createClient();
  const notificationCount = missedRequests.length;

  // Fetch user profile data internally
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session?.user) return;

        // Try player schema first (default schema)
        const { data: playerProfile } = await supabase
          .from('player_profiles')
          .select('profilepic, profilecolor, granboard_name')
          .eq('id', session.user.id)
          .maybeSingle();

        if (playerProfile) {
          if (playerProfile.profilepic) setProfilepic(playerProfile.profilepic);
          if (playerProfile.profilecolor) setAccentColor(playerProfile.profilecolor);
          if (playerProfile.granboard_name) setUserName(playerProfile.granboard_name);
        } else {
          // Fallback to youth schema
          const { data: youthProfile } = await (supabase as any)
            .schema('youth')
            .from('youth_profiles')
            .select('profilepic, profilecolor, granboard_name')
            .eq('id', session.user.id)
            .maybeSingle();

          if (youthProfile) {
            if (youthProfile.profilepic) setProfilepic(youthProfile.profilepic);
            if (youthProfile.profilecolor) setAccentColor(youthProfile.profilecolor);
            if (youthProfile.granboard_name) setUserName(youthProfile.granboard_name);
          }
        }
      } catch (error) {
        console.error('AppHeader: Failed to fetch user profile:', error);
      }
    };

    fetchProfile();
  }, []);

  const handleBLEClick = async () => {
    if (!onBLEConnect || !onBLEDisconnect) return;

    if (bleConnected) {
      await onBLEDisconnect();
    } else {
      const result = await onBLEConnect();
      if (!result.success && result.error) {
        alert(`BLE Connection Failed:\n\n${result.error}\n\nTroubleshooting:\n- Make sure your Granboard is powered on\n- Enable Bluetooth on your phone\n- Use Chrome or Edge browser\n- Make sure you're using HTTPS (deployed app) or localhost`);
      }
    }
  };

  return (
    <div className="relative flex items-center justify-center h-10 shrink-0">
      {/* Left side */}
      <div className="absolute left-0 z-20">
        {onBack ? (
          // Back button for pages like OnlineLobby
          <button
            onClick={onBack}
            className="p-1 text-white hover:opacity-80 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : bleStatus ? (
          // BLE status for Dashboard
          <button
            onClick={handleBLEClick}
            className="flex items-center gap-2 transition-all hover:scale-105"
            disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
          >
            <img
              src={bluetoothIcon}
              alt="BLE Status"
              className="w-5 h-5 object-contain transition-all duration-300"
              style={{
                filter: bleConnected
                  ? 'brightness(0) saturate(100%) invert(64%) sepia(98%) saturate(451%) hue-rotate(85deg) brightness(95%) contrast(89%)'
                  : bleStatus === 'connecting' || bleStatus === 'scanning'
                  ? 'brightness(0) saturate(100%) invert(73%) sepia(47%) saturate(1122%) hue-rotate(358deg) brightness(103%) contrast(96%)'
                  : 'brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(4392%) hue-rotate(352deg) brightness(93%) contrast(94%)'
              }}
            />
            <span
              className="transition-colors text-xs"
              style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                color: bleConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444'
              }}
            >
              {bleStatus === 'connected' ? 'Connected' :
               bleStatus === 'connecting' ? 'Connecting...' :
               bleStatus === 'scanning' ? 'Scanning...' :
               'Disconnected'}
            </span>
          </button>
        ) : null}
      </div>

      {/* Center - title */}
      <h1
        className="text-base text-white uppercase tracking-wider font-bold"
        style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
      >
        {title}
      </h1>

      {/* Right side */}
      <div className="absolute right-0 flex items-center gap-3 z-20">
        {/* Refresh button (OnlineLobby) */}
        {showRefresh && onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Notifications bell */}
        {onClearMissedRequests && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-1.5 rounded-full border border-white/10 text-white hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                aria-label={notificationCount ? `${notificationCount} missed requests` : 'No missed requests'}
              >
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold text-white">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[240px] bg-zinc-900/95 text-white border border-zinc-700 backdrop-blur-md"
            >
              <DropdownMenuLabel>Missed Requests</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-700" />
              {notificationCount === 0 ? (
                <DropdownMenuItem disabled className="text-zinc-400">
                  No missed requests
                </DropdownMenuItem>
              ) : (
                <>
                  {missedRequests.map(request => (
                    <DropdownMenuItem
                      key={request.id}
                      className="focus:bg-zinc-800 focus:text-white cursor-default"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{request.fromPlayerName}</span>
                        <span className="text-xs text-zinc-400">
                          {new Date(request.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuItem
                    onSelect={event => {
                      event.preventDefault();
                      onClearMissedRequests();
                    }}
                    className="focus:bg-red-500/20 focus:text-white text-red-400 cursor-pointer"
                  >
                    Clear all
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User menu */}
        <UserMenu
          profilepic={profilepic}
          accentColor={accentColor}
          userName={userName}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          customItems={customMenuItems}
          size="sm"
        />
      </div>
    </div>
  );
}

export default AppHeader;
