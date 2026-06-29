import { NextResponse } from "next/server";
import { searchSerper } from "@/lib/scraper/serper";

export async function GET() {
  const key = process.env.SERPER_API_KEY;
  if (!key) return NextResponse.json({ error: "No SERPER_API_KEY" }, { status: 500 });

  const query = 'site:linkedin.com/in ("Forward Deployed Engineer" OR "Forward Deployment Engineer" OR FDE) ("San Francisco Bay Area" OR "San Francisco, California" OR SF)';

  try {
    const result = await searchSerper(key, query, 1, 10);
    return NextResponse.json({
      totalOnPage: result.totalOnPage,
      linkedinCount: result.results.length,
      sample: result.results.slice(0, 5).map(r => ({ title: r.title, link: r.link })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
