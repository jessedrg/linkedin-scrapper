import { NextRequest, NextResponse } from "next/server";
import { getProfiles } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { profiles, total } = getProfiles({
    searchId: sp.get("searchId") || undefined,
    minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
    offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
    sort: (sp.get("sort") as "score" | "name" | "created_at") || "score",
    order: (sp.get("order") as "asc" | "desc") || "desc",
  });
  return NextResponse.json({ profiles, total });
}
