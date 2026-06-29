import type { SearchResult } from "./brave";

const SERPER_URL = "https://google.serper.dev/search";

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
}
interface SerperResponse {
  organic?: SerperOrganicResult[];
  searchInformation?: { totalResults?: string };
}

// tbs values for Serper date-range filter (matches Serper playground "Date range" param)
export type SerperTbs =
  | "qdr:h"   // past hour
  | "qdr:d"   // past 24 hours
  | "qdr:w"   // past week
  | "qdr:m"   // past month
  | "qdr:y"   // past year
  | "";       // any time (default — no filter)

/**
 * Single Serper.dev page. Returns { results, totalOnPage }.
 * totalOnPage = raw organic count (not filtered LinkedIn count) — used to detect last page.
 */
export async function searchSerper(
  query: string,
  apiKey: string,
  page = 1,
  num = 100,
  tbs: SerperTbs = "",
): Promise<{ results: SearchResult[]; totalOnPage: number }> {
  const body: Record<string, unknown> = {
    q: query.slice(0, 400),
    num: Math.min(num, 100),
    page,
    gl: "us",
    hl: "en",
  };
  if (tbs) body.tbs = tbs;

  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000)); return { results: [], totalOnPage: 0 }; }
    if (res.status === 400) return { results: [], totalOnPage: 0 };
    const text = await res.text();
    throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as SerperResponse;
  const organic = data.organic ?? [];
  const results: SearchResult[] = [];

  for (const r of organic) {
    if (r.link?.includes("linkedin.com/in/")) {
      results.push({ title: r.title ?? "", link: r.link.split("?")[0], snippet: r.snippet ?? "" });
    }
  }

  return { results, totalOnPage: organic.length };
}

/**
 * Exhaustive paginated Serper search.
 * Iterates pages until Google returns an empty page (like the playground does at page 55+).
 * Hard cap at maxPages to control cost. With tbs="qdr:h" (past hour) there are far fewer
 * total results so pagination naturally terminates quickly.
 */
export async function searchSerperDeep(
  query: string,
  apiKey: string,
  opts: { maxPages?: number; delayMs?: number; tbs?: SerperTbs } = {},
): Promise<SearchResult[]> {
  const maxPages = opts.maxPages ?? 10; // iterate until empty, but hard-cap at 10 pages
  const delayMs = opts.delayMs ?? 300;
  const tbs = opts.tbs ?? "";
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await new Promise((r) => setTimeout(r, delayMs));

    let batch: { results: SearchResult[]; totalOnPage: number };
    try {
      batch = await searchSerper(query, apiKey, page, 100, tbs);
    } catch {
      break;
    }

    // Google returned nothing — all pages exhausted (e.g. page 55 in playground)
    if (batch.totalOnPage === 0) break;

    for (const r of batch.results) {
      const u = r.link.split("?")[0];
      if (!seen.has(u)) { seen.add(u); out.push(r); }
    }

    // Partial page = last page of results
    if (batch.totalOnPage < 100) break;
  }

  return out;
}
