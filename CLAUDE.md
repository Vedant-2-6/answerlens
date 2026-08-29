# AnswerLens — Cline CLAUDE.md

## What this project is
VedaAI hiring assignment: upload a question paper + answer sheet PDF, map answers to questions, grade them. Deadline: 30 August 2026.

## Current state (Phase 1 DONE, Phase 2 NOT started)
- Phase 0: monorepo scaffold ✅ (pnpm + turbo + Next.js 16 + React 19 + Tailwind 4)
- Phase 1: Upload Screen + Shell + OCR provider ✅ (build clean, dev server running)
- Phase 2–5: NOT started (see below)

## Tech stack
- **Runtime:** Node.js v22, pnpm 11, Next.js 16.3.3, React 19, Tailwind 4, TypeScript 5
- **OCR:** Tesseract.js (local, no API key needed)
- **LLM:** OmniRoute at http://127.0.0.1:20128/v1, key=dummy-token
- **Primary models:** cw/claude-opus-4-6 (mapping/grading), cw/claude-sonnet-4-6 (extraction/OCR/summary)
- **Fallback chain:** chatgpt-web/gpt-5.5-pro → deepseek/deepseek-v4-pro → tllm/gemini_3_pro
- **Vision model:** auto/pro-vision

## Monorepo structure
```
answerlens/
  apps/web/          ← Next.js app (main product)
  packages/
    types/src/index.ts       ← ALL shared types (read this first)
    providers/src/ocr.ts     ← Tesseract.js adapter (done)
    extraction/src/index.ts  ← LLM extraction (stub, phase 2)
    mapping/src/             ← Smith-Waterman + Hungarian (stub, phase 2)
    grading/src/             ← grading logic (stub, phase 2)
    pipeline/src/            ← orchestrator (stub, phase 2)
```

## Planning docs (READ BEFORE WRITING CODE)
All in C:\Users\DELL 5420\Projects\VedaAI\
- 02-ARCHITECTURE.md   ← system design
- 03-API_SPEC.md       ← all 6 API routes
- 04-DATA_MODEL.md     ← TypeScript interfaces
- 05-UI_UX_SPEC.md     ← Figma pixel-exact spec (colour, spacing, components)
- 16-PROMPT_SPEC.md    ← P-01 through P-06 — ALL LLM prompts verbatim
- 17-ALGORITHMS.md     ← §18 has all algorithm constants

## Non-negotiable architecture rules
1. **Zustand is authoritative** — app/store/session.ts owns all state. Route handlers are pure stateless functions.
2. **LLMs never produce coordinates** — Tesseract gives bounding boxes, LLM gives semantics. Smith-Waterman aligns them.
3. **Per-page requests** — never send full PDF to a route. One page per API call. Vercel: 4.5MB body limit, 60s timeout.
4. **Hungarian algorithm** — NOT greedy. Use Hungarian with THETA=0.35 for unanswered/orphan handling.

## Algorithm constants (packages/mapping/src/constants.ts — write this in Phase 2)
SW: MATCH=3, FUZZY=1, MISMATCH=-2, GAP_W=-2, GAP_B=-1, BACKTRACK=40, LOOKAHEAD=400, MIN_SCORE=1.2
Regions: PAD_X=0.25, PAD_Y=0.35, MAX_REGIONS=4, STITCH_MIN=0.5, MERGE_X_OVERLAP=0.5, MERGE_Y_GAP=1.6
Hungarian: THETA_UNANSWERED=0.35, THETA_ORPHAN=0.35, CONF_ASSERT=0.35
Evidence weights: W_LABEL=0.45, W_SEMANTIC=0.35
Confidence: 5-term [0.30, 0.15, 0.15, 0.25, 0.15], REVIEW_THRESHOLD=0.50

## Design tokens (all in apps/web/app/globals.css)
Font: Bricolage Grotesque, --accent: #ff5623, --surface-dark: #303030
One shadow for cards, one for buttons. No others.
Letter-spacing: -0.04em everywhere. First-letter underline motif on accent words.

## Environment (apps/web/.env.local)
OMNIROUTE_BASE_URL=http://127.0.0.1:20128/v1
OMNIROUTE_API_KEY=dummy-token
OMNIROUTE_EXTRACTION_MODEL=cw/claude-sonnet-4-6
OMNIROUTE_VISION_MODEL=auto/pro-vision
OMNIROUTE_MAPPING_MODEL=cw/claude-opus-4-6
OMNIROUTE_GRADING_MODEL=cw/claude-opus-4-6
OMNIROUTE_SUMMARY_MODEL=cw/claude-sonnet-4-6
OMNIROUTE_FALLBACK_1=chatgpt-web/gpt-5.5-pro
OMNIROUTE_FALLBACK_2=deepseek/deepseek-v4-pro
OMNIROUTE_FALLBACK_3=tllm/gemini_3_pro
OCR_PROVIDER=tesseract
USE_STUBS=false

## Phase 2 work (what to build next)
1. packages/mapping/src/constants.ts       — all algo constants above
2. packages/extraction/src/index.ts        — P-01 prompt, parse response, return Question[]
3. app/api/extract/route.ts                — POST, calls extraction package
4. packages/mapping/src/smith-waterman.ts  — SW alignment for text matching
5. packages/mapping/src/hungarian.ts       — cost matrix + Hungarian solver
6. packages/mapping/src/index.ts           — full mapAnswers() function
7. app/api/vision/route.ts                 — POST, calls auto/pro-vision, returns VisionPage
8. app/api/map/route.ts                    — POST, calls mapping package
9. packages/grading/src/index.ts           — grading logic with required-point check
10. app/api/grade/route.ts                 — POST, calls grading package
11. app/components/upload/UploadScreen.tsx  — wire "Start Mapping" to actually call all routes in sequence
12. app/processing/page.tsx                — drive stage updates in Zustand during pipeline

## Commands
```bash
# From answerlens/ root:
pnpm dev           # starts dev server at localhost:3000 (or: pnpm --filter @answerlens/web dev)
pnpm build         # production build
pnpm typecheck     # typecheck all packages
pnpm --filter @answerlens/providers typecheck
pnpm --filter @answerlens/web typecheck
```

## File encoding
Always write files with UTF-8 NO BOM. In PowerShell:
  [System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))