import { LucideIcon, Lock, ChevronLeft, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Badge } from './ui/badge';
import nextUpLogo from '../NextUPicon.png';

interface LobbyCardProps {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  customIcon?: string;
  accentColor: string;
  ageGated?: boolean;
  protected?: boolean;
  expandable?: boolean;
  isCenter?: boolean;
  isFlipped?: boolean;
  onNavigateToSolo?: () => void;
  onNavigateToLocalDubs?: () => void;
  onNavigateToRemoteDubs?: () => void;
}

export function LobbyCard({
  id,
  title,
  description,
  icon: Icon,
  customIcon,
  accentColor,
  ageGated,
  protected: isProtected,
  expandable,
  isCenter,
  isFlipped,
  onNavigateToSolo,
  onNavigateToLocalDubs,
  onNavigateToRemoteDubs,
}: LobbyCardProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Convert hex to rgba for box shadows
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Check if content is scrollable
  const checkScrollable = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const hasScroll = container.scrollHeight > container.clientHeight;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 5;
      setShowScrollIndicator(hasScroll && !isAtBottom);
    }
  };

  // Check scrollable on mount and when menu changes
  useEffect(() => {
    checkScrollable();
    // Small delay to ensure content is rendered
    const timer = setTimeout(checkScrollable, 100);
    return () => clearTimeout(timer);
  }, [expandedMenu, isFlipped]);

  // Handle scroll events
  const handleScroll = () => {
    checkScrollable();
  };

  const boxShadow = isCenter
    ? `0 0 20px ${hexToRgba(accentColor, 0.6)}, 0 0 40px ${hexToRgba(accentColor, 0.35)}, inset 0 0 20px ${hexToRgba(accentColor, 0.15)}`
    : 'none';

  return (
    <div
      className="relative bg-black rounded-lg border text-center w-80 h-64 overflow-hidden"
      style={{
        borderColor: isCenter ? accentColor : '#4b5563',
        boxShadow,
        transformStyle: 'preserve-3d',
        transition: 'box-shadow 200ms ease',
      }}
    >
      {/* Front face */}
      <div
        className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center"
        style={{
          backfaceVisibility: 'hidden',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: '#000',
          zIndex: isFlipped ? 1 : 10,
        }}
      >
        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          {ageGated && (
            <Badge 
              variant="secondary" 
              className="backdrop-blur-sm bg-orange-500/80 text-white border-0"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              21+
            </Badge>
          )}
          {isProtected && (
            <div className="backdrop-blur-sm bg-white/20 rounded-full p-1.5">
              <Lock className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Icon */}
        {id !== 'youth-lobby' && (
          <div className="flex items-center justify-center mb-0" style={{ marginTop: '-1rem' }}>
            {(id === 'local-play' || id === 'ladies-only') ? (
              // Special styling for local play, ladies - bigger, full width, sideways, no border/background
              <div className="w-full flex items-center justify-center" style={{ height: '180px' }}>
                {customIcon && (
                  <img 
                    src={customIcon} 
                    alt={title} 
                    className="w-full h-full object-contain"
                    style={{
                      transform: 'rotate(90deg) scale(1.2)',
                    }}
                  />
                )}
                {!customIcon && Icon && (
                  <Icon 
                    className="w-full h-full text-white"
                    style={{
                      transform: 'rotate(90deg) scale(1.2)',
                    }}
                  />
                )}
              </div>
            ) : id === 'cash-sets' ? (
            // Cash sets - smaller and NOT sideways with padding for spacing
            <div className="w-full flex items-center justify-center py-8" style={{ height: '180px' }}>
              {customIcon && (
                <img 
                  src={customIcon} 
                  alt={title} 
                  className="h-full object-contain"
                  style={{
                    maxWidth: '120px',
                    maxHeight: '120px',
                  }}
                />
              )}
              {!customIcon && Icon && (
                <Icon 
                  className="h-full text-white"
                  style={{
                    maxWidth: '120px',
                    maxHeight: '120px',
                  }}
                />
              )}
            </div>
          ) : id === 'online-play' ? (
            // Online play - larger icon with less padding
            <div className="w-full flex items-center justify-center py-4" style={{ height: '180px' }}>
              {customIcon && (
                <img 
                  src={customIcon} 
                  alt={title} 
                  className="h-full object-contain"
                  style={{
                    maxWidth: '160px',
                    maxHeight: '160px',
                  }}
                />
              )}
              {!customIcon && Icon && (
                <Icon 
                  className="h-full text-white"
                  style={{
                    maxWidth: '160px',
                    maxHeight: '160px',
                  }}
                />
              )}
            </div>
          ) : (
            // All other cards - standard sizing with padding
            <div className="w-full flex items-center justify-center py-8" style={{ height: '180px' }}>
              {customIcon && (
                <img 
                  src={customIcon} 
                  alt={title} 
                  className="h-full object-contain"
                  style={{
                    maxWidth: '120px',
                    maxHeight: '120px',
                  }}
                />
              )}
              {!customIcon && Icon && (
                <Icon 
                  className="h-full text-white"
                  style={{
                    maxWidth: '120px',
                    maxHeight: '120px',
                  }}
                />
              )}
            </div>
          )}
        </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {id === 'youth-lobby' ? (
            <div className="w-full h-full flex items-center justify-center px-8">
              <img 
                src={nextUpLogo} 
                alt="NextUP" 
                className="w-full h-auto object-contain"
                style={{ maxWidth: '280px' }}
              />
            </div>
          ) : (
            <h3 
              className="text-white text-4xl mb-0 whitespace-nowrap"
              style={{ 
                fontFamily: 'Helvetica, Arial, sans-serif', 
                fontWeight: 'bold',
                fontSize: id === 'tournament' ? '2rem' : id === 'cash-sets' ? '2rem' : undefined
              }}
            >
              {id === 'local-play' ? 'In House' : id === 'ladies-only' ? 'Ladies' : id === 'cash-sets' ? 'Cash Sets' : title}
            </h3>
          )}
        </div>

      </div>

      {/* Back face */}
      <div
        className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center"
        style={{
          transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
          backfaceVisibility: 'hidden',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: '#000',
          zIndex: isFlipped ? 10 : 1,
        }}
      >
        {/* Youth lobby dart icon at top */}
        {id === 'youth-lobby' && customIcon && (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 flex items-center justify-center" style={{ width: '60px', height: '60px' }}>
            <img 
              src={customIcon} 
              alt={title} 
              className="w-full h-full object-contain"
              style={{
                transform: 'rotate(90deg)',
              }}
            />
          </div>
        )}
        
        {/* Back Arrow - only show in submenus */}
        {id === 'local-play' && expandedMenu && (
          <button
            className="absolute top-4 left-4 p-2 rounded-full backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors z-20"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedMenu(null);
            }}
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative" style={{ paddingTop: id === 'youth-lobby' ? '3rem' : '0' }}>
          {id === 'local-play' ? (
            // Special content for local-play back face
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="space-y-3 w-full px-4 max-h-full overflow-y-auto scrollbar-hidden"
            >
              {!expandedMenu ? (
                // Main menu
                <>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMenu('01-games');
                    }}
                  >
                    01 GAMES
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMenu('cr-games');
                    }}
                  >
                    CR GAMES
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMenu('medley');
                    }}
                  >
                    MEDLEY
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMenu('practice');
                    }}
                  >
                    PRACTICE
                  </button>
                </>
              ) : expandedMenu === '01-games' ? (
                // 01 Games submenu
                <>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    301
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    501
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    701
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Freeze
                  </button>
                </>
              ) : expandedMenu === 'cr-games' ? (
                // CR Games submenu
                <>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Standard Cricket
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Wild Card Cricket
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Hidden Cricket
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Double Down
                  </button>
                </>
              ) : expandedMenu === 'medley' ? (
                // Medley submenu
                <>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    3 Leg
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    5 Leg
                  </button>
                </>
              ) : expandedMenu === 'practice' ? (
                // Practice submenu
                <>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Count Up
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Cricket Count Up
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Target
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Around the World
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Tic Tac Toe
                  </button>
                  <button
                    className="w-full py-3 px-4 rounded-lg backdrop-blur-sm bg-white/10 text-white hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Two Line
                  </button>
                </>
              ) : null}
            </div>
          ) : id === 'youth-lobby' ? (
            // Youth lobby back face
            <>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ color: accentColor, fontFamily: 'Helvetica, Arial, sans-serif' }}
              >
                Youth Lobby
              </h3>
              
              <div className="space-y-2 w-full px-4">
                <button
                  className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToSolo?.();
                  }}
                >
                  Solo
                </button>
                <button
                  className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToLocalDubs?.();
                  }}
                >
                  Local Dubs
                </button>
                <button
                  className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToRemoteDubs?.();
                  }}
                >
                  Remote Dubs
                </button>
              </div>
            </>
          ) : (
            <>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ color: accentColor, fontFamily: 'Helvetica, Arial, sans-serif' }}
              >
                {id === 'online-play' ? 'Choose Play Type' : `${title} Details`}
              </h3>
              {id !== 'online-play' && (
                <p className="text-sm text-gray-400 mb-4 px-2" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  Click to explore more features
                </p>
              )}
              
              {expandable && (
                <div className="space-y-2 w-full px-4">
                  <button
                    className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToSolo?.();
                    }}
                  >
                    Solo
                  </button>
                  <button
                    className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToLocalDubs?.();
                    }}
                  >
                    Local Dubs
                  </button>
                  <button
                    className="w-full py-2 px-3 rounded-lg backdrop-blur-sm bg-white/10 text-white text-sm hover:bg-white/20 transition-colors text-center"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToRemoteDubs?.();
                    }}
                  >
                    Remote Dubs
                  </button>
                </div>
              )}
              
              {!expandable && (
                <ul className="space-y-2 max-h-28 overflow-auto px-2">
                  {['Feature 1', 'Feature 2', 'Feature 3'].map((f, i) => (
                    <li
                      key={i}
                      className="text-gray-300 flex items-center text-sm"
                      style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                    >
                      <span className="mr-2 mt-[2px] inline-flex items-center justify-center">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={accentColor}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Scroll Indicator */}
          {id === 'local-play' && showScrollIndicator && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
              <ChevronDown 
                className="w-6 h-6 text-white/50 animate-bounce"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.3))',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
