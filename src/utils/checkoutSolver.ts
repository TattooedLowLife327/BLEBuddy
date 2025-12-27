export type OutMode = 'open' | 'master' | 'double';

interface DartOption {
  label: string;
  score: number;
  isDouble: boolean;
  isTriple: boolean;
  isBull50: boolean;
}

interface CheckoutOptions {
  outMode: OutMode;
  splitBull: boolean;
  dartsRemaining: number;
}

const buildDarts = (splitBull: boolean): DartOption[] => {
  const darts: DartOption[] = [];

  for (let n = 1; n <= 20; n += 1) {
    darts.push({ label: `S${n}`, score: n, isDouble: false, isTriple: false, isBull50: false });
    darts.push({ label: `D${n}`, score: n * 2, isDouble: true, isTriple: false, isBull50: false });
    darts.push({ label: `T${n}`, score: n * 3, isDouble: false, isTriple: true, isBull50: false });
  }

  if (splitBull) {
    darts.push({ label: 'BULL25', score: 25, isDouble: false, isTriple: false, isBull50: false });
    darts.push({ label: 'BULL50', score: 50, isDouble: true, isTriple: false, isBull50: true });
  } else {
    darts.push({ label: 'BULL', score: 50, isDouble: true, isTriple: false, isBull50: true });
  }

  return darts;
};

const isValidFinish = (dart: DartOption, outMode: OutMode): boolean => {
  if (outMode === 'double') return dart.isDouble || dart.isBull50;
  if (outMode === 'master') return dart.isDouble || dart.isTriple || dart.isBull50;
  return true;
};

const compareCombo = (a: DartOption[], b: DartOption[]): number => {
  if (a.length !== b.length) return a.length - b.length;
  const scoresA = a.map(d => d.score);
  const scoresB = b.map(d => d.score);
  for (let i = 0; i < scoresA.length; i += 1) {
    if (scoresA[i] !== scoresB[i]) return scoresB[i] - scoresA[i];
  }
  return 0;
};

export const getCheckoutSuggestion = (score: number, options: CheckoutOptions): string | null => {
  const { outMode, splitBull, dartsRemaining } = options;
  if (outMode === 'open') return null;
  if (dartsRemaining < 1) return null;
  if (score <= 1) return null;

  const darts = buildDarts(splitBull);
  let best: DartOption[] | null = null;

  // 1 dart
  if (dartsRemaining >= 1) {
    for (const last of darts) {
      if (last.score !== score) continue;
      if (!isValidFinish(last, outMode)) continue;
      const combo = [last];
      if (!best || compareCombo(combo, best) < 0) best = combo;
    }
  }

  // 2 darts
  if (dartsRemaining >= 2) {
    for (const first of darts) {
      for (const last of darts) {
        if (!isValidFinish(last, outMode)) continue;
        if (first.score + last.score !== score) continue;
        const combo = [first, last];
        if (!best || compareCombo(combo, best) < 0) best = combo;
      }
    }
  }

  // 3 darts
  if (dartsRemaining >= 3) {
    for (const first of darts) {
      for (const second of darts) {
        for (const last of darts) {
          if (!isValidFinish(last, outMode)) continue;
          if (first.score + second.score + last.score !== score) continue;
          const combo = [first, second, last];
          if (!best || compareCombo(combo, best) < 0) best = combo;
        }
      }
    }
  }

  if (!best) return null;
  return best.map(d => d.label).join(' ');
};
