import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Scraper AI",
  description: "AI-powered LinkedIn profile discovery at scale",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased grid-bg">
        <div className="gradient-orb top-[-200px] left-[-200px]" />
        <div className="gradient-orb bottom-[-200px] right-[-200px]" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.06), transparent 70%)" }} />
        <div className="relative z-10">
          {children}
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#16161f",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0f0f5",
            },
          }}
        />
      </body>
    </html>
  );
}
