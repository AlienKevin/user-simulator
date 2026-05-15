import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "with-user — training trace viewer",
  description: "Inspect SWE-chat training traces as rendered to the base model for user-simulator SFT.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
