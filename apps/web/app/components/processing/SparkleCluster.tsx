"use client";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function SparkleCluster({ animate }: { animate: boolean }) {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-accent-soft text-accent overflow-hidden shadow-inner">
      <motion.div
        animate={animate ? { rotate: 360, scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
        transition={{ 
          rotate: { duration: 4, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <Sparkles size={40} strokeWidth={1.5} />
      </motion.div>
      
      {/* Little floating sparkles */}
      {animate && (
        <>
          <motion.div 
            className="absolute top-2 right-4 w-2 h-2 rounded-full bg-accent opacity-60"
            animate={{ y: [-5, 5, -5], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-accent opacity-40"
            animate={{ y: [3, -3, 3], opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
        </>
      )}
    </div>
  );
}