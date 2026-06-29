"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
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
  );
}
