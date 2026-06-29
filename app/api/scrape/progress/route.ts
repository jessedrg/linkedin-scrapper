import { onProgress, getCurrentProgress } from "@/lib/scraper/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send current state immediately
      const current = getCurrentProgress();
      if (current) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(current)}\n\n`));
      }

      const unsub = onProgress((p) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
          if (p.status === "completed" || p.status === "error") {
            setTimeout(() => { try { controller.close(); } catch {} }, 500);
            unsub();
          }
        } catch {
          unsub();
        }
      });

      // Heartbeat
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { clearInterval(hb); }
      }, 15000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
