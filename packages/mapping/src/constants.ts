export const ALGORITHM_CONSTANTS = {
  // Region computation & banding (A-09, A-10, 3.1)
  GUTTER_DENSITY_MAX: 0.02,
  GUTTER_MIN_WIDTH: 0.04,
  GUTTER_MIN_HEIGHT: 0.6,
  MIN_COLUMN_WORDS: 12,
  BAND_TOLERANCE: 0.6,
  SKEW_BAND_THRESHOLD: 2,
  SKEW_REDO_THRESHOLD: 8,
  SINGLE_WORD_KEEP: 0.5,
  MERGE_X_OVERLAP: 0.5,
  MERGE_Y_GAP: 1.6,
  MAX_REGIONS: 4,
  PAD_X: 0.25,
  PAD_Y: 0.35,
  FILL_MIN: 0.10,

  // Stitching (A-11)
  STITCH_MIN: 0.5,

  // Smith-Waterman Alignment (A-08, 9.1)
  FUZZY_MIN: 0.75,
  SW_MATCH: 3,
  SW_FUZZY: 1,
  SW_MISMATCH: -2,
  SW_GAP_W: -2,
  SW_GAP_B: -1,
  BACKTRACK: 40,
  LOOKAHEAD: 400,
  MIN_SCORE: 1.2,

  // Evidence Weights (13.4)
  W_LABEL: 0.45,
  W_SEMANTIC: 0.35,

  // Hungarian Assignment (14.2)
  THETA_UNANSWERED: 0.35,
  THETA_ORPHAN: 0.35,
  CONF_ASSERT: 0.35,
  SHEET_SANITY: 0.30,

  // Confidence (15)
  CONF_WEIGHTS: [0.30, 0.15, 0.15, 0.25, 0.15],
  REVIEW_THRESHOLD: 0.50,
  
  // UI Scroll (17)
  SCROLL_CENTER_FRACTION: 0.4
} as const;