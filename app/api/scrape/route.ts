import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/orchestrator";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, queries, locations, maxQueries, target, delayMs } = body;

  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (!process.env.BRAVE_API_KEY) return NextResponse.json({ error: "BRAVE_API_KEY not configured" }, { status: 500 });

  // Run scrape in background — don't await
  runScrape({ prompt, queries, locations, maxQueries, target, delayMs }).catch(console.error);

  return NextResponse.json({ status: "started", message: "Scraping started. Check /api/scrape/progress for updates." });
}
