"use client";
import { motion } from "framer-motion";

export function AccentHeading() {
  return (
    <motion.h1 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="text-[40px] font-[800] leading-[48px] text-text-body text-center max-md:text-[28px] max-md:leading-9"
    >
      {/* Desktop: "Upload" dark + accent block orange */}
      <span className="max-md:hidden">
        Upload{" "}
        <motion.span 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="inline-block bg-accent-soft px-2 py-1 rounded-xl text-accent align-baseline"
        >
          <span className="first-letter-underline">Q</span>uestion Paper &amp;{" "}
          <span className="first-letter-underline">A</span>nswer Sheets
        </motion.span>
      </span>
      {/* Mobile: plain dark two-line */}
      <span className="md:hidden">
        Upload <span className="first-letter-underline">Q</span>uestion Paper
        <br />&amp; <span className="first-letter-underline">A</span>nswer Sheets
      </span>
    </motion.h1>
  );
}