import { FileText, Download, UploadCloud, Search } from "lucide-react";
import Link from "next/link";

export default function ExamsHub() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text mb-1">Exams & Batches</h1>
          <p className="text-text-muted">Manage all your grading sessions.</p>
        </div>
        <button className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
          <UploadCloud className="w-4 h-4" /> Upload New Batch
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search exams..." 
              className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface/50 border-b border-border text-sm text-text-muted">
              <th className="p-4 font-medium">Exam Name</th>
              <th className="p-4 font-medium">Subject</th>
              <th className="p-4 font-medium">Papers</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <ExamRow id="101" name="Data Structures - Midterm" subject="CS 201" count={50} status="Completed" />
            <ExamRow id="102" name="Algorithms - Quiz 3" subject="CS 301" count={120} status="Completed" />
            <ExamRow id="103" name="Operating Systems - Final" subject="CS 401" count={45} status="Needs Review" warning />
            <ExamRow id="104" name="Computer Networks - Midterm" subject="CS 302" count={65} status="Draft" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamRow({ id, name, subject, count, status, warning }: any) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface/30 transition-colors">
      <td className="p-4 font-medium text-text flex items-center gap-3">
        <FileText className="w-5 h-5 text-text-muted" />
        {name}
      </td>
      <td className="p-4 text-text-muted">{subject}</td>
      <td className="p-4 text-text">{count}</td>
      <td className="p-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          warning ? "bg-amber-100 text-amber-700" : 
          status === "Draft" ? "bg-gray-100 text-gray-700" :
          "bg-green-100 text-green-700"
        }`}>
          {status}
        </span>
      </td>
      <td className="p-4 text-right">
        <Link href={`/exams/${id}`} className="text-accent hover:text-accent-dark font-medium text-sm inline-flex items-center gap-1">
          Open Roster
        </Link>
      </td>
    </tr>
  );
}
