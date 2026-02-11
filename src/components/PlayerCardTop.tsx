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
  /** Card skin image URL (from store/profile) – shows as textured background with hole for PFP */
  skin?: string | null;
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

// Skin: organic blob / leopard-spot pattern for panel (visible on dark background)
const skinPatternStyle: React.CSSProperties = {
  backgroundImage: [
    'radial-gradient(ellipse 24px 28px at 15% 20%, rgba(30,30,35,0.85) 0%, transparent 65%)',
    'radial-gradient(ellipse 20px 24px at 55% 15%, rgba(28,28,33,0.8) 0%, transparent 65%)',
    'radial-gradient(ellipse 28px 22px at 85% 45%, rgba(32,32,37,0.85) 0%, transparent 65%)',
    'radial-gradient(ellipse 22px 26px at 25% 65%, rgba(26,26,31,0.8) 0%, transparent 65%)',
    'radial-gradient(ellipse 18px 22px at 75% 80%, rgba(30,30,35,0.85) 0%, transparent 65%)',
    'radial-gradient(ellipse 16px 20px at 45% 90%, rgba(28,28,33,0.75) 0%, transparent 65%)',
  ].join(', '),
  backgroundColor: '#0c0c0d',
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

  // Panel variant: centered layout matching reference (skin bg, PFP border, LLOGB, NAME caps, games • friends, stats)
  if (isPanel) {
    const hasSkinImage = Boolean(data.skin && data.skin.trim());
    return (
      <div
        className="relative overflow-hidden flex flex-col w-full h-full rounded-tl-lg rounded-bl-lg"
      >
        {/* Base: black + blob pattern when no skin image */}
        {!hasSkinImage && (
          <div className="absolute inset-0 z-0" style={skinPatternStyle} />
        )}
        {hasSkinImage && <div className="absolute inset-0 z-0 bg-black" />}

        {/* Player's skin image – hole cut out for PFP, light gradient so skin stays visible */}
        {hasSkinImage && (
          <div className="absolute inset-0 overflow-hidden z-[1] rounded-tl-lg rounded-bl-lg">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${data.skin!.trim()})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
                backgroundRepeat: 'no-repeat',
                opacity: 0.65,
                mask: 'radial-gradient(circle 52px at 50% 76px, transparent 100%, black 100%)',
                WebkitMask: 'radial-gradient(circle 52px at 50% 76px, transparent 100%, black 100%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.7) 75%, black 95%)',
              }}
            />
          </div>
        )}

        {/* Black circle behind PFP so skin doesn't show through (matches pre-cut hole: 104px) */}
        {hasSkinImage && (
          <div
            className="absolute z-[2] rounded-full bg-black"
            style={{
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 104,
              height: 104,
            }}
          />
        )}

        <div className="relative z-[5] flex flex-col items-center pt-4 pb-1 px-4 shrink-0">
          {/* Avatar fills the skin precut hole (104px) */}
          <div className="relative mb-1.5">
            <Avatar
              className="shrink-0 rounded-full overflow-hidden"
              style={{
                width: 104,
                height: 104,
                border: `3px solid ${data.accentColor}`,
                boxShadow: `0 0 10px ${hexToRgba(data.accentColor, 0.3)}`,
              }}
            >
              <AvatarImage src={profilePicUrl} />
              <AvatarFallback className="bg-zinc-800 text-white text-2xl">
                {data.granboardName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {llogbBadge && (
              <img
                src="/icons/llogbicon.png"
                alt="LLoGB"
                className="absolute opacity-95 pointer-events-none z-[5]"
                style={{ bottom: 6, left: '50%', transform: 'translateX(-50%)', height: 36, width: 36 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          {/* Breathing room below profile pic, then player name */}
          <div
            className="font-bold text-center truncate max-w-full uppercase mt-4 text-lg md:text-xl"
            style={{
              color: data.accentColor,
              fontFamily: FONT,
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              textShadow: `0 0 14px ${hexToRgba(data.accentColor, 0.5)}`,
            }}
          >
            {data.granboardName.toUpperCase()}
          </div>
          {/* Single line: X games • Y friends (bold numbers, smaller labels) */}
          <div
            className="text-white text-center mb-3 text-[11px] md:text-sm"
            style={{ fontFamily: FONT }}
          >
            <span className="font-bold">{(data.onlineGameCount ?? 0).toLocaleString()}</span>
            <span className="font-normal text-white/80"> games · </span>
            <span className="font-bold">{(data.friendCount ?? 0).toLocaleString()}</span>
            <span className="font-normal text-white/80"> friends</span>
          </div>

          {/* Stats: labels smallest, letter grade large, numbers medium - larger on desktop */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-gray-400 text-xs" style={{ fontFamily: FONT }}>
                Loading...
              </span>
            </div>
          ) : (
            <div className="w-full grid grid-cols-3 gap-2 md:gap-3 text-center">
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/70 text-[8px] md:text-[11px]" style={{ fontFamily: FONT }}>
                  01 AVG
                </div>
                <div className="font-bold text-white text-[26px] md:text-[32px]" style={{ fontFamily: FONT }}>
                  {data.pprLetter || '--'}
                </div>
                <div className="text-white/90 text-sm md:text-base font-medium" style={{ fontFamily: FONT }}>
                  {data.pprNumeric != null && data.pprNumeric > 0 ? data.pprNumeric.toFixed(2) : '--'}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/70 text-[8px] md:text-[11px]" style={{ fontFamily: FONT }}>
                  OVERALL
                </div>
                <div className="font-bold text-white text-[26px] md:text-[32px]" style={{ fontFamily: FONT }}>
                  {data.overallLetter || '--'}
                </div>
                <div className="text-white/90 text-sm md:text-base font-medium" style={{ fontFamily: FONT }}>
                  {data.overallNumeric != null && data.overallNumeric > 0 ? data.overallNumeric.toFixed(2) : '--'}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="uppercase tracking-wider text-white/70 text-[8px] md:text-[11px]" style={{ fontFamily: FONT }}>
                  CR AVG
                </div>
                <div className="font-bold text-white text-[26px] md:text-[32px]" style={{ fontFamily: FONT }}>
                  {data.mprLetter || '--'}
                </div>
                <div className="text-white/90 text-sm md:text-base font-medium" style={{ fontFamily: FONT }}>
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
