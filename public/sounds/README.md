# Game sounds (electronic soft-tip style)

Drop **MP3** files here. The app looks for these exact filenames. If a file is missing, that event is silent.

## File list

| File | When it plays |
|------|----------------|
| `dart.mp3` | Every dart hit (same sound for single/double/triple) |
| `bull.mp3` | Bull hit (optional; omit to use `dart.mp3`) |
| `doubleBull.mp3` | Double bull (optional; omit to use `dart.mp3`) |
| `gameRequest.mp3` | Game request received or sent |
| `corkLoading.mp3` | Cork screen ready / waiting for throws |
| `corkHit.mp3` | Dart thrown during cork |
| `corkWinner.mp3` | Cork winner decided |
| `gameStart.mp3` | “Good luck” done, game starting |
| `lastRound.mp3` | Last round (e.g. round 20) |
| `gameEnd.mp3` | Game over / winner screen |
| `bust.mp3` | Bust (01) |
| `medleyTransition.mp3` | Next game in medley or medley match end |
| `out.mp3` | Checkout dart (winning throw) |
| `missClick.mp3` | Button to count misses / end turn |
| `playerChange.mp3` | Turn change |
| `win.mp3` | Game winner (also used for achievements; can same as `gameEnd`) |
| `achievement.mp3` | Ton80, hat trick, white horse, etc. |

---

## Brief for generating sounds (pleasant, not jarring)

**Style:** Electronic soft-tip dartboard. **Not** high-pitch arcade beeps, **not** a physical “thunk.” Clean, mid-range, subtle – like a tablet or smart device. Pleasant on repeat.

- **dart** – One short soft “tick” or “tock” (0.1–0.3 s). Same sound for singles, doubles, triples. Muted, non-piercing.
- **bull / doubleBull** – Same as dart or a very slight variant (e.g. slightly rounder). Optional.
- **gameRequest** – Short “incoming” or “sent” chime (0.3–0.6 s). Friendly, not alarming.
- **corkLoading** – Very short ambient or “ready” tone (0.2–0.5 s). Calm.
- **corkHit** – Same as dart (cork throw = one dart).
- **corkWinner** – Short “winner” tone (0.4–0.8 s). Satisfying, not cheesy.
- **gameStart** – Short “game on” (0.3–0.6 s).
- **lastRound** – Short “final round” cue (0.3–0.5 s). Subtle.
- **gameEnd** – Short “game over” / “round complete” (0.5–1 s). Clear but not harsh.
- **bust** – Short “no” / “error” (0.3–0.5 s). Low, soft, not punishing.
- **medleyTransition** – Short “next leg” or “match end” (0.4–0.7 s).
- **out** – Checkout confirmation (0.2–0.5 s). Can be same as dart or a slight “finish” variant.
- **missClick** – Very short UI click (0.05–0.15 s). Soft, not metallic.
- **playerChange** – Short “turn change” (0.15–0.35 s). Neutral.
- **win** – Same as gameEnd or a bit more “celebration” (0.5–1.2 s).
- **achievement** – Short “bonus” / “unlock” (0.6–1.5 s). Brighter than dart but not arcade.

**Rule of thumb:** If it makes you wince or want to mute after a few throws, soften and shorten it.
