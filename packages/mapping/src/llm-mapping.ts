import type { Question, VisionPage, MappingResult } from "@answerlens/types";
import { ALGORITHM_CONSTANTS } from "./constants";
import { callLLMJSON, getLLMCredentials } from "@answerlens/providers";

function buildRegionFromBlock(b: { approxTopFraction: number; approxBottomFraction: number }, pageIndex: number) {
  return {
    x: 0,
    y: Math.min(b.approxTopFraction, b.approxBottomFraction),
    w: 1,
    h: Math.abs(b.approxBottomFraction - b.approxTopFraction),
    pageIndex
  };
}

export async function mapAnswersLLM(
  questions: Question[],
  visionPages: VisionPage[]
): Promise<{ mappings: MappingResult[], orphans: any[] }> {
  const prompt = `You are an expert examiner mapping a student's answer sheet to the original question paper.
  
RULES:
1. The student may answer out of order (e.g. Q3 then Q1). Map them correctly.
2. A single answer may span multiple pages. You can map a question to multiple page indices.
3. If the student answers extra choices (e.g. did 4 out of 3), map all of them.
4. For diagrams/maps/MCQs without text, infer which question they belong to based on context.
5. Identify any blocks that do not correspond to any question on the question paper as orphans.
6. Return a JSON object with 'mappings' and 'orphanBlocks' arrays matching this structure:
{
  "mappings": [
    {
      "questionId": "Q1",
      "pagesSpanned": [0, 1],
      "blockIndices": {
        "0": [0, 1],
        "1": [0]
      },
      "confidence": 0.95,
      "reasoning": "Explicitly labelled 1(a)",
      "interleaved": false
    }
  ],
  "orphanBlocks": [
    {
      "pageIndex": 0,
      "blockIndex": 2,
      "reasonGuess": "Unlabeled diagram or blank space"
    }
  ]
}

QUESTION PAPER:
${JSON.stringify(questions.map(q => ({ id: q.id, label: q.labelRaw, text: q.text, marks: q.maxMarks })), null, 2)}

STUDENT ANSWER PAGES (WITH BLOCKS):
${visionPages.map(vp => `--- PAGE ${vp.pageIndex} ---\n` + (vp.blocks || []).map(b => `[Block ${b.index}] (kind: ${b.kind}, label: ${b.label || 'none'})\nText: ${b.text}`).join("\n")).join("\n\n")}

RETURN JSON FORMAT:
{
  "mappings": [
    {
      "questionId": "Q1",
      "pagesSpanned": [0],
      "blockIndices": {
        "0": [0]
      },
      "confidence": 0.9,
      "reasoning": "Student wrote Q1 in label",
      "interleaved": false
    }
  ],
  "orphanBlocks": []
}
`;

  const payloadBase = {
    messages: [
      { role: "system", content: "You output strict JSON for examination mapping." },
      { role: "user", content: prompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };

  const credentials = getLLMCredentials();
  const { parsed } = await callLLMJSON(payloadBase, credentials);

  // Compute print order rank for each question ID
  const questionOrderMap = new Map<string, number>();
  questions.forEach((q, idx) => {
    questionOrderMap.set(q.id, idx);
  });

  // Collect physical order info for orderEvidence
  const physicalMappings = (parsed.mappings || []).map((m: any) => {
    const pagesSpanned: number[] = m.pagesSpanned || [];
    const blockIndices: { [pageIndex: string]: number[] } = m.blockIndices || {};
    let minPhysVal = Infinity;
    pagesSpanned.forEach(pIdx => {
      const idxs = blockIndices[pIdx] || [];
      if (idxs.length > 0) {
        const firstBlockIdx = Math.min(...idxs);
        const physVal = pIdx * 1000 + firstBlockIdx;
        if (physVal < minPhysVal) {
          minPhysVal = physVal;
        }
      }
    });
    return {
      questionId: m.questionId,
      physicalPos: minPhysVal === Infinity ? 0 : minPhysVal,
      mapping: m
    };
  });

  // Sort mappings by physical order to compute physical ranks
  physicalMappings.sort((a: any, b: any) => a.physicalPos - b.physicalPos);
  const physicalRankMap = new Map<string, number>();
  physicalMappings.forEach((pm: any, idx: number) => {
    physicalRankMap.set(pm.questionId, idx);
  });

  const mappedBlockIds = new Set<string>();
  
  const mappings: MappingResult[] = [];
  
  for (const m of parsed.mappings || []) {
    const pagesSpanned: number[] = m.pagesSpanned || [];
    const blockIndices: { [pageIndex: string]: number[] } = m.blockIndices || {};
    
    // Retrieve target blocks
    const targetBlocks: any[] = [];
    pagesSpanned.forEach(pIdx => {
      const vp = visionPages.find(v => v.pageIndex === pIdx);
      const idxs = blockIndices[pIdx] || [];
      if (vp) {
        const matchedBlocks = (vp.blocks || []).filter(b => idxs.includes(b.index));
        matchedBlocks.forEach(b => {
          targetBlocks.push({ ...b, pageIndex: pIdx });
        });
      }
    });

    // Expand target blocks using continuation flags
    let addedNew = true;
    while (addedNew) {
      addedNew = false;
      const currentBlocks = [...targetBlocks];
      for (const b of currentBlocks) {
        if (b.continuesToNextPage) {
          const nextVp = visionPages.find(v => v.pageIndex === b.pageIndex + 1);
          if (nextVp) {
            const nextBlock = (nextVp.blocks || []).find(nb => nb.continuedFromPrevious);
            if (nextBlock && !targetBlocks.some(tb => tb.pageIndex === nextVp.pageIndex && tb.index === nextBlock.index)) {
              targetBlocks.push({ ...nextBlock, pageIndex: nextVp.pageIndex });
              addedNew = true;
            }
          }
        }
        if (b.continuedFromPrevious) {
          const prevVp = visionPages.find(v => v.pageIndex === b.pageIndex - 1);
          if (prevVp) {
            const prevBlock = (prevVp.blocks || []).find(pb => pb.continuesToNextPage);
            if (prevBlock && !targetBlocks.some(tb => tb.pageIndex === prevVp.pageIndex && tb.index === prevBlock.index)) {
              targetBlocks.push({ ...prevBlock, pageIndex: prevVp.pageIndex });
              addedNew = true;
            }
          }
        }
      }
    }
    
    // Sort targetBlocks by pageIndex and then index to maintain natural order
    targetBlocks.sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.index - b.index;
    });

    // Record all successfully grabbed blocks
    targetBlocks.forEach(b => {
      mappedBlockIds.add(`${b.pageIndex}-${b.index}`);
    });

    // Filter by kind
    const filteredBlocks = targetBlocks.filter(b => b.kind === "answer" || b.kind === "rough-work" || b.kind === "label-only" || b.kind === "mcq");

    // Build transcription
    const transcription = filteredBlocks.map(b => (b.label ? `[LABEL: ${b.label}]\n` : "") + b.text).join("\n\n");

    // Build regions
    const regions = filteredBlocks.map(b => buildRegionFromBlock(b, b.pageIndex));

    // Determine the dominant kind for this mapping (e.g. if it has an mcq block)
    const hasMcq = filteredBlocks.some(b => b.kind === "mcq");
    const mappingKind = hasMcq ? "mcq" : "prose";

    // Calculate labelEvidence
    const questionObj = questions.find(q => q.id === m.questionId);
    let labelEvidence = 0.2; // default lower evidence
    if (questionObj) {
      const cleanLabel = questionObj.labelRaw.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanText = transcription.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      const textHasLabelMatch = cleanLabel.length > 0 && cleanText.includes(cleanLabel);
      const blockLabelHasMatch = filteredBlocks.some(b => b.label && b.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanLabel));

      if (textHasLabelMatch || blockLabelHasMatch) {
        labelEvidence = 1.0;
      }
    }

    // Calculate orderEvidence
    let orderEvidence = 1.0;
    const printRank = questionOrderMap.get(m.questionId);
    const physicalRank = physicalRankMap.get(m.questionId);
    if (printRank !== undefined && physicalRank !== undefined) {
      const diff = Math.abs(printRank - physicalRank);
      if (diff > 2) {
        orderEvidence = Math.max(0.7, 1.0 - 0.05 * (diff - 2));
      }
    }

    const confidence = m.confidence || 0.5;

    let finalAnswerText: string | null = null;
    for (let idx = filteredBlocks.length - 1; idx >= 0; idx--) {
      const fb = filteredBlocks[idx];
      if (fb && fb.finalAnswerText) {
        finalAnswerText = fb.finalAnswerText;
        break;
      }
    }

    mappings.push({
      questionId: m.questionId,
      kind: mappingKind,
      regions,
      tier: confidence > 0.8 ? "exact" : "approximate",
      confidence,
      transcription,
      labelEvidence,
      semanticEvidence: confidence,
      orderEvidence,
      suppressed: confidence < ALGORITHM_CONSTANTS.REVIEW_THRESHOLD || m.interleaved,
      finalAnswerText
    });
  }

  // Build Orphans
  const orphans: any[] = [];
  for (const o of parsed.orphanBlocks || []) {
    const pageIndex: number = o.pageIndex;
    const blockIndex: number = o.blockIndex;
    
    // Skip if it was pulled into a mapping via continuation
    if (mappedBlockIds.has(`${pageIndex}-${blockIndex}`)) {
      continue;
    }

    const vp = visionPages.find(v => v.pageIndex === pageIndex);
    if (vp) {
      const block = (vp.blocks || []).find(b => b.index === blockIndex);
      if (block) {
        orphans.push({
          regions: [buildRegionFromBlock(block, pageIndex)],
          transcription: block.text,
          confidence: 0.5
        });
      }
    }
  }

  return { mappings, orphans };
}
