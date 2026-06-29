import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/orchestrator";
import { getAllCompaniesFromDb, updateSearch } from "@/lib/db/queries";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    role,
    companies: companiesOverride,
    queriesPerCompany,
    targetPerCompany,
    maxResultsPerQuery,
    delayMs,
    deep,
    useAI,
  } = body;

  if (!process.env.BRAVE_API_KEY)
    return NextResponse.json({ error: "BRAVE_API_KEY not configured" }, { status: 500 });

  let companies: string[] = companiesOverride ?? [];
  if (companies.length === 0) {
    const dbCompanies = await getAllCompaniesFromDb();
    companies = dbCompanies.map((c) => c.name);
  }
  if (companies.length === 0)
    return NextResponse.json({ error: "No companies to scrape. Add companies first." }, { status: 400 });

  // Start scrape and stream progress via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      try {
        const result = await runScrape({
          companies,
          role,
          queriesPerCompany: queriesPerCompany ?? (deep === false ? 30 : 150),
          // null = no cap (grab everything we can find per company)
          targetPerCompany: targetPerCompany === undefined ? null : targetPerCompany,
          maxResultsPerQuery: maxResultsPerQuery ?? 120,
          delayMs: delayMs ?? 300,
          deep: deep ?? true,
          useAI: useAI ?? Boolean(role),
          onProgress: send,
        });
        send(result);
      } catch (err) {
        send({ status: "error", error: String(err) });
      } finally {
        try { controller.close(); } catch {}
      }
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

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { getSearch } = await import("@/lib/db/queries");
  const search = await getSearch(Number(id));
  if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });
  return NextResponse.json(search);
}
