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
 * Deep paginated search: fetches ALL pages (up to 10 x 20 = 200 results) for a query.
 * Used for company-only queries where we want every employee Brave has indexed.
 * Rate: ~700ms per page request.
 */
export async function searchBraveDeep(
  query: string,
  apiKey: string,
  opts: { maxPages?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const maxPages = opts.maxPages ?? 10; // Brave max is offset 0-9 = 10 pages x 20 = 200 results
  const delayMs = opts.delayMs ?? 700;
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, delayMs));

    let batch: SearchResult[] = [];
    try {
      batch = await searchBrave(query, apiKey, page, 20);
    } catch {
      break;
    }

    if (batch.length === 0) break; // no more results for this query

    for (const r of batch) {
      const u = r.link.split("?")[0];
      if (!seen.has(u)) { seen.add(u); out.push(r); }
    }

    // If we got fewer than 15 results, this was the last page
    if (batch.length < 15) break;
  }

  return out;
}
