"use client";
import { useSessionStore } from "@/app/store/session";

export function SummaryBar() {
  const { questions, gradings } = useSessionStore();

  const totalMax = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
  const totalScore = gradings.reduce((sum, g) => sum + (g.marks || 0), 0);

  const correct = gradings.filter(g => g.verdict === 'full').length;
  const partial = gradings.filter(g => g.verdict === 'partial').length;
  const incorrect = gradings.filter(g => g.verdict === 'zero').length;
  const review = gradings.filter(g => g.suppressed).length;
  const unanswered = questions.length - gradings.length;

  return (
    <div className="h-16 px-6 bg-surface-card border-b border-border-default flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-text-body">Result Overview</h1>
        
        {/* EXT-04 Summary Chips */}
        <div className="flex items-center gap-2">
          {correct > 0 && <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">{correct} Correct</span>}
          {partial > 0 && <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">{partial} Partial</span>}
          {incorrect > 0 && <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">{incorrect} Incorrect</span>}
          {unanswered > 0 && <span className="px-2 py-0.5 text-xs font-semibold bg-[#f0f0f0] text-[#8a8a8a] rounded">{unanswered} Unanswered</span>}
          {review > 0 && <button className="px-2 py-0.5 text-xs font-semibold bg-accent text-white rounded shadow-sm hover:bg-accent-tint transition-colors">{review} Needs Review</button>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-text-meta">Total Marks:</span>
        <span className="px-3 py-1 bg-accent/10 text-accent font-semibold rounded-md">
          {totalScore} / {totalMax}
        </span>
      </div>
    </div>
  );
}