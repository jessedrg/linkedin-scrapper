import { searchBraveDeep, type SearchResult } from "./brave";
import { searchSerperDeep, type SerperTbs } from "./serper";

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
  opts: { maxPages?: number; delayMs?: number; tbs?: SerperTbs } = {},
): Promise<SearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    return searchSerperDeep(query, serperKey, {
      maxPages: opts.maxPages ?? 10,
      delayMs: opts.delayMs ?? 300,
      tbs: opts.tbs,
    });
  }

  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    return searchBraveDeep(query, braveKey, opts);
  }

  throw new Error("No search provider configured (set SERPER_API_KEY or BRAVE_API_KEY)");
}
