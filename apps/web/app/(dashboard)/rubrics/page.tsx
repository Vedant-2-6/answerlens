import { ListChecks, Plus, Edit2, Settings2 } from "lucide-react";

export default function RubricsManager() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text mb-1">Rubric Manager</h1>
          <p className="text-text-muted">Create and reuse custom grading instructions for the AI.</p>
        </div>
        <button className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Rubric
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RubricCard 
          title="Strict Coding Rubric" 
          subject="CS 201" 
          desc="Penalizes heavily for syntax errors and missing base cases. Validates time complexity."
        />
        <RubricCard 
          title="Lenient Math Rubric" 
          subject="MATH 101" 
          desc="Gives partial credit for correct steps even if the final calculation is slightly off."
        />
        <RubricCard 
          title="Standard Essay Rubric" 
          subject="ENG 101" 
          desc="Checks for thesis, 3 supporting arguments, and grammar. Lenient on vocabulary."
        />
      </div>
    </div>
  );
}

function RubricCard({ title, subject, desc }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-border shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="px-2 py-1 bg-surface text-text-muted text-xs font-bold rounded mb-2 inline-block">
            {subject}
          </span>
          <h3 className="text-xl font-bold text-text">{title}</h3>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-text-muted hover:bg-surface rounded-md transition-colors"><Settings2 className="w-4 h-4" /></button>
          <button className="p-2 text-text-muted hover:bg-surface rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="text-sm text-text-muted mb-6 flex-1">{desc}</p>
      <div className="flex justify-between items-center pt-4 border-t border-border mt-auto">
        <span className="text-sm text-text-muted">Last updated 2 days ago</span>
        <button className="text-accent font-medium text-sm hover:underline">Apply to Exam</button>
      </div>
    </div>
  );
}
