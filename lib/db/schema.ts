import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  companyCount: integer("company_count").notNull().default(0),
  profilesFound: integer("profiles_found").notNull().default(0),
  queriesGenerated: integer("queries_generated").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
});

export const talentSearches = pgTable("talent_searches", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  location: text("location").notNull().default(""),
  tiers: text("tiers").array().notNull().default([]),
  status: text("status").notNull().default("pending"),
  profilesFound: integer("profiles_found").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id"),
  company: text("company").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  linkedinUrl: text("linkedin_url").notNull().unique(),
  sourceQuery: text("source_query"),
  score: integer("score").notNull().default(0),
  companyTier: text("company_tier").notNull().default(""),
  location: text("location").notNull().default(""),
  matchReason: text("match_reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usedQueries = pgTable("used_queries", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id"),
  company: text("company").notNull(),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Company       = typeof companies.$inferSelect;
export type NewCompany    = typeof companies.$inferInsert;
export type Search        = typeof searches.$inferSelect;
export type TalentSearch  = typeof talentSearches.$inferSelect;
export type Profile       = typeof profiles.$inferSelect;
export type UsedQuery     = typeof usedQueries.$inferSelect;
