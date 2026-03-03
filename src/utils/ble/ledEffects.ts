// utils/ble/ledEffects.ts
// All complex multi-frame LED animations for Granboard
// Imports bleConnection singleton directly — game screens call these functions directly

import bleConnection from './bleConnection';

// ============================================================================
// CONSTANTS
// ============================================================================

// Physical board order clockwise from top (position 0 = segment 20)
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const CRICKET_NUMS = [20, 19, 18, 17, 16, 15];

// Palette codes for 20-byte ring frames
const PAL_OFF = 0x00;
const PAL_RED = 0x01;
const PAL_WHITE = 0x07;

// LED effect opcodes
const OP_DARK_SOLID = 0x15;
const OP_FLASH = 0x17;
const OP_FADE = 0x1D;
const OP_BULL_FADE = 0x1F;

// Drain paths for bust effect (from 20 down both sides, meeting at 3)
// Clockwise from 20:  20,1,18,4,13,6,10,15,2,17,3
// CCW from 20:        5,12,9,14,11,8,16,7,19,3
const DRAIN_CW  = [19, 0, 17, 3, 12, 5, 9, 14, 1, 16, 2]; // segment indexes (seg-1)
const DRAIN_CCW = [4, 11, 8, 13, 10, 7, 15, 6, 18, 2];

// ============================================================================
// HELPERS
// ============================================================================

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

/** Build a 16-byte effect frame with opcode + 0x01 terminator */
function buildFrame16(opcode: number): Uint8Array {
  const frame = new Uint8Array(16);
  frame[0] = opcode & 0xFF;
  frame[15] = 0x01;
  return frame;
}

/** Get physical position (0-19) of a segment number on the ring */
function boardPosition(segNum: number): number {
  return BOARD_ORDER.indexOf(segNum);
}

/** Send raw bytes to the board */
function send(bytes: Uint8Array): Promise<boolean> {
  return bleConnection.sendRawCommand(bytes);
}

/** Clear all LEDs */
function clear(): Promise<boolean> {
  return bleConnection.clearLEDs();
}

/** Send dark solid black (kills running animations) then clear ring */
async function fullClear(): Promise<void> {
  const kill = new Uint8Array(16);
  kill[0] = OP_DARK_SOLID;
  kill[15] = 0x01;
  await send(kill);
  await send(new Uint8Array(20));
}

// ============================================================================
// EFFECT FUNCTIONS
// ============================================================================

/**
 * Connect effect — fade/sweep in profile color
 * Used when board pairs or on player change
 */
export async function playConnectEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);
  const frame = buildFrame16(OP_FADE);
  frame[1] = c.r; frame[2] = c.g; frame[3] = c.b;
  frame[12] = 0x0A;
  await send(frame);
}

/**
 * Bust effect — 2 red flashes + drain animation
 * Ring drains from 20 down both sides to 3
 */
export async function playBustEffect(): Promise<void> {
  // 2 quick red flashes
  const flashFrame = buildFrame16(OP_FLASH);
  flashFrame[1] = 0xFF; flashFrame[2] = 0x00; flashFrame[3] = 0x00;
  flashFrame[12] = 0x02;

  await send(flashFrame);
  await wait(120);
  await send(new Uint8Array(20)); // off
  await wait(60);
  await send(flashFrame);
  await wait(120);

  // Snap to solid red ring then drain
  const ring = new Uint8Array(20);
  ring.fill(PAL_RED);
  await send(new Uint8Array(ring));

  const steps = Math.max(DRAIN_CW.length, DRAIN_CCW.length);
  for (let i = 0; i < steps; i++) {
    await wait(50);
    if (i < DRAIN_CW.length) ring[DRAIN_CW[i]] = PAL_OFF;
    if (i < DRAIN_CCW.length) ring[DRAIN_CCW[i]] = PAL_OFF;
    await send(new Uint8Array(ring));
  }
}

/**
 * Morse LL loop — flashes "LL" (·-·· ·-··) until AbortSignal fires
 * dit=195ms, dah=585ms, element gap=195ms, letter gap=585ms
 */
export async function playMorseLL(profileColor: string, signal: AbortSignal): Promise<void> {
  const c = hexToRGB(profileColor);
  const DIT = 195;
  const DAH = 585;
  const ELEMENT_GAP = 195;
  const LETTER_GAP = 585;
  const LOOP_GAP = 975; // 5x dit

  const L: ('dit' | 'dah')[] = ['dit', 'dah', 'dit', 'dit']; // morse L

  function solidFrame(): Uint8Array {
    const u8 = buildFrame16(OP_DARK_SOLID);
    u8[1] = c.r; u8[2] = c.g; u8[3] = c.b;
    u8[12] = 0;
    return u8;
  }
  const offFrame = new Uint8Array(20);

  while (!signal.aborted) {
    // Play "LL" once
    for (let letter = 0; letter < 2 && !signal.aborted; letter++) {
      for (let i = 0; i < L.length && !signal.aborted; i++) {
        await send(solidFrame());
        await wait(L[i] === 'dah' ? DAH : DIT);
        if (signal.aborted) break;
        await send(offFrame);
        await wait(ELEMENT_GAP);
      }
      if (letter === 0 && !signal.aborted) {
        await wait(LETTER_GAP - ELEMENT_GAP);
      }
    }
    if (!signal.aborted) {
      await wait(LOOP_GAP);
    }
  }

  // Cleanup on abort
  await clear();
}

/**
 * Cricket close effect — two comets converge from opposite side to closed number
 * Tail length 2, white burst on collision, restore open numbers
 */
export async function playCricketCloseEffect(
  closedNum: number,
  openCricketNums: number[],
  paletteColor: number = 0x06 // default purple
): Promise<void> {
  const STEP_MS = 20;
  const TAIL_LEN = 2;
  const targetPos = boardPosition(closedNum);
  const halfWay = 10;

  function baseFrame(): Uint8Array {
    const f = new Uint8Array(20);
    for (const num of openCricketNums) {
      f[num - 1] = paletteColor;
    }
    f[closedNum - 1] = paletteColor; // keep closing number lit until collision
    return f;
  }

  // Two comets race from opposite side toward the closed number
  for (let step = 0; step < halfWay; step++) {
    const frame = baseFrame();

    // CW comet
    for (let t = 0; t <= TAIL_LEN; t++) {
      const pos = (targetPos + halfWay - step + t) % 20;
      const seg = BOARD_ORDER[pos] - 1;
      if (t === 0) frame[seg] = paletteColor;
      else if (!openCricketNums.includes(BOARD_ORDER[pos])) frame[seg] = paletteColor;
    }

    // CCW comet
    for (let t = 0; t <= TAIL_LEN; t++) {
      const pos = (targetPos - halfWay + step - t + 40) % 20;
      const seg = BOARD_ORDER[pos] - 1;
      if (t === 0) frame[seg] = paletteColor;
      else if (!openCricketNums.includes(BOARD_ORDER[pos])) frame[seg] = paletteColor;
    }

    await send(new Uint8Array(frame));
    await wait(STEP_MS);
  }

  // Collision — white burst at closed number
  const burstFrame = baseFrame();
  burstFrame[closedNum - 1] = PAL_WHITE;
  await send(burstFrame);
  await wait(120);

  // Restore: open numbers stay, closed number now off
  const openRing = new Uint8Array(20);
  for (const num of openCricketNums) {
    openRing[num - 1] = paletteColor;
  }
  await send(openRing);
}

/**
 * Disconnect effect — red expand from 18 outward both directions to 7, then 4 red flashes
 */
export async function playDisconnectEffect(): Promise<void> {
  const startPos = boardPosition(18);
  const STEPS = 10;
  const FRAME_MS = 60;
  const REPEATS = 4;

  for (let rep = 0; rep < REPEATS; rep++) {
    // Expand from 18 both directions toward 7
    for (let step = 0; step <= STEPS; step++) {
      const frame = new Uint8Array(20);
      for (let i = 0; i <= step; i++) {
        const cw = (startPos + i) % 20;
        frame[BOARD_ORDER[cw] - 1] = PAL_RED;
        const ccw = (startPos - i + 20) % 20;
        frame[BOARD_ORDER[ccw] - 1] = PAL_RED;
      }
      await send(frame);
      await wait(FRAME_MS);
    }

    // Full ring lit — hold briefly
    await wait(150);

    // Flash the full ring on/off
    await send(new Uint8Array(20));
    await wait(100);
    const fullRed = new Uint8Array(20);
    for (let i = 0; i < 20; i++) fullRed[i] = PAL_RED;
    await send(fullRed);
    await wait(150);

    // Clear before next repeat
    await send(new Uint8Array(20));
    await wait(200);
  }

  await fullClear();
}

/**
 * Reconnect effect — green fade/sweep + double flash
 */
export async function playReconnectEffect(): Promise<void> {
  // Fade/sweep in true green
  const sweep = buildFrame16(OP_FADE);
  sweep[1] = 0x00; sweep[2] = 0xFF; sweep[3] = 0x00;
  sweep[12] = 0x0A;
  await send(sweep);
  await wait(1200);

  // Double flash in green
  const flash = buildFrame16(OP_FLASH);
  flash[1] = 0x00; flash[2] = 0xFF; flash[3] = 0x00;
  flash[12] = 0x02;
  await send(flash);
  await wait(120);
  await send(new Uint8Array(20));
  await wait(60);
  await send(flash);
  await wait(120);

  await fullClear();
}

/**
 * Bull hit — bull fade effect
 * Single bull: speed 0x0C. Double bull: speed 0x00 (fastest)
 */
export async function playBullHit(profileColor: string, isDouble: boolean): Promise<void> {
  const c = hexToRGB(profileColor);
  const frame = buildFrame16(OP_BULL_FADE);
  frame[1] = c.r; frame[2] = c.g; frame[3] = c.b;
  // colorB = black (already 0)
  // colorC = black (already 0)
  frame[12] = isDouble ? 0x00 : 0x0C;
  await send(frame);
}

/**
 * Game win — Grand Finale
 * Phase 1: Color cycling (hot pink, lime, cyan, purple) — 48 ticks at 50ms
 * Phase 2: Hot pink strobe — 8 ticks at 40ms
 * Phase 3: Final FLASH in player profile color
 */
export async function playGameWinEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);

  // Phase 1: Color cycling via DARK_SOLID effect frames
  const hotPink = buildFrame16(OP_DARK_SOLID);
  hotPink[1] = 0xFF; hotPink[2] = 0x00; hotPink[3] = 0xA2; hotPink[12] = 0;

  const lime = buildFrame16(OP_DARK_SOLID);
  lime[1] = 0x00; lime[2] = 0xFF; lime[3] = 0x00; lime[12] = 0;

  const cyan = buildFrame16(OP_DARK_SOLID);
  cyan[1] = 0x00; cyan[2] = 0xFF; cyan[3] = 0xFF; cyan[12] = 0;

  const purp = buildFrame16(OP_DARK_SOLID);
  purp[1] = 0x80; purp[2] = 0x00; purp[3] = 0xFF; purp[12] = 0;

  const rgbCycle = [hotPink, lime, cyan, purp];
  for (let tick = 0; tick < 48; tick++) {
    await send(rgbCycle[tick % rgbCycle.length]);
    await wait(50);
  }

  // Phase 2: Hot pink strobe
  const pinkFlash = buildFrame16(OP_FLASH);
  pinkFlash[1] = 0xFF; pinkFlash[2] = 0x00; pinkFlash[3] = 0xA2; pinkFlash[12] = 0x02;
  for (let tick = 0; tick < 8; tick++) {
    if (tick % 2 === 0) await send(pinkFlash);
    else await send(new Uint8Array(20));
    await wait(40);
  }

  // Phase 3: Final flash in player profile color
  const finalFlash = buildFrame16(OP_FLASH);
  finalFlash[1] = c.r; finalFlash[2] = c.g; finalFlash[3] = c.b; finalFlash[12] = 0;
  await send(finalFlash);
  await wait(150);

  await fullClear();
}

// ============================================================================
// ACHIEVEMENT EFFECTS
// ============================================================================

/**
 * Three in a Bed — escalating x3: strobe + explosion outward, bright FLASH finish
 */
export async function playThreeInBedEffect(segment: number, profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);
  const segPos = boardPosition(segment);
  // Map segment to a palette color (use purple=0x06 as default, or closest match)
  const pal = 0x06;

  // Trip 1: Just the segment
  const f1 = new Uint8Array(20);
  f1[segment - 1] = pal;
  await send(f1);
  await wait(300);
  await send(new Uint8Array(20));
  await wait(200);

  // Trip 2: Segment + 2 neighbors each side, quick double flash
  const f2 = new Uint8Array(20);
  for (let i = -2; i <= 2; i++) {
    f2[BOARD_ORDER[(segPos + i + 20) % 20] - 1] = pal;
  }
  await send(f2);
  await wait(150);
  await send(new Uint8Array(20));
  await wait(80);
  await send(f2);
  await wait(150);
  await send(new Uint8Array(20));
  await wait(200);

  // Trip 3: Repeat 3 times — rapid strobe + explosion outward
  for (let rep = 0; rep < 3; rep++) {
    // Rapid strobe on the segment
    for (let flash = 0; flash < 6; flash++) {
      const f3 = new Uint8Array(20);
      f3[segment - 1] = flash % 2 === 0 ? PAL_WHITE : pal;
      await send(f3);
      await wait(40);
    }
    // Explosion outward
    for (let step = 0; step <= 10; step++) {
      const frame = new Uint8Array(20);
      for (let i = 0; i <= step; i++) {
        frame[BOARD_ORDER[(segPos + i) % 20] - 1] = pal;
        frame[BOARD_ORDER[(segPos - i + 20) % 20] - 1] = pal;
      }
      await send(frame);
      await wait(25);
    }
    await send(new Uint8Array(20));
    await wait(60);
  }

  // Bright FLASH finish
  const flash = buildFrame16(OP_FLASH);
  flash[1] = c.r; flash[2] = c.g; flash[3] = c.b; flash[12] = 0x02;
  await send(flash);
  await wait(150);
  await fullClear();
}

/**
 * Three in the Black — 3 bull fades + strobe + extended ending + bright FLASH
 */
export async function playThreeInBlackEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);
  const pal = 0x06;

  // 3 rapid bull fades (profile + white)
  for (let rep = 0; rep < 3; rep++) {
    const u8 = buildFrame16(OP_BULL_FADE);
    u8[1] = c.r; u8[2] = c.g; u8[3] = c.b;
    u8[4] = 0xFF; u8[5] = 0xFF; u8[6] = 0xFF; // white
    u8[7] = c.r; u8[8] = c.g; u8[9] = c.b;
    u8[10] = 0x01; u8[11] = 0x00;
    u8[12] = 0x00; // max speed
    u8[13] = 0x01;
    await send(u8);
    await wait(400);
  }

  // Alternating strobe profile/white
  const aFrame = new Uint8Array(20);
  const bFrame = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    if (i % 2 === 0) { aFrame[i] = pal; bFrame[i] = PAL_WHITE; }
    else { aFrame[i] = PAL_WHITE; bFrame[i] = pal; }
  }
  for (let tick = 0; tick < 16; tick++) {
    await send(tick % 2 === 0 ? aFrame : bFrame);
    await wait(50);
  }

  // Bright FLASH finish with double flash
  const flash = buildFrame16(OP_FLASH);
  flash[1] = c.r; flash[2] = c.g; flash[3] = c.b; flash[12] = 0x02;
  await send(flash);
  await wait(120);
  await send(new Uint8Array(20));
  await wait(60);
  await send(flash);
  await wait(150);
  await fullClear();
}

/**
 * Hat Trick — 3 rapid bull fades (profile + white), no extra flash
 */
export async function playHatTrickEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);

  for (let rep = 0; rep < 3; rep++) {
    const u8 = buildFrame16(OP_BULL_FADE);
    u8[1] = c.r; u8[2] = c.g; u8[3] = c.b;
    u8[4] = 0xFF; u8[5] = 0xFF; u8[6] = 0xFF;
    u8[7] = c.r; u8[8] = c.g; u8[9] = c.b;
    u8[10] = 0x01; u8[11] = 0x00;
    u8[12] = 0x06; u8[13] = 0x01;
    await send(u8);
    await wait(400);
  }
  await fullClear();
}

/**
 * Shanghai — single light, double light, triple light at the segment number
 */
export async function playShanghaiEffect(segment: number, _profileColor: string): Promise<void> {
  const pal = 0x06;
  const idx = segment - 1;

  // Single — 1 flash
  const frame = new Uint8Array(20);
  frame[idx] = pal;
  await send(frame);
  await wait(300);
  await send(new Uint8Array(20));
  await wait(150);

  // Double — 2 flashes
  for (let f = 0; f < 2; f++) {
    await send(frame);
    await wait(150);
    await send(new Uint8Array(20));
    await wait(100);
  }
  await wait(100);

  // Triple — 3 rapid flashes then hold
  for (let f = 0; f < 3; f++) {
    await send(frame);
    await wait(100);
    await send(new Uint8Array(20));
    await wait(60);
  }

  // Final hold
  await send(frame);
  await wait(400);
  await fullClear();
}

/**
 * White Horse — 3 segments light -> shoot out -> 3-point spin (4 laps) -> full ring hold
 * NO flash at end (user called out flash fatigue)
 */
export async function playWhiteHorseEffect(segments: number[], _profileColor: string): Promise<void> {
  const pal = 0x06;
  const crNums = segments.length >= 3 ? segments.slice(0, 3) : [20, 19, 18];

  // Light each one up with a dramatic pause
  const frame = new Uint8Array(20);
  for (const num of crNums) {
    frame[num - 1] = pal;
    await send(new Uint8Array(frame));
    await wait(400);
  }

  // Shoot out from all three simultaneously
  for (let step = 1; step <= 6; step++) {
    const f = new Uint8Array(20);
    for (const num of crNums) {
      const pos = boardPosition(num);
      f[BOARD_ORDER[(pos + step) % 20] - 1] = pal;
      f[BOARD_ORDER[(pos - step + 20) % 20] - 1] = pal;
    }
    await send(f);
    await wait(35);
  }

  // Full spin celebration — 3-point spin, 4 laps getting faster
  for (let speed = 50; speed >= 20; speed -= 10) {
    for (let step = 0; step < 20; step++) {
      const f = new Uint8Array(20);
      for (let i = 0; i < 3; i++) {
        const pos = (step + i * 7) % 20;
        f[BOARD_ORDER[pos] - 1] = pal;
        f[BOARD_ORDER[(pos + 1) % 20] - 1] = pal;
      }
      await send(f);
      await wait(speed);
    }
  }

  // End on full ring hold then clear (NO flash)
  const full = new Uint8Array(20);
  full.fill(pal);
  await send(full);
  await wait(400);
  await fullClear();
}

/**
 * Ton 80 — triple hit escalation on 20, then double helix from 6 & 11 converging to 20
 */
export async function playTon80Effect(profileColor: string): Promise<void> {
  const pal = 0x06;
  const startPos = boardPosition(20); // position 0
  const pos6 = boardPosition(6);      // position 5
  const pos11 = boardPosition(11);    // position 15
  const STRAND_LEN = 3;

  // Trip 1: Normal — just segment 20
  const f1 = new Uint8Array(20);
  f1[19] = pal; // segment 20
  await send(f1);
  await wait(300);
  await send(new Uint8Array(20));
  await wait(200);

  // Trip 2: Wider — 20 + 2 neighbors each side
  const f2 = new Uint8Array(20);
  for (let i = -2; i <= 2; i++) {
    f2[BOARD_ORDER[(startPos + i + 20) % 20] - 1] = pal;
  }
  await send(f2);
  await wait(300);
  await send(new Uint8Array(20));
  await wait(200);

  // Trip 3: Wide — expand to 6 (CW) and 11 (CCW)
  const f3 = new Uint8Array(20);
  for (let i = 0; i <= 5; i++) f3[BOARD_ORDER[(startPos + i) % 20] - 1] = pal;
  for (let i = 1; i <= 5; i++) f3[BOARD_ORDER[(startPos - i + 20) % 20] - 1] = pal;
  await send(f3);
  await wait(300);
  await send(new Uint8Array(20));
  await wait(100);

  // Double helix — strand 1 from 6 CW, strand 2 from 11 CCW, converge to 20
  const speeds = [50, 35, 20];
  for (let lap = 0; lap < 3; lap++) {
    const spd = speeds[lap];
    for (let step = 0; step < 20; step++) {
      const frame = new Uint8Array(20);
      for (let s = 0; s < STRAND_LEN; s++) {
        const p = (pos6 + step - s + 20) % 20;
        frame[BOARD_ORDER[p] - 1] = pal;
      }
      for (let s = 0; s < STRAND_LEN; s++) {
        const p = (pos11 - step + s + 20) % 20;
        frame[BOARD_ORDER[p] - 1] = pal;
      }
      await send(frame);
      await wait(spd);
    }
  }

  // Both strands arrive at 20 — hold briefly then clean vanish
  const end = new Uint8Array(20);
  end[19] = pal;
  await send(end);
  await wait(200);
  await fullClear();
}

/**
 * High Ton — fast spin (18ms/step, 4 laps), bright FLASH at end
 */
export async function playHighTonEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);
  const pal = 0x06;

  for (let lap = 0; lap < 4; lap++) {
    for (let step = 0; step < 20; step++) {
      const frame = new Uint8Array(20);
      frame[BOARD_ORDER[step] - 1] = pal;
      frame[BOARD_ORDER[(step + 1) % 20] - 1] = pal;
      frame[BOARD_ORDER[(step + 2) % 20] - 1] = pal;
      await send(frame);
      await wait(18);
    }
  }

  // Bright FLASH finish
  const flash = buildFrame16(OP_FLASH);
  flash[1] = c.r; flash[2] = c.g; flash[3] = c.b; flash[12] = 0;
  await send(flash);
  await wait(200);
  await fullClear();
}

/**
 * Low Ton — spin (22ms/step, 4 laps), clean stop, no flash
 */
export async function playLowTonEffect(_profileColor: string): Promise<void> {
  const pal = 0x06;

  for (let lap = 0; lap < 4; lap++) {
    for (let step = 0; step < 20; step++) {
      const frame = new Uint8Array(20);
      frame[BOARD_ORDER[step] - 1] = pal;
      frame[BOARD_ORDER[(step + 1) % 20] - 1] = pal;
      frame[BOARD_ORDER[(step + 2) % 20] - 1] = pal;
      await send(frame);
      await wait(22);
    }
  }
  await fullClear();
}

/**
 * Madhouse Out (D1 win) — glitch animation, freeze on D1, explosion outward, color cycling
 */
export async function playMadhouseOutEffect(profileColor: string): Promise<void> {
  const c = hexToRGB(profileColor);
  const pal = 0x06;
  const glitchPals = [pal, PAL_WHITE];

  // Phase 1: Glitchy chaos
  for (let tick = 0; tick < 20; tick++) {
    const frame = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      frame[i] = Math.random() > 0.5 ? glitchPals[Math.floor(Math.random() * glitchPals.length)] : PAL_OFF;
    }
    await send(frame);
    await wait(Math.random() > 0.7 ? 15 : 40);
  }

  // Phase 2: Freeze — just segment 1 lit up (D1)
  await send(new Uint8Array(20));
  await wait(300);
  const d1Frame = new Uint8Array(20);
  d1Frame[0] = PAL_WHITE; // segment 1
  await send(d1Frame);
  await wait(500);

  // Phase 3: Explosion from D1 (position 1 on BOARD_ORDER)
  for (let step = 0; step <= 10; step++) {
    const frame = new Uint8Array(20);
    for (let i = 0; i <= step; i++) {
      frame[BOARD_ORDER[(1 + i) % 20] - 1] = pal;
      frame[BOARD_ORDER[(21 - i) % 20] - 1] = pal;
    }
    await send(frame);
    await wait(25);
  }

  // Phase 4: Full ring rapid color cycle (profile + white, not random)
  const hotPink = buildFrame16(OP_DARK_SOLID);
  hotPink[1] = 0xFF; hotPink[2] = 0x00; hotPink[3] = 0xA2; hotPink[12] = 0;
  const profSolid = buildFrame16(OP_DARK_SOLID);
  profSolid[1] = c.r; profSolid[2] = c.g; profSolid[3] = c.b; profSolid[12] = 0;
  for (let tick = 0; tick < 8; tick++) {
    await send(tick % 2 === 0 ? hotPink : profSolid);
    await wait(60);
  }

  // Final profile flash
  const flash = buildFrame16(OP_FLASH);
  flash[1] = c.r; flash[2] = c.g; flash[3] = c.b; flash[12] = 0;
  await send(flash);
  await wait(150);
  await fullClear();
}

// ============================================================================
// HIT ESCALATION HELPERS
// ============================================================================

/**
 * Enhanced triple hit for dart 2 when building toward 3-in-a-bed or ton80
 * Segment + 2 neighbors each side light up + double flash
 */
export async function playEnhancedTripleHit(segment: number, _profileColor: string): Promise<void> {
  const pal = 0x06;
  const segPos = boardPosition(segment);

  const f = new Uint8Array(20);
  for (let i = -2; i <= 2; i++) {
    f[BOARD_ORDER[(segPos + i + 20) % 20] - 1] = pal;
  }

  // Double flash
  await send(f);
  await wait(150);
  await send(new Uint8Array(20));
  await wait(80);
  await send(f);
  await wait(150);
}
