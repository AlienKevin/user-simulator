import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Does a user profile help a coding-agent simulator? — CondAgree",
  description:
    "A single metric — CondAgree (did the simulator make the same move the real developer made?) — across 9 simulators (DeepSeek-V3.1/V4, GPT-5.5, Claude-Opus-4.8, GLM-5.2, Gemini-3.1-Pro, OSim-4B/8B), with and without a distilled user profile, on a user- and repo-disjoint SWE-chat test split. Trial data downloadable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
