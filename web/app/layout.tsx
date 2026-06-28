import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Does a user profile help a coding-agent simulator? — CondAgree",
  description:
    "A single metric — CondAgree (did the simulator make the same move the real developer made?) — for DeepSeek-V3.1 and OSim-4B, with and without a distilled user profile, on a user- and repo-disjoint SWE-chat test split.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
