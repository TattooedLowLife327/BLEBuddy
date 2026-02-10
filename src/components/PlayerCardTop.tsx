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

export function PlayerCardTop({
  variant,
  data,
  llogbBadge = false,
  status,
  loading = false,
  resolvedProfilePic,
}: PlayerCardTopProps) {
  const isCard = variant === 'card';
  const isIdle = status === 'idle';
  const isInMatch = status === 'in_match';
  const profilePicUrl = resolvedProfilePic ?? resolveProfilePicUrl(data.profilePic);

  const content = (
    <>
      {/* Glassmorphic base layer */}
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
        {/* Top row: Profile pic + Name / ID / counts */}
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

        {/* Status (lobby card only) */}
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

        {/* Stats: 01 AVG, OVERALL, CR AVG */}
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

  if (isCard) {
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

  return (
    <div
      className="relative overflow-hidden flex flex-col w-full h-full"
      style={{
        borderRight: `1px solid ${data.accentColor}`,
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {content}
    </div>
  );
}
