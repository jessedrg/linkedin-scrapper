/**
 * People Data Labs (PDL) — Person Search provider
 *
 * Uses the PDL Person Search API v5 with Elasticsearch SQL to find
 * professionals by title + location. Returns structured data directly —
 * no Google scraping, no LinkedIn parsing, no SERP pagination.
 *
 * API: POST https://api.peopledatalabs.com/v5/person/search
 * Docs: https://docs.peopledatalabs.com/docs/person-search-api
 *
 * Each call costs 1 credit per returned record (not per request).
 * Free tier: 1,000 credits/month. Paid: ~$0.05–0.10/record.
 */

const PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search";

export interface PDLProfile {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  job_company_name: string | null;
  job_company_size: string | null;
  location_name: string | null;
  location_metro: string | null;
  linkedin_url: string | null;
  work_email: string | null;
  industry: string | null;
  summary: string | null;
  inferred_salary: string | null;
  job_last_updated: string | null;
  experience: Array<{
    company: { name: string | null };
    title: { name: string | null };
    is_primary: boolean;
  }> | null;
}

interface PDLSearchResponse {
  status: number;
  data: PDLProfile[];
  total: number;
  scroll_token?: string;
  error?: { type: string; message: string };
}

export interface PDLSearchOpts {
  titleVariants: string[];   // all role variants to OR together
  location?: string;         // metro/city name
  companies?: string[];      // optional target company list to OR filter
  size?: number;             // records per page (max 100)
  scrollToken?: string;      // for pagination
  minScore?: number;         // PDL relevance min_score
}

/**
 * Build a PDL SQL query. NOTE: LIMIT is NOT supported in PDL SQL —
 * use the `size` request parameter instead.
 */
function buildPDLSQL(opts: PDLSearchOpts): string {
  const parts: string[] = [];

  // Title filter — OR across all variants
  if (opts.titleVariants.length > 0) {
    const titleConditions = opts.titleVariants
      .map((t) => `job_title LIKE '%${t.replace(/'/g, "''")}%'`)
      .join(" OR ");
    parts.push(`(${titleConditions})`);
  }

  // Location filter
  if (opts.location) {
    const loc = opts.location.toLowerCase();
    const locConditions: string[] = [];

    if (loc.includes("san francisco") || loc.includes("sf") || loc.includes("bay area")) {
      locConditions.push(
        "location_metro = 'san francisco, california'",
        "location_region = 'california'",
      );
    } else if (loc.includes("new york") || loc.includes("nyc")) {
      locConditions.push(
        "location_metro = 'new york, new york'",
        "location_region = 'new york'",
      );
    } else if (loc.includes("london")) {
      locConditions.push("location_country = 'united kingdom'");
    } else if (loc.includes("los angeles")) {
      locConditions.push("location_metro = 'los angeles, california'");
    } else if (loc.includes("seattle")) {
      locConditions.push("location_metro = 'seattle, washington'");
    } else if (loc.includes("austin")) {
      locConditions.push("location_metro = 'austin, texas'");
    } else if (loc.includes("boston")) {
      locConditions.push("location_metro = 'boston, massachusetts'");
    } else if (loc.includes("chicago")) {
      locConditions.push("location_metro = 'chicago, illinois'");
    } else if (loc.includes("berlin")) {
      locConditions.push("location_country = 'germany'");
    } else {
      // Generic fallback
      locConditions.push(`location_name LIKE '%${opts.location.replace(/'/g, "''")}%'`);
    }

    if (locConditions.length > 0) {
      parts.push(`(${locConditions.join(" OR ")})`);
    }
  }

  // Company filter (optional — skip if empty to cast wider net)
  if (opts.companies && opts.companies.length > 0) {
    const companyConditions = opts.companies
      .slice(0, 20) // keep query reasonable
      .map((c) => `job_company_name LIKE '%${c.replace(/'/g, "''")}%'`)
      .join(" OR ");
    parts.push(`(${companyConditions})`);
  }

  // Require LinkedIn URL
  parts.push("linkedin_url IS NOT NULL");

  // Require current job
  parts.push("job_title IS NOT NULL");

  const where = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";

  return `SELECT * FROM person ${where}`;
}

/**
 * Single PDL search page. Returns profiles + scroll token for next page.
 */
export async function searchPDL(
  apiKey: string,
  opts: PDLSearchOpts,
): Promise<{ profiles: PDLProfile[]; total: number; scrollToken?: string }> {
  const sql = buildPDLSQL(opts);

  // `from` is no longer supported by PDL — pagination uses scroll_token only.
  const body: Record<string, unknown> = {
    sql,
    size: Math.min(opts.size ?? 100, 100),
    pretty: false,
  };

  if (opts.scrollToken) {
    body.scroll_token = opts.scrollToken;
  }

  const res = await fetch(PDL_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    throw new Error("PDL: out of credits (402). Check your PDL plan.");
  }
  if (res.status === 401) {
    throw new Error("PDL: invalid API key (401). Check PDL_API_KEY.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDL ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as PDLSearchResponse;

  if (data.error) {
    throw new Error(`PDL API error: ${data.error.type} — ${data.error.message}`);
  }

  return {
    profiles: data.data ?? [],
    total: data.total ?? 0,
    scrollToken: data.scroll_token,
  };
}

/**
 * Deep paginated PDL search.
 * Iterates pages until there are no more results or maxRecords is reached.
 * PDL pagination uses `from` offset (max 10,000) or scroll_token.
 */
export async function searchPDLDeep(
  apiKey: string,
  opts: PDLSearchOpts,
  maxRecords = 1000,
): Promise<PDLProfile[]> {
  const pageSize = 100;
  const out: PDLProfile[] = [];
  const seen = new Set<string>();
  let scrollToken: string | undefined = undefined;

  while (out.length < maxRecords) {
    let page: { profiles: PDLProfile[]; total: number; scrollToken?: string };
    try {
      page = await searchPDL(apiKey, { ...opts, size: pageSize, scrollToken });
    } catch (err) {
      // Surface credit/auth errors immediately
      if (String(err).includes("402") || String(err).includes("401")) throw err;
      break;
    }

    if (page.profiles.length === 0) break;

    for (const p of page.profiles) {
      const url = p.linkedin_url;
      if (url && !seen.has(url)) {
        seen.add(url);
        out.push(p);
      }
    }

    // If PDL returns a scroll_token, use it for the next page; otherwise we're done.
    if (!page.scrollToken) break;
    scrollToken = page.scrollToken;

    // Stop if we've fetched everything available
    if (out.length >= page.total) break;

    await new Promise((r) => setTimeout(r, 150));
  }

  return out;
}

/** Convert a PDL profile to the SearchResult shape used by the rest of the pipeline */
export function pdlToSearchResult(p: PDLProfile): {
  title: string;
  link: string;
  snippet: string;
  name: string;
  location: string;
  company: string;
  email: string | null;
} {
  const company = p.job_company_name ?? "";
  const title = p.job_title ?? "";
  const location = p.location_metro ?? p.location_name ?? "";
  const name = p.full_name ?? "";

  // Build a rich snippet from experience history
  const prevRoles = (p.experience ?? [])
    .filter((e) => !e.is_primary && e.title?.name)
    .slice(0, 3)
    .map((e) => `${e.title?.name} at ${e.company?.name}`)
    .join("; ");

  const snippet = [
    title && company ? `${title} at ${company}` : title || company,
    location,
    prevRoles ? `Previously: ${prevRoles}` : "",
    p.summary?.slice(0, 120),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${name} - ${title}`,
    link: p.linkedin_url?.startsWith("http")
      ? p.linkedin_url
      : `https://www.linkedin.com/in/${p.linkedin_url ?? ""}`,
    snippet,
    name,
    location,
    company,
    email: p.work_email ?? null,
  };
}
