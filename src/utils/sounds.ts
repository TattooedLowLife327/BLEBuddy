/**
 * Game sounds. Place MP3 files in public/sounds/ — see public/sounds/README.md for the full list.
 * Same sound for singles/doubles/triples (one "dart" tick); bull/double bull optional variants.
 * If a file is missing, that event is silent. No errors.
 */

const SOUNDS_DIR = '/sounds/';

const cache: Record<string, HTMLAudioElement> = {};
const failed = new Set<string>();

export type SoundName =
  | 'dart'           // Any dart hit (S/D/T – same sound)
  | 'bull'           // Bull hit (optional; can use dart.mp3)
  | 'doubleBull'     // Double bull (optional; can use dart.mp3)
  | 'gameRequest'    // Incoming/outgoing game request
  | 'corkLoading'    // Cork screen ready / waiting
  | 'corkHit'        // Dart thrown during cork
  | 'corkWinner'     // Cork winner decided
  | 'gameStart'      // Good luck done, game starting
  | 'lastRound'      // Last round (e.g. round 20)
  | 'gameEnd'        // Game over / winner screen
  | 'bust'           // Bust (01)
  | 'medleyTransition' // Next game in medley or medley match end
  | 'out'            // Checkout dart (winning throw)
  | 'missClick'      // Button to count misses / end turn
  | 'playerChange'   // Turn change
  | 'win'            // Legacy: game winner (use gameEnd or out as well)
  | 'achievement';   // Ton80, hat trick, etc.

function loadSound(name: SoundName): HTMLAudioElement | null {
  if (failed.has(name)) return null;
  const cached = cache[name];
  if (cached) return cached;

  const path = `${SOUNDS_DIR}${name}.mp3`;
  const audio = new Audio(path);
  cache[name] = audio;
  return audio;
}

/**
 * Play a game sound. Does nothing if the file doesn't exist.
 * Uses cloneNode so the same sound can overlap (e.g. rapid darts).
 */
export function playSound(name: SoundName): void {
  const audio = loadSound(name);
  if (!audio) return;
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.7;
  clone.play().catch(() => {
    failed.add(name);
    delete cache[name];
  });
}
