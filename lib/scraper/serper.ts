import type { SearchResult } from "./brave";

const SERPER_URL = "https://google.serper.dev/search";

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
}
interface SerperResponse {
  organic?: SerperOrganicResult[];
}

/**
 * Single Serper.dev (Google) search page.
 * `page` is 1-indexed (page 1 = first 100 results). num max is 100.
 * Returns only linkedin.com/in/ profile results, normalized to SearchResult.
 */
export async function searchSerper(
  query: string,
  apiKey: string,
  page = 1,
  num = 100,
): Promise<SearchResult[]> {
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
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000)); return []; }
    if (res.status === 400) return [];
    const body = await res.text();
    throw new Error(`Serper API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as SerperResponse;
  const results: SearchResult[] = [];

  for (const r of data.organic ?? []) {
    if (r.link && r.link.includes("linkedin.com/in/")) {
      results.push({
        title: r.title ?? "",
        link: r.link.split("?")[0],
        snippet: r.snippet ?? "",
      });
    }
  }
  return results;
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
  const maxPages = opts.maxPages ?? 3; // 3 pages x 100 = up to 300 results per query
  const delayMs = opts.delayMs ?? 300;
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await new Promise((r) => setTimeout(r, delayMs));

    let batch: SearchResult[] = [];
    try {
      batch = await searchSerper(query, apiKey, page, 100);
    } catch {
      break;
    }

    if (batch.length === 0) break;

    for (const r of batch) {
      const u = r.link.split("?")[0];
      if (!seen.has(u)) { seen.add(u); out.push(r); }
    }

    // Fewer than 80 LinkedIn results on a full page means we've likely exhausted it
    if (batch.length < 80) break;
  }

  return out;
}
