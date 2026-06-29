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
import { searchBraveDeep } from "@/lib/scraper/brave";
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

  const locStr = location ? " \"" + location + "\"" : "";

  // ── TIER A: Role variant × Company ──────────────────────────────────────────
  // The core strategy: for every role variant (synonym) and every company,
  // generate one query. Brave finds different profiles for each variant.
  // e.g. "Palantir" "FDE", "Palantir" "Forward Deployed Engineer", "Palantir" "Field Engineer"
  // With 12 variants × 300 companies = 3,600 queries × ~20 results = 72,000 raw profiles.
  for (const variant of allVariants) {
    for (const company of companies) {
      add(SITE + " \"" + company + "\" \"" + variant + "\"", "company");
    }
  }

  // ── TIER B: Role variant only (no company) — global + location sweep ────────
  // Catches people at companies not in our list.
  for (const variant of allVariants) {
    add(SITE + " \"" + variant + "\"", "role");
    if (location) add(SITE + " \"" + variant + "\"" + locStr, "role");
  }

  // ── TIER C: Seniority prefix × variant × company (top companies only) ───────
  // Adds "Senior", "Staff", "Lead" prefix variations for top-tier companies.
  const seniorityPrefixes = ["Senior ", "Staff ", "Lead ", "Principal "];
  const topCompanies = companies.slice(0, 30);
  for (const prefix of seniorityPrefixes) {
    for (const variant of allVariants.slice(0, 4)) {
      add(SITE + " \"" + prefix + variant + "\"", "role");
      for (const company of topCompanies) {
        add(SITE + " \"" + company + "\" \"" + prefix + variant + "\"", "company");
      }
    }
  }

  return queries.slice(0, opts.totalQueries);
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

  const braveKey = process.env.BRAVE_API_KEY ?? "";
  if (!braveKey) {
    return new Response(JSON.stringify({ error: "BRAVE_API_KEY not set" }), { status: 500 });
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
            // Role+company queries: 2 pages (up to 40 results, all role-relevant)
            // Role-only queries: 2 pages (global sweep)
            // Both types now have the role in the query so results are pre-filtered by Brave.
            results = await searchBraveDeep(q, braveKey, {
              maxPages: 2,
              delayMs: 700,
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

        // ── Phase 6: PERSIST top 500 ──
        const toSave = ranked.slice(0, 500);
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
            }).onConflictDoNothing();
          } catch { /* ignore dupe */ }
        }

        await db
          .update(talentSearches)
          .set({ status: "completed", profilesFound: ranked.length, finishedAt: new Date() })
          .where(eq(talentSearches.id, tsId));

        send({ type: "done", searchId: tsId, total: ranked.length, profiles: ranked.slice(0, 200) });

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
