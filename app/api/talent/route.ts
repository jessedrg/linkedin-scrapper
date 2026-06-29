/**
 * POST /api/talent
 *
 * Collect-then-filter strategy:
 * 1. Generate many role-specific queries (role phrase in EVERY query)
 * 2. Collect ALL results from Brave — no filtering during collection
 * 3. Filter by role title match AFTER collection (AI synonyms + static list)
 * 4. Score and AI re-rank the filtered set
 * 5. Stream SSE progress + final results to client
 */

import { type NextRequest } from "next/server";
import { searchDeep, getSearchProvider } from "@/lib/scraper/search";
import {
  scoreProfile,
  rankProfiles,
  extractCompanyFromResult,
  normaliseRole,
  titleMatchesRole,
} from "@/lib/scraper/scorer";
import { getCompaniesByTier, type CompanyTier } from "@/lib/scraper/companies";
import { db } from "@/lib/db";
import { talentSearches, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

// ── helpers ───────────────────────────────────────────────────────────────────

function buildPromptQueryGen(role: string, location: string, companySample: string): string {
  const loc = location ? "\nTarget location: " + location : "";
  return (
    "Role to find: \"" + role + "\"" + loc +
    "\nCompanies to use: " + companySample +
    "\n\nGenerate 50 precise LinkedIn search queries." +
    "\nEVERY query MUST contain the role title or close synonym as a quoted phrase." +
    "\nVary: exact title, seniority (senior/staff/lead/principal), synonyms, company combos." +
    "\nFormat: site:linkedin.com/in/ \"Title\" \"Company\"" +
    "\nReturn one query per line, no numbering."
  );
}

function buildPromptSynonyms(role: string): string {
  return (
    "Role: \"" + role + "\"\n\n" +
    "Return a flat JSON array of all LinkedIn title variations for this role." +
    " Include abbreviations, seniority prefixes, alternate phrasings, and closely related roles." +
    " Lowercase strings only. No markdown, no explanation."
  );
}

function buildPromptRerank(role: string, location: string, profileLines: string): string {
  const loc = location ? "\nLocation: \"" + location + "\"" : "";
  return (
    "Role: \"" + role + "\"" + loc +
    "\n\nProfiles to re-rank:\n" + profileLines +
    "\n\nReturn JSON only. Array: [{index, rerankedScore (0-100), reason (max 15 words)}]"
  );
}

// ── AI query generator ────────────────────────────────────────────────────────

async function generateTalentQueries(opts: {
  role: string;
  location: string;
  companies: string[];
  totalQueries: number;
  roleSynonyms?: string[]; // AI-generated synonyms passed in from pre-fetch
}): Promise<{ query: string; type: "company" | "role" }[]> {
  const { role, location, companies, roleSynonyms = [] } = opts;
  const SITE = "site:linkedin.com/in/";
  const { exactPhrases, titles } = normaliseRole(role);

  // Build the full set of role title variants to use in queries.
  // Deduplicate and cap at 12 variants — more than that creates redundant queries.
  const allVariants = Array.from(new Set([
    ...exactPhrases,
    ...titles,
    ...roleSynonyms,
  ])).slice(0, 12);

  const queries: { query: string; type: "company" | "role" }[] = [];
  const seen = new Set<string>();
  const add = (q: string, type: "company" | "role") => {
    const k = q.toLowerCase().trim();
    if (!seen.has(k) && k.length > 20) { seen.add(k); queries.push({ query: q, type }); }
  };

  const seniorityPrefixes = ["", "Senior ", "Staff ", "Lead ", "Principal "];

  // Build UNQUOTED location terms. Unlike a quoted "San Francisco" (which Brave
  // requires verbatim and almost no snippet contains), unquoted terms are treated
  // as soft relevance signals: Brave biases toward that geography but still returns
  // people who list "Bay Area", "SF", etc. We append several metro phrasings.
  const locationTerms: string[] = [];
  if (location) {
    const loc = location.toLowerCase();
    locationTerms.push(location);
    if (loc.includes("san francisco") || loc.includes("sf") || loc.includes("bay area")) {
      locationTerms.push("Bay Area", "Silicon Valley");
    } else if (loc.includes("new york") || loc.includes("nyc")) {
      locationTerms.push("New York", "NYC");
    } else if (loc.includes("london")) {
      locationTerms.push("London", "United Kingdom");
    } else if (loc.includes("los angeles") || loc.includes("la")) {
      locationTerms.push("Los Angeles", "LA");
    }
  }

  // IMPORTANT: queries are emitted in order of PRODUCTIVITY (most results first),
  // because the final list is capped with slice(0, totalQueries).

  // ── PRIMARY: Title + UNQUOTED location — geo-biased, still high yield ────────
  // Brave ranks local profiles first but does NOT require exact location text,
  // so we keep volume while strongly favoring the requested area.
  if (locationTerms.length > 0) {
    for (const variant of allVariants) {
      for (const prefix of seniorityPrefixes) {
        add(SITE + " \"" + prefix + variant + "\" " + locationTerms.join(" "), "role");
      }
    }
  }

  // ── SECONDARY: Title only (no location) — global reach, catches everyone ────
  for (const variant of allVariants) {
    for (const prefix of seniorityPrefixes) {
      add(SITE + " \"" + prefix + variant + "\"", "role");
    }
  }

  // ── TERTIARY: Title × company — Brave pre-filters by role + company ──────────
  for (const variant of allVariants) {
    for (const company of companies) {
      add(SITE + " \"" + company + "\" \"" + variant + "\"", "company");
    }
  }

  return queries.slice(0, opts.totalQueries);
}

// ── Cluster profiles ─────────────────────────────────────────────────────────
// Groups profiles into clusters based on (normalised role variant × location).
// A cluster key is derived from the title + location so people doing the same
// job in the same city end up together. Deduplication by linkedinUrl happens
// across ALL clusters so a person can only appear once, in the best cluster.
function clusterProfiles<T extends { title: string; location: string; linkedinUrl: string; score: number }>(
  profiles: T[],
  role: string,
): Array<{ key: string; label: string; profiles: T[] }> {
  const seen = new Set<string>();
  const clusters = new Map<string, { label: string; profiles: T[] }>();

  // Canonical role words for grouping variant titles
  const roleWords = role.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  const getKey = (p: T): string => {
    const titleLower = (p.title ?? "").toLowerCase();
    const locLower = (p.location ?? "").toLowerCase();

    // Normalise location to metro area
    let loc = "Global";
    if (locLower.includes("san francisco") || locLower.includes("bay area") || locLower.includes("silicon valley")) loc = "San Francisco Bay Area";
    else if (locLower.includes("new york") || locLower.includes("nyc")) loc = "New York";
    else if (locLower.includes("london")) loc = "London";
    else if (locLower.includes("los angeles") || locLower.includes(" la,")) loc = "Los Angeles";
    else if (locLower.includes("seattle")) loc = "Seattle";
    else if (locLower.includes("austin")) loc = "Austin";
    else if (locLower.includes("boston")) loc = "Boston";
    else if (locLower.includes("chicago")) loc = "Chicago";
    else if (locLower.includes("berlin")) loc = "Berlin";
    else if (locLower.includes("paris")) loc = "Paris";
    else if (locLower.includes("toronto")) loc = "Toronto";
    else if (locLower.includes("remote")) loc = "Remote";
    else if (locLower) loc = p.location; // keep as-is if known

    // Normalise title variant
    let roleLabel = role; // default to searched role
    if (titleLower.includes("senior") || titleLower.includes("sr.")) roleLabel = "Senior " + role;
    else if (titleLower.includes("staff")) roleLabel = "Staff " + role;
    else if (titleLower.includes("lead")) roleLabel = "Lead " + role;
    else if (titleLower.includes("principal")) roleLabel = "Principal " + role;
    else if (titleLower.includes("head of") || titleLower.includes("director")) roleLabel = "Head / Director";
    // Check if title shares key words with role
    const matchesRole = roleWords.some((w) => titleLower.includes(w));
    if (!matchesRole) roleLabel = "Related Roles";

    return `${roleLabel}||${loc}`;
  };

  for (const p of profiles) {
    const url = p.linkedinUrl;
    if (seen.has(url)) continue; // global dedup — each URL appears only once
    seen.add(url);

    const key = getKey(p);
    if (!clusters.has(key)) {
      const [roleLabel, loc] = key.split("||");
      clusters.set(key, {
        label: loc === "Global" ? roleLabel : `${roleLabel} — ${loc}`,
        profiles: [],
      });
    }
    clusters.get(key)!.profiles.push(p);
  }

  // Sort clusters by total score desc, then sort profiles within each cluster
  return Array.from(clusters.entries())
    .map(([key, c]) => ({
      key,
      label: c.label,
      profiles: c.profiles.sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => {
      const scoreA = a.profiles.reduce((s, p) => s + p.score, 0) / a.profiles.length;
      const scoreB = b.profiles.reduce((s, p) => s + p.score, 0) / b.profiles.length;
      return scoreB - scoreA;
    });
}

// ── AI company evaluator ────────────────────────────────────────────────────
// Uses a cheap model to judge whether each (unknown) company is a good startup.
// Returns a map of companyName(lowercase) → { tier, rating(0-10), note }.
async function aiEvaluateCompanies(
  companyNames: string[],
): Promise<Map<string, { rating: number; label: string; note: string }>> {
  const result = new Map<string, { rating: number; label: string; note: string }>();
  if (companyNames.length === 0) return result;

  // De-dupe and cap to keep the prompt cheap
  const unique = Array.from(new Set(companyNames.map((c) => c.trim()).filter(Boolean))).slice(0, 60);
  if (unique.length === 0) return result;

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (process.env.AI_GATEWAY_API_KEY ?? ""),
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // cheap model for company evaluation
        messages: [
          {
            role: "system",
            content:
              "You are a startup/tech-company analyst. For each company name, judge how impressive it is " +
              "as a place to work for a top engineer, based on your knowledge (funding, prestige, growth, talent bar). " +
              "rating: 0-10 (10 = elite like OpenAI/Stripe/Palantir, 7-9 = strong well-funded startup or big tech, " +
              "4-6 = decent/mid startup, 1-3 = unknown/weak, 0 = not a real company). " +
              "label: one of \"Elite\", \"Strong\", \"Decent\", \"Weak\", \"Unknown\". " +
              "note: max 6 words. " +
              "Return ONLY a JSON array: [{\"company\": \"Name\", \"rating\": N, \"label\": \"...\", \"note\": \"...\"}]",
          },
          { role: "user", content: "Companies:\n" + unique.map((c, i) => (i + 1) + ". " + c).join("\n") },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) return result;
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return result;
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ company: string; rating: number; label: string; note: string }>;
    for (const p of parsed) {
      if (p.company) {
        result.set(p.company.toLowerCase().trim(), {
          rating: Math.max(0, Math.min(10, Number(p.rating) || 0)),
          label: p.label || "Unknown",
          note: p.note || "",
        });
      }
    }
  } catch { /* fall back to heuristic scoring */ }

  return result;
}

// ── AI re-ranker ──────────────────────────────────────────────────────────────

async function aiRerank(opts: {
  role: string;
  location: string;
  profiles: Array<{ title: string; company: string; linkedinUrl: string; score: number }>;
}): Promise<Array<{ url: string; rerankedScore: number; reason: string }>> {
  const { role, location, profiles: candidates } = opts;
  if (candidates.length === 0) return [];

  const profileLines = candidates
    .slice(0, 30)
    .map((p, i) => (i + 1) + ". Title: \"" + p.title + "\" | Company: \"" + p.company + "\" | Score: " + p.score)
    .join("\n");

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (process.env.AI_GATEWAY_API_KEY ?? ""),
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an elite technical recruiter re-ranking LinkedIn profiles. " +
              "Rank purely on role fit, company prestige, and seniority. Be strict. " +
              "Return JSON array: [{\"index\": N, \"rerankedScore\": 0-100, \"reason\": \"short reason\"}]",
          },
          { role: "user", content: buildPromptRerank(role, location, profileLines) },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; rerankedScore: number; reason: string }>;
    return parsed.map((p) => ({
      url: candidates[p.index - 1]?.linkedinUrl ?? "",
      rerankedScore: p.rerankedScore,
      reason: p.reason,
    }));
  } catch {
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    role,
    location = "",
    tiers = ["S", "A", "Mega"],
    queriesTotal = 80,
    aiRerank: wantRerank = true,
  } = body as {
    role: string;
    location?: string;
    tiers?: CompanyTier[];
    queriesTotal?: number;
    aiRerank?: boolean;
  };

  if (!role?.trim()) {
    return new Response(JSON.stringify({ error: "role is required" }), { status: 400 });
  }

  const provider = getSearchProvider();
  if (!provider) {
    return new Response(JSON.stringify({ error: "No search provider set (add SERPER_API_KEY or BRAVE_API_KEY)" }), { status: 500 });
  }

  // Create talent_search record
  let tsId: number;
  try {
    const [tsRow] = await db
      .insert(talentSearches)
      .values({ role: role.trim(), location, tiers: tiers as string[], status: "running" })
      .returning();
    tsId = tsRow.id;
  } catch (err) {
    return new Response(JSON.stringify({ error: "DB insert failed: " + String(err) }), { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode("data: " + JSON.stringify(data) + "\n\n"));
      };

      try {
        const tieredCos = getCompaniesByTier(tiers as CompanyTier[]);
        const companyNames = tieredCos.map((c) => c.name);

        // ── Step 1: Fetch AI synonyms first ──────────────────────────────────────
        // Used both to generate diverse queries AND to filter results after collection.
        send({ type: "status", message: "Expanding role synonyms..." });
        let aiSynonyms: string[] = [];
        try {
          const synRes = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + (process.env.AI_GATEWAY_API_KEY ?? ""),
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a LinkedIn recruiter expert. " +
                    "Return every possible LinkedIn title variation for the given role — " +
                    "abbreviations, seniority prefixes (Senior/Sr/Staff/Lead/Principal/Head/Director), " +
                    "alternate phrasings, and closely related roles that are essentially the same job. " +
                    "Return ONLY a flat JSON array of lowercase strings. No markdown, no explanation. Be very comprehensive.",
                },
                { role: "user", content: buildPromptSynonyms(role) },
              ],
              temperature: 0.2,
              max_tokens: 600,
            }),
          });
          if (synRes.ok) {
            const synData = (await synRes.json()) as { choices: Array<{ message: { content: string } }> };
            const raw = synData.choices[0]?.message?.content?.trim() ?? "[]";
            const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) {
              aiSynonyms = parsed.map((s: unknown) => String(s).toLowerCase()).filter(Boolean);
            }
          }
        } catch { /* use static synonyms from normaliseRole */ }

        // ── Step 2: Generate queries using synonyms ───────────────────────────
        send({ type: "status", message: "Generating queries for " + companyNames.length + " companies..." });
        const queryList = await generateTalentQueries({
          role,
          location,
          companies: companyNames,
          totalQueries: queriesTotal,
          roleSynonyms: aiSynonyms,
        });

        // ── Phase 1: COLLECT — no filtering during collection ──
        // Company queries paginate up to 10 pages (200 results each) = thousands of profiles.
        // Role queries paginate 2 pages max — used to catch people at unlisted companies.
        // titleMatchesRole filters by role relevance before scoring (in both partials and final).
        const allRaw: Array<{ title: string; company: string; linkedinUrl: string; snippet: string }> = [];
        const seenUrls = new Set<string>();
        let lastPartialAt = 0;

        for (let qi = 0; qi < queryList.length; qi++) {
          const { query: q, type: qType } = queryList[qi];
          send({ type: "progress", queriesDone: qi, queriesTotal: queryList.length, profilesFound: allRaw.length });

          let results;
          try {
            // Provider-agnostic: Serper (Google, 100/page) when SERPER_API_KEY is set,
            // otherwise Brave (20/page). Each query has the role pre-filtered by the engine.
            results = await searchDeep(q, {
              maxPages: 2,
              delayMs: provider === "serper" ? 300 : 700,
            });
          } catch {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          const prevCount = allRaw.length;
          for (const r of results) {
            const url = r.link.split("?")[0];
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);
            const company = extractCompanyFromResult(r.title, r.snippet);
            allRaw.push({ title: r.title, company, linkedinUrl: url, snippet: r.snippet });
          }
          if (allRaw.length > prevCount) {
            send({ type: "progress", queriesDone: qi + 1, queriesTotal: queryList.length, profilesFound: allRaw.length });

            // Every 30 new profiles, filter + score what we have and stream a partial snapshot.
            if (allRaw.length - lastPartialAt >= 30) {
              lastPartialAt = allRaw.length;
              const partialFiltered = allRaw.filter((p) => titleMatchesRole(p.title, role, aiSynonyms));
              const partialScored = partialFiltered.map((p) =>
                scoreProfile(p, { role, location, preferredTiers: tiers as CompanyTier[] }),
              );
              const partialRanked = rankProfiles(partialScored).slice(0, 200);
              send({ type: "partial", profiles: partialRanked, total: partialRanked.length });
            }
          }

          if (allRaw.length >= 50000) break;
        }

        send({ type: "status", message: "Collected " + allRaw.length + " raw profiles. Filtering by role..." });

        // ── Phase 2: FILTER by role title (aiSynonyms already computed above) ──
        const filtered = allRaw.filter((p) => titleMatchesRole(p.title, role, aiSynonyms));

        send({ type: "status", message: filtered.length + " role-matched profiles. Scoring..." });

        // ── Phase 4: SCORE ──
        const scored = filtered.map((p) =>
          scoreProfile(p, { role, location, preferredTiers: tiers as CompanyTier[] }),
        );
        let ranked = rankProfiles(scored);

        // ── Phase 4b: AI company evaluation (cheap model) ──
        // For the top candidates, evaluate whether their CURRENT company is a good
        // startup/employer and adjust scores. This is the key signal now that we
        // filter by location+title rather than by a fixed company list.
        send({ type: "status", message: "AI evaluating companies of top candidates..." });
        const topForCompanyEval = ranked.slice(0, 120);
        const companyEval = await aiEvaluateCompanies(topForCompanyEval.map((p) => p.company));
        if (companyEval.size > 0) {
          ranked = ranked.map((p) => {
            const evalResult = companyEval.get((p.company || "").toLowerCase().trim());
            if (!evalResult) return p;
            // Map rating 0-10 to a score delta of -10..+20
            const delta = Math.round((evalResult.rating - 4) * 3);
            const newTier =
              evalResult.rating >= 9 ? "S" :
              evalResult.rating >= 7 ? "A" :
              evalResult.rating >= 4 ? "Unknown" : p.companyTier;
            return {
              ...p,
              score: Math.max(0, Math.min(100, p.score + delta)),
              companyTier: (p.companyTier && p.companyTier !== "Unknown") ? p.companyTier : (newTier as typeof p.companyTier),
              startupSignals: evalResult.note
                ? Array.from(new Set([...(p.startupSignals ?? []), evalResult.label + ": " + evalResult.note]))
                : p.startupSignals,
              matchReasons: [...p.matchReasons, "Company (AI): " + evalResult.label + " (" + evalResult.rating + "/10)"],
            };
          });
          ranked.sort((a, b) => b.score - a.score);
        }

        send({ type: "status", message: "AI re-ranking top " + Math.min(ranked.length, 30) + " profiles..." });

        // ── Phase 5: AI re-rank top 30 ──
        if (wantRerank && ranked.length > 0) {
          const reranked = await aiRerank({ role, location, profiles: ranked.slice(0, 30) });
          if (reranked.length > 0) {
            const rerankedMap = new Map(reranked.map((r) => [r.url, r]));
            ranked = ranked.map((p) => {
              const ai = rerankedMap.get(p.linkedinUrl);
              if (!ai) return p;
              return {
                ...p,
                score: Math.round((p.score * 0.4) + (ai.rerankedScore * 0.6)),
                matchReasons: [...p.matchReasons, "AI: " + ai.reason],
              };
            });
            ranked.sort((a, b) => b.score - a.score);
          }
        }

        // ── Phase 6: CLUSTER + PERSIST top 500 ──
        // Cluster by (role variant × location), deduplicate URLs globally.
        const clusters = clusterProfiles(ranked, role);
        // Flatten maintaining cluster label, still globally deduped by clusterProfiles.
        const toSave: Array<typeof ranked[0] & { cluster: string }> = [];
        const globalSeen = new Set<string>();
        for (const c of clusters) {
          for (const p of c.profiles) {
            if (!globalSeen.has(p.linkedinUrl)) {
              globalSeen.add(p.linkedinUrl);
              toSave.push({ ...p, cluster: c.label });
              if (toSave.length >= 500) break;
            }
          }
          if (toSave.length >= 500) break;
        }

        // Send clusters info as part of done event
        const clustersSummary = clusters.map((c) => ({ key: c.key, label: c.label, count: c.profiles.length }));

        for (const p of toSave) {
          try {
            const fullName = p.name || p.title.split(" - ")[0] || "Unknown";
            const firstname = fullName.trim().split(/\s+/)[0] ?? "";
            await db.insert(profiles).values({
              company: p.company || "Unknown",
              name: fullName,
              firstname,
              title: p.title,
              linkedinUrl: p.linkedinUrl,
              sourceQuery: role,
              score: p.score,
              companyTier: p.companyTier ?? "",
              location: p.location,
              matchReason: p.matchReasons.join(" | "),
              cluster: p.cluster,
            }).onConflictDoNothing();
          } catch { /* ignore dupe */ }
        }

        await db
          .update(talentSearches)
          .set({ status: "completed", profilesFound: ranked.length, finishedAt: new Date() })
          .where(eq(talentSearches.id, tsId));

        send({ type: "done", searchId: tsId, total: ranked.length, profiles: ranked.slice(0, 200), clusters: clustersSummary });

      } catch (err) {
        await db
          .update(talentSearches)
          .set({ status: "error" })
          .where(eq(talentSearches.id, tsId));
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
