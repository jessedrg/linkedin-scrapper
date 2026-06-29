import { NextResponse } from "next/server";
import { searchSerper } from "@/lib/scraper/serper";
import { searchBraveDeep } from "@/lib/scraper/brave";

/**
 * Quick smoke-test endpoint: GET /api/search-test
 * Runs one search query and returns how many LinkedIn results came back.
 * Used to verify the search provider key is valid and working.
 */
export async function GET() {
  const serperKey = process.env.SERPER_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;

  if (!serperKey && !braveKey) {
    return NextResponse.json({ error: "No search provider configured" }, { status: 500 });
  }

  const testQuery = 'site:linkedin.com/in/ "software engineer" "San Francisco"';

  if (serperKey) {
    try {
      const { results, totalOnPage } = await searchSerper(testQuery, serperKey, 1, 10);
      return NextResponse.json({
        provider: "serper",
        query: testQuery,
        totalGoogleResults: totalOnPage,
        linkedinResultsFound: results.length,
        sample: results.slice(0, 3).map((r) => ({ title: r.title, url: r.link })),
      });
    } catch (e) {
      return NextResponse.json({ provider: "serper", error: String(e) }, { status: 500 });
    }
  }

  try {
    const results = await searchBraveDeep(testQuery, braveKey!, { maxPages: 1 });
    return NextResponse.json({
      provider: "brave",
      query: testQuery,
      linkedinResultsFound: results.length,
      sample: results.slice(0, 3).map((r) => ({ title: r.title, url: r.link })),
    });
  } catch (e) {
    return NextResponse.json({ provider: "brave", error: String(e) }, { status: 500 });
  }
}
