import { searchBraveDeep, type SearchResult } from "./brave";
import { searchSerperDeep } from "./serper";

export type { SearchResult };

/** Returns which provider is configured. Serper is preferred (cheaper + better coverage). */
export function getSearchProvider(): "serper" | "brave" | null {
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_API_KEY) return "brave";
  return null;
}

/**
 * Provider-agnostic deep search. Uses Serper.dev (Google) when SERPER_API_KEY is set,
 * otherwise falls back to Brave. Same signature & return shape regardless of provider.
 * `maxPages` is interpreted per-provider (Serper: 100 results/page, Brave: 20/page).
 */
export async function searchDeep(
  query: string,
  opts: { maxPages?: number; delayMs?: number } = {},
): Promise<SearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    // Serper returns 100/page, so we need far fewer pages than Brave.
    const serperPages = Math.max(1, Math.ceil((opts.maxPages ?? 2) / 3));
    return searchSerperDeep(query, serperKey, { maxPages: serperPages, delayMs: opts.delayMs ?? 300 });
  }

  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    return searchBraveDeep(query, braveKey, opts);
  }

  throw new Error("No search provider configured (set SERPER_API_KEY or BRAVE_API_KEY)");
}
