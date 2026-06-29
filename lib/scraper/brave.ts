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
