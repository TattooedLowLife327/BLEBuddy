# 🎯 BLE Buddy - LowLife Companion

A mobile/tablet darts application with landscape-only orientation, featuring a glassmorphic dark design with neon glow borders on pure black background.

## 🌟 Features

- **7-Card Carousel Lobby System** with role-based visibility (owner, admin, mod, youth, etc.)
- **Supabase Integration** with authentication and data storage
- **Separate Schemas** for regular players (`player.player_profiles`) and youth players (`youth.youth_profiles`)
- **Online Play Options:**
  - Solo (direct to lobby)
  - Local Dubs (team pairing with order selection)
  - Remote Dubs (online friends selection)
- **Unified OnlineLobby** with paginated player grid
- **PlayerGameSetup Modal** with:
  - Interactive slot-based game picker with flying animations
  - Format chips (Do/Mo/MiMo/DiDo and Full/Split)
  - Handicap options
- **Real-time Database Integration** with live player status

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Supabase:**
   
   Copy `.env.example` to `.env` (or `.env.local`) and fill in your Supabase publishable credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PROJECT_ID=your-project-ref   # optional, used if URL is omitted
   VITE_SUPABASE_ANON_KEY=your-new-publishable-key
   ```
   > ⚠️ Use the **Publishable anon key** from the Supabase dashboard, not legacy keys.

3. **Add Image Assets:**
   
   Replace the `figma:asset` imports in `App.tsx` with your own images:
   - Create `/assets` folder
   - Add the following images:
     - `bluetooth-icon.png`
     - `youth-background.png`
     - `darts-icon.png`
     - `ladies-dart-icon.png`
     - `youth-dart-icon.png`
     - `local-play-dart-icon.png`
     - `cash-sets-icon.png`
   
   Update imports in `App.tsx`:
   ```typescript
   import bluetoothIcon from './assets/bluetooth-icon.png'
   import youthBackground from './assets/youth-background.png'
   // ... etc
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
├── App.tsx                    # Main application component
├── components/
│   ├── Login.tsx             # Authentication component
│   ├── LobbyCard.tsx         # Individual lobby card
│   ├── OnlineLobby.tsx       # Online player lobby
│   ├── PlayerGameSetup.tsx   # Game configuration modal
│   ├── LocalDubsSetup.tsx    # Local doubles setup
│   ├── RemoteDubsSetup.tsx   # Remote doubles setup
│   └── ui/                   # Shadcn UI components
├── utils/
│   └── supabase/
│       ├── client.ts         # Supabase client
│       └── info.tsx          # Supabase configuration
├── styles/
│   └── globals.css           # Global styles & Tailwind
└── supabase/
    └── functions/
        └── server/           # Edge functions
```

## 🗄️ Database Schema

### Required Tables:

1. **player.player_profiles**
   - `id` (uuid, primary key)
   - `granboard_name` (text)
   - `profilecolor` (text)
   - `profilepic` (text)
   - `role` (text)
   - `gender` (text)
   - `birthday_month`, `birthday_day`, `birthday_year` (int)
   - `mpr_numeric`, `ppr_numeric`, `overall_numeric` (numeric)

2. **youth.youth_profiles**
   - Same as player_profiles
   - `parent_id` (uuid)

3. **public.online_lobby**
   - `user_id` (uuid)
   - `last_seen` (timestamp)
   - `is_doubles_team` (boolean)
   - `partner_id` (uuid, nullable)

4. **public.active_games**
   - Game challenge data

## 🎨 Design System

- **Background:** Pure black (#000000)
- **Glass Effect:** Backdrop blur with semi-transparent backgrounds
- **Neon Glow:** Dynamic accent colors based on user profile
- **Typography:** Helvetica/Arial sans-serif
- **Orientation:** Landscape only (mobile/tablet optimized)

## 🔐 Authentication

The app uses Supabase Auth with:
- Email/password authentication
- Profile-based role management
- Youth player safety features with parent pairing

## 📱 Responsive Design

Optimized for:
- Tablets (landscape)
- Mobile devices (landscape)
- Touch interactions
- BLE connectivity status

## 🛠️ Technologies

- **React 18** with TypeScript
- **Vite** for blazing fast builds
- **Tailwind CSS v4** for styling
- **Supabase** for backend
- **Shadcn/ui** for UI components
- **Lucide React** for icons
- **Motion/Framer Motion** for animations

## 📄 License

All rights reserved.

## 🤝 Contributing

This is a private project. Please contact the project owner for contribution guidelines.

---

**Built with ❤️ for the darts community**
