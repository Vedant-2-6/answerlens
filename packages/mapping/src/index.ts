
export * from "./constants";
export * from "./smith-waterman";
export * from "./hungarian";

import { ALGORITHM_CONSTANTS } from "./constants";
import { solveHungarian } from "./hungarian";

export interface EvidenceMatrix {
  labelScore: number;
  orderScore: number;
  semanticScore: number;
  totalScore: number;
}

export function computeCostMatrix(
  numQuestions: number,
  numGroups: number,
  scores: number[][]
): { matrix: number[][], size: number } {
  const size = numQuestions + numGroups;
  const matrix: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));
  
  const { THETA_UNANSWERED, THETA_ORPHAN } = ALGORITHM_CONSTANTS;
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i < numQuestions && j < numGroups) {
        matrix[i]![j] = 1 - (scores[i]?.[j] ?? 0);
      } else if (i < numQuestions && j >= numGroups) {
        matrix[i]![j] = 1 - THETA_UNANSWERED;
      } else if (i >= numQuestions && j < numGroups) {
        matrix[i]![j] = 1 - THETA_ORPHAN;
      } else {
        matrix[i]![j] = 0;
      }
    }
  }
  return { matrix, size };
}