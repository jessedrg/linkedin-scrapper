import { NextRequest, NextResponse } from "next/server";
import {
  getAllCompaniesFromDb,
  addCompany,
  addCompanies,
  removeCompany,
  getCompanyCount,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await getAllCompaniesFromDb();
  return NextResponse.json({ companies, total: companies.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Bulk import
  if (Array.isArray(body.names)) {
    const added = await addCompanies(body.names);
    const total = await getCompanyCount();
    return NextResponse.json({ added, total });
  }

  // Single add
  if (body.name) {
    const company = await addCompany(body.name);
    return NextResponse.json({ company });
  }

  return NextResponse.json({ error: "name or names required" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeCompany(Number(id));
  return NextResponse.json({ ok: true });
}
