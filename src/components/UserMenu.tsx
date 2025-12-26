import { useMemo } from 'react';
import { LogOut, Settings, type LucideIcon } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

export interface CustomMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  className?: string;
}

interface UserMenuProps {
  profilepic?: string | null;
  accentColor?: string;
  userName?: string | null;
  onLogout: () => void | Promise<void>;
  onOpenSettings?: () => void;
  customItems?: CustomMenuItem[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UserMenu({
  profilepic,
  accentColor = '#a855f7',
  userName,
  onLogout,
  onOpenSettings,
  customItems,
  className,
  size = 'lg',
}: UserMenuProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };
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
          <Avatar className={`${sizeClasses[size]} border-2`} style={{ borderColor: accentColor }}>
            <AvatarImage src={profilepic || undefined} alt={userName ?? 'Profile picture'} />
            <AvatarFallback className="bg-white/10 text-white text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] backdrop-blur-xl bg-zinc-900/40 text-white border border-zinc-600/50"
        style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-zinc-700">
            <AvatarImage src={profilepic || undefined} alt={userName ?? 'Profile picture'} />
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
        {onOpenSettings && (
          <DropdownMenuItem
            onSelect={event => {
              event.preventDefault();
              onOpenSettings();
            }}
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        )}
        {customItems && customItems.map((item, index) => (
          <DropdownMenuItem
            key={index}
            onSelect={() => item.onClick()}
            className={item.className || "focus:bg-zinc-800 focus:text-white cursor-pointer"}
          >
            {item.icon && <item.icon className="mr-2 h-4 w-4" />}
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
        {customItems && customItems.length > 0 && <DropdownMenuSeparator className="bg-zinc-700" />}
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
