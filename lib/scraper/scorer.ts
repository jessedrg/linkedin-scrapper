/**
 * Profile scorer — assigns a 0-100 score to each LinkedIn profile result
 * based on company tier, title relevance, location match, and seniority.
 * Used by the talent search to surface the best candidates first.
 */

import { getCompanyTier, type CompanyTier } from "./companies";

export interface ScoredProfile {
  name: string;
  firstname: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location: string;
  score: number;
  companyTier: CompanyTier | null;
  matchReasons: string[];
  snippet: string;
}

interface ScoreOpts {
  role: string;
  location: string;
  preferredTiers?: CompanyTier[];
}

// ── Tier base scores ──────────────────────────────────────────────────────────
const TIER_SCORE: Record<string, number> = {
  S: 40,
  A: 28,
  B: 16,
  Mega: 22,
};

// ── Seniority keywords and their score bonuses ────────────────────────────────
const SENIORITY_BOOSTS: Array<{ pattern: RegExp; bonus: number; label: string }> = [
  { pattern: /\b(cto|vp|chief|head of|director|principal|distinguished|fellow)\b/i, bonus: 18, label: "Senior leader" },
  { pattern: /\b(staff|senior staff|sr\.? staff)\b/i, bonus: 14, label: "Staff-level" },
  { pattern: /\b(senior|sr\.?)\b/i, bonus: 8, label: "Senior" },
  { pattern: /\b(lead|tech lead|engineering lead)\b/i, bonus: 10, label: "Lead" },
  { pattern: /\b(manager|em|engineering manager)\b/i, bonus: 12, label: "Manager" },
];

// ── Location normaliser ───────────────────────────────────────────────────────
const LOCATION_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /san francisco|sf|bay area|south bay|silicon valley|san jose|palo alto|menlo park|mountain view/i, canonical: "San Francisco" },
  { pattern: /new york|nyc|brooklyn|manhattan/i, canonical: "New York" },
  { pattern: /los angeles|la|santa monica|venice beach/i, canonical: "Los Angeles" },
  { pattern: /seattle|bellevue|redmond/i, canonical: "Seattle" },
  { pattern: /austin|round rock/i, canonical: "Austin" },
  { pattern: /boston|cambridge ma/i, canonical: "Boston" },
  { pattern: /chicago|evanston/i, canonical: "Chicago" },
  { pattern: /london|greater london/i, canonical: "London" },
  { pattern: /berlin|munich|hamburg/i, canonical: "Germany" },
  { pattern: /paris|ile-de-france/i, canonical: "Paris" },
  { pattern: /toronto|ontario/i, canonical: "Toronto" },
  { pattern: /remote|distributed|worldwide|anywhere/i, canonical: "Remote" },
];

export function normaliseLocation(raw: string): string {
  for (const { pattern, canonical } of LOCATION_ALIASES) {
    if (pattern.test(raw)) return canonical;
  }
  return raw.trim();
}

/** Extract location text from a Brave result snippet / title */
export function extractLocation(title: string, snippet: string): string {
  const combined = `${title} ${snippet}`;
  // LinkedIn titles often look like "John Smith - Software Engineer at Stripe · San Francisco Bay Area"
  const locMatch = combined.match(/[·|–-]\s*([A-Za-z\s,]+(?:Area|Bay|City|York|Angeles|Francisco|Remote|London|Berlin|Paris|Toronto))/i);
  if (locMatch) return normaliseLocation(locMatch[1].trim());
  // Check snippet for city names
  for (const { pattern, canonical } of LOCATION_ALIASES) {
    if (pattern.test(combined)) return canonical;
  }
  return "";
}

/** Extract company from title/snippet heuristics */
export function extractCompany(title: string, snippet: string): string {
  const combined = `${title} ${snippet}`;
  const atMatch = combined.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,'"-]{1,40})(?:\s[·|–-]|$|\.|,)/);
  if (atMatch) return atMatch[1].trim();
  return "";
}

/** Build a normalised role search query from natural language */
export function normaliseRole(raw: string): { keywords: string[]; titles: string[] } {
  const lower = raw.toLowerCase();

  // Extract location clause so it doesn't pollute role matching
  const withoutLoc = lower
    .replace(/\bin\s+[\w\s]+/g, "")
    .replace(/\bat\s+[\w\s]+/g, "")
    .trim();

  const words = withoutLoc.split(/\s+/).filter((w) => w.length > 2);

  // Common role aliases
  const titleMap: Record<string, string[]> = {
    "forward deployed": ["forward deployed engineer", "fde", "forward deployed", "solutions engineer", "field engineer"],
    "software engineer": ["software engineer", "swe", "software developer", "backend engineer", "frontend engineer"],
    "product manager": ["product manager", "pm", "product lead", "group pm", "senior pm"],
    "data scientist": ["data scientist", "ml engineer", "machine learning", "ai engineer", "research scientist"],
    "designer": ["product designer", "ux designer", "ui designer", "design engineer", "visual designer"],
    "devops": ["devops", "sre", "platform engineer", "infrastructure engineer", "cloud engineer"],
    "engineering manager": ["engineering manager", "em", "manager engineering", "head of engineering", "vp engineering"],
    "recruiter": ["recruiter", "talent acquisition", "technical recruiter", "sourcer"],
    "sales": ["account executive", "ae", "sales", "business development", "enterprise sales"],
    "marketing": ["marketing", "growth", "demand generation", "content", "brand"],
  };

  for (const [key, aliases] of Object.entries(titleMap)) {
    if (lower.includes(key)) return { keywords: words, titles: aliases };
  }

  return { keywords: words, titles: [withoutLoc, ...words.slice(0, 3)] };
}

// ── Main scorer ───────────────────────────────────────────────────────────────

export function scoreProfile(
  profile: { title: string; company: string; linkedinUrl: string; snippet: string },
  opts: ScoreOpts,
): ScoredProfile {
  const { role, location, preferredTiers = ["S", "A", "Mega"] } = opts;
  const reasons: string[] = [];
  let score = 0;

  // 1. Company tier score
  const tier = getCompanyTier(profile.company);
  const tierScore = tier ? (TIER_SCORE[tier] ?? 0) : 0;
  if (tier) {
    score += tierScore;
    const tierLabel = tier === "S" ? "Tier S (elite startup)" : tier === "Mega" ? "Mega-cap" : `Tier ${tier}`;
    reasons.push(`${tierLabel}: +${tierScore}`);
    // Bonus if it's in the user's preferred tiers
    if (preferredTiers.includes(tier)) {
      score += 8;
      reasons.push("Preferred tier: +8");
    }
  }

  // 2. Title relevance
  const { titles } = normaliseRole(role);
  const titleLower = (profile.title ?? "").toLowerCase();
  let titleScore = 0;
  for (const t of titles) {
    if (titleLower.includes(t.toLowerCase())) {
      titleScore = 20;
      reasons.push(`Title match "${t}": +20`);
      break;
    }
  }
  // Partial word match
  if (titleScore === 0) {
    const roleWords = role.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matches = roleWords.filter((w) => titleLower.includes(w));
    if (matches.length > 0) {
      titleScore = Math.min(matches.length * 5, 15);
      reasons.push(`Partial title match (${matches.join(", ")}): +${titleScore}`);
    }
  }
  score += titleScore;

  // 3. Seniority bonus
  const combined = `${profile.title ?? ""} ${profile.snippet ?? ""}`.toLowerCase();
  for (const { pattern, bonus, label } of SENIORITY_BOOSTS) {
    if (pattern.test(combined)) {
      score += bonus;
      reasons.push(`${label}: +${bonus}`);
      break; // only apply highest seniority
    }
  }

  // 4. Location match
  const extractedLoc = extractLocation(profile.title ?? "", profile.snippet ?? "");
  const normTarget = normaliseLocation(location);
  const locationMatch =
    normTarget &&
    extractedLoc &&
    (normaliseLocation(extractedLoc) === normTarget ||
      extractedLoc.toLowerCase().includes(normTarget.toLowerCase()) ||
      normTarget.toLowerCase().includes(extractedLoc.toLowerCase()));

  if (locationMatch) {
    score += 12;
    reasons.push(`Location match (${extractedLoc}): +12`);
  } else if (extractedLoc.toLowerCase() === "remote") {
    score += 4;
    reasons.push("Remote: +4");
  }

  // 5. LinkedIn profile quality heuristics (profile completeness signals)
  if (profile.snippet && profile.snippet.length > 120) {
    score += 2;
  }
  // URL slug quality — longer slugs usually are real people (john-smith vs john-smith-12345)
  const slug = profile.linkedinUrl.replace("https://www.linkedin.com/in/", "").replace(/\/$/, "");
  if (slug.length > 8 && !/\d{5,}/.test(slug)) {
    score += 2;
    reasons.push("Clean profile URL: +2");
  }

  const fullName = profile.title?.split(" - ")[0]?.split(" | ")[0] ?? "";
  const firstname = fullName.trim().split(/\s+/)[0] ?? "";

  return {
    name: fullName,
    firstname,
    title: profile.title ?? "",
    company: profile.company,
    linkedinUrl: profile.linkedinUrl,
    location: extractedLoc,
    score: Math.min(score, 100),
    companyTier: tier,
    matchReasons: reasons,
    snippet: profile.snippet ?? "",
  };
}

/** Sort profiles by score descending, deduplicate by URL */
export function rankProfiles(profiles: ScoredProfile[]): ScoredProfile[] {
  const seen = new Set<string>();
  return profiles
    .filter((p) => {
      if (seen.has(p.linkedinUrl)) return false;
      seen.add(p.linkedinUrl);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}
