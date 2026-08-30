import { BarChart3, TrendingUp, AlertCircle, BookOpen } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-1">Class Analytics</h1>
        <p className="text-text-muted">Discover learning gaps and class-wide performance trends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 bg-white p-6 rounded-xl border border-border shadow-sm flex flex-col items-center justify-center min-h-[300px] text-text-muted">
          <BarChart3 className="w-12 h-12 mb-4 text-border" />
          <p>Chart data will render here (Score Distribution)</p>
          <p className="text-sm">Install Recharts to visualize this component.</p>
        </div>

        <div className="flex flex-col gap-6">
          <InsightCard 
            icon={TrendingUp}
            title="Strongest Topic"
            desc="Students scored an average of 92% on Dynamic Programming questions."
            color="text-green-600"
            bg="bg-green-100"
          />
          <InsightCard 
            icon={AlertCircle}
            title="Critical Knowledge Gap"
            desc="45% of students missed Q3(a)(ii). Recommendation: Review Master's Theorem."
            color="text-red-600"
            bg="bg-red-100"
          />
          <InsightCard 
            icon={BookOpen}
            title="Time Saved"
            desc="AI grading has saved 14 hours this week across 3 batches."
            color="text-accent"
            bg="bg-accent/10"
          />
        </div>
      </div>
      
      <h2 className="text-xl font-bold text-text mb-4">Question Breakdown (Data Structures)</h2>
      <div className="bg-white rounded-xl border border-border shadow-sm p-6 flex flex-col gap-4">
        <QuestionBar q="Q1 (Divide and Conquer)" score={85} />
        <QuestionBar q="Q2 (Edit Distance)" score={72} />
        <QuestionBar q="Q3(a) (Master Theorem)" score={45} />
        <QuestionBar q="Q3(b) (Kosaraju's Alg)" score={68} />
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, desc, color, bg }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${bg} ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-text">{title}</h3>
      </div>
      <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function QuestionBar({ q, score }: { q: string, score: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-text">{q}</span>
        <span className="text-text-muted">{score}% Avg</span>
      </div>
      <div className="w-full bg-surface h-3 rounded-full overflow-hidden">
        <div 
          className={`h-full ${score > 80 ? 'bg-green-500' : score > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
