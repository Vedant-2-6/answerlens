"use client";
import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "@/app/store/session";
import { Sparkles, Pencil, Download } from "lucide-react";
import { ChatDrawer } from "./ChatDrawer";

export function SummaryBar() {
  const { questions, paperMaxMarks, setPaperMaxMarks, activeStudentId, students } = useSessionStore();
  const student = students.find(s => s.id === activeStudentId);
  const { visionPages = [], mappings = [], gradings = [], orphans = [], stages = {}, corrections = {} } = student || {};
  const [chatOpen, setChatOpen] = useState(false);
  const [isEditingMax, setIsEditingMax] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalMax = paperMaxMarks ?? questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
  const [tempMax, setTempMax] = useState(totalMax.toString());

  const handleExport = () => {
    // Class-level CSV export: one row per student, columns for each question
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header row
    const questionLabels = questions.map(q => q.labelRaw);
    csvContent += ["Student", ...questionLabels, "Total Score"].map(s => `"${s}"`).join(",") + "\n";

    // Data rows
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

    // 2. Export Corrections JSON
    // Collect all corrections
    const allCorrections: Record<string, any> = {};
    students.forEach(s => {
       if (s.corrections) {
          allCorrections[s.filename] = s.corrections;
       }
    });
    const correctionsJson = JSON.stringify(allCorrections, null, 2);
    const jsonBlob = new Blob([correctionsJson], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement("a");
    jsonLink.setAttribute("href", jsonUrl);
    jsonLink.setAttribute("download", `answerlens_class_corrections_${Date.now()}.json`);
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
  };
  const totalScore = gradings.reduce((sum, g) => {
    if (g.countedTowardTotal === false) return sum;
    return sum + (g.marks || 0);
  }, 0);

  const correct = gradings.filter(g => g.verdict === 'full').length;
  const partial = gradings.filter(g => g.verdict === 'partial').length;
  const incorrect = gradings.filter(g => g.verdict === 'zero' && !g.suppressed).length;
  const review = gradings.filter(g => g.suppressed).length;
  const unanswered = questions.length - gradings.length;

  useEffect(() => {
    setTempMax(totalMax.toString());
  }, [totalMax]);

  const handleSaveMax = () => {
    setIsEditingMax(false);
    const parsed = parseInt(tempMax, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setPaperMaxMarks(parsed);
    } else {
      setTempMax(totalMax.toString());
    }
  };

    const handlePrintReport = () => {
      if (!student) return;
      const htmlContent = `
        <html>
          <head>
            <title>${student.filename} - Grading Report</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #333; }
              h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
              .summary { font-size: 1.2em; margin-bottom: 30px; font-weight: bold; }
              .question { border-bottom: 1px solid #eee; padding: 15px 0; }
              .question-title { font-weight: bold; margin-bottom: 5px; }
              .marks { color: #555; }
              .feedback { margin-top: 10px; font-style: italic; color: #666; }
            </style>
          </head>
          <body>
            <h1>Grading Report: ${student.filename}</h1>
            <div class="summary">Total Score: ${totalScore} / ${totalMax}</div>
            ${questions.map(q => {
              const grade = student.gradings?.find(g => g.questionId === q.id);
              const marks = grade && grade.countedTowardTotal !== false ? grade.marks : 0;
              const feedback = grade ? grade.feedback : "Not answered";
              return `
                <div class="question">
                  <div class="question-title">${q.labelRaw} - ${q.text}</div>
                  <div class="marks">Marks: ${marks} / ${q.maxMarks}</div>
                  <div class="feedback">Feedback: ${feedback}</div>
                </div>
              `;
            }).join("")}
          </body>
        </html>
      `;
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 250);
      }
    };

    return (
    <>
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

      <div className="flex items-center gap-4">
        
        <button 
          onClick={() => useSessionStore.getState().setActiveStudent(null)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded text-text-body hover:bg-surface-app transition-colors"
        >
          &larr; Back to Class
        </button>
        <button 
          onClick={handlePrintReport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-white text-text-body border border-border-default shadow-sm hover:bg-surface transition-colors"
        >
          Print Report
        </button>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-white text-text-body border border-border-default shadow-sm hover:bg-surface transition-colors"
        >
          <Download size={16} />
          Export Data
        </button>
        <button 
          onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-[#e8eaff] text-[#3341d3] border border-[#d2d6fa] shadow-sm hover:bg-[#d6daff] transition-colors"
        >
          <Sparkles size={16} />
          Ask AI Assistant
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-meta">Total Marks:</span>
          <div className="flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent font-semibold rounded-md">
            <span>{totalScore} / </span>
            {isEditingMax ? (
              <input 
                ref={inputRef}
                type="number"
                value={tempMax}
                onChange={(e) => setTempMax(e.target.value)}
                onBlur={handleSaveMax}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveMax()}
                className="w-12 bg-white text-text-body px-1 py-0.5 rounded border border-border-default outline-none text-center"
                autoFocus
              />
            ) : (
              <span 
                className="cursor-pointer hover:underline decoration-dashed flex items-center gap-1"
                onClick={() => setIsEditingMax(true)}
                title="Edit maximum marks"
              >
                {totalMax}
                <Pencil size={12} className="opacity-50 hover:opacity-100" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
    
    <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}