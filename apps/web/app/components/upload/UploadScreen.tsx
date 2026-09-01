"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSessionStore } from "@/app/store/session";
import { useSettingsStore } from "@/app/store/settings";
import { AccentHeading } from "./AccentHeading";
import { TeacherIllustration } from "./TeacherIllustration";
import { DropZone } from "./DropZone";
import { PrimaryButton } from "./PrimaryButton";

export function UploadScreen() {
  const router = useRouter();
  const {
    questionFile, answerFile,
    setQuestionFile, setAnswerFile,
    setSidebarCollapsed,
  } = useSessionStore();
  const { settings, updateSettings } = useSettingsStore();

  const [llmDegraded, setLlmDegraded] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { llm: string }) => { if (d.llm !== "ok") setLlmDegraded(true); })
      .catch(() => setLlmDegraded(true));
  }, []);

  const bothReady = questionFile !== null && answerFile !== null;

  function handleStart() {
    if (!bothReady) return;
    setSidebarCollapsed(true);
    router.push("/processing");
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-app rounded-[--radius-pane]">
      <div className="min-h-full flex flex-col items-center justify-center py-12 px-4 sm:px-8">
        {llmDegraded && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="mb-8 px-4 py-3 rounded-xl bg-[#fff5e6] text-[#e3600f] text-sm font-medium border border-[#e3600f]/20 max-w-lg w-full text-center"
          >
            AI service is temporarily unavailable. You can still upload files.
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }} 
          className="w-full max-w-[800px] flex flex-col items-center gap-6"
        >
          <div className="w-full pt-4 flex flex-col items-center">
            <AccentHeading />
            <p className="text-[15px] text-text-meta text-center mt-2">
              Upload both files to get started
            </p>
          </div>

          <TeacherIllustration />

          <div className="w-full p-4 rounded-2xl bg-white shadow-sm border border-black/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DropZone
                kind="question"
                file={questionFile}
                onAdd={setQuestionFile}
                onRemove={() => setQuestionFile(null)}
              />
              <DropZone
                kind="answer"
                file={answerFile}
                onAdd={setAnswerFile}
                onRemove={() => setAnswerFile(null)}
              />
            </div>
            
            {bothReady && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 pt-6 border-t border-black/5 flex flex-col gap-4 overflow-hidden"
              >
                <h3 className="text-sm font-semibold text-text-body">Grading Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-text-muted">Focus Evaluation On:</label>
                    <div className="flex items-center gap-4 text-sm text-text-body bg-surface-app p-2 rounded border border-black/5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="focus" checked={settings.focus === 'answer'} onChange={() => updateSettings({ focus: 'answer' })} className="accent-accent" />
                        Final Answer
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="focus" checked={settings.focus === 'steps'} onChange={() => updateSettings({ focus: 'steps' })} className="accent-accent" />
                        Steps / Method
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-text-muted">Partial Marking:</label>
                    <label className="flex items-center gap-2 text-sm text-text-body cursor-pointer bg-surface-app p-2 rounded border border-black/5 h-[38px]">
                      <input type="checkbox" checked={settings.allowPartial} onChange={(e) => updateSettings({ allowPartial: e.target.checked })} className="accent-accent w-4 h-4 rounded" />
                      Award partial marks
                    </label>
                  </div>


                </div>
              </motion.div>
            )}
          </div>

          <PrimaryButton
            disabled={!bothReady}
            disabledReason="Upload both files first"
            onClick={handleStart}
          >
            Start Mapping <ArrowRight size={16} />
          </PrimaryButton>

          <p
            id="cta-helper"
            className="text-[13px] text-text-helper text-center"
          >
            Once both files are uploaded, you&apos;ll be able to map answers with questions
          </p>
        </motion.div>
      </div>
    </div>
  );
}