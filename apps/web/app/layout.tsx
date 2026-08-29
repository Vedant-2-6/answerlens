import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AnswerLens — AI Question Mapping",
  description: "Upload a question paper and answer sheet to map and grade answers automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}