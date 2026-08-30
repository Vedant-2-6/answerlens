import { Users, FileDown, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ExamBatchView({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <Link href="/exams" className="hover:text-accent">Exams</Link>
        <span>/</span>
        <span className="text-text">Data Structures - Midterm</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Data Structures - Midterm</h1>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 50 Students</span>
            <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4" /> 48 Graded</span>
            <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-4 h-4" /> 2 Needs Review</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface hover:bg-border text-text px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            Sync to LMS
          </button>
          <button className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--border)] z-10">
              <tr className="text-sm text-text-muted">
                <th className="p-4 font-medium">Student ID</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Total Score</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, i) => (
                <StudentRow 
                  key={i} 
                  id={`2026${i.toString().padStart(4, "0")}`} 
                  name={`Student ${i + 1}`} 
                  score={i === 2 ? "14/36" : i === 7 ? "32/36" : "28/36"} 
                  warning={i === 2}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentRow({ id, name, score, warning }: any) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface/30 transition-colors">
      <td className="p-4 font-mono text-text-muted text-sm">{id}</td>
      <td className="p-4 font-medium text-text">{name}</td>
      <td className="p-4 font-bold text-text">{score}</td>
      <td className="p-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
          warning ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
        }`}>
          {warning ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          {warning ? "Needs Review" : "Graded"}
        </span>
      </td>
      <td className="p-4 text-right">
        <Link href="/" className="text-accent hover:text-accent-dark font-medium text-sm">Review Paper</Link>
      </td>
    </tr>
  );
}
