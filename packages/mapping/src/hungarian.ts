// @ts-nocheck
// Simple Munkres (Hungarian) Algorithm for O(N^3) assignment
// Cost matrix should be square.

export function solveHungarian(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  if (n === 0) return [];
  
  // Clone to avoid mutation
  const C = costMatrix.map(row => [...row]);
  
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1);
  const way = new Int32Array(n + 1);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1).fill(0);
    
    do {
      used[j0!]! = 1;
      const i0 = p[j0!]!;
      let delta = Infinity;
      let j1 = 0;
      
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = C[i0! - 1]![j - 1]! - u[i0!]! - v[j]!;
          if (cur < minv[j]!!) {
            minv[j]!! = cur;
            way[j]! = j0;
          }
          if (minv[j]!! < delta) {
            delta = minv[j]!!;
            j1 = j;
          }
        }
      }
      
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!] += delta;
          v[j]! -= delta;
        } else {
          minv[j]!! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0!]! !== 0);
    
    do {
      const j1 = way[j0];
      p[j0!]! = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  
  const result = new Array(n);
  for (let j = 1; j <= n; j++) {
    result[p[j]! - 1] = j - 1;
  }
  return result;
}