"use client";
import { useEffect, useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/app/store/session";
import { AnswerToolbar } from "./AnswerToolbar";
import { HighlightBox } from "./HighlightBox";
import { rasterizeFile, type RasterizedPage } from "@/lib/rasterize";
import type { MappingResult } from "@answerlens/types";

// Memoized Highlight Box to prevent re-renders when zoom changes
const MemoizedHighlightBox = memo(HighlightBox);

export function AnswerPane() {
  const { answerFile, mappings, selectedQuestionId, selectQuestion } = useSessionStore();
  
  const [zoom, setZoom] = useState(1.0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pages, setPages] = useState<RasterizedPage[]>([]);
  const [error, setError] = useState<string>();

  // Rasterize PDF on mount
  useEffect(() => {
    if (!answerFile) return;
    rasterizeFile(answerFile)
      .then(setPages)
      .catch(e => setError(e.message));
  }, [answerFile]);

  // Auto-navigate to the page containing the selected question
  useEffect(() => {
    if (!selectedQuestionId) return;
    const mapping = mappings.find(m => m.questionId === selectedQuestionId);
    if (mapping && mapping.regions.length > 0) {
      const targetPage = mapping.regions[0].pageIndex;
      if (targetPage !== pageIndex && targetPage >= 0 && targetPage < pages.length) {
        setPageIndex(targetPage);
      }
    }
  }, [selectedQuestionId, mappings, pageIndex, pages.length]);

  const currentPage = pages[pageIndex];

  // Optimize mapping region lookup
  const currentRegions = useMemo(() => {
    const regions = [];
    for (const m of mappings) {
      for (let i = 0; i < m.regions.length; i++) {
        if (m.regions[i].pageIndex === pageIndex) {
          regions.push({
            m,
            region: m.regions[i],
            isFirst: i === 0
          });
        }
      }
    }
    return regions;
  }, [mappings, pageIndex]);

  if (!answerFile) return null;

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
      <AnswerToolbar 
        zoom={zoom} onZoom={setZoom}
        page={pageIndex} pageCount={pages.length} onPageChange={setPageIndex}
      />
      
      <div className="flex-1 overflow-auto p-8 flex items-start justify-center relative">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400">
              Failed to load paper: {error}
            </motion.div>
          ) : !currentPage ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-surface-dark border-t-accent rounded-full animate-spin"></div>
              <div className="text-text-muted text-sm">Rendering high-res page...</div>
            </motion.div>
          ) : (
            <motion.div 
              key={`page-${pageIndex}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white origin-top transition-[transform] duration-75"
              style={{ 
                width: currentPage.width, 
                height: currentPage.height,
                transform: `scale(${zoom})`,
                marginBottom: `${(zoom - 1) * currentPage.height}px` 
              }}
            >
              <img 
                src={`data:image/jpeg;base64,${currentPage.base64}`} 
                alt={`Page ${pageIndex + 1}`}
                className="w-full h-full pointer-events-none"
                loading="lazy"
              />
              
              {currentRegions.map(({ m, region, isFirst }, idx) => (
                <MemoizedHighlightBox
                  key={`${m.questionId}-region-${idx}`}
                  region={region}
                  label={isFirst ? `Q${m.questionId}` : undefined}
                  active={selectedQuestionId === m.questionId}
                  lowConfidence={m.confidence < 0.50}
                  onClick={() => selectQuestion(m.questionId)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}