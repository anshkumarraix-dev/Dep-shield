import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DepShield Incident Room | Supply Chain Threat Intelligence",
  description: "Forensic evidence-driven investigation tool using verified incident data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100 antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
