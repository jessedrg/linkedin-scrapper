import { NextResponse } from "next/server";

export async function GET() {
  const serper = process.env.SERPER_API_KEY ?? "";
  const pdl = process.env.PDL_API_KEY ?? "";
  return NextResponse.json({
    serperLength: serper.length,
    serperFirst4: serper.slice(0, 4),
    serperLast4: serper.slice(-4),
    serperHasQuotes: serper.startsWith("'") || serper.startsWith('"'),
    pdlLength: pdl.length,
    pdlFirst4: pdl.slice(0, 4),
    pdlHasQuotes: pdl.startsWith("'") || pdl.startsWith('"'),
  });
}
