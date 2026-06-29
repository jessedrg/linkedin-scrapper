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

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => searches.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  linkedinUrl: text("linkedin_url").notNull(),
  sourceQuery: text("source_query"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usedQueries = pgTable("used_queries", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => searches.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Search = typeof searches.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UsedQuery = typeof usedQueries.$inferSelect;
