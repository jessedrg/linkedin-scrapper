import { db } from "./index";
import {
  companies, searches, profiles, usedQueries,
  type Company, type Search, type Profile,
} from "./schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";

// ── Companies ───────────────────────────────────────────────────

export async function getAllCompaniesFromDb(): Promise<Company[]> {
  return db.select().from(companies).orderBy(companies.name);
}

export async function addCompany(name: string): Promise<Company> {
  const [company] = await db
    .insert(companies)
    .values({ name: name.trim() })
    .onConflictDoNothing()
    .returning();
  if (!company) {
    // Already exists — fetch it
    const [existing] = await db.select().from(companies).where(eq(companies.name, name.trim()));
    return existing;
  }
  return company;
}

export async function addCompanies(names: string[]): Promise<number> {
  if (names.length === 0) return 0;
  const values = names.map((n) => ({ name: n.trim() })).filter((v) => v.name.length > 0);
  const result = await db.insert(companies).values(values).onConflictDoNothing().returning();
  return result.length;
}

export async function removeCompany(id: number): Promise<void> {
  await db.delete(companies).where(eq(companies.id, id));
}

export async function getCompanyCount(): Promise<number> {
  const [row] = await db.select({ c: count() }).from(companies);
  return row?.c ?? 0;
}

// ── Searches ────────────────────────────────────────────────────

export async function createSearch(opts: {
  companyCount: number;
  queriesGenerated: number;
}): Promise<Search> {
  const [search] = await db
    .insert(searches)
    .values({ status: "running", companyCount: opts.companyCount, queriesGenerated: opts.queriesGenerated })
    .returning();
  return search;
}

export async function updateSearch(
  id: number,
  data: Partial<Pick<Search, "status" | "profilesFound" | "queriesGenerated" | "finishedAt" | "error">>,
): Promise<void> {
  await db.update(searches).set(data).where(eq(searches.id, id));
}

export async function getSearch(id: number): Promise<Search | undefined> {
  const [row] = await db.select().from(searches).where(eq(searches.id, id));
  return row;
}

export async function getRecentSearches(limit = 10): Promise<Search[]> {
  return db.select().from(searches).orderBy(desc(searches.startedAt)).limit(limit);
}

// ── Profiles ────────────────────────────────────────────────────

export async function upsertProfile(data: {
  searchId: number;
  company: string;
  name: string;
  title: string | null;
  linkedinUrl: string;
  sourceQuery: string;
}): Promise<void> {
  await db
    .insert(profiles)
    .values(data)
    .onConflictDoNothing();
}

export async function profileUrlExists(url: string): Promise<boolean> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.linkedinUrl, url))
    .limit(1);
  return !!row;
}

export interface ProfilesResult {
  profiles: Profile[];
  total: number;
}

export async function getProfiles(opts: {
  searchId?: number;
  company?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ProfilesResult> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const conditions = [];
  if (opts.searchId) conditions.push(eq(profiles.searchId, opts.searchId));
  if (opts.company) conditions.push(eq(profiles.company, opts.company));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(profiles)
    .where(where);

  const rows = await db
    .select()
    .from(profiles)
    .where(where)
    .orderBy(desc(profiles.createdAt))
    .limit(limit)
    .offset(offset);

  return { profiles: rows, total };
}

export async function getTotalProfileCount(): Promise<number> {
  const [row] = await db.select({ c: count() }).from(profiles);
  return row?.c ?? 0;
}

// ── Used Queries ────────────────────────────────────────────────

export async function recordQuery(opts: {
  searchId: number;
  company: string;
  query: string;
  resultsCount: number;
}): Promise<void> {
  await db.insert(usedQueries).values(opts).onConflictDoNothing();
}

export async function isQueryUsed(query: string, searchId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: usedQueries.id })
    .from(usedQueries)
    .where(and(eq(usedQueries.query, query), eq(usedQueries.searchId, searchId)))
    .limit(1);
  return !!row;
}

// ── Stats ────────────────────────────────────────────────────────

export async function getStats() {
  const [totalProfilesRow] = await db.select({ c: count() }).from(profiles);
  const [totalSearchesRow] = await db.select({ c: count() }).from(searches);
  const [totalCompaniesRow] = await db.select({ c: count() }).from(companies);

  const recentProfilesList = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.createdAt))
    .limit(5);

  const recentSearchesList = await db
    .select()
    .from(searches)
    .orderBy(desc(searches.startedAt))
    .limit(5);

  const activeSearch = recentSearchesList.find((s) => s.status === "running") ?? null;

  return {
    totalProfiles: totalProfilesRow?.c ?? 0,
    totalSearches: totalSearchesRow?.c ?? 0,
    totalCompanies: totalCompaniesRow?.c ?? 0,
    activeSearch,
    recentProfiles: recentProfilesList,
    recentSearches: recentSearchesList,
  };
}
