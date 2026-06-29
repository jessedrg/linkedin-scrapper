import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "scraper.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linkedin_url TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      headline TEXT DEFAULT '',
      location TEXT DEFAULT '',
      snippet TEXT DEFAULT '',
      score INTEGER DEFAULT 0,
      source TEXT DEFAULT 'brave',
      query TEXT DEFAULT '',
      search_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS searches (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      queries_total INTEGER DEFAULT 0,
      queries_done INTEGER DEFAULT 0,
      profiles_found INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS used_queries (
      query TEXT NOT NULL,
      search_id TEXT NOT NULL,
      results INTEGER DEFAULT 0,
      PRIMARY KEY (query, search_id)
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles(search_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_score ON profiles(score DESC);
  `);
}

// ── Profile operations ─────────────────────────────────────────

export interface DbProfile {
  id: number;
  linkedin_url: string;
  name: string;
  headline: string;
  location: string;
  snippet: string;
  score: number;
  source: string;
  query: string;
  search_id: string;
  created_at: string;
}

export function upsertProfile(p: Omit<DbProfile, "id" | "created_at">) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO profiles (linkedin_url, name, headline, location, snippet, score, source, query, search_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(linkedin_url) DO UPDATE SET
      score = MAX(profiles.score, excluded.score),
      headline = CASE WHEN length(excluded.headline) > length(profiles.headline) THEN excluded.headline ELSE profiles.headline END
  `).run(p.linkedin_url, p.name, p.headline, p.location, p.snippet, p.score, p.source, p.query, p.search_id);
}

export function profileExists(url: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM profiles WHERE linkedin_url = ?").get(url);
  return !!row;
}

export function getProfiles(opts: {
  searchId?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
  sort?: "score" | "name" | "created_at";
  order?: "asc" | "desc";
} = {}): { profiles: DbProfile[]; total: number } {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.searchId) { where.push("search_id = ?"); params.push(opts.searchId); }
  if (opts.minScore) { where.push("score >= ?"); params.push(opts.minScore); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sort = opts.sort || "score";
  const order = opts.order || "desc";
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const total = (db.prepare(`SELECT COUNT(*) as c FROM profiles ${whereClause}`).get(...params) as { c: number }).c;
  const profiles = db.prepare(`SELECT * FROM profiles ${whereClause} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as DbProfile[];

  return { profiles, total };
}

export function getProfileCount(searchId?: string): number {
  const db = getDb();
  if (searchId) {
    return (db.prepare("SELECT COUNT(*) as c FROM profiles WHERE search_id = ?").get(searchId) as { c: number }).c;
  }
  return (db.prepare("SELECT COUNT(*) as c FROM profiles").get() as { c: number }).c;
}

// ── Search operations ──────────────────────────────────────────

export interface DbSearch {
  id: string;
  prompt: string;
  status: string;
  queries_total: number;
  queries_done: number;
  profiles_found: number;
  created_at: string;
  finished_at: string | null;
}

export function createSearch(id: string, prompt: string, queriesTotal: number) {
  const db = getDb();
  db.prepare("INSERT INTO searches (id, prompt, status, queries_total) VALUES (?, ?, 'running', ?)").run(id, prompt, queriesTotal);
}

export function updateSearch(id: string, data: Partial<Pick<DbSearch, "status" | "queries_done" | "profiles_found" | "finished_at">>) {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
  if (data.queries_done !== undefined) { sets.push("queries_done = ?"); params.push(data.queries_done); }
  if (data.profiles_found !== undefined) { sets.push("profiles_found = ?"); params.push(data.profiles_found); }
  if (data.finished_at !== undefined) { sets.push("finished_at = ?"); params.push(data.finished_at); }
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE searches SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

export function getSearch(id: string): DbSearch | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM searches WHERE id = ?").get(id) as DbSearch | undefined;
}

export function getRecentSearches(limit: number = 10): DbSearch[] {
  const db = getDb();
  return db.prepare("SELECT * FROM searches ORDER BY created_at DESC LIMIT ?").all(limit) as DbSearch[];
}

export function isQueryUsed(query: string, searchId: string): boolean {
  const db = getDb();
  return !!db.prepare("SELECT 1 FROM used_queries WHERE query = ? AND search_id = ?").get(query, searchId);
}

export function recordQuery(query: string, searchId: string, results: number) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO used_queries (query, search_id, results) VALUES (?, ?, ?)").run(query, searchId, results);
}

// ── Stats ──────────────────────────────────────────────────────

export function getStats() {
  const db = getDb();
  const totalProfiles = (db.prepare("SELECT COUNT(*) as c FROM profiles").get() as { c: number }).c;
  const totalSearches = (db.prepare("SELECT COUNT(*) as c FROM searches").get() as { c: number }).c;
  const avgScore = (db.prepare("SELECT ROUND(AVG(score),1) as a FROM profiles").get() as { a: number | null }).a || 0;
  const topScore = (db.prepare("SELECT MAX(score) as m FROM profiles").get() as { m: number | null }).m || 0;
  const activeSearch = db.prepare("SELECT * FROM searches WHERE status = 'running' ORDER BY created_at DESC LIMIT 1").get() as DbSearch | undefined;

  const scoreDist = db.prepare(`
    SELECT
      SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN score >= 40 AND score < 70 THEN 1 ELSE 0 END) as mid,
      SUM(CASE WHEN score < 40 THEN 1 ELSE 0 END) as low
    FROM profiles
  `).get() as { high: number; mid: number; low: number };

  const recentProfiles = db.prepare("SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5").all() as DbProfile[];

  return { totalProfiles, totalSearches, avgScore, topScore, activeSearch, scoreDist, recentProfiles };
}
