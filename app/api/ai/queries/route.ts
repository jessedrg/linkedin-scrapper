import { NextRequest, NextResponse } from "next/server";
import { generateQueries, parseSearchIntent } from "@/lib/scraper/query-engine";

export async function POST(req: NextRequest) {
  const { prompt, locations, maxQueries, useAI } = await req.json();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const intent = parseSearchIntent(prompt);

  // If OpenAI key is set AND useAI is true, use AI to enhance queries
  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at generating search queries to find LinkedIn profiles.
Given a job role description, generate 30-50 diverse search queries using the format:
site:linkedin.com/in/ "keyword1" "keyword2"

Vary across: job title synonyms, seniority levels, company names, locations, skills.
Return ONLY the queries, one per line. No numbering, no explanations.`,
          },
          {
            role: "user",
            content: `Generate search queries to find LinkedIn profiles for: "${prompt}"
${locations?.length ? `Focus on locations: ${locations.join(", ")}` : ""}
Include top startups and tech companies.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      });

      const aiQueries = (completion.choices[0]?.message?.content || "")
        .split("\n")
        .map((q: string) => q.trim())
        .filter((q: string) => q.length > 10 && q.includes("linkedin"));

      // Combine AI queries with engine-generated ones
      const engineQueries = generateQueries(prompt, { maxQueries: maxQueries || 600, locations });
      const allQueries = [...new Set([...aiQueries, ...engineQueries])];

      return NextResponse.json({
        intent,
        queries: allQueries.slice(0, maxQueries || 600),
        aiGenerated: aiQueries.length,
        engineGenerated: engineQueries.length,
        total: Math.min(allQueries.length, maxQueries || 600),
      });
    } catch (err) {
      console.error("AI query generation failed, falling back to engine:", err);
    }
  }

  // Fallback: engine-only queries
  const queries = generateQueries(prompt, { maxQueries: maxQueries || 600, locations });

  return NextResponse.json({
    intent,
    queries,
    aiGenerated: 0,
    engineGenerated: queries.length,
    total: queries.length,
  });
}
