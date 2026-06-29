

const LOCATIONS_US = [
  "San Francisco", "New York", "Seattle", "Austin", "Denver",
  "Chicago", "Boston", "Los Angeles", "Washington DC", "Atlanta",
  "San Jose", "Palo Alto", "Mountain View", "Portland", "Miami",
];
const LOCATIONS_EU = [
  "London", "Berlin", "Amsterdam", "Paris", "Dublin",
  "Barcelona", "Stockholm", "Munich", "Zurich",
];
const LOCATIONS_GLOBAL = [
  "Singapore", "Bangalore", "Tokyo", "Sydney", "Toronto", "Tel Aviv", "Remote",
];
const ALL_LOCATIONS = [...LOCATIONS_US, ...LOCATIONS_EU, ...LOCATIONS_GLOBAL];

const SENIORITY = [
  "junior", "mid-level", "senior", "staff", "principal",
  "lead", "head of", "director", "VP",
];

function extractCoreTitle(input: string): string {
  let t = input.toLowerCase().trim();
  t = t.split(/\b(?:at|in|for|like|from|with|who|that|and|or)\b/)[0].trim();
  t = t.replace(/\b(?:top|best|leading|great)\b/g, "").trim();
  t = t.replace(/\b(?:startups?|companies|firms)\b/g, "").trim();
  t = t.replace(/^(senior|junior|lead|principal|staff|founding|head of|director of|vp of)\s+/i, "").trim();
  return t.replace(/\s+/g, " ").trim();
}

function generateTitleVariants(core: string): string[] {
  const v = new Set<string>();
  v.add(core);
  const transforms: [RegExp, string][] = [
    [/\bengineer\b/, "developer"],
    [/\bdeveloper\b/, "engineer"],
    [/\bdevops\b/, "site reliability"],
    [/\bml\b/, "machine learning"],
    [/\bmachine learning\b/, "ML"],
    [/\bfull[\s-]?stack\b/, "fullstack"],
    [/\bfront[\s-]?end\b/, "frontend"],
    [/\bback[\s-]?end\b/, "backend"],
    [/\bplatform\b/, "infrastructure"],
  ];
  for (const [p, r] of transforms) if (p.test(core)) v.add(core.replace(p, r).trim());
  return [...v].filter((x) => x.length > 1);
}

export interface SearchIntent {
  titles: string[];
  locations: string[];
  seniority: string[];
}

export function parseSearchIntent(role: string): SearchIntent {
  const lower = role.toLowerCase();
  const core = extractCoreTitle(role);
  const titles = generateTitleVariants(core);
  const locations = ALL_LOCATIONS.filter((l) => lower.includes(l.toLowerCase()));
  const seniority = SENIORITY.filter((s) => lower.includes(s));
  return { titles, locations, seniority };
}

// Broad department / role keywords used to fan out queries when no specific
// role is given (or to supplement a given role). Each one surfaces a different
// slice of a company's employees, which multiplies unique profile URLs.
const DEPARTMENTS = [
  "software engineer", "engineer", "developer", "frontend engineer",
  "backend engineer", "full stack engineer", "mobile engineer",
  "machine learning engineer", "data scientist", "data engineer",
  "data analyst", "devops engineer", "site reliability engineer",
  "security engineer", "product manager", "product designer",
  "ux designer", "ui designer", "engineering manager", "tech lead",
  "marketing manager", "growth", "content", "brand", "demand generation",
  "sales", "account executive", "sales development", "customer success",
  "solutions engineer", "recruiter", "talent", "people operations",
  "finance", "accounting", "operations", "business analyst",
  "founder", "co-founder", "CEO", "CTO", "COO", "VP engineering",
  "head of product", "director of engineering", "chief of staff",
];

export function generateQueries(
  company: string,
  opts: { maxQueries?: number; role?: string; deep?: boolean } = {},
): string[] {
  const max = opts.maxQueries ?? (opts.deep ? 250 : 30);
  const seen = new Set<string>();
  const queries: string[] = [];
  const SITE = "site:linkedin.com/in/";

  function add(q: string) {
    const n = q.toLowerCase().trim();
    if (!seen.has(n)) { seen.add(n); queries.push(q); }
  }

  // In deep mode use the full location/seniority lists for maximum coverage.
  const locs = opts.deep ? ALL_LOCATIONS : ALL_LOCATIONS.slice(0, 12);
  const levels = opts.deep ? SENIORITY : SENIORITY.slice(0, 5);

  if (opts.role) {
    const intent = parseSearchIntent(opts.role);
    for (const t of intent.titles) {
      add(`${SITE} "${company}" "${t}"`);
      for (const l of locs.slice(0, opts.deep ? locs.length : 5)) {
        add(`${SITE} "${company}" "${t}" "${l}"`);
      }
      for (const lv of levels) add(`${SITE} "${company}" "${lv} ${t}"`);
    }
  }

  // Department fan-out: bare, by seniority, and by location.
  const deptList = opts.deep ? DEPARTMENTS : DEPARTMENTS.slice(0, 10);
  for (const dept of deptList) {
    add(`${SITE} "${company}" "${dept}"`);
    if (opts.deep) {
      for (const lv of levels.slice(0, 4)) add(`${SITE} "${company}" "${lv} ${dept}"`);
      for (const l of locs.slice(0, 6)) add(`${SITE} "${company}" "${dept}" "${l}"`);
    }
  }

  // Pure location sweep — catches employees we'd otherwise miss.
  for (const l of locs) add(`${SITE} "${company}" "${l}"`);

  // Shuffle so we don't exhaust the API on one department before others.
  for (let i = queries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queries[i], queries[j]] = [queries[j], queries[i]];
  }
  return queries.slice(0, max);
}

// ── AI-powered query generation via Vercel AI Gateway ──────────

export async function generateAIQueries(opts: {
  role: string;
  companies: string[];
  maxQueriesPerCompany?: number;
}): Promise<{ company: string; queries: string[] }[]> {
  const perCompany = opts.maxQueriesPerCompany ?? 20;
  const companySample = opts.companies.slice(0, 50).join(", ");

  // Call Vercel AI Gateway directly via fetch (OpenAI-compatible API)
  const gatewayRes = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at generating LinkedIn search queries to find professionals.
Generate highly targeted search queries using this format: site:linkedin.com/in/ "keyword1" "keyword2"
Vary across: job title synonyms, seniority levels, skills, locations.
Return ONLY valid search queries, one per line. No explanations.`,
        },
        {
          role: "user",
          content: `Generate ${perCompany} search queries per company to find: "${opts.role}"
Companies: ${companySample}
For each company, prefix the company name so we know which company the query is for.
Format each line as: COMPANY_NAME|query
Example: Stripe|site:linkedin.com/in/ "Stripe" "software engineer" "San Francisco"`,
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!gatewayRes.ok) {
    throw new Error(`AI Gateway error: ${gatewayRes.status}`);
  }

  const gatewayData = await gatewayRes.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = gatewayData.choices[0]?.message?.content ?? "";

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
  const byCompany = new Map<string, string[]>();

  for (const line of lines) {
    const pipeIdx = line.indexOf("|");
    const company = line.slice(0, pipeIdx).trim();
    const query = line.slice(pipeIdx + 1).trim();
    if (!company || !query || !query.includes("linkedin")) continue;
    const normalized = opts.companies.find(
      (c) => c.toLowerCase() === company.toLowerCase(),
    ) ?? company;
    const arr = byCompany.get(normalized) ?? [];
    arr.push(query);
    byCompany.set(normalized, arr);
  }

  return opts.companies.map((company) => ({
    company,
    queries: byCompany.get(company) ?? generateQueries(company, { role: opts.role, maxQueries: perCompany }),
  }));
}
