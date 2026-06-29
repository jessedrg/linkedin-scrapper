import { searchDeep, getSearchProvider, type SearchResult } from "./search";
import { generateQueries, generateAIQueries } from "./query-engine";
import {
  upsertProfile, profileUrlExists,
  createSearch, updateSearch,
  isQueryUsed, recordQuery,
} from "../db/queries";

export interface ScrapeProgress {
  searchId: number;
  profilesFound: number;
  queriesUsed: number;
  queriesTotal: number;
  currentQuery: string;
  currentCompany: string;
  status: "running" | "completed" | "error";
}

function parseResult(sr: SearchResult, company: string, query: string, searchId: number) {
  const titleParts = sr.title.replace(/\s*[|–-]\s*LinkedIn.*$/i, "").split(/\s*[|–-]\s*/);
  const name = titleParts[0]?.trim() || "Unknown";
  const title = titleParts.slice(1).join(" | ").trim() || null;
  return {
    linkedinUrl: sr.link.split("?")[0],
    name,
    title,
    company,
    sourceQuery: query,
    searchId,
  };
}

export async function runScrape(opts: {
  companies: string[];
  role?: string;
  queriesPerCompany?: number;
  targetPerCompany?: number | null;
  maxResultsPerQuery?: number;
  delayMs?: number;
  deep?: boolean;
  useAI?: boolean;
  onProgress?: (p: ScrapeProgress) => void;
}): Promise<ScrapeProgress> {
  const provider = getSearchProvider();
  if (!provider) throw new Error("No search provider set (add SERPER_API_KEY or BRAVE_API_KEY)");

  const companiesList = opts.companies;
  const deep = opts.deep ?? true;
  const queriesPerCompany = opts.queriesPerCompany ?? (deep ? 150 : 30);
  // null / 0 = no cap → grab every unique profile we can find per company
  const targetPerCompany =
    opts.targetPerCompany === null || opts.targetPerCompany === 0
      ? Infinity
      : opts.targetPerCompany ?? Infinity;
  const maxResultsPerQuery = opts.maxResultsPerQuery ?? 120;
  const delayMs = opts.delayMs ?? 300;
  const useAI = opts.useAI ?? false;

  // Pre-generate AI queries for all companies in one shot when enabled.
  let aiQueriesByCompany = new Map<string, string[]>();
  if (useAI && opts.role) {
    try {
      const ai = await generateAIQueries({
        role: opts.role,
        companies: companiesList,
        maxQueriesPerCompany: Math.min(queriesPerCompany, 40),
      });
      aiQueriesByCompany = new Map(ai.map((a) => [a.company, a.queries]));
    } catch {
      // fall back silently to static queries
    }
  }

  // Generate all queries upfront
  const totalQueries = companiesList.length * queriesPerCompany;
  const search = await createSearch({
    companyCount: companiesList.length,
    queriesGenerated: totalQueries,
  });
  const searchId = search.id;

  let profilesFound = 0;
  let queriesUsed = 0;
  const emit = (partial: Partial<ScrapeProgress> = {}) => {
    opts.onProgress?.({
      searchId,
      profilesFound,
      queriesUsed,
      queriesTotal: totalQueries,
      currentQuery: "",
      currentCompany: "",
      status: "running",
      ...partial,
    });
  };

  emit();

  try {
    for (const company of companiesList) {
      // Blend AI-generated queries with the expanded static matrix, dedup.
      const staticQueries = generateQueries(company, {
        maxQueries: queriesPerCompany,
        role: opts.role,
        deep,
      });
      const aiQueries = aiQueriesByCompany.get(company) ?? [];
      const merged: string[] = [];
      const seenQ = new Set<string>();
      for (const q of [...aiQueries, ...staticQueries]) {
        const key = q.toLowerCase().trim();
        if (seenQ.has(key)) continue;
        seenQ.add(key);
        merged.push(q);
      }
      const queries = merged.slice(0, queriesPerCompany);
      let foundForCompany = 0;

      for (const query of queries) {
        if (foundForCompany >= targetPerCompany) break;
        if (await isQueryUsed(query, searchId)) continue;

        let results: SearchResult[] = [];
        try {
          results = await searchDeep(query, {
            maxPages: 2,
            delayMs: provider === "serper" ? 300 : 1100,
          });
        } catch {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        queriesUsed++;
        let newInBatch = 0;

        for (const sr of results) {
          const url = sr.link.split("?")[0];
          if (await profileUrlExists(url)) continue;
          const profile = parseResult(sr, company, query, searchId);
          await upsertProfile(profile);
          profilesFound++;
          foundForCompany++;
          newInBatch++;
        }

        await recordQuery({ searchId, company, query, resultsCount: newInBatch });
        await updateSearch(searchId, { profilesFound });
        emit({ currentQuery: query, currentCompany: company });

        await new Promise((r) => setTimeout(r, delayMs + Math.random() * delayMs * 0.5));
      }
    }

    await updateSearch(searchId, {
      status: "completed",
      profilesFound,
      finishedAt: new Date(),
    });
    const final: ScrapeProgress = {
      searchId, profilesFound, queriesUsed, queriesTotal: totalQueries,
      currentQuery: "", currentCompany: "", status: "completed",
    };
    opts.onProgress?.(final);
    return final;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateSearch(searchId, { status: "error", error: message, profilesFound });
    const errProgress: ScrapeProgress = {
      searchId, profilesFound, queriesUsed, queriesTotal: totalQueries,
      currentQuery: "", currentCompany: "", status: "error",
    };
    opts.onProgress?.(errProgress);
    throw err;
  }
}
