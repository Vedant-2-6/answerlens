
"use client";
import { useSessionStore } from "@/app/store/session";
import { Download } from "lucide-react";

export function ClassRoster() {
  const { students, questions, setActiveStudent } = useSessionStore();

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const questionLabels = questions.map(q => q.labelRaw);
    csvContent += ["Student", ...questionLabels, "Total Score"].map(s => `"${s}"`).join(",") + "\n";

    students.forEach(s => {
      const row = [`"${s.filename}"`];
      let totalMarks = 0;
      questions.forEach(q => {
        const grade = s.gradings?.find(g => g.questionId === q.id);
        if (grade && grade.countedTowardTotal !== false) {
          row.push(`"${grade.marks ?? ""}"`);
          totalMarks += grade.marks || 0;
        } else {
          row.push(`""`);
        }
      });
      row.push(`"${totalMarks}"`);
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const csvLink = document.createElement("a");
    csvLink.setAttribute("href", encodedUri);
    csvLink.setAttribute("download", `answerlens_class_grades_${Date.now()}.csv`);
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
  };

  return (
    <div className="h-full flex flex-col bg-surface-app p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text-body">Class Roster</h1>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-white text-text-body border border-border-default shadow-sm hover:bg-surface transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden">
        <table className="w-full text-left text-sm text-text-body">
          <thead className="bg-surface-card border-b border-border-default">
            <tr>
              <th className="px-6 py-4 font-semibold">Student File</th>
              <th className="px-6 py-4 font-semibold text-right">Score</th>
              <th className="px-6 py-4 font-semibold text-center">Status</th>
              <th className="px-6 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {students.map(s => {
              const totalScore = (s.gradings || []).reduce((sum, g) => {
                if (g.countedTowardTotal === false) return sum;
                return sum + (g.marks || 0);
              }, 0);
              
              const isFailed = Object.values(s.stages).some(st => st.kind === "failed") || s.error;

              return (
                <tr key={s.id} className="hover:bg-surface-app transition-colors">
                  <td className="px-6 py-4 font-medium">{s.filename}</td>
                  <td className="px-6 py-4 text-right">{isFailed ? "-" : totalScore}</td>
                  <td className="px-6 py-4 text-center">
                    {isFailed ? (
                      <span className="text-red-500 bg-red-50 px-2 py-1 rounded">Failed</span>
                    ) : (
                      <span className="text-green-600 bg-green-50 px-2 py-1 rounded">Graded</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setActiveStudent(s.id)}
                      className="text-accent hover:underline font-medium"
                    >
                      View Details &rarr;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

