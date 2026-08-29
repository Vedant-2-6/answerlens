"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/app/store/session";
import type { Verdict, RubricVerdict } from "@answerlens/types";

function ScoreChip({ verdict, marks, max, suppressed }: { verdict: Verdict | null, marks: number | null, max: number | null, suppressed: boolean }) {
  if (suppressed) {
    return <span className="px-2 py-0.5 text-xs font-bold border rounded bg-surface-muted text-[#6b6b6b] border-transparent">Review</span>;
  }
  
  if (!verdict) {
    return <span className="px-2 py-0.5 text-xs font-bold border rounded bg-[#f0f0f0] text-[#8a8a8a] border-transparent">Not answered</span>;
  }

  const colors = {
    full: "bg-green-100 text-green-800 border-green-200",
    partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
    zero: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold border rounded ${colors[verdict]}`}>
      {marks !== null ? `${marks} / ${max}` : verdict}
    </span>
  );
}

function FeedbackPanel({ verdicts }: { verdicts: RubricVerdict[] }) {
  if (!verdicts.length) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 p-3 bg-surface-muted rounded-md text-sm text-text-meta space-y-2 overflow-hidden"
    >
      {verdicts.map((v, i) => (
        <div key={i} className="flex gap-2">
          <span className={v.verdict === 'met' ? 'text-green-600' : v.verdict === 'partial' ? 'text-yellow-600' : 'text-red-600'}>
            {v.verdict === 'met' ? 'âœ“' : v.verdict === 'partial' ? '~' : 'âœ—'}
          </span>
          <span className="leading-snug">{v.justification}</span>
        </div>
      ))}
    </motion.div>
  );
}

export function QuestionPane() {
  const { questions, gradings, orphans, selectedQuestionId, selectQuestion } = useSessionStore();

  return (
    <div className="flex flex-col h-full bg-surface-card">
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-text-meta uppercase tracking-wider px-1">Graded Questions</h2>
        {questions.map((q, idx) => {
          const grade = gradings.find(g => g.questionId === q.id);
          const isSelected = selectedQuestionId === q.id;
          
          const isUnanswered = !grade;
          const needsReview = grade?.suppressed;

          let borderClass = "border-border-default bg-white hover:border-accent/40";
          if (isSelected) borderClass = "border-accent bg-accent/5 ring-1 ring-accent";
          if (needsReview) borderClass += " border-l-4 border-l-accent"; // EXT-06

          const textClass = isUnanswered ? "text-[#8a8a8a]" : "text-text-muted"; // EXT-07

          return (
            <motion.div 
              key={q.id} 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              onClick={() => selectQuestion(q.id)}
              className={`p-3 border rounded-md cursor-pointer transition-colors shadow-sm hover:shadow-md ${borderClass}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-text-body">Q{q.labelRaw}</span>
                <ScoreChip 
                  verdict={grade?.verdict || null} 
                  marks={grade?.marks ?? null} 
                  max={q.maxMarks} 
                  suppressed={!!needsReview} 
                />
              </div>
              <p className={`text-sm leading-snug ${textClass}`}>{q.text}</p>
              
              <AnimatePresence>
                {isSelected && grade && !needsReview && (
                  <FeedbackPanel verdicts={grade.rubricVerdicts} />
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* EXT-05: UnmatchedList */}
      {orphans.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border-default bg-surface-muted p-4 border-l-4 border-l-accent"
        >
          <h3 className="text-sm font-semibold text-text-body mb-2">Unmatched Answers ({orphans.length})</h3>
          <div className="flex flex-col gap-2">
            {orphans.map((o, idx) => (
              <div key={idx} className="bg-white border border-border-default p-2 rounded text-xs text-text-meta truncate cursor-pointer hover:border-accent/40 shadow-sm">
                {o.transcription}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}