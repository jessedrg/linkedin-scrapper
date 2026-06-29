import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const pdl = Boolean(process.env.PDL_API_KEY);
  const serper = Boolean(process.env.SERPER_API_KEY);
  const brave = Boolean(process.env.BRAVE_API_KEY);

  return NextResponse.json({
    provider: pdl ? "pdl" : serper ? "serper" : brave ? "brave" : null,
    pdl,
    serper,
    brave,
  });
}
