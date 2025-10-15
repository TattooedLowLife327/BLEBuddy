import { useMemo } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface UserMenuProps {
  profilePic?: string | null;
  accentColor?: string;
  userName?: string | null;
  onLogout: () => void | Promise<void>;
  className?: string;
}

export function UserMenu({
  profilePic,
  accentColor = '#a855f7',
  userName,
  onLogout,
  className,
}: UserMenuProps) {
  const initials = useMemo(() => {
    if (!userName) return 'U';
    const trimmed = userName.trim();
    if (!trimmed) return 'U';
    const parts = trimmed.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
    return (first + second).toUpperCase() || 'U';
  }, [userName]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-full transition-transform hover:scale-[1.03] ${className ?? ''}`}
          aria-label="Open user menu"
        >
          <Avatar className="w-14 h-14 border-2" style={{ borderColor: accentColor }}>
            <AvatarImage src={profilePic || undefined} alt={userName ?? 'Profile picture'} />
            <AvatarFallback className="bg-white/10 text-white text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] bg-zinc-900/95 text-white border border-zinc-700 backdrop-blur-md"
      >
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-zinc-700">
            <AvatarImage src={profilePic || undefined} alt={userName ?? 'Profile picture'} />
            <AvatarFallback className="bg-white/10 text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{userName || 'Player'}</span>
            <span className="text-xs text-zinc-400">Manage your account</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-700" />
        <DropdownMenuItem
          onSelect={event => {
            event.preventDefault();
            onLogout();
          }}
          className="focus:bg-zinc-800 focus:text-white cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
