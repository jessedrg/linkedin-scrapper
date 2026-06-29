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

/**
 * Single Serper.dev (Google) search page.
 * `page` is 1-indexed (page 1 = first 100 results). num max is 100.
 * Returns only linkedin.com/in/ profile results, normalized to SearchResult.
 */
// Returns { results, totalOnPage } so the deep function can decide whether to paginate
// without using the filtered LinkedIn count as a proxy for "page exhausted".
export async function searchSerper(
  query: string,
  apiKey: string,
  page = 1,
  num = 100,
): Promise<{ results: SearchResult[]; totalOnPage: number }> {
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query.slice(0, 400),
      num: Math.min(num, 100),
      page,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000)); return { results: [], totalOnPage: 0 }; }
    if (res.status === 400) return { results: [], totalOnPage: 0 };
    const body = await res.text();
    throw new Error(`Serper API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as SerperResponse;
  const organic = data.organic ?? [];
  const results: SearchResult[] = [];

  for (const r of organic) {
    if (r.link && r.link.includes("linkedin.com/in/")) {
      results.push({
        title: r.title ?? "",
        link: r.link.split("?")[0],
        snippet: r.snippet ?? "",
      });
    }
  }

  // totalOnPage = actual results Google returned (not filtered LinkedIn count).
  // If < num, this was the last page of results.
  return { results, totalOnPage: organic.length };
}

/**
 * Deep paginated Serper search. Each page returns up to 100 results (vs Brave's 20),
 * so far fewer requests are needed to collect the same volume.
 */
export async function searchSerperDeep(
  query: string,
  apiKey: string,
  opts: { maxPages?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const maxPages = opts.maxPages ?? 2; // 2 pages × 100 = up to 200 results per query
  const delayMs = opts.delayMs ?? 300;
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await new Promise((r) => setTimeout(r, delayMs));

    let batch: { results: SearchResult[]; totalOnPage: number };
    try {
      batch = await searchSerper(query, apiKey, page, 100);
    } catch {
      break;
    }

    // No results at all from Google — query is exhausted
    if (batch.totalOnPage === 0) break;

    for (const r of batch.results) {
      const u = r.link.split("?")[0];
      if (!seen.has(u)) { seen.add(u); out.push(r); }
    }

    // If Google returned fewer than the requested num, this was the last page
    if (batch.totalOnPage < 100) break;
  }

  return out;
}
