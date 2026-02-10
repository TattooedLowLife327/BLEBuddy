// Lightweight TypeScript representations of the key Supabase tables
// used by the online lobby and active game flows. These mirror the
// columns referenced in code and help keep frontend assumptions
// aligned with the database schema.

export type ActiveGameStatus =
  | 'pending'
  | 'accepted'
  | 'playing'
  | 'cancelled'
  | 'declined'
  | 'abandoned'
  | 'expired';

export interface CompanionActiveGame {
  id: string;
  player1_id: string;
  player1_granboard_name: string;
  player2_id: string;
  player2_granboard_name: string;
  is_doubles: boolean;
  player1_partner_id: string | null;
  player2_partner_id: string | null;
  game_type: string | null;
  legs_to_win: number | null;
  double_out: boolean | null;
  game_config: unknown | null;
  status: ActiveGameStatus;
  created_at: string;
  accepted_at?: string | null;
  completed_at: string | null;
}

export type OnlineLobbyStatus = 'waiting' | 'idle' | 'in_match';

export interface CompanionOnlineLobbyRow {
  id: string;
  player_id: string;
  granboard_name: string;
  is_youth: boolean;
  partner_id: string | null;
  partner_granboard_name: string | null;
  status: OnlineLobbyStatus;
  last_seen: string;
  idle_started_at?: string | null;
  created_at: string;
}

