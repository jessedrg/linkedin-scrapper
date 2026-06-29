"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Users, Zap, Download, Sparkles, Building2,
  ArrowRight, ExternalLink, TrendingUp, Activity,
  Loader2, CheckCircle2, XCircle, Plus, Trash2,
  Upload, RefreshCw, Globe, BarChart3, ChevronRight,
  AlertCircle, Trophy, MapPin, Star, Brain, ChevronDown,
  Filter, SlidersHorizontal, Flame,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  createdAt: string;
}

interface Stats {
  totalProfiles: number;
  totalSearches: number;
  totalCompanies: number;
  activeSearch: Search | null;
  recentProfiles: Profile[];
  recentSearches: Search[];
}

interface Profile {
  id: number;
  linkedinUrl: string;
  name: string;
  title: string | null;
  company: string;
  sourceQuery: string | null;
  createdAt: string;
}

interface Search {
  id: number;
  status: string;
  companyCount: number;
  profilesFound: number;
  queriesGenerated: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

interface ScrapeProgress {
  searchId: number;
  profilesFound: number;
  queriesUsed: number;
  queriesTotal: number;
  currentQuery: string;
  currentCompany: string;
  status: "running" | "completed" | "error";
}

type Tab = "dashboard" | "companies" | "search" | "results" | "talent";

type CompanyTier = "S" | "A" | "B" | "Mega";

interface TalentProfile {
  name: string;
  firstname: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location: string;
  score: number;
  companyTier: CompanyTier | null;
  matchReasons: string[];
  snippet: string;
}

interface TalentEvent {
  type: "status" | "progress" | "partial" | "done" | "error";
  message?: string;
  queriesDone?: number;
  queriesTotal?: number;
  profilesFound?: number;
  profiles?: TalentProfile[];
  total?: number;
  searchId?: number;
}

// ── Main App ───────────────────────────────────────────────────

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (progress?.status === "running") {
      const iv = setInterval(loadStats, 8000);
      return () => clearInterval(iv);
    }
  }, [progress?.status, loadStats]);

  const navItems: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "talent", label: "Top Talent", icon: <Trophy className="h-4 w-4" />, badge: "NEW" },
    { id: "companies", label: "Companies", icon: <Building2 className="h-4 w-4" /> },
    { id: "search", label: "Bulk Search", icon: <Sparkles className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-500/25">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">LinkedIn Scraper</span>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-400">AI</span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); if (item.id === "dashboard") loadStats(); }}
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === item.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="rounded-sm bg-cyan-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-400">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {progress?.status === "running" && (
            <div className="flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1.5 text-xs text-brand-400">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400 live-dot" />
              {progress.profilesFound} found &middot; {progress.queriesUsed}/{progress.queriesTotal} queries
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === "dashboard" && (
          <Dashboard
            stats={stats}
            progress={progress}
            onNavigate={setTab}
            onRefresh={loadStats}
          />
        )}
        {tab === "talent" && <TalentView />}
        {tab === "companies" && <CompaniesView />}
        {tab === "search" && (
          <SearchView
            progress={progress}
            setProgress={setProgress}
            onComplete={() => { loadStats(); setTab("results"); }}
          />
        )}
        {tab === "results" && <ResultsView />}
      </main>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────

function Dashboard({
  stats, progress, onNavigate, onRefresh,
}: {
  stats: Stats | null;
  progress: ScrapeProgress | null;
  onNavigate: (t: Tab) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="gradient-text">AI-Powered</span> LinkedIn Discovery
        </h1>
        <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
          Add companies, describe the role, and let AI generate thousands of targeted search queries
          to find the best matching LinkedIn profiles at scale.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => onNavigate("companies")} className="btn-secondary">
            <Building2 className="h-4 w-4" /> Manage Companies
          </button>
          <button onClick={() => onNavigate("search")} className="btn-primary">
            <Sparkles className="h-4 w-4" /> Start New Search <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Profiles" value={stats?.totalProfiles.toLocaleString() ?? "—"} />
        <StatCard icon={Search} label="Searches Run" value={stats?.totalSearches.toString() ?? "—"} />
        <StatCard icon={Building2} label="Companies" value={stats?.totalCompanies.toString() ?? "—"} color="text-purple-400" />
        <StatCard icon={TrendingUp} label="Active Search" value={stats?.activeSearch ? "Running" : "Idle"} color={stats?.activeSearch ? "text-emerald-400" : "text-white/40"} />
      </div>

      {/* Live Progress */}
      {progress?.status === "running" && (
        <div className="glass-card glow-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-brand-500 live-dot" />
              <span className="text-sm font-medium text-brand-400">Search in Progress</span>
            </div>
            <span className="text-xs text-white/30">{progress.currentCompany}</span>
          </div>
          <ProgressBar progress={progress} />
          <div className="mt-3 rounded bg-black/30 px-3 py-2 font-mono text-xs text-white/30 truncate">
            {progress.currentQuery || "Generating queries..."}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {stats && stats.recentSearches.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">Recent Searches</h3>
            <button onClick={onRefresh} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          <div className="space-y-2">
            {stats.recentSearches.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusDot status={s.status} />
                  <div>
                    <div className="text-sm font-medium text-white/80">
                      {s.companyCount} companies &middot; {s.profilesFound} profiles
                    </div>
                    <div className="text-xs text-white/30">{new Date(s.startedAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium capitalize ${
                    s.status === "completed" ? "text-emerald-400" :
                    s.status === "running" ? "text-brand-400" :
                    s.status === "error" ? "text-red-400" : "text-white/30"
                  }`}>{s.status}</div>
                  <div className="text-xs text-white/30">{s.queriesGenerated} queries</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Profiles */}
      {stats && stats.recentProfiles.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">Recent Finds</h3>
            <button onClick={() => onNavigate("results")} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {stats.recentProfiles.map((p) => (
              <ProfileRow key={p.id} profile={p} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats && stats.totalProfiles === 0 && stats.totalCompanies === 0 && (
        <div className="glass-card p-12 text-center">
          <Zap className="h-12 w-12 text-brand-500/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Get Started</h3>
          <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
            Add companies to your list, then launch a search to discover LinkedIn profiles using AI-generated queries.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => onNavigate("companies")} className="btn-primary">
              <Building2 className="h-4 w-4" /> Add Companies
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Companies View ────────────────────────────────────────────

function CompaniesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [search, setSearch] = useState("");
  const [seedLoading, setSeedLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) { setNewName(""); await load(); }
    } catch {}
    setAdding(false);
  }

  async function handleBulkAdd() {
    const names = bulkText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (res.ok) { setBulkText(""); setBulkMode(false); await load(); }
    } catch {}
    setAdding(false);
  }

  async function handleSeedDefaults() {
    setSeedLoading(true);
    try {
      const { getAllCompanies } = await import("@/lib/scraper/companies");
      const names = getAllCompanies().slice(0, 200);
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (res.ok) await load();
    } catch {}
    setSeedLoading(false);
  }

  async function handleRemove(id: number) {
    try {
      await fetch("/api/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Companies</h2>
          <p className="text-white/40 text-sm mt-1">
            {companies.length} companies &mdash; all will be targeted in the next search
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={seedLoading}
            className="btn-secondary text-sm"
          >
            {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            Seed 200 Top Startups
          </button>
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className="btn-secondary text-sm"
          >
            <Upload className="h-4 w-4" /> Bulk Import
          </button>
        </div>
      </div>

      {/* Add Company */}
      <div className="glass-card p-5">
        {bulkMode ? (
          <div className="space-y-3">
            <label className="label">Paste company names (one per line or comma-separated)</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Stripe\nVercel\nAnthropic\nOpenAI, Google, Meta"}
              className="input-field min-h-[120px] resize-none font-mono text-xs"
              rows={5}
            />
            <div className="flex gap-3">
              <button onClick={() => setBulkMode(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                onClick={handleBulkAdd}
                disabled={!bulkText.trim() || adding}
                className="btn-primary flex-1 text-sm"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import Companies
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Add company name..."
              className="input-field flex-1"
            />
            <button onClick={handleAdd} disabled={!newName.trim() || adding} className="btn-primary px-5">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
        )}
      </div>

      {/* Search/filter */}
      {companies.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter companies..."
              className="input-field pl-10"
            />
          </div>
        </div>
      )}

      {/* Companies List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : companies.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No companies yet</h3>
          <p className="text-white/40 text-sm mb-6">
            Add companies manually, bulk import, or seed with 200 top tech startups.
          </p>
          <button onClick={handleSeedDefaults} disabled={seedLoading} className="btn-primary">
            {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            Seed Top Startups
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-white/5">
            {filtered.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between bg-[#0a0a0f] px-4 py-3 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-400 text-xs font-bold">
                    {company.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate">{company.name}</span>
                </div>
                <button
                  onClick={() => handleRemove(company.id)}
                  className="shrink-0 ml-2 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {filtered.length < companies.length && (
            <div className="px-4 py-2 text-xs text-white/30 bg-black/20">
              Showing {filtered.length} of {companies.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Search View ────────────────────────────────────────────────

function SearchView({
  progress, setProgress, onComplete,
}: {
  progress: ScrapeProgress | null;
  setProgress: (p: ScrapeProgress | null) => void;
  onComplete: () => void;
}) {
  const [role, setRole] = useState("");
  const [queriesPerCompany, setQueriesPerCompany] = useState(150);
  const [targetPerCompany, setTargetPerCompany] = useState(0); // 0 = sin límite
  const [maxMode, setMaxMode] = useState(true);
  const [useAI, setUseAI] = useState(true);
  const [preview, setPreview] = useState<{
    companiesCount: number;
    total: number;
    aiEnhanced: boolean;
    results: { company: string; queries: string[] }[];
    intent: { titles: string[]; locations: string[]; seniority: string[] };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyCount, setCompanyCount] = useState(0);

  useEffect(() => {
    fetch("/api/companies").then((r) => r.json()).then((d) => setCompanyCount(d.total)).catch(() => {});
  }, []);

  async function handlePreview() {
    if (!role.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, useAI, maxQueriesPerCompany: queriesPerCompany }),
      });
      if (res.ok) setPreview(await res.json());
    } catch {}
    setGenerating(false);
  }

  async function handleStart() {
    setLoading(true);
    try {
      // POST starts the scrape and streams progress back via SSE in the body.
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          queriesPerCompany,
          targetPerCompany: maxMode ? 0 : targetPerCompany,
          maxResultsPerQuery: maxMode ? 200 : 60,
          deep: maxMode,
          useAI,
        }),
      });

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const read = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as ScrapeProgress;
                  setProgress(data);
                  if (data.status === "completed" || data.status === "error") {
                    setTimeout(onComplete, 1000);
                    return;
                  }
                } catch {}
              }
            }
          }
        };

        setLoading(false);
        await read();
      }
    } catch {
      setLoading(false);
    }
  }

  if (progress?.status === "running") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="glass-card glow-border p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-3 w-3 rounded-full bg-brand-500 live-dot" />
            <h2 className="text-xl font-semibold">Search in Progress</h2>
          </div>
          <ProgressBar progress={progress} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black/20 px-4 py-3">
              <div className="text-xs text-white/30 mb-1">Current Company</div>
              <div className="text-sm font-medium truncate">{progress.currentCompany || "—"}</div>
            </div>
            <div className="rounded-lg bg-black/20 px-4 py-3">
              <div className="text-xs text-white/30 mb-1">Profiles Found</div>
              <div className="text-sm font-medium text-emerald-400">{progress.profilesFound.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-3 rounded bg-black/30 px-3 py-2 font-mono text-xs text-white/30 truncate">
            {progress.currentQuery || "..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Launch a Search</h2>
        <p className="text-white/40">
          AI will generate targeted queries for all {companyCount} companies in your list
        </p>
      </div>

      {companyCount === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/80">
            You have no companies yet.{" "}
            <button onClick={() => {}} className="text-amber-400 underline">Go to Companies</button>{" "}
            to add some before searching.
          </div>
        </div>
      )}

      <div className="glass-card p-6 space-y-5">
        <div>
          <label className="label">Role / What are you looking for?</label>
          <textarea
            value={role}
            onChange={(e) => { setRole(e.target.value); setPreview(null); }}
            placeholder="e.g. Senior Software Engineer, Forward Deployment Engineer, AI Product Manager..."
            className="input-field min-h-[90px] resize-none"
            rows={3}
          />
        </div>

        <button
          onClick={() => setMaxMode(!maxMode)}
          className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left flex items-center gap-3 ${
            maxMode
              ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
              : "border-white/10 bg-white/5 text-white/40"
          }`}
        >
          <Zap className="h-4 w-4 shrink-0" />
          <div>
            <div>{maxMode ? "Modo Máximo Volumen activado" : "Modo Personalizado"}</div>
            <div className="text-xs opacity-60 mt-0.5">
              {maxMode
                ? "Sin límite de perfiles, paginación profunda (~200/query), matriz de queries ampliada"
                : "Ajusta manualmente queries y tope de perfiles por empresa"}
            </div>
          </div>
        </button>

        {!maxMode && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Queries per company</label>
              <input
                type="number"
                value={queriesPerCompany}
                onChange={(e) => { setQueriesPerCompany(Number(e.target.value)); setPreview(null); }}
                className="input-field"
                min={5}
                max={300}
              />
            </div>
            <div>
              <label className="label">Target profiles per company (0 = sin límite)</label>
              <input
                type="number"
                value={targetPerCompany}
                onChange={(e) => setTargetPerCompany(Number(e.target.value))}
                className="input-field"
                min={0}
                max={2000}
              />
            </div>
          </div>
        )}

        <div>
          <label className="label">AI Enhancement</label>
          <button
            onClick={() => { setUseAI(!useAI); setPreview(null); }}
            className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left flex items-center gap-3 ${
              useAI
                ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <div>
              <div>{useAI ? "AI Queries Enabled" : "Engine-only Mode"}</div>
              <div className="text-xs opacity-60 mt-0.5">
                {useAI ? "GPT-4o-mini generates targeted queries per company" : "Uses rule-based query engine"}
              </div>
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!role.trim() || generating || companyCount === 0}
            className="btn-secondary flex-1"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {generating ? "Generating..." : "Preview Queries"}
          </button>
          <button
            onClick={handleStart}
            disabled={!role.trim() || loading || companyCount === 0}
            className="btn-primary flex-1"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loading ? "Starting..." : "Launch Search"}
          </button>
        </div>
      </div>

      {/* Query Preview */}
      {preview && (
        <div className="glass-card p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Query Preview</h3>
            <div className="flex gap-2">
              {preview.aiEnhanced && (
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-400">
                  <Sparkles className="inline h-3 w-3 mr-1" />AI Enhanced
                </span>
              )}
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-400">
                {preview.total} total queries
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-black/20 p-3">
              <span className="text-white/30 block mb-1">Companies</span>
              <span className="text-white/80 font-medium">{preview.companiesCount}</span>
            </div>
            <div className="rounded-lg bg-black/20 p-3">
              <span className="text-white/30 block mb-1">Titles detected</span>
              <div className="flex flex-wrap gap-1">
                {preview.intent.titles.slice(0, 3).map((t, i) => (
                  <span key={i} className="rounded bg-brand-500/10 px-1.5 py-0.5 text-brand-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-black/20 p-3">
              <span className="text-white/30 block mb-1">Potential profiles</span>
              <span className="text-white/80 font-medium">{(preview.total * 20).toLocaleString()}</span>
            </div>
          </div>

          {/* Sample queries per company */}
          <div className="max-h-52 overflow-y-auto rounded-lg bg-black/30 p-3 space-y-3">
            {preview.results.slice(0, 5).map(({ company, queries }) => (
              <div key={company}>
                <div className="text-xs font-medium text-white/50 mb-1">{company}</div>
                {queries.slice(0, 3).map((q, i) => (
                  <div key={i} className="font-mono text-[11px] text-white/25 hover:text-white/50 truncate transition-colors pl-2">{q}</div>
                ))}
              </div>
            ))}
            {preview.results.length > 5 && (
              <div className="text-brand-400/50 text-xs">...and {preview.results.length - 5} more companies</div>
            )}
          </div>

          <div className="text-center text-xs text-white/30">
            {preview.total} queries &times; ~20 results =&nbsp;
            <span className="text-white/60">{(preview.total * 20).toLocaleString()} potential profiles</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Results View ───────────────────────────────────────────────

function ResultsView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [companyFilter, setCompanyFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (companyFilter) params.set("company", companyFilter);
      const res = await fetch(`/api/profiles?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles);
        setTotal(data.total);
      }
    } catch {}
    setLoading(false);
  }, [page, companyFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{total.toLocaleString()} Profiles</h2>
          <p className="text-white/40 text-sm">All discovered LinkedIn profiles</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={companyFilter}
            onChange={(e) => { setCompanyFilter(e.target.value); setPage(0); }}
            placeholder="Filter by company..."
            className="input-field w-48 text-sm"
          />
          <a
            href={`/api/export?format=csv${companyFilter ? `&company=${encodeURIComponent(companyFilter)}` : ""}`}
            className="btn-secondary text-sm"
          >
            <Download className="h-4 w-4" /> CSV
          </a>
          <a
            href={`/api/export?format=json${companyFilter ? `&company=${encodeURIComponent(companyFilter)}` : ""}`}
            className="btn-secondary text-sm"
          >
            <Download className="h-4 w-4" /> JSON
          </a>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wider text-white/30">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-white/30">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-white/30">
                  No profiles found
                </td>
              </tr>
            ) : profiles.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-sm">{p.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-white/50 max-w-xs truncate">{p.title || "—"}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-md bg-brand-500/10 px-2.5 py-0.5 text-xs text-brand-400">
                    {p.company}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a
                    href={`https://${p.linkedinUrl.replace(/^https?:\/\//, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= total} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Talent View ────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string; icon: string }> = {
  S: { label: "Tier S", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-amber-500/20", icon: "★" },
  A: { label: "Tier A", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/30", glow: "shadow-slate-500/10", icon: "◆" },
  B: { label: "Tier B", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "shadow-orange-500/10", icon: "●" },
  Mega: { label: "Mega", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", glow: "shadow-violet-500/20", icon: "⬡" },
};

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const cfg = TIER_CONFIG[tier];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className="text-[8px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-slate-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-white/30"}`}>
        {score}
      </span>
    </div>
  );
}

function TalentView() {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<CompanyTier[]>(["S", "A", "Mega"]);
  const [queriesTotal, setQueriesTotal] = useState(80);
  const [aiRerank, setAiRerank] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, found: 0 });
  const [results, setResults] = useState<TalentProfile[]>([]);
  const [filterTier, setFilterTier] = useState<CompanyTier | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleTier = (t: CompanyTier) =>
    setSelectedTiers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  async function handleSearch() {
    if (!role.trim() || running) return;
    setRunning(true);
    setResults([]);
    setStatusMsg("Initialising...");
    setProgress({ done: 0, total: 0, found: 0 });
    setExpandedIdx(null);

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, location, tiers: selectedTiers, queriesTotal, aiRerank }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const msg = (errJson as { error?: string }).error ?? `HTTP ${res.status}`;
        if (msg.includes("BRAVE_API_KEY")) {
          setStatusMsg("BRAVE_API_KEY no configurada — añadela en Settings > Vars del proyecto");
        } else {
          setStatusMsg(`Error del servidor: ${msg}`);
        }
        setRunning(false);
        return;
      }
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as TalentEvent;
            if (evt.type === "status" && evt.message) setStatusMsg(evt.message);
            if (evt.type === "progress") {
              setProgress({ done: evt.queriesDone ?? 0, total: evt.queriesTotal ?? 0, found: evt.profilesFound ?? 0 });
            }
            if (evt.type === "partial" && evt.profiles && evt.profiles.length > 0) {
              setResults(evt.profiles);
            }
            if (evt.type === "done") {
              setResults(evt.profiles ?? []);
              setStatusMsg(`Done — ${evt.total ?? 0} profiles ranked`);
              setRunning(false);
            }
            if (evt.type === "error") {
              setStatusMsg(`Error: ${evt.message}`);
              setRunning(false);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setStatusMsg("Connection lost");
      setRunning(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
    setStatusMsg("Stopped");
  }

  const filtered = results.filter((p) => {
    if (filterTier !== "all" && p.companyTier !== filterTier) return false;
    if (p.score < minScore) return false;
    return true;
  });

  const tierCounts = results.reduce<Record<string, number>>((acc, p) => {
    if (p.companyTier) acc[p.companyTier] = (acc[p.companyTier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-2xl font-bold tracking-tight">Top Talent Search</h2>
          </div>
          <p className="text-white/40 text-sm">
            AI-powered LinkedIn sourcing across {["S","A","B","Mega"].map(t => TIER_CONFIG[t].label).join(" / ")} companies. Scored + AI re-ranked.
          </p>
        </div>

      </div>

      {/* Search Form */}
      <div className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Role / What you&apos;re looking for</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSearch(); }}
              placeholder="e.g. Forward Deployed Engineer, AI Product Manager..."
              className="input-field"
              disabled={running}
            />
          </div>
          <div>
            <label className="label">Location (optional)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, Remote, New York..."
                className="input-field pl-10"
                disabled={running}
              />
            </div>
          </div>
        </div>

        {/* Tier selector */}
        <div>
          <label className="label">Company tiers to search</label>
          <div className="flex flex-wrap gap-2">
            {(["S", "A", "B", "Mega"] as CompanyTier[]).map((t) => {
              const cfg = TIER_CONFIG[t];
              const active = selectedTiers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  disabled={running}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                    active ? `${cfg.color} ${cfg.bg} ${cfg.border}` : "border-white/10 text-white/30 hover:text-white/50"
                  }`}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label}
                  {active && t === "S" && <Flame className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Config row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="label mb-0 whitespace-nowrap">Queries</label>
            <input
              type="number"
              value={queriesTotal}
              onChange={(e) => setQueriesTotal(Number(e.target.value))}
              min={20}
              max={300}
              className="input-field w-24 text-center"
              disabled={running}
            />
          </div>
          <button
            onClick={() => setAiRerank(!aiRerank)}
            disabled={running}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
              aiRerank ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-white/10 text-white/30 hover:text-white/60"
            }`}
          >
            <Brain className="h-4 w-4" />
            AI Re-ranking {aiRerank ? "On" : "Off"}
          </button>
        </div>

        {/* Action */}
        <div className="flex gap-3">
          <button
            onClick={running ? handleStop : handleSearch}
            disabled={!role.trim() && !running}
            className={`flex-1 btn-primary justify-center text-base font-semibold py-3 ${running ? "bg-red-600 hover:bg-red-500 shadow-red-500/20" : ""}`}
          >
            {running ? (
              <><XCircle className="h-5 w-5" /> Stop Search</>
            ) : (
              <><Trophy className="h-5 w-5" /> Find Top Talent</>
            )}
          </button>
        </div>
      </div>

      {/* Error banner — shown when not running and there is an error message */}
      {!running && statusMsg && !statusMsg.startsWith("Done") && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">{statusMsg}</p>
            {statusMsg.includes("BRAVE_API_KEY") && (
              <p className="text-xs text-white/40 mt-1">
                Ve a <strong className="text-white/60">Settings › Vars</strong> en la esquina superior derecha y a&ntilde;ade{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 text-white/60">BRAVE_API_KEY</code> con tu clave de{" "}
                <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                  Brave Search API
                </a>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Live progress */}
      {running && (
        <div className="glass-card p-5 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 live-dot" />
              <span className="text-sm font-medium text-cyan-300">Searching...</span>
            </div>
            <span className="text-xs text-white/30 font-mono">{progress.found} profiles found</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
              style={{ width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : "5%" }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/30">
            <span className="truncate max-w-sm">{statusMsg}</span>
            {progress.total > 0 && <span className="shrink-0 ml-2">{progress.done}/{progress.total} queries</span>}
          </div>
        </div>
      )}

      {/* Results — shown live during search AND after completion */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Live CSV download — always available once profiles start appearing */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">
              {running ? `${results.length} profiles so far (updating live)...` : `${results.length} profiles found`}
            </span>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                ["Rank,Name,Firstname,Title,Company,Tier,Score,Location,LinkedIn"].concat(
                  filtered.map((p, i) =>
                    [
                      i + 1,
                      `"${p.name}"`,
                      `"${p.firstname}"`,
                      `"${p.title}"`,
                      `"${p.company}"`,
                      p.companyTier ?? "",
                      p.score,
                      `"${p.location}"`,
                      p.linkedinUrl,
                    ].join(",")
                  )
                ).join("\n")
              )}`}
              download={`talent-${role.replace(/\s+/g, "-").toLowerCase()}.csv`}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {running ? "Download CSV (partial)" : "Download CSV"}
            </a>
          </div>

          {/* Tier breakdown + filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterTier("all")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${filterTier === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-white/30 hover:text-white/60"}`}
              >
                All ({results.length})
              </button>
              {(["S", "Mega", "A", "B"] as CompanyTier[]).map((t) => {
                const cfg = TIER_CONFIG[t];
                const cnt = tierCounts[t] ?? 0;
                if (!cnt) return null;
                return (
                  <button
                    key={t}
                    onClick={() => setFilterTier(filterTier === t ? "all" : t)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      filterTier === t ? `${cfg.color} ${cfg.bg} ${cfg.border}` : "border-white/10 text-white/30 hover:text-white/50"
                    }`}
                  >
                    <span>{cfg.icon}</span> {cfg.label} ({cnt})
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showFilters && (
            <div className="glass-card p-4 flex items-center gap-4">
              <label className="label mb-0 whitespace-nowrap">Min score</label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="flex-1 accent-cyan-500"
              />
              <span className="text-sm font-mono text-white/60 w-8">{minScore}</span>
            </div>
          )}

          {/* Ranking table */}
          <div className="glass-card overflow-hidden">
            <div className="grid grid-cols-[40px_80px_1fr_auto_auto] items-center gap-0 border-b border-white/5 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/25">
              <span>#</span>
              <span>First</span>
              <span>Profile</span>
              <span className="text-right pr-6">Tier</span>
              <span className="text-right">Score</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {filtered.slice(0, 200).map((p, i) => {
                const isExpanded = expandedIdx === i;
                const tierCfg = p.companyTier ? TIER_CONFIG[p.companyTier] : null;
                const rank = i + 1;
                const rankColor = rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-orange-400" : "text-white/20";
                return (
                  <div key={p.linkedinUrl}>
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      className="w-full grid grid-cols-[40px_80px_1fr_auto_auto] items-center gap-0 px-5 py-4 text-left hover:bg-white/[0.025] transition-colors group"
                    >
                      {/* Rank */}
                      <span className={`text-sm font-bold tabular-nums ${rankColor}`}>
                        {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : rank}
                      </span>

                      {/* Firstname */}
                      <span className="text-sm font-semibold text-white/70 truncate pr-2">
                        {p.firstname || "—"}
                      </span>

                      {/* Profile info */}
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-white/90 truncate">
                            {p.name || p.title.split(" - ")[0] || "Unknown"}
                          </span>
                          {p.location && (
                            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/30 shrink-0">
                              <MapPin className="h-2.5 w-2.5" /> {p.location}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/40 truncate">{p.title}</div>
                        <div className="text-xs text-white/25 truncate">{p.company}</div>
                      </div>

                      {/* Tier badge */}
                      <div className="pr-4">
                        {tierCfg ? (
                          <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                            <span className="text-[8px]">{tierCfg.icon}</span>
                            {tierCfg.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/15">—</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-end gap-1">
                        <ScoreBar score={p.score} />
                        <ChevronDown className={`h-3 w-3 text-white/20 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Expanded row */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0 border-t border-white/5 bg-black/20">
                        <div className="flex flex-wrap items-start gap-4 pt-4">
                          <div className="flex-1 min-w-0 space-y-3">
                            {p.snippet && (
                              <p className="text-xs text-white/40 leading-relaxed line-clamp-3">{p.snippet}</p>
                            )}
                            {p.matchReasons.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {p.matchReasons.map((r, ri) => (
                                  <span key={ri} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40 border border-white/5">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <a
                              href={p.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="btn-primary text-xs py-2 px-4"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View LinkedIn
                            </a>
                            {p.location && (
                              <span className="flex items-center gap-1 text-[10px] text-white/30">
                                <MapPin className="h-3 w-3" /> {p.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {filtered.length > 200 && (
              <div className="px-5 py-3 border-t border-white/5 text-xs text-white/25 text-center">
                Showing top 200 of {filtered.length} results
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!running && results.length === 0 && (
        <div className="glass-card p-16 text-center">
          <Trophy className="h-14 w-14 text-amber-500/20 mx-auto mb-5" />
          <h3 className="text-lg font-semibold mb-2 text-white/70">Find the absolute best</h3>
          <p className="text-white/30 text-sm max-w-md mx-auto leading-relaxed">
            Enter a role and location, select which company tiers to search, and let AI find + rank the top LinkedIn talent across{" "}
            <span className="text-white/50">3,500+ curated companies</span>.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            {(["S", "A", "Mega"] as CompanyTier[]).map((t) => {
              const cfg = TIER_CONFIG[t];
              return (
                <span key={t} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                  {cfg.icon} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-white/30" />
        <span className="text-xs font-medium uppercase tracking-wider text-white/30">{label}</span>
      </div>
      <div className={`stat-number ${color ?? ""}`}>{value}</div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: ScrapeProgress }) {
  const pct = progress.queriesTotal > 0
    ? Math.round((progress.queriesUsed / progress.queriesTotal) * 100)
    : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{progress.queriesUsed.toLocaleString()} / {progress.queriesTotal.toLocaleString()} queries</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-white/40">
        <span className="text-emerald-400 font-medium">{progress.profilesFound.toLocaleString()} profiles found</span>
        {progress.status === "completed" && (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </span>
        )}
        {progress.status === "error" && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="h-3 w-3" /> Error
          </span>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "completed" ? "bg-emerald-500" :
    status === "running" ? "bg-brand-500 live-dot" :
    status === "error" ? "bg-red-500" : "bg-white/20";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function ProfileRow({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-4 py-3 hover:bg-black/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold">
          {profile.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{profile.name}</div>
          <div className="text-xs text-white/30 truncate">{profile.title || profile.company}</div>
        </div>
      </div>
      <a
        href={`https://${profile.linkedinUrl.replace(/^https?:\/\//, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 ml-3 text-brand-400/60 hover:text-brand-300 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
