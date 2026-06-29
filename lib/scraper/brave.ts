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
 * Fast single-page search: fetches one page of Brave results per query.
 * We get volume by running many diverse queries, not by deep-paginating one query.
 * Each call costs ~700ms (Brave rate limit), so 250 queries ≈ 3 minutes total.
 */
export async function searchBraveDeep(
  query: string,
  apiKey: string,
  opts: { maxResults?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const delayMs = opts.delayMs ?? 700;
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  // Always fetch page 0
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

  // Fetch page 1 only if first page was full (likely more results)
  if (batch.length >= 18) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const batch2 = await searchBrave(query, apiKey, 1, 20);
      for (const r of batch2) {
        const u = r.link.split("?")[0];
        if (!seen.has(u)) { seen.add(u); out.push(r); }
      }
    } catch { /* ignore */ }
  }

  return out;
}
