import type { Metadata } from "next";
import { ToasterProvider } from "@/components/toaster-provider";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Scraper AI",
  description: "AI-powered LinkedIn profile discovery at scale",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body className="min-h-screen antialiased grid-bg">
        <div className="gradient-orb top-[-200px] left-[-200px]" />
        <div className="gradient-orb bottom-[-200px] right-[-200px]" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.06), transparent 70%)" }} />
        <div className="relative z-10">
          {children}
        </div>
        <ToasterProvider />
      </body>
    </html>
  );
}
