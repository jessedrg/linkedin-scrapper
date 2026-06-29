"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Users, Zap, Download, Sparkles, Building2,
  ArrowRight, ExternalLink, TrendingUp, Activity,
  Loader2, CheckCircle2, XCircle, Plus, Trash2,
  Upload, RefreshCw, Globe, BarChart3, ChevronRight,
  AlertCircle,
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

type Tab = "dashboard" | "companies" | "search" | "results";

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

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "companies", label: "Companies", icon: <Building2 className="h-4 w-4" /> },
    { id: "search", label: "New Search", icon: <Sparkles className="h-4 w-4" /> },
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
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === item.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {item.icon}
                {item.label}
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
