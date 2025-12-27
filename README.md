# BLE Buddy - LowLife Companion App

A landscape-optimized mobile darts application with Bluetooth Low Energy (BLE) dartboard integration for The LowLifes of Granboard community.

## Features

- 🎯 **Real BLE Dartboard Connection** - Connect to Granboard via Web Bluetooth API
- 📱 **Landscape-Only Design** - Optimized for phone gameplay in landscape mode
- 🔐 **Supabase Authentication** - Secure login with player profiles
- 🎮 **Multiple Game Modes**
  - Online Solo & Doubles Play
  - Local Doubles Setup
  - Remote Doubles
  - Tournament Play (Tattoo's Lounge)
  - League Play
  - Cash Sets (21+ age-gated)
  - Ladies Only Lobby
  - Youth Lobby
- 📊 **Real-time Throw Tracking** - Automatic sync of throws to Supabase database
- 🎨 **Custom Theming** - Profile-based accent colors

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **BLE**: Web Bluetooth API
- **State Management**: React Context API
- **UI Components**: Radix UI + shadcn/ui

## Prerequisites

- Node.js 18+
- Chrome on Android or Bluefy on iOS (for Web Bluetooth support)
- Supabase project with database schemas set up

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Appraisily/BLEBuddy.git
cd BLEBuddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

For mobile testing on your local network:

```bash
npm run dev -- --host
```

### 5. Build for production

```bash
npm run build
```

## BLE Integration

### Using BLE Connection

The BLE functionality is available app-wide through the `BLEContext`:

```typescript
import { useBLE } from './contexts/BLEContext';

function MyComponent() {
  const { isConnected, connect, disconnect, lastThrow } = useBLE();

  // Connect to dartboard
  const handleConnect = async () => {
    await connect();
  };

  // Disconnect
  const handleDisconnect = async () => {
    await disconnect();
  };

  return (
    <button onClick={isConnected ? handleDisconnect : handleConnect}>
      {isConnected ? 'Disconnect' : 'Connect Board'}
    </button>
  );
}
```

### Using Throw Tracking Hook

To automatically save throws to Supabase:

```typescript
import { useBLEThrows } from './hooks/useBLEThrows';

function MatchComponent() {
  const { throws, totalScore, isProcessing } = useBLEThrows(
    matchId,
    playerId
  );

  return (
    <div>
      <h3>Score: {totalScore}</h3>
      {isProcessing && <p>Processing throw...</p>}
    </div>
  );
}
```

## Database Schema

The app expects the following Supabase schemas:

- `player` - Player profiles and settings
- `youth` - Youth player profiles
- `tournament` - Tournament registrations and matches
- `league` - League schedules and matches
- `admin` - Admin tables
- `badges` - Badge system
- `cash_sets` - Cash set matches
- `elite` - Elite player data
- `ghost` - Ghost league data

## Deployment

### Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Netlify dashboard
6. Deploy!

The `netlify.toml` is already configured for optimal deployment.

## Browser Support

**Web Bluetooth API Support:**
- ✅ Chrome on Android
- ✅ Edge on Android
- ✅ Bluefy Browser on iOS
- ❌ Safari (not supported)
- ❌ Firefox (not supported)

## Contributing

This is a private project for The LowLifes of Granboard community.

## License

Proprietary - © 2022-2025 The LowLifes of Granboard™

## Attributions

See [Attributions.md](./Attributions.md) for third-party licenses and credits.
