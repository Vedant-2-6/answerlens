"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSessionStore } from "@/app/store/session";
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