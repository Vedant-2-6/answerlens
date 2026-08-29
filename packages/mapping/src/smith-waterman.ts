import { ALGORITHM_CONSTANTS } from "./constants";

export interface AlignmentResult {
  score: number;
  matchedCount: number;
  matchedIndices: number[];
  endIndex: number;
}

export function tokenize(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) matrix[i]![0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  return matrix[a.length]![b.length]!;
}

function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1.0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - (dist / maxLen);
}

export function smithWaterman(windowTokens: string[], blockTokens: string[]): AlignmentResult {
  const { SW_MATCH, SW_FUZZY, SW_MISMATCH, SW_GAP_W, SW_GAP_B, FUZZY_MIN } = ALGORITHM_CONSTANTS;
  const n = windowTokens.length;
  const m = blockTokens.length;

  if (n === 0 || m === 0) return { score: 0, matchedCount: 0, matchedIndices: [], endIndex: 0 };

  let prevRow = new Int32Array(m + 1);
  let currRow = new Int32Array(m + 1);
  const traceback = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  
  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 1; i <= n; i++) {
    const w = windowTokens[i - 1]!;
    for (let j = 1; j <= m; j++) {
      const b = blockTokens[j - 1]!;
      
      const fuzzyScore = fuzzyMatch(w, b);
      let matchCost = Number(SW_MISMATCH);
      if (fuzzyScore === 1.0) matchCost = Number(SW_MATCH);
      else if (fuzzyScore >= Number(FUZZY_MIN)) matchCost = Number(SW_FUZZY);

      const diag = Number(prevRow[j - 1]) + matchCost;
      const up = Number(prevRow[j]) + Number(SW_GAP_B);
      const left = Number(currRow[j - 1]) + Number(SW_GAP_W);

      let score = 0;
      let dir = 0;

      if (diag > score) { score = diag; dir = 1; }
      if (up > score) { score = up; dir = 2; }
      if (left > score) { score = left; dir = 3; }

      currRow[j] = score;
      traceback[i]![j] = dir;

      if (score > maxScore) {
        maxScore = score;
        maxI = i;
        maxJ = j;
      }
    }
    prevRow.set(currRow);
    currRow.fill(0);
  }

  const matchedIndices: number[] = [];
  let i = maxI;
  let j = maxJ;
  let matchedCount = 0;

  while (i > 0 && j > 0 && traceback[i]![j] !== 0) {
    const dir = traceback[i]![j];
    if (dir === 1) {
      matchedIndices.unshift(i - 1);
      matchedCount++;
      i--; j--;
    } else if (dir === 2) {
      i--;
    } else {
      j--;
    }
  }

  return {
    score: maxScore,
    matchedCount,
    matchedIndices,
    endIndex: maxI
  };
}