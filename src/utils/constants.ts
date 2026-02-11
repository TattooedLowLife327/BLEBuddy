// Centralized constants used across lobby and gameplay flows.
// Keeping these here avoids magic numbers being scattered in multiple files.

// Online lobby / matchmaking
export const REQUEST_TIMEOUT_MS = 11_000; // 11 seconds for incoming/outgoing game request timeout

// Idle handling
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const IDLE_WARNING_DURATION_S = 5 * 60; // 5 minutes in seconds
export const IDLE_CHECK_INTERVAL_MS = 30_000; // check every 30 seconds

// Lobby presence heartbeat
export const LOBBY_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

// Game status / disconnect timeout
export const DISCONNECT_TIMEOUT_SECONDS = 60;

// Delay before auto player change (time to pull darts) - local and online
export const PLAYER_CHANGE_DELAY_MS = 7000; // 7 seconds (was 3s, +4s)

// Protected lobby access (hardcoded passwords for Ladies / Youth cards)
export const LADIES_LOBBY_PASSWORD = 'blebuddy-ladies';
export const YOUTH_LOBBY_PASSWORD = 'blebuddy-youth';

