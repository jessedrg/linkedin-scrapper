const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";

interface BraveWebResult { title: string; url: string; description: string; extra_snippets?: string[]; }
interface BraveResponse { web?: { results: BraveWebResult[] } }

export interface SearchResult { title: string; link: string; snippet: string; }

export async function searchBrave(
  query: string, apiKey: string, offset = 0, count = 20,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query.slice(0, 400),
    count: String(Math.min(count, 20)),
    offset: String(Math.min(offset, 9)),
    safesearch: "off",
    text_decorations: "false",
  });

  const res = await fetch(`${BRAVE_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    if (res.status === 429) { await new Promise(r => setTimeout(r, 5000)); return []; }
    if (res.status === 422) return [];
    const body = await res.text();
    throw new Error(`Brave API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as BraveResponse;
  const results: SearchResult[] = [];

  for (const r of data.web?.results ?? []) {
    if (r.url.includes("linkedin.com/in/")) {
      results.push({
        title: r.title,
        link: r.url.split("?")[0],
        snippet: r.description + (r.extra_snippets ? " " + r.extra_snippets.join(" ") : ""),
      });
    }
  }
  return results;
}

/**
 * Deep search: paginates through Brave's offsets (0-9) to pull up to ~200
 * unique LinkedIn profile URLs per query instead of just the first 20.
 * This is the main multiplier for getting thousands of URLs.
 */
export async function searchBraveDeep(
  query: string,
  apiKey: string,
  opts: { maxResults?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const maxResults = opts.maxResults ?? 120;
  const delayMs = opts.delayMs ?? 1100; // Brave free tier ≈ 1 req/sec
  const seen = new Set<string>();
  const out: SearchResult[] = [];

  // Brave allows offset 0..9 with count up to 20 → up to 200 results per query
  for (let offset = 0; offset <= 9 && out.length < maxResults; offset++) {
    let batch: SearchResult[] = [];
    try {
      batch = await searchBrave(query, apiKey, offset, 20);
    } catch {
      break;
    }
    if (batch.length === 0) break; // no more pages

    for (const r of batch) {
      const u = r.link.split("?")[0];
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(r);
    }

    if (batch.length < 20) break; // last page reached
    if (offset < 9) await new Promise((r) => setTimeout(r, delayMs));
  }

  return out.slice(0, maxResults);
}
