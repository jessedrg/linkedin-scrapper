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
 * Single-page search: fetches ONE page of Brave results for the query.
 * We run many queries in sequence rather than paginating deeply per query —
 * this is far faster and Brave's pagination rarely yields new results past page 2.
 */
export async function searchBraveDeep(
  query: string,
  apiKey: string,
  opts: { maxResults?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const maxResults = opts.maxResults ?? 20;
  const delayMs = opts.delayMs ?? 600; // Brave free tier: 1 req/sec, 600ms is safe

  const out: SearchResult[] = [];
  const seen = new Set<string>();

  // Page 0 (offset=0): always fetch
  let batch: SearchResult[] = [];
  try {
    batch = await searchBrave(query, apiKey, 0, 20);
  } catch {
    return [];
  }
  for (const r of batch) {
    const u = r.link.split("?")[0];
    if (!seen.has(u)) { seen.add(u); out.push(r); }
  }

  // Page 1 (offset=1): only fetch if we got a full first page AND need more
  if (batch.length >= 18 && out.length < maxResults) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const batch2 = await searchBrave(query, apiKey, 1, 20);
      for (const r of batch2) {
        const u = r.link.split("?")[0];
        if (!seen.has(u)) { seen.add(u); out.push(r); }
      }
    } catch { /* ignore */ }
  }

  return out.slice(0, maxResults);
}
