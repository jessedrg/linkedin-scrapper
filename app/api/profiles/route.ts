import { NextRequest, NextResponse } from "next/server";
import { getProfiles } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { profiles, total } = await getProfiles({
    searchId: sp.get("searchId") ? Number(sp.get("searchId")) : undefined,
    company: sp.get("company") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
    offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
  });
  return NextResponse.json({ profiles, total });
}
