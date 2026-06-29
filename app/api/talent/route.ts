/**
 * POST /api/talent
 *
 * Top-talent search: given a role + location + tier preferences, generates
 * hyper-targeted LinkedIn search queries using the Vercel AI Gateway, runs
 * them against Brave Search with deep pagination, scores every result with the
 * profile scorer, optionally re-ranks the top candidates with AI, and streams
 * SSE progress back to the client.
 */

import { type NextRequest } from "next/server";
import { searchBraveDeep } from "@/lib/scraper/brave";
import { scoreProfile, rankProfiles, extractCompanyFromResult, normaliseRole } from "@/lib/scraper/scorer";
import { getCompaniesByTier, type CompanyTier } from "@/lib/scraper/companies";
import { db } from "@/lib/db";
import { talentSearches, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

// ── AI query generator ────────────────────────────────────────────────────────

async function generateTalentQueries(opts: {
  role: string;
  location: string;
  companies: string[];
  totalQueries: number;
}): Promise<string[]> {
  const { role, location, companies } = opts;
  const SITE = "site:linkedin.com/in/";
  const { exactPhrases, titles } = normaliseRole(role);

  const queries: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const k = q.toLowerCase().trim();
    if (!seen.has(k) && k.length > 20) { seen.add(k); queries.push(q); }
  };

  const loc = location ? `"${location}"` : "";
  const seniorityPrefixes = ["", "senior ", "staff ", "principal ", "lead ", "founding "];

  // ── TIER 1: Role-first queries (highest precision, fills most of the budget) ──
  // Every query MUST contain an exact role phrase — this guarantees relevance.
  for (const phrase of exactPhrases) {
    for (const prefix of seniorityPrefixes) {
      const titleQ = `"${prefix}${phrase}"`;
      // Without company (broadest reach)
      add(`${SITE} ${titleQ}${loc ? " " + loc : ""}`);
      // With each top company
      for (const company of companies.slice(0, 40)) {
        add(`${SITE} "${company}" ${titleQ}${loc ? " " + loc : ""}`);
      }
    }
  }

  // ── TIER 2: Title alias queries (good precision) ──
  for (const title of titles.slice(0, 4)) {
    const titleQ = `"${title}"`;
    add(`${SITE} ${titleQ}${loc ? " " + loc : ""}`);
    for (const company of companies.slice(0, 20)) {
      add(`${SITE} "${company}" ${titleQ}${loc ? " " + loc : ""}`);
    }
  }

  // ── TIER 3: AI-generated queries (diversity boost) ──
  try {
    const companySample = companies.slice(0, 25).join(", ");
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
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
            content: `You are an expert LinkedIn talent sourcer.
CRITICAL RULE: Every single query you generate MUST contain the exact role title or a very close synonym as a quoted phrase.
Never generate queries that search for a company+location without the role — those return irrelevant profiles.
Format: site:linkedin.com/in/ "RoleTitle" "Company" (optional "Location")
Return ONLY raw queries, one per line. No numbering, no explanations.`,
          },
          {
            role: "user",
            content: `Role to find: "${role}"${location ? `\nTarget location: ${location}` : ""}
Companies to use (pick the most relevant ones): ${companySample}

Generate 50 precise LinkedIn search queries. Rules:
1. EVERY query must have the role title or synonym as a quoted phrase
2. Vary: exact title, seniority level (senior/staff/lead/principal), close synonyms
3. Mix: some with company, some with just title+location
4. Include niche title variants that this type of person actually uses on LinkedIn

Examples of good queries:
site:linkedin.com/in/ "Forward Deployed Engineer" "Palantir"
site:linkedin.com/in/ "Forward Deployed Engineer" "San Francisco"
site:linkedin.com/in/ "FDE" "Palantir" "New York"
site:linkedin.com/in/ "Field Engineer" "Stripe" "San Francisco"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      const text = data.choices[0]?.message?.content ?? "";
      for (const line of text.split("\n")) {
        const q = line.trim().replace(/^\d+\.\s*/, "");
        if (q.startsWith("site:linkedin.com/in/")) add(q);
      }
    }
  } catch {
    // AI queries are a bonus — continue with static ones
  }

  return queries.slice(0, opts.totalQueries);
}

// ── AI re-ranker ──────────────────────────────────────────────────────────────

async function aiRerank(opts: {
  role: string;
  location: string;
  profiles: Array<{ title: string; company: string; linkedinUrl: string; snippet: string; score: number }>;
}): Promise<Array<{ url: string; rerankedScore: number; reason: string }>> {
  const { role, location, profiles: candidates } = opts;
  if (candidates.length === 0) return [];

  const profileLines = candidates
    .slice(0, 30)
    .map((p, i) => `${i + 1}. Title: "${p.title}" | Company: "${p.company}" | Score: ${p.score} | URL: ${p.linkedinUrl}`)
    .join("\n");

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
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
            content: `You are an elite technical recruiter re-ranking LinkedIn profiles.
You ONLY look for the absolute best candidates — tier-S startups, strong seniority, perfect role+location match.
Return JSON array: [{"index": N, "rerankedScore": 0-100, "reason": "short reason"}]
Rank purely on likely quality and fit for the role. Be opinionated and strict.`,
          },
          {
            role: "user",
            content: `Role: "${role}"${location ? `\nLocation: "${location}"` : ""}

Profiles to re-rank:
${profileLines}

Return JSON only. Array of objects with index (1-based), rerankedScore (0-100), reason (max 15 words).`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
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
    maxResultsPerQuery = 60,
    aiRerank: wantRerank = true,
  } = body as {
    role: string;
    location?: string;
    tiers?: CompanyTier[];
    queriesTotal?: number;
    maxResultsPerQuery?: number;
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Gather companies for the requested tiers
        const tieredCos = getCompaniesByTier(tiers as CompanyTier[]);
        const companyNames = tieredCos.map((c) => c.name);

        send({ type: "status", message: `Generating AI queries for ${companyNames.length} companies across tiers ${tiers.join("/")}...` });

        const queries = await generateTalentQueries({
          role,
          location,
          companies: companyNames,
          totalQueries: queriesTotal,
        });

        send({ type: "status", message: `Running ${queries.length} targeted searches...`, queriesTotal: queries.length });

        const allRaw: Array<{ title: string; company: string; linkedinUrl: string; snippet: string }> = [];
        const seenUrls = new Set<string>();

        for (let qi = 0; qi < queries.length; qi++) {
          const query = queries[qi];
          send({ type: "progress", queriesDone: qi, queriesTotal: queries.length, profilesFound: allRaw.length });

          let results;
          try {
            results = await searchBraveDeep(query, braveKey, { maxResults: maxResultsPerQuery, delayMs: 1100 });
          } catch {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          for (const r of results) {
            const url = r.link.split("?")[0];
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            const company = extractCompanyFromResult(r.title, r.snippet);
            allRaw.push({ title: r.title, company, linkedinUrl: url, snippet: r.snippet });
          }

          if (allRaw.length >= 2000) break;
        }

        send({ type: "status", message: `Scoring ${allRaw.length} profiles...` });

        // Score all profiles
        const scored = allRaw.map((p) =>
          scoreProfile(p, { role, location, preferredTiers: tiers as CompanyTier[] }),
        );
        let ranked = rankProfiles(scored);

        send({ type: "status", message: `AI re-ranking top ${Math.min(ranked.length, 30)} profiles...` });

        // AI re-rank top 30
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
                matchReasons: [...p.matchReasons, `AI: ${ai.reason}`],
              };
            });
            ranked.sort((a, b) => b.score - a.score);
          }
        }

        // Persist top 500 to profiles table
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
          } catch { /* ignore dupe constraint */ }
        }

        // Update talent search status
        await db
          .update(talentSearches)
          .set({ status: "completed", profilesFound: ranked.length, finishedAt: new Date() })
          .where(eq(talentSearches.id, tsId));

        send({
          type: "done",
          searchId: tsId,
          total: ranked.length,
          profiles: ranked.slice(0, 200),
        });
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
