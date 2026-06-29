import { NextRequest, NextResponse } from "next/server";
import { generateAIQueries, generateQueries, parseSearchIntent } from "@/lib/scraper/query-engine";
import { getAllCompaniesFromDb } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const { role, companies: companiesOverride, maxQueriesPerCompany, useAI } = await req.json();
  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  // Use provided companies or load from DB
  let companies: string[] = companiesOverride ?? [];
  if (companies.length === 0) {
    const dbCompanies = await getAllCompaniesFromDb();
    companies = dbCompanies.map((c) => c.name);
  }
  if (companies.length === 0) {
    return NextResponse.json({ error: "No companies found. Add companies first." }, { status: 400 });
  }

  const intent = parseSearchIntent(role);
  const perCompany = maxQueriesPerCompany ?? 20;

  if (useAI) {
    try {
      const aiResults = await generateAIQueries({ role, companies, maxQueriesPerCompany: perCompany });
      const total = aiResults.reduce((s, r) => s + r.queries.length, 0);
      return NextResponse.json({
        intent,
        results: aiResults,
        total,
        aiEnhanced: true,
        companiesCount: companies.length,
      });
    } catch (err) {
      console.error("AI query generation failed, falling back:", err);
    }
  }

  // Fallback: engine-generated queries per company
  const results = companies.map((company) => ({
    company,
    queries: generateQueries(company, { role, maxQueries: perCompany }),
  }));
  const total = results.reduce((s, r) => s + r.queries.length, 0);

  return NextResponse.json({
    intent,
    results,
    total,
    aiEnhanced: false,
    companiesCount: companies.length,
  });
}
