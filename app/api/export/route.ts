import { NextRequest, NextResponse } from "next/server";
import { getProfiles } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") || "csv";
  const searchId = sp.get("searchId") ? Number(sp.get("searchId")) : undefined;
  const company = sp.get("company") ?? undefined;

  const { profiles } = await getProfiles({ searchId, company, limit: 100000 });

  if (format === "json") {
    return NextResponse.json(profiles, {
      headers: {
        "Content-Disposition": `attachment; filename="profiles_${Date.now()}.json"`,
      },
    });
  }

  // CSV
  const header = "Name,Title,Company,LinkedIn URL,Source Query,Found At";
  const rows = profiles.map((p) => {
    const esc = (s: string | null | undefined) => `"${(s || "").replace(/"/g, '""')}"`;
    return [
      esc(p.name),
      esc(p.title),
      esc(p.company),
      esc(p.linkedinUrl),
      esc(p.sourceQuery),
      p.createdAt?.toISOString() ?? "",
    ].join(",");
  });
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="profiles_${Date.now()}.csv"`,
    },
  });
}
