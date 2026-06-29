import { searchBrave, type SearchResult } from "./brave";
import { generateQueries, parseSearchIntent } from "./query-engine";
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
  queriesPerCompany?: number;
  targetPerCompany?: number;
  delayMs?: number;
  onProgress?: (p: ScrapeProgress) => void;
}): Promise<ScrapeProgress> {
  const braveKey = process.env.BRAVE_API_KEY || "";
  if (!braveKey) throw new Error("BRAVE_API_KEY not set");

  const companiesList = opts.companies;
  const queriesPerCompany = opts.queriesPerCompany ?? 20;
  const targetPerCompany = opts.targetPerCompany ?? 50;
  const delayMs = opts.delayMs ?? 600;

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
      const queries = generateQueries(company, { maxQueries: queriesPerCompany });
      let foundForCompany = 0;

      for (const query of queries) {
        if (foundForCompany >= targetPerCompany) break;
        if (await isQueryUsed(query, searchId)) continue;

        let results: SearchResult[] = [];
        try {
          results = await searchBrave(query, braveKey, 0, 20);
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
