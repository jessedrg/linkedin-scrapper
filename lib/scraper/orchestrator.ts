import { searchBrave, type SearchResult } from "./brave";
import { generateQueries, parseSearchIntent } from "./query-engine";
import {
  upsertProfile, profileExists, getProfileCount,
  createSearch, updateSearch, isQueryUsed, recordQuery,
} from "../db";

export interface ScrapeProgress {
  searchId: string;
  profilesFound: number;
  queriesUsed: number;
  queriesTotal: number;
  currentQuery: string;
  status: "running" | "completed" | "error" | "stopped";
}

// Global state for SSE streaming
let _currentProgress: ScrapeProgress | null = null;
let _listeners: ((p: ScrapeProgress) => void)[] = [];

export function onProgress(fn: (p: ScrapeProgress) => void) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

export function getCurrentProgress(): ScrapeProgress | null {
  return _currentProgress;
}

function emit(p: ScrapeProgress) {
  _currentProgress = p;
  for (const fn of _listeners) fn(p);
}

function parseResult(sr: SearchResult, query: string, searchId: string) {
  const titleParts = sr.title.replace(/\s*[|–-]\s*LinkedIn.*$/i, "").split(/\s*[|–-]\s*/);
  const name = titleParts[0]?.trim() || "Unknown";
  const headline = titleParts.slice(1).join(" | ").trim();
  const locMatch = sr.snippet.match(/(?:^|\.\s)([A-Z][a-záéíóúñ]+(?:[\s,]+[A-Z][a-záéíóúñ]+){0,3})/);
  return {
    linkedin_url: sr.link.split("?")[0],
    name,
    headline,
    location: locMatch?.[1]?.trim() || "",
    snippet: sr.snippet,
    score: scoreProfile(name, headline, sr.snippet),
    source: "brave",
    query,
    search_id: searchId,
  };
}

function scoreProfile(name: string, headline: string, snippet: string): number {
  let score = 40;
  const h = (headline + " " + snippet).toLowerCase();
  // Boost for seniority
  if (/\b(senior|sr\.?|staff|principal|lead|director|head)\b/i.test(h)) score += 10;
  // Boost for engineering
  if (/\b(engineer|developer|architect|sre|devops|swe)\b/i.test(h)) score += 8;
  // Boost for known companies
  if (/\b(google|meta|apple|amazon|microsoft|palantir|stripe|databricks|snowflake|openai|anthropic)\b/i.test(h)) score += 12;
  if (/\b(coinbase|robinhood|ramp|brex|figma|notion|vercel|airbnb|uber|netflix)\b/i.test(h)) score += 10;
  // Boost for forward deployed
  if (/\b(forward deploy|fde|field engineer|solutions engineer)\b/i.test(h)) score += 15;
  // Cap at 100
  return Math.min(score, 100);
}

export async function runScrape(opts: {
  prompt: string;
  queries?: string[];
  locations?: string[];
  maxQueries?: number;
  target?: number;
  delayMs?: number;
}): Promise<ScrapeProgress> {
  const braveKey = process.env.BRAVE_API_KEY || "";
  if (!braveKey) throw new Error("BRAVE_API_KEY not set");

  const searchId = crypto.randomUUID().slice(0, 8);
  const target = opts.target ?? 1000;
  const delayMs = opts.delayMs ?? 600;

  // Use provided queries (from AI) or generate
  const queries = opts.queries?.length
    ? opts.queries
    : generateQueries(opts.prompt, { maxQueries: opts.maxQueries ?? 600, locations: opts.locations });

  createSearch(searchId, opts.prompt, queries.length);

  const seenUrls = new Set<string>();
  let profilesFound = 0;
  let queriesUsed = 0;

  emit({ searchId, profilesFound: 0, queriesUsed: 0, queriesTotal: queries.length, currentQuery: "", status: "running" });

  try {
    for (const query of queries) {
      if (profilesFound >= target) break;
      if (isQueryUsed(query, searchId)) continue;

      let results: SearchResult[] = [];
      try {
        results = await searchBrave(query, braveKey, 0, 20);
      } catch (err) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      queriesUsed++;
      let newInBatch = 0;

      for (const sr of results) {
        const url = sr.link.split("?")[0];
        if (seenUrls.has(url) || profileExists(url)) continue;
        seenUrls.add(url);

        const profile = parseResult(sr, query, searchId);
        if (profile.score >= 20) {
          upsertProfile(profile);
          profilesFound++;
          newInBatch++;
        }
      }

      recordQuery(query, searchId, newInBatch);

      if (queriesUsed % 3 === 0 || newInBatch > 0) {
        updateSearch(searchId, { queries_done: queriesUsed, profiles_found: profilesFound });
        emit({ searchId, profilesFound, queriesUsed, queriesTotal: queries.length, currentQuery: query, status: "running" });
      }

      await new Promise(r => setTimeout(r, delayMs + Math.random() * delayMs * 0.5));
    }

    updateSearch(searchId, { status: "completed", queries_done: queriesUsed, profiles_found: profilesFound, finished_at: new Date().toISOString() });
    const final: ScrapeProgress = { searchId, profilesFound, queriesUsed, queriesTotal: queries.length, currentQuery: "", status: "completed" };
    emit(final);
    return final;
  } catch (err) {
    updateSearch(searchId, { status: "error", queries_done: queriesUsed, profiles_found: profilesFound });
    const errProgress: ScrapeProgress = { searchId, profilesFound, queriesUsed, queriesTotal: queries.length, currentQuery: "", status: "error" };
    emit(errProgress);
    throw err;
  }
}
