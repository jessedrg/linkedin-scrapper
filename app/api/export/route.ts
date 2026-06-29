import { NextRequest, NextResponse } from "next/server";
import { getProfiles } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") || "csv";
  const searchId = sp.get("searchId") || undefined;
  const minScore = sp.get("minScore") ? Number(sp.get("minScore")) : 0;

  const { profiles } = getProfiles({ searchId, minScore, limit: 100000, sort: "score", order: "desc" });

  if (format === "json") {
    return NextResponse.json(profiles, {
      headers: {
        "Content-Disposition": `attachment; filename="profiles_${Date.now()}.json"`,
      },
    });
  }

  // CSV
  const header = "Name,Headline,Location,Score,LinkedIn URL,Source,Created At";
  const rows = profiles.map(p => {
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    return [esc(p.name), esc(p.headline), esc(p.location), p.score, esc(p.linkedin_url), p.source, p.created_at].join(",");
  });
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="profiles_${Date.now()}.csv"`,
    },
  });
}
