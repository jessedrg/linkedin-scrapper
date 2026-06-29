import { getTopStartups, getAllCompanies } from "./companies";

const LOCATIONS_US = [
  "San Francisco", "New York", "Seattle", "Austin", "Denver",
  "Chicago", "Boston", "Los Angeles", "Washington DC", "Atlanta",
  "San Jose", "Palo Alto", "Mountain View", "Portland", "Miami",
  "San Diego", "Pittsburgh", "Philadelphia",
];
const LOCATIONS_EU = [
  "London", "Berlin", "Amsterdam", "Paris", "Dublin",
  "Barcelona", "Madrid", "Stockholm", "Munich", "Zurich",
];
const LOCATIONS_GLOBAL = [
  "Singapore", "Bangalore", "Tokyo", "Sydney", "Toronto",
  "Vancouver", "Tel Aviv", "Dubai", "Remote",
];
const ALL_LOCATIONS = [...LOCATIONS_US, ...LOCATIONS_EU, ...LOCATIONS_GLOBAL];

const SENIORITY = ["junior", "mid-level", "senior", "staff", "principal", "lead", "head of", "director", "VP"];

function extractCoreTitle(input: string): string {
  let t = input.toLowerCase().trim();
  t = t.split(/\b(?:at|in|for|like|from|with|who|that|and|or|such as|including)\b/)[0].trim();
  t = t.replace(/\b(?:top|best|leading|great|amazing|incredible)\b/g, "").trim();
  t = t.replace(/\b(?:startups?|companies|firms)\b/g, "").trim();
  t = t.replace(/^(senior|junior|lead|principal|staff|founding|distinguished|head of|director of|vp of)\s+/i, "").trim();
  return t.replace(/\s+/g, " ").trim();
}

function generateTitleVariants(core: string): string[] {
  const v = new Set<string>();
  v.add(core);
  const transforms: [RegExp, string][] = [
    [/\bengineer\b/, "developer"], [/\bdeveloper\b/, "engineer"],
    [/\bforward deploy\w*\b/, "forward deployed"], [/\bforward deployed?\b/, "field"],
    [/\bfield engineer\b/, "solutions engineer"], [/\bsolutions?\s*engineer\b/, "implementation engineer"],
    [/\bdevops\b/, "site reliability"], [/\bsite reliability\b/, "devops"],
    [/\bml\b/, "machine learning"], [/\bmachine learning\b/, "ML"],
    [/\bplatform\b/, "infrastructure"], [/\binfrastructure\b/, "platform"],
    [/\bfull[\s-]?stack\b/, "fullstack"], [/\bfullstack\b/, "full stack"],
    [/\bfront[\s-]?end\b/, "frontend"], [/\bback[\s-]?end\b/, "backend"],
  ];
  for (const [p, r] of transforms) if (p.test(core)) v.add(core.replace(p, r).trim());
  const words = core.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2 && words.length <= 4) {
    const acr = words.map(w => w[0].toUpperCase()).join("");
    if (acr.length >= 2 && acr.length <= 4) v.add(acr);
  }
  return [...v].filter(x => x.length > 1);
}

export interface SearchIntent {
  titles: string[];
  companies: string[];
  locations: string[];
  seniority: string[];
}

export function parseSearchIntent(input: string): SearchIntent {
  const lower = input.toLowerCase();
  const core = extractCoreTitle(input);
  const titles = generateTitleVariants(core);
  const all = getAllCompanies();
  const companies = all.filter(c => lower.includes(c.toLowerCase()));
  const locations = ALL_LOCATIONS.filter(l => lower.includes(l.toLowerCase()));
  const seniority = SENIORITY.filter(s => lower.includes(s));
  return { titles, companies, locations, seniority };
}

export function generateQueries(
  input: string,
  opts: { maxQueries?: number; locations?: string[] } = {},
): string[] {
  const intent = parseSearchIntent(input);
  const max = opts.maxQueries ?? 600;
  const seen = new Set<string>();
  const queries: string[] = [];
  const SITE = "site:linkedin.com/in/";

  function add(q: string) {
    const n = q.toLowerCase().trim();
    if (!seen.has(n)) { seen.add(n); queries.push(q); }
  }

  let locs = opts.locations?.length ? opts.locations : intent.locations.length ? intent.locations : ALL_LOCATIONS.slice(0, 20);
  locs = [...new Set([...locs, "Remote"])];
  const companies = intent.companies.length > 0 ? intent.companies : getTopStartups(300);
  const levels = intent.seniority.length > 0 ? intent.seniority : SENIORITY.slice(0, 6);

  // Title alone
  for (const t of intent.titles) add(`${SITE} "${t}"`);
  // Title x Location
  for (const t of intent.titles.slice(0, 5)) for (const l of locs) add(`${SITE} "${t}" "${l}"`);
  // Title x Company
  for (const t of intent.titles.slice(0, 4)) for (const co of companies) add(`${SITE} "${t}" "${co}"`);
  // Seniority x Title
  for (const t of intent.titles.slice(0, 3)) for (const lv of levels) add(`${SITE} "${lv} ${t}"`);
  // Seniority x Title x Location
  for (const t of intent.titles.slice(0, 3)) for (const lv of levels.slice(0, 4)) for (const l of locs.slice(0, 8)) add(`${SITE} "${lv} ${t}" "${l}"`);
  // Company x Location
  for (const co of companies.slice(0, 50)) for (const l of locs.slice(0, 5)) add(`${SITE} "${co}" "${l}" engineer`);
  // Broad
  for (const t of intent.titles.slice(0, 3)) add(`linkedin.com/in/ "${t}"`);

  // Shuffle
  for (let i = queries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queries[i], queries[j]] = [queries[j], queries[i]];
  }
  return queries.slice(0, max);
}
