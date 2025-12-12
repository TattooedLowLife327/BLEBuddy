# BLE Buddy - Claude Context

**Last Updated**: December 11, 2025 (Idle detection, notification bell in lobby)

---

## WHAT IS BLE BUDDY?

BLE Buddy is a **companion app** for the main LowLife League of Granboard (LLOGB) application. It's a landscape-optimized mobile/tablet app that connects directly to Granboard dart boards via Bluetooth Low Energy (BLE) to enable real-time score tracking and online multiplayer games.

### Why It Exists
- **Main LLOGB App** = Full web app (tournaments, leagues, chat, player cards, admin, etc.) - runs on ANY device
- **BLE Buddy** = Lightweight companion app for ACTIVE GAMEPLAY - requires BLE-capable device

The main app can't reliably maintain BLE connections during complex tournament flows. BLE Buddy solves this by being a dedicated, focused game interface that:
1. Connects to the player's Granboard via Bluetooth
2. Detects dart throws automatically
3. Syncs scores to the same Supabase backend as the main app
4. Provides video chat between players (anti-cheat)

### Anti-Cheat Is Critical
Video feed is NOT optional - it's core functionality. Without seeing your opponent throw, people WILL cheat. This community has dealt with cheaters ruining games, so verification via live video is mandatory for online play.

---

## TECHNICAL STACK

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI + shadcn/ui |
| Database | Supabase (PostgreSQL) - **SHARED WITH MAIN APP** |
| Auth | Supabase Auth - **SAME ACCOUNTS AS MAIN APP** |
| BLE | Web Bluetooth API |
| Video Chat | WebRTC + Supabase Realtime (signaling) |
| State | React Context API |
| Deployment | Netlify |

---

## URLS & REPOS

| Resource | URL |
|----------|-----|
| **BLE Buddy Repo** | `https://github.com/Appraisily/BLEBuddy` |
| **BLE Buddy Netlify** | TBD (not deployed to production yet) |
| **Main LLOGB App** | `https://llogb.netlify.app` |
| **Supabase Project** | `https://sndsyxxcnuwjmjgikzgg.supabase.co` |
| **Supabase Project ID** | `sndsyxxcnuwjmjgikzgg` |

---

## LOCAL DEVELOPMENT

```bash
# Clone
git clone https://github.com/Appraisily/BLEBuddy.git
cd BLEBuddy

# Install
npm install

# Dev server (with network access for mobile testing)
npm run dev -- --host

# Build
npm run build
```

**Local Path**: `C:\Users\maehe\Desktop\BLEBUDDY\`

---

## SUPABASE SCHEMA MAPPING

BLE Buddy uses the **SAME Supabase instance** as the main LLOGB app. The database has multiple schemas:

### Schemas Used by BLE Buddy

| Schema | Purpose | Used By |
|--------|---------|---------|
| `player` | Standard player profiles, settings, stats | Both apps |
| `youth` | Youth player profiles (parental controls) | Both apps |
| `companion` | **BLE Buddy specific tables** | BLE Buddy only |

### `companion` Schema Tables

| Table | Purpose |
|-------|---------|
| `companion.online_lobby` | Players currently online in BLE Buddy lobby |
| `companion.games` | Active game sessions (TBD) |
| `companion.game_requests` | Pending match requests (TBD) |

### Key Tables From Other Schemas

| Table | Purpose |
|-------|---------|
| `player.player_profiles` | Player name, profile pic, accent color |
| `player.player_spotify` | Spotify integration settings |
| `youth.youth_profiles` | Youth player data |
| `store.products` | Store-purchased items (avatar asset_url paths) |

### Profile Pic Resolution Logic
Store-purchased avatars use local asset paths stored in `store.products.asset_url`:
```
/assets/LowLifeStore/halloween/pfp/vampireghostpfp.svg
```

These must be resolved to full URLs using the main app domain:
```typescript
// Local asset → https://llogb.netlify.app/assets/LowLifeStore/...
// Storage path → https://sndsyxxcnuwjmjgikzgg.supabase.co/storage/v1/object/public/profilepic/...
```

---

## PROJECT STRUCTURE

```
BLEBUDDY/
├── App.tsx                    # Main app component
├── main.tsx                   # Entry point with providers
├── components/
│   ├── CorkScreen.tsx         # "Who throws first" screen with video
│   ├── OnlineLobby.tsx        # Online player lobby
│   ├── Login.tsx              # Auth screen
│   ├── LobbyCard.tsx          # Game mode selection cards
│   ├── LocalDubsSetup.tsx     # Local doubles setup
│   ├── RemoteDubsSetup.tsx    # Remote doubles setup
│   ├── BLEStatus.tsx          # BLE connection status
│   ├── UserMenu.tsx           # User dropdown menu
│   └── ui/                    # shadcn/ui components
├── contexts/
│   ├── BLEContext.tsx         # App-wide BLE state
│   └── WebRTCContext.tsx      # (deprecated - empty)
├── hooks/
│   ├── useBLEThrows.ts        # Throw tracking to Supabase
│   └── useWebRTC.ts           # WebRTC video connection hook
├── utils/
│   ├── ble/
│   │   └── bleConnection.ts   # BLE manager with Granboard mapping
│   ├── supabase/
│   │   ├── client.ts          # Supabase client
│   │   └── info.tsx           # Supabase config
│   └── webrtc/
│       └── peerConnection.ts  # WebRTC peer connection manager
└── styles/
    └── globals.css            # Global styles
```

---

## BLE INTEGRATION

### Granboard Connection
```typescript
import { useBLE } from './contexts/BLEContext';

const { isConnected, connect, disconnect, lastThrow, status } = useBLE();
```

### Segment Mapping
Full segment map in `utils/ble/bleConnection.ts` covers:
- Numbers 1-20 (inner single, outer single, double, triple)
- Single Bull (25)
- Double Bull (50)
- Miss/Out
- Reset button

### Throw Data Structure
```typescript
interface DartThrowData {
  segment: string;        // "S20", "T19", "D16", "BULL", "DBL_BULL", "MISS"
  score: number;          // Calculated score
  multiplier: number;     // 1, 2, or 3
  baseValue: number;      // Face value (1-20 or 25)
  segmentType: SegmentType; // 'SINGLE_INNER' | 'SINGLE_OUTER' | 'DOUBLE' | 'TRIPLE' | 'BULL' | 'DBL_BULL' | 'MISS'
  dartNum: number;        // 1, 2, or 3 in the round
  timestamp: string;      // ISO timestamp
  device?: string;        // Board name
  rawBytes?: string;      // Raw BLE bytes for debugging
}
```

### Browser Support
| Browser | Support |
|---------|---------|
| Chrome Android | ✅ |
| Edge Android | ✅ |
| Bluefy iOS | ✅ |
| Safari iOS | ❌ NO WEB BLUETOOTH |
| Firefox | ❌ |

---

## WEBRTC VIDEO CHAT

### Architecture
- **Signaling**: Supabase Realtime broadcast channels
- **STUN Servers**: Google's public STUN servers
- **TURN**: None currently (may need for NAT traversal issues)

### Flow
1. Both players join same Supabase Realtime channel: `webrtc:{gameId}`
2. Initiator creates offer → broadcasts
3. Receiver gets offer → creates answer → broadcasts
4. ICE candidates exchanged via same channel
5. Peer connection established → video streams flow

### Usage
```typescript
import { useWebRTC } from './hooks/useWebRTC';

const { localStream, remoteStream, connectionState, initialize, disconnect } = useWebRTC({
  gameId: 'unique-game-id',
  localPlayerId: currentUser.id,
  remotePlayerId: opponent.id,
  isInitiator: true, // false for receiver
});
```

---

## CORK SCREEN (Who Throws First)

### Rules
- **Valid throws** (score at face value):
  - Inner single 1-20 = face value
  - Single Bull = 25
  - Double Bull = 50
- **Invalid throws** (score = 0):
  - Triples
  - Doubles
  - Outer singles
  - Miss
- **Tie**: Both players rethrow
- **Winner**: Higher score throws first in game

### Privacy
- You see YOUR score immediately
- Opponent's score shows only "✓" until both have thrown
- Both scores revealed simultaneously after both throw

---

## CURRENT STATUS

### ✅ Completed
- BLE connection and throw detection
- Granboard segment mapping (all segments)
- Online lobby with presence
- Profile pic resolution (including store purchases)
- Cork screen with BLE integration + mobile-first layout
- WebRTC manager and hook with detailed logging
- Video feed slots in cork screen
- PWA setup (landscape, service worker, manifest)
- Game request flow (challenge -> accept/decline)
- Cork screen wired into app flow
- Session persistence (refresh won't lose game state)
- Database tables exist: `companion.active_games`, `companion.game_throws`, `companion.online_lobby`
- **Leave Match** with confirmation dialog and opponent notification
- **Network disconnect detection** with 60-second countdown before auto-kick
- **Rejoin prompt** on app load for active games (rejoin or abandon)
- **useGameStatus hook** for presence tracking and game status communication
- **Lobby manual refresh only** - no auto-polling, refreshes on page navigation or refresh button
- **Game cleanup uses DELETE** - avoids RLS/column issues with UPDATE
- **BLE required for online lobby** - must connect board before entering, prompt shown if not connected
- **BLE disconnect handling in game** - blocking overlay with reconnect button, pauses game for that player only
- **Idle detection in lobby** - 15min inactivity triggers warning, 5min countdown to respond or auto-remove
- **Notification bell** - bottom right of lobby, shows missed game requests with clear all option
- Build passing

### ⏳ In Progress / TODO
1. **WebRTC Testing**
   - Video streaming between two real devices
   - Debug signaling if needed (detailed logging added)

2. **Game Screen**
   - Score tracking (501/301/Cricket)
   - Turn management
   - Checkout logic
   - Game over detection

3. **Game State Sync**
   - Realtime score sync between devices
   - Throw broadcasting

4. **End-to-end Testing**
   - Full game flow from challenge to game completion

---

## ENV VARIABLES

```env
VITE_SUPABASE_URL=https://sndsyxxcnuwjmjgikzgg.supabase.co
VITE_SUPABASE_PROJECT_ID=sndsyxxcnuwjmjgikzgg
VITE_SUPABASE_ANON_KEY=sb_publishable_YR80q8me3afbdERJ6w7rFg_Uajm8Jj1
```

---

## KEY DIFFERENCES FROM MAIN APP

| Aspect | Main LLOGB App | BLE Buddy |
|--------|----------------|-----------|
| Purpose | Full platform | Gameplay only |
| BLE | Not integrated | Core feature |
| Video | Not integrated | Core feature |
| Orientation | Portrait/responsive | Landscape only |
| Complexity | Everything | Minimal, focused |
| Default schema | `player` | `player` (queries `companion` explicitly) |

---

## COMMON GOTCHAS

1. **Schema specification**: Always use `.schema('companion')` for companion tables
2. **Profile pics**: Must resolve store asset paths through main app URL
3. **BLE warmup**: 2-second warmup period after connection (ignores initial events)
4. **iOS**: Safari does NOT support Web Bluetooth - use Bluefy browser
5. **Supabase client**: Use `createClient()` from `utils/supabase/client.ts`
6. **Game cleanup**: Use DELETE not UPDATE on `active_games` - UPDATE causes 400 errors. Include `.or('player1_id.eq.{userId},player2_id.eq.{userId}')` filter for RLS compatibility

---

## CONTACT / OWNER

**Mae** - Owner, Designer, Developer
- Sole developer of LLOGB and BLE Buddy
- Self-taught coder (7 months)
- Mass communications degree
- Community of 7,500+ dart players

---

*This file should be read at the start of every Claude session working on BLE Buddy.*
