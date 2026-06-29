import { NextResponse } from "next/server";
import { searchPDL } from "@/lib/scraper/pdl";

export async function GET() {
  const key = process.env.PDL_API_KEY;
  if (!key) return NextResponse.json({ error: "No PDL_API_KEY" }, { status: 500 });

  try {
    const result = await searchPDL(key, {
      titleVariants: ["Forward Deployed Engineer", "Forward Deployment Engineer", "FDE"],
      location: "San Francisco",
      size: 10,
    });
    return NextResponse.json({
      total: result.total,
      count: result.profiles.length,
      scrollToken: result.scrollToken?.slice(0, 20),
      sample: result.profiles.slice(0, 5).map(p => ({
        name: p.full_name,
        title: p.job_title,
        company: p.job_company_name,
        linkedin: p.linkedin_url,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
