import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Are AI models good enough to stand in for real developers? — UserSimBench v0",
  description:
    "We tested whether today's top AI models can role-play a real software developer to stress-test coding agents. They can't: every model is too polite. Real developers say \"something's wrong\" on 1 turn in 3; the toughest AI model manages 1 in 9.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
