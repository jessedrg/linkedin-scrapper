"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Users, Zap, Download, Sparkles, Globe, Building2,
  ArrowRight, ExternalLink, TrendingUp, Activity, ChevronDown,
  Loader2, CheckCircle2, XCircle, BarChart3, RefreshCw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface Stats {
  totalProfiles: number;
  totalSearches: number;
  avgScore: number;
  topScore: number;
  scoreDist: { high: number; mid: number; low: number };
  activeSearch: { id: string; prompt: string; queries_done: number; queries_total: number; profiles_found: number } | null;
  recentProfiles: Profile[];
}

interface Profile {
  id: number;
  linkedin_url: string;
  name: string;
  headline: string;
  location: string;
  score: number;
  source: string;
  created_at: string;
}

interface Progress {
  searchId: string;
  profilesFound: number;
  queriesUsed: number;
  queriesTotal: number;
  currentQuery: string;
  status: "running" | "completed" | "error" | "stopped";
}

interface QueryPreview {
  intent: { titles: string[]; companies: string[]; locations: string[]; seniority: string[] };
  queries: string[];
  aiGenerated: number;
  engineGenerated: number;
  total: number;
}

// ── Main App ───────────────────────────────────────────────────

export default function HomePage() {
  const [view, setView] = useState<"home" | "scrape" | "results">("home");
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Poll stats while scraping
  useEffect(() => {
    if (progress?.status === "running") {
      const iv = setInterval(loadStats, 5000);
      return () => clearInterval(iv);
    }
  }, [progress?.status, loadStats]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">LinkedIn Scraper</span>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-400">AI</span>
          </div>
          <nav className="flex items-center gap-1">
            {(["home", "scrape", "results"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); if (v === "home") loadStats(); }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {v === "home" ? "Dashboard" : v === "scrape" ? "New Search" : "Results"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {view === "home" && <Dashboard stats={stats} progress={progress} onNavigate={setView} />}
        {view === "scrape" && <ScrapeView progress={progress} setProgress={setProgress} onComplete={() => { loadStats(); setView("results"); }} />}
        {view === "results" && <ResultsView />}
      </main>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────

function Dashboard({ stats, progress, onNavigate }: { stats: Stats | null; progress: Progress | null; onNavigate: (v: "home" | "scrape" | "results") => void }) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="gradient-text">AI-Powered</span> LinkedIn Discovery
        </h1>
        <p className="text-white/40 text-lg max-w-2xl mx-auto">
          Describe who you&apos;re looking for in plain language. Our AI generates thousands of search queries
          and finds matching profiles at scale.
        </p>
        <button onClick={() => onNavigate("scrape")} className="btn-primary mt-6 text-base px-6 py-3">
          <Sparkles className="h-5 w-5" /> Start New Search <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Profiles" value={stats.totalProfiles.toLocaleString()} />
          <StatCard icon={Search} label="Searches Run" value={stats.totalSearches.toString()} />
          <StatCard icon={TrendingUp} label="Avg Score" value={`${stats.avgScore}pts`} />
          <StatCard icon={Zap} label="Top Score" value={`${stats.topScore}pts`} />
        </div>
      )}

      {/* Score Distribution */}
      {stats && stats.totalProfiles > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Score Distribution</h3>
          <div className="flex gap-4 items-end h-32">
            <ScoreBar label="High (70+)" count={stats.scoreDist.high} total={stats.totalProfiles} color="bg-emerald-500" />
            <ScoreBar label="Mid (40-69)" count={stats.scoreDist.mid} total={stats.totalProfiles} color="bg-amber-500" />
            <ScoreBar label="Low (<40)" count={stats.scoreDist.low} total={stats.totalProfiles} color="bg-red-500" />
          </div>
        </div>
      )}

      {/* Active Search */}
      {progress?.status === "running" && (
        <div className="glass-card glow-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-brand-500 live-dot" />
            <span className="text-sm font-medium text-brand-400">Live Search</span>
          </div>
          <ProgressBar progress={progress} />
        </div>
      )}

      {/* Recent Profiles */}
      {stats && stats.recentProfiles.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">Recent Finds</h3>
            <button onClick={() => onNavigate("results")} className="text-xs text-brand-400 hover:text-brand-300">
              View all <ArrowRight className="inline h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {stats.recentProfiles.map((p) => (
              <ProfileRow key={p.id} profile={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scrape View ────────────────────────────────────────────────

function ScrapeView({ progress, setProgress, onComplete }: {
  progress: Progress | null;
  setProgress: (p: Progress | null) => void;
  onComplete: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [locations, setLocations] = useState("San Francisco, New York");
  const [maxQueries, setMaxQueries] = useState(600);
  const [target, setTarget] = useState(3000);
  const [useAI, setUseAI] = useState(true);
  const [preview, setPreview] = useState<QueryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handlePreview() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, useAI,
          locations: locations.split(",").map(l => l.trim()).filter(Boolean),
          maxQueries,
        }),
      });
      if (res.ok) setPreview(await res.json());
    } catch {}
    setGenerating(false);
  }

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          queries: preview?.queries,
          locations: locations.split(",").map(l => l.trim()).filter(Boolean),
          maxQueries,
          target,
        }),
      });
      if (res.ok) {
        // Start SSE for progress
        const sse = new EventSource("/api/scrape/progress");
        sse.onmessage = (e) => {
          const data = JSON.parse(e.data) as Progress;
          setProgress(data);
          if (data.status === "completed" || data.status === "error") {
            sse.close();
            setTimeout(onComplete, 1000);
          }
        };
        sse.onerror = () => sse.close();
      }
    } catch {}
    setLoading(false);
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
          <div className="mt-6 p-4 rounded-lg bg-black/30 font-mono text-xs text-white/40 overflow-hidden">
            <p className="truncate">{progress.currentQuery}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Describe Who You&apos;re Looking For</h2>
        <p className="text-white/40">AI will generate optimized search queries to find matching LinkedIn profiles</p>
      </div>

      {/* Prompt */}
      <div className="glass-card p-6 space-y-5">
        <div>
          <label className="label">What role are you looking for?</label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setPreview(null); }}
            placeholder="e.g. Forward Deployment Engineer at top startups like Palantir, Stripe, Databricks..."
            className="input-field min-h-[100px] resize-none"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Locations</label>
            <input
              value={locations}
              onChange={(e) => { setLocations(e.target.value); setPreview(null); }}
              placeholder="San Francisco, New York, Remote"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Target Profiles</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="input-field"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max Queries</label>
            <input
              type="number"
              value={maxQueries}
              onChange={(e) => { setMaxQueries(Number(e.target.value)); setPreview(null); }}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">AI Enhancement</label>
            <button
              onClick={() => { setUseAI(!useAI); setPreview(null); }}
              className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                useAI
                  ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
                  : "border-white/10 bg-white/5 text-white/40"
              }`}
            >
              <Sparkles className="inline h-4 w-4 mr-2" />
              {useAI ? "AI Queries Enabled" : "Engine Only"}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handlePreview} disabled={!prompt.trim() || generating} className="btn-secondary flex-1">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {generating ? "Generating..." : "Preview Queries"}
          </button>
          <button
            onClick={handleStart}
            disabled={!prompt.trim() || loading}
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
              {preview.aiGenerated > 0 && (
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-400">
                  <Sparkles className="inline h-3 w-3 mr-1" />{preview.aiGenerated} AI
                </span>
              )}
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-400">
                {preview.engineGenerated} engine
              </span>
            </div>
          </div>

          {/* Intent */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-black/20 p-3">
              <span className="text-white/30 block mb-1">Titles detected</span>
              <div className="flex flex-wrap gap-1">
                {preview.intent.titles.map((t, i) => (
                  <span key={i} className="rounded bg-brand-500/10 px-2 py-0.5 text-brand-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-black/20 p-3">
              <span className="text-white/30 block mb-1">Companies matched</span>
              <span className="text-white/60">{preview.intent.companies.length > 0 ? preview.intent.companies.slice(0, 5).join(", ") + (preview.intent.companies.length > 5 ? ` +${preview.intent.companies.length - 5}` : "") : "Using top 300 startups"}</span>
            </div>
          </div>

          {/* Sample queries */}
          <div className="max-h-48 overflow-y-auto rounded-lg bg-black/30 p-3 space-y-1 font-mono text-xs">
            {preview.queries.slice(0, 20).map((q, i) => (
              <div key={i} className="text-white/30 hover:text-white/60 truncate transition-colors">{q}</div>
            ))}
            {preview.queries.length > 20 && (
              <div className="text-brand-400/50 pt-1">...and {preview.queries.length - 20} more</div>
            )}
          </div>

          <div className="text-center text-xs text-white/30">
            {preview.total} queries × ~20 results = <span className="text-white/60">{(preview.total * 20).toLocaleString()} potential profiles</span>
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
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profiles?limit=${limit}&offset=${page * limit}&minScore=${minScore}&sort=score&order=desc`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles);
        setTotal(data.total);
      }
    } catch {}
    setLoading(false);
  }, [page, minScore]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{total.toLocaleString()} Profiles</h2>
          <p className="text-white/40 text-sm">Sorted by match score</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={minScore}
            onChange={(e) => { setMinScore(Number(e.target.value)); setPage(0); }}
            className="input-field w-auto text-sm"
          >
            <option value={0}>All scores</option>
            <option value={40}>40+ pts</option>
            <option value={50}>50+ pts</option>
            <option value={60}>60+ pts</option>
            <option value={70}>70+ pts</option>
          </select>
          <a href={`/api/export?format=csv&minScore=${minScore}`} className="btn-secondary text-sm">
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <a href={`/api/export?format=json&minScore=${minScore}`} className="btn-secondary text-sm">
            <Download className="h-4 w-4" /> JSON
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wider text-white/30">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Headline</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4 text-right">Score</th>
              <th className="px-6 py-4 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-white/30"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
            ) : profiles.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-white/30">No profiles found</td></tr>
            ) : profiles.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-sm">{p.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-white/50 max-w-xs truncate">{p.headline}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs text-white/30">{p.location || "—"}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    p.score >= 70 ? "score-high" : p.score >= 40 ? "score-mid" : "score-low"
                  }`}>
                    {p.score}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a href={`https://${p.linkedin_url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
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
          <span className="text-sm text-white/30">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small Components ───────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="glass-card-hover p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
          <Icon className="h-4 w-4 text-brand-400" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-white/30">{label}</span>
      </div>
      <div className="stat-number">{value}</div>
    </div>
  );
}

function ScoreBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max((count / total) * 100, 2) : 0;
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="w-full flex justify-center items-end h-20">
        <div className={`${color}/20 w-full max-w-[60px] rounded-t-lg transition-all duration-500`} style={{ height: `${pct}%`, minHeight: "4px" }}>
          <div className={`${color} w-full h-full rounded-t-lg opacity-60`} />
        </div>
      </div>
      <span className="text-2xl font-bold">{count.toLocaleString()}</span>
      <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ProgressBar({ progress }: { progress: Progress }) {
  const pct = progress.queriesTotal > 0 ? (progress.queriesUsed / progress.queriesTotal) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">
          <span className="text-2xl font-bold text-white">{progress.profilesFound.toLocaleString()}</span> profiles found
        </span>
        <span className="text-white/40">{progress.queriesUsed}/{progress.queriesTotal} queries</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.status === "completed" && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Search completed
        </div>
      )}
    </div>
  );
}

function ProfileRow({ profile: p }: { profile: Profile }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-400">
          {p.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{p.name}</div>
          <div className="text-xs text-white/30 truncate">{p.headline}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
          p.score >= 70 ? "score-high" : p.score >= 40 ? "score-mid" : "score-low"
        }`}>{p.score}</span>
        <a href={`https://${p.linkedin_url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5 text-white/20 hover:text-brand-400 transition-colors" />
        </a>
      </div>
    </div>
  );
}
