import { ALGORITHM_CONSTANTS } from "./constants";

export interface AlignmentResult {
  score: number;
  matchedCount: number;
  matchedIndices: number[];
  endIndex: number;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;
  return 0.0;
}

export function smithWaterman(windowTokens: string[], blockTokens: string[]): AlignmentResult {
  const { SW_MATCH, SW_FUZZY, SW_MISMATCH, SW_GAP_W, SW_GAP_B, FUZZY_MIN } = ALGORITHM_CONSTANTS;
  const n = windowTokens.length;
  const m = blockTokens.length;

  if (n === 0 || m === 0) return { score: 0, matchedCount: 0, matchedIndices: [], endIndex: 0 };

  let prevRow = new Int32Array(m + 1);
  let currRow = new Int32Array(m + 1);
  const traceback = new Uint8Array((n + 1) * (m + 1));
  
  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 1; i <= n; i++) {
    const w = windowTokens[i - 1] as string;
    for (let j = 1; j <= m; j++) {
      const b = blockTokens[j - 1] as string;
      
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
      traceback[i * (m + 1) + j] = dir;

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

  while (i > 0 && j > 0 && traceback[i * (m + 1) + j] !== 0) {
    const dir = traceback[i * (m + 1) + j];
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