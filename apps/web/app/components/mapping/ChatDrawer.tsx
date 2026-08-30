"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, User, Sparkles } from "lucide-react";
import { useSessionStore } from "@/app/store/session";

interface Message {
  role: "assistant" | "user";
  content: string;
}

export function ChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I am the AnswerLens AI Assistant. I can help you analyze the student's answer sheet or understand the grading rubrics. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { visionPages, gradings, questions } = useSessionStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const query = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: query }]);
    setIsLoading(true);

    // Prepare context
    const ocrContext = visionPages.map(p => `--- PAGE ${p.pageIndex} ---\n${p.transcription}`).join("\n\n");
    const gradingContext = JSON.stringify({ questions, gradings }, null, 2);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, ocrContext, gradingContext })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="h-16 border-b border-black/5 flex items-center justify-between px-4 bg-surface-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-accent" />
                </div>
                <span className="font-semibold text-text-body">AI Assistant</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-text-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#FAFAFA]">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center ${m.role === 'user' ? 'bg-[#E3E3E3]' : 'bg-accent/10 text-accent'}`}>
                    {m.role === 'user' ? <User size={16} className="text-text-muted" /> : <Bot size={16} />}
                  </div>
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
                    m.role === 'user' ? 'bg-text-body text-white rounded-tr-sm' : 'bg-white border border-black/5 text-text-body shadow-sm rounded-tl-sm'
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm prose-p:my-1" dangerouslySetInnerHTML={{__html: m.content.replace(/\\n/g, '<br/>')}} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center bg-accent/10 text-accent">
                    <Bot size={16} />
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-black/5 text-text-muted shadow-sm rounded-tl-sm text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-black/5 bg-white">
              <div className="flex items-center gap-2 bg-surface-app border border-black/10 rounded-full px-4 py-2 focus-within:border-accent transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-text-muted"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-8 h-8 flex shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50 transition-opacity"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
