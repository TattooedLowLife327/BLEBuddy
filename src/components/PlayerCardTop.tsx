/**
 * Player card "top half" – matches legitllogb PlayerCardReadOnly top section.
 * Used in: Online Lobby grid cards and Send Format setup modal (left panel).
 * Includes: PFP, optional LLoGB badge (skin), profile color, name, granid, Online Games/Friends, stats (01 AVG, OVERALL, CR AVG).
 */
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { resolveProfilePicUrl } from '../utils/profile';

const FONT = 'Helvetica, Arial, sans-serif';

export interface PlayerCardTopData {
  granboardName: string;
  profilePic?: string | null;
  accentColor: string;
  granid?: string | null;
  friendCount?: number;
  onlineGameCount?: number;
  pprLetter?: string | null;
  pprNumeric?: number;
  overallLetter?: string | null;
  overallNumeric?: number;
  mprLetter?: string | null;
  mprNumeric?: number;
  partnerName?: string | null;
}

export interface PlayerCardTopProps {
  variant: 'card' | 'panel';
  data: PlayerCardTopData;
  /** Show LLoGB badge on profile pic (skin). Use /icons/llogbicon.png if present. */
  llogbBadge?: boolean;
  /** For lobby cards only: show status label below stats */
  status?: 'waiting' | 'idle' | 'in_match';
  loading?: boolean;
  /** Panel only: resolved profile pic URL if fetched separately */
  resolvedProfilePic?: string | null;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  const c = hex.trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    let r: number, g: number, b: number;
    if (h.length >= 6) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 0, 0, ${alpha})`;
}

// Leopard-spot style pattern for panel (full card) background
const spotPatternStyle: React.CSSProperties = {
  backgroundImage: [
    'radial-gradient(ellipse 12px 14px at 20% 15%, rgba(40,40,45,0.5) 0%, transparent 70%)',
    'radial-gradient(ellipse 10px 12px at 60% 25%, rgba(35,35,40,0.45) 0%, transparent 70%)',
    'radial-gradient(ellipse 14px 10px at 80% 55%, rgba(38,38,43,0.5) 0%, transparent 70%)',
    'radial-gradient(ellipse 11px 13px at 35% 70%, rgba(42,42,47,0.45) 0%, transparent 70%)',
    'radial-gradient(ellipse 9px 11px at 70% 85%, rgba(36,36,41,0.5) 0%, transparent 70%)',
  ].join(', '),
  backgroundColor: '#0a0a0b',
};

export function PlayerCardTop({
  variant,
  data,
  llogbBadge = false,
  status,
  loading = false,
  resolvedProfilePic,
}: PlayerCardTopProps) {
  const isCard = variant === 'card';
  const isPanel = variant === 'panel';
  const isIdle = status === 'idle';
  const isInMatch = status === 'in_match';
  const profilePicUrl = resolvedProfilePic ?? resolveProfilePicUrl(data.profilePic);

  // Panel variant: centered layout matching original card design (avatar → LLOGB → name → games • friends → stats)
  if (isPanel) {
    return (
      <div
        className="relative overflow-hidden flex flex-col w-full h-full rounded-lg"
        style={{
          ...spotPatternStyle,
          border: `2px solid ${data.accentColor}`,
          boxShadow: `0 0 24px ${hexToRgba(data.accentColor, 0.5)}`,
        }}
      >
        <div className="relative z-[5] flex flex-col flex-1 items-center pt-5 pb-4 px-4">
          {/* Centered avatar with accent glow */}
          <div className="relative mb-1">
            <Avatar
              className="border-[3px] shrink-0"
              style={{
                width: 80,
                height: 80,
                borderColor: data.accentColor,
                boxShadow: `0 0 16px ${hexToRgba(data.accentColor, 0.5)}`,
              }}
            >
              <AvatarImage src={profilePicUrl} />
              <AvatarFallback className="bg-zinc-800 text-white text-2xl">
                {data.granboardName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {llogbBadge && (
              <img
                src="/icons/llogbicon.png"
                alt="LLoGB"
                className="absolute opacity-90 pointer-events-none z-[5]"
                style={{ bottom: -6, right: -6, height: 28, width: 28 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          {/* LLOGB label below avatar (when badge shown) */}
          {llogbBadge && (
            <div
              className="text-white uppercase tracking-wider mb-0.5"
              style={{ fontFamily: FONT, fontSize: 10 }}
            >
              LLOGB
            </div>
          )}
          {/* Player name - prominent purple/accent */}
          <div
            className="font-bold text-center truncate max-w-full"
            style={{
              color: data.accentColor,
              fontFamily: FONT,
              fontSize: 15,
              textShadow: `0 0 12px ${hexToRgba(data.accentColor, 0.4)}`,
            }}
          >
            {data.granboardName}
          </div>
          {/* Single line: X games • Y friends */}
          <div
            className="text-white text-center mb-4"
            style={{ fontFamily: FONT, fontSize: 12 }}
          >
            <span className="font-bold">{(data.onlineGameCount ?? 0).toLocaleString()}</span>
            <span className="font-normal"> games • </span>
            <span className="font-bold">{(data.friendCount ?? 0).toLocaleString()}</span>
            <span className="font-normal"> friends</span>
          </div>

          {/* Stats: 01 AVG, OVERALL, CR AVG - label, grade, value */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-gray-400 text-xs" style={{ fontFamily: FONT }}>
                Loading...
              </span>
            </div>
          ) : (
            <div className="w-full grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/80" style={{ fontFamily: FONT, fontSize: 9 }}>
                  01 AVG
                </div>
                <div className="font-bold text-white" style={{ fontFamily: FONT, fontSize: 22 }}>
                  {data.pprLetter || '--'}
                </div>
                <div className="text-white" style={{ fontFamily: FONT, fontSize: 11 }}>
                  {data.pprNumeric != null && data.pprNumeric > 0 ? data.pprNumeric.toFixed(2) : '--'}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/80" style={{ fontFamily: FONT, fontSize: 9 }}>
                  OVERALL
                </div>
                <div className="font-bold text-white" style={{ fontFamily: FONT, fontSize: 22 }}>
                  {data.overallLetter || '--'}
                </div>
                <div className="text-white" style={{ fontFamily: FONT, fontSize: 11 }}>
                  {data.overallNumeric != null && data.overallNumeric > 0 ? data.overallNumeric.toFixed(2) : '--'}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/80" style={{ fontFamily: FONT, fontSize: 9 }}>
                  CR AVG
                </div>
                <div className="font-bold text-white" style={{ fontFamily: FONT, fontSize: 22 }}>
                  {data.mprLetter || '--'}
                </div>
                <div className="text-white" style={{ fontFamily: FONT, fontSize: 11 }}>
                  {data.mprNumeric != null && data.mprNumeric > 0 ? data.mprNumeric.toFixed(2) : '--'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Card variant: compact horizontal layout for lobby grid
  const content = (
    <>
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.2) 0%, rgba(20, 20, 20, 0.4) 100%)',
        }}
      />

      <div
        className="relative z-[5] flex flex-col h-full"
        style={{ padding: isCard ? 12 : 16 }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0">
            {isCard && status === 'waiting' && (
              <div
                className="absolute inset-0 rounded-full blur-md"
                style={{
                  backgroundColor: data.accentColor,
                  opacity: 0.5,
                  transform: 'scale(1.2)',
                }}
              />
            )}
            <Avatar
              className="relative border-[3px] shrink-0"
              style={{
                width: isCard ? 56 : 64,
                height: isCard ? 56 : 64,
                borderColor: isIdle || isInMatch ? '#52525b' : data.accentColor,
              }}
            >
              <AvatarImage src={profilePicUrl} />
              <AvatarFallback
                className="bg-zinc-800 text-white"
                style={{ fontSize: isCard ? 18 : 20 }}
              >
                {data.granboardName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {llogbBadge && (
              <img
                src="/icons/llogbicon.png"
                alt="LLoGB"
                className="absolute opacity-90 pointer-events-none z-[5]"
                style={{
                  bottom: -4,
                  right: -4,
                  height: isCard ? 24 : 28,
                  width: isCard ? 24 : 28,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div
              className="font-bold truncate"
              style={{
                color: data.accentColor,
                fontFamily: FONT,
                fontSize: isCard ? 12 : 14,
              }}
            >
              {data.granboardName}
            </div>
            {(data.granid ?? null) && (
              <div
                className="text-white font-medium"
                style={{ fontFamily: FONT, fontSize: isCard ? 10 : 12 }}
              >
                {data.granid}
              </div>
            )}
            {data.partnerName && (
              <div
                className="text-gray-400 truncate"
                style={{ fontFamily: FONT, fontSize: isCard ? 9 : 10 }}
              >
                + {data.partnerName}
              </div>
            )}
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="uppercase tracking-wider text-gray-500"
                  style={{ fontFamily: FONT, fontSize: isCard ? 9 : 10 }}
                >
                  Online Games
                </span>
                <span
                  className="text-white font-bold"
                  style={{ fontFamily: FONT, fontSize: isCard ? 10 : 12 }}
                >
                  {(data.onlineGameCount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="uppercase tracking-wider text-gray-500"
                  style={{ fontFamily: FONT, fontSize: isCard ? 9 : 10 }}
                >
                  Friends
                </span>
                <span
                  className="text-white font-bold"
                  style={{ fontFamily: FONT, fontSize: isCard ? 10 : 12 }}
                >
                  {(data.friendCount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isCard && status === 'idle' && (
          <p className="text-yellow-500 text-xs font-semibold text-center mb-1" style={{ fontFamily: FONT }}>
            IDLE
          </p>
        )}
        {isCard && status === 'in_match' && (
          <p className="text-red-400 text-xs font-semibold text-center mb-1" style={{ fontFamily: FONT }}>
            IN MATCH
          </p>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-gray-400 text-xs" style={{ fontFamily: FONT }}>
              Loading...
            </span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center">
            <div
              className="grid grid-cols-3 gap-1 text-center mb-0.5"
              style={{ fontFamily: FONT }}
            >
              <div
                className="uppercase tracking-wider text-gray-500"
                style={{ fontSize: isCard ? 8 : 9 }}
              >
                01 AVG
              </div>
              <div
                className="uppercase tracking-wider text-gray-500"
                style={{ fontSize: isCard ? 8 : 9 }}
              >
                OVERALL
              </div>
              <div
                className="uppercase tracking-wider text-gray-500"
                style={{ fontSize: isCard ? 8 : 9 }}
              >
                CR AVG
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 20 : 24,
                }}
              >
                {data.pprLetter || '--'}
              </div>
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 20 : 24,
                }}
              >
                {data.overallLetter || '--'}
              </div>
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 20 : 24,
                }}
              >
                {data.mprLetter || '--'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center mt-0.5">
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 10 : 12,
                }}
              >
                {data.pprNumeric != null && data.pprNumeric > 0
                  ? data.pprNumeric.toFixed(2)
                  : '--'}
              </div>
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 10 : 12,
                }}
              >
                {data.overallNumeric != null && data.overallNumeric > 0
                  ? data.overallNumeric.toFixed(2)
                  : '--'}
              </div>
              <div
                className="font-bold text-white"
                style={{
                  fontFamily: FONT,
                  fontSize: isCard ? 10 : 12,
                }}
              >
                {data.mprNumeric != null && data.mprNumeric > 0
                  ? data.mprNumeric.toFixed(2)
                  : '--'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className="relative rounded-lg overflow-hidden w-full h-full flex flex-col"
      style={{
        borderColor: isIdle || isInMatch ? '#52525b' : data.accentColor,
        borderWidth: 2,
        boxShadow:
          status === 'waiting'
            ? `0 0 20px ${hexToRgba(data.accentColor, 0.4)}`
            : 'none',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {content}
    </div>
  );
}
