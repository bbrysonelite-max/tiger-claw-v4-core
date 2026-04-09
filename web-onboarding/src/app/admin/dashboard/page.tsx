"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight,
  Database, Eye, Link, LogOut, MessageSquare, Pause, Play, RefreshCw, Shield, Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.tigerclaw.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PoolHealth {
  status: "healthy" | "low" | "critical" | "empty";
  available: number;
  assigned: number;
  total: number;
  action: string;
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  email: string;
  status: string;
  flavor: string;
  region: string;
  language: string;
  preferredChannel: string;
  canaryGroup: string | null;
  lastActivityAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

interface TenantConversationStat {
  tenantId: string;
  messagesLast24h: number;
  messagesToday: number;
  lastMessageAt: string | null;
}

interface ConversationStats {
  totalLast24h: number;
  totalToday: number;
  byTenant: TenantConversationStat[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "active":     return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "onboarding": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "suspended":  return "bg-red-500/20 text-red-300 border-red-500/30";
    case "waitlisted": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "terminated": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    default:           return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

function poolStatusColor(status: string): string {
  switch (status) {
    case "healthy":  return "text-emerald-400";
    case "low":      return "text-amber-400";
    case "critical": return "text-orange-400";
    case "empty":    return "text-red-400";
    default:         return "text-zinc-400";
  }
}

function poolStatusBg(status: string): string {
  switch (status) {
    case "healthy":  return "bg-emerald-500/10 border-emerald-500/20";
    case "low":      return "bg-amber-500/10 border-amber-500/20";
    case "critical": return "bg-orange-500/10 border-orange-500/20";
    case "empty":    return "bg-red-500/10 border-red-500/20";
    default:         return "bg-zinc-800 border-zinc-700";
  }
}

function flavorLabel(flavor: string): string {
  return flavor.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

function computeAlarms(pool: PoolHealth | null, tenants: TenantRow[]): string[] {
  const alarms: string[] = [];
  if (pool?.status === "empty")    alarms.push("ℹ️ Bot pool is EMPTY — all new signups must be BYOB");
  if (pool?.status === "critical") alarms.push(`⚠️ Bot pool critical — only ${pool.available} tokens left`);
  if (pool?.status === "low")      alarms.push(`⚠️ Bot pool low — ${pool.available} tokens remaining`);

  const suspended = tenants.filter((t) => t.status === "suspended");
  if (suspended.length > 0)
    alarms.push(`⛔ ${suspended.length} tenant${suspended.length > 1 ? "s" : ""} suspended: ${suspended.map((t) => t.name).join(", ")}`);

  const waitlisted = tenants.filter((t) => t.status === "waitlisted");
  if (waitlisted.length > 0)
    alarms.push(`⏳ ${waitlisted.length} tenant${waitlisted.length > 1 ? "s" : ""} waitlisted (pool was empty when they signed up)`);

  const stuckOnboarding = tenants.filter((t) => {
    if (t.status !== "onboarding") return false;
    const hoursElapsed = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
    return hoursElapsed > 48;
  });
  if (stuckOnboarding.length > 0)
    alarms.push(`🔄 ${stuckOnboarding.length} tenant${stuckOnboarding.length > 1 ? "s" : ""} stuck in onboarding >48h: ${stuckOnboarding.map((t) => t.name).join(", ")}`);

  return alarms;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FleetDashboard() {
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pool, setPool] = useState<PoolHealth | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [conversations, setConversations] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [webhookFixResult, setWebhookFixResult] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchAll = useCallback(async (tok: string) => {
    setLoading(true);
    setError("");
    try {
      const [poolRes, fleetRes, convoRes] = await Promise.all([
        fetch(`${API_URL}/admin/pool/health`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API_URL}/admin/fleet`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API_URL}/admin/conversations`, { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      if (poolRes.status === 401 || fleetRes.status === 401) {
        setError("Invalid admin token");
        setIsAuthenticated(false);
        localStorage.removeItem("tiger_admin_token");
        return;
      }

      if (!fleetRes.ok) {
        const body = await fleetRes.json().catch(() => ({})) as { error?: string };
        setError(`Fleet API error ${fleetRes.status}: ${body.error ?? "unknown"}`);
        return;
      }

      if (poolRes.ok) setPool(await poolRes.json());
      const fleetData = await fleetRes.json();
      setTenants(fleetData.tenants ?? []);
      if (convoRes.ok) setConversations(await convoRes.json());
      setLastRefreshed(new Date());
    } catch {
      setError("Connection error — is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("tiger_admin_token");
    if (saved) {
      setToken(saved);
      setIsAuthenticated(true);
      fetchAll(saved);
    }
  }, [fetchAll]);

  // Auto-refresh every 30s so data stays live during operations
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const interval = setInterval(() => fetchAll(token), 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchAll]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    localStorage.setItem("tiger_admin_token", token.trim());
    setIsAuthenticated(true);
    fetchAll(token.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem("tiger_admin_token");
    setToken("");
    setIsAuthenticated(false);
    setTenants([]);
    setPool(null);
  };

  const tenantAction = async (tenantId: string, action: "suspend" | "resume" | "report") => {
    const key = `${tenantId}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const method = action === "report" ? "POST" : "POST";
      const path =
        action === "report"
          ? `/admin/fleet/${tenantId}/report`
          : `/admin/fleet/${tenantId}/${action}`;
      await fetch(`${API_URL}${path}`, { method, headers: headers() });
      await fetchAll(token);
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fixAllWebhooks = async () => {
    setActionLoading((prev) => ({ ...prev, "fix-webhooks": true }));
    setWebhookFixResult(null);
    try {
      const res = await fetch(`${API_URL}/admin/fix-all-webhooks`, { method: "POST", headers: headers() });
      const data = await res.json() as { ok: boolean; processed: number; secretWired: boolean; results: { slug: string; status: string; msg?: string }[] };
      const failed = data.results.filter((r) => r.status !== "fixed");
      if (failed.length === 0) {
        setWebhookFixResult(`✅ ${data.processed} webhook${data.processed !== 1 ? "s" : ""} fixed. Secret wired: ${data.secretWired ? "yes" : "NO — check TELEGRAM_WEBHOOK_SECRET env var"}`);
      } else {
        setWebhookFixResult(`⚠️ ${data.processed - failed.length}/${data.processed} fixed. Failed: ${failed.map((r) => `${r.slug} (${r.msg})`).join(", ")}`);
      }
      await fetchAll(token);
    } catch {
      setWebhookFixResult("❌ Request failed — check API connection");
    } finally {
      setActionLoading((prev) => ({ ...prev, "fix-webhooks": false }));
    }
  };

  const alarms = computeAlarms(pool, tenants);
  const activeTenants = tenants.filter((t) => t.status === "active").length;

  // ---------------------------------------------------------------------------
  // Login screen
  // ---------------------------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Shield className="w-6 h-6 text-orange-500" />
            <span className="text-white font-bold text-lg">Tiger Claw Fleet</span>
          </div>
          <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs text-zinc-200 font-medium block mb-1">Admin Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer token"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors"
            >
              Access Fleet →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-white">Tiger Claw Fleet</span>
          <span className="text-zinc-500 text-sm">|</span>
          <span className="text-zinc-200 text-sm">
            {activeTenants} active · {tenants.length} total
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-zinc-300 text-xs">
              Updated {relativeTime(lastRefreshed.toISOString())}
            </span>
          )}
          <button
            onClick={fixAllWebhooks}
            disabled={!!actionLoading["fix-webhooks"]}
            title="Re-register all Telegram webhooks with the secret token"
            className="flex items-center gap-1.5 text-zinc-200 hover:text-orange-400 text-sm transition-colors disabled:opacity-50"
          >
            <Link className={`w-4 h-4 ${actionLoading["fix-webhooks"] ? "animate-pulse" : ""}`} />
            Fix Webhooks
          </button>
          <button
            onClick={() => fetchAll(token)}
            disabled={loading}
            className="flex items-center gap-1.5 text-zinc-200 hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Alarms */}
        {alarms.length > 0 && (
          <div className="space-y-2">
            {alarms.map((alarm, i) => (
              <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-300 text-sm">{alarm}</span>
              </div>
            ))}
          </div>
        )}

        {/* Webhook fix result */}
        {webhookFixResult && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 flex items-start justify-between gap-2">
            <span className="text-zinc-300 text-sm">{webhookFixResult}</span>
            <button onClick={() => setWebhookFixResult(null)} className="text-zinc-400 hover:text-zinc-200 text-xs shrink-0">✕</button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Pool health */}
          <div className={`rounded-xl border p-4 ${pool ? poolStatusBg(pool.status) : "bg-zinc-900 border-zinc-800"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-200 font-medium">Bot Pool</span>
            </div>
            {pool ? (
              <>
                <div className={`text-2xl font-bold ${poolStatusColor(pool.status)}`}>
                  {pool.available}
                </div>
                <div className="text-xs text-zinc-300 mt-1">
                  {pool.assigned} assigned · {pool.total} total · <span className="capitalize">{pool.status}</span>
                </div>
              </>
            ) : (
              <div className="text-zinc-600 text-sm">—</div>
            )}
          </div>

          {/* Active tenants */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-200 font-medium">Active Agents</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{activeTenants}</div>
            <div className="text-xs text-zinc-300 mt-1">{tenants.length} total tenants</div>
          </div>

          {/* Messages 24h — heartbeat metric */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-200 font-medium">Messages 24h</span>
            </div>
            <div className={`text-2xl font-bold ${(conversations?.totalLast24h ?? 0) > 0 ? "text-orange-400" : "text-zinc-600"}`}>
              {conversations?.totalLast24h ?? "—"}
            </div>
            <div className="text-xs text-zinc-300 mt-1">
              {conversations ? `${conversations.totalToday} today` : "loading..."}
            </div>
          </div>

          {/* Onboarding */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-200 font-medium">Onboarding</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {tenants.filter((t) => t.status === "onboarding").length}
            </div>
            <div className="text-xs text-zinc-300 mt-1">in progress</div>
          </div>

          {/* Issues */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-200 font-medium">Issues</span>
            </div>
            <div className={`text-2xl font-bold ${alarms.length > 0 ? "text-red-400" : "text-zinc-400"}`}>
              {alarms.length}
            </div>
            <div className="text-xs text-zinc-300 mt-1">
              {alarms.length === 0 ? "all clear" : "need attention"}
            </div>
          </div>
        </div>

        {/* Fleet table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-sm">Fleet</span>
            </div>
            <span className="text-xs text-zinc-300">{tenants.length} tenants</span>
          </div>

          {tenants.length === 0 ? (
            <div className="px-5 py-12 text-center text-zinc-600 text-sm">
              {loading ? "Loading fleet..." : "No tenants found"}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {tenants.map((t) => {
                const isExpanded = expandedTenant === t.id;
                const suspendLoading = actionLoading[`${t.id}-suspend`];
                const resumeLoading  = actionLoading[`${t.id}-resume`];
                const reportLoading  = actionLoading[`${t.id}-report`];

                return (
                  <div key={t.id}>
                    {/* Row */}
                    <div className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors">
                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedTenant(isExpanded ? null : t.id)}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </button>

                      {/* Name + email */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{t.name}</div>
                        <div className="text-xs text-zinc-300 truncate">{t.email ?? t.slug}</div>
                      </div>

                      {/* Flavor */}
                      <div className="hidden md:block w-36 text-xs text-zinc-200 truncate">
                        {flavorLabel(t.flavor)}
                      </div>

                      {/* Channel */}
                      <div className="hidden sm:block w-20 text-xs text-zinc-300 uppercase">
                        {t.preferredChannel}
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(t.status)}`}>
                          {t.status}
                        </span>
                      </div>

                      {/* Last active */}
                      <div className="hidden lg:block w-24 text-xs text-zinc-300 text-right shrink-0">
                        {relativeTime(t.lastActivityAt)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {t.status === "active" && (
                          <>
                            <button
                              onClick={() => tenantAction(t.id, "report")}
                              disabled={!!reportLoading}
                              title="Trigger daily scout"
                              className="text-zinc-300 hover:text-orange-400 transition-colors disabled:opacity-40"
                            >
                              <Eye className={`w-4 h-4 ${reportLoading ? "animate-pulse" : ""}`} />
                            </button>
                            <button
                              onClick={() => tenantAction(t.id, "suspend")}
                              disabled={!!suspendLoading}
                              title="Suspend tenant"
                              className="text-zinc-300 hover:text-red-400 transition-colors disabled:opacity-40"
                            >
                              <Pause className={`w-4 h-4 ${suspendLoading ? "animate-pulse" : ""}`} />
                            </button>
                          </>
                        )}
                        {t.status === "suspended" && (
                          <button
                            onClick={() => tenantAction(t.id, "resume")}
                            disabled={!!resumeLoading}
                            title="Resume tenant"
                            className="text-zinc-300 hover:text-emerald-400 transition-colors disabled:opacity-40"
                          >
                            <Play className={`w-4 h-4 ${resumeLoading ? "animate-pulse" : ""}`} />
                          </button>
                        )}
                        {(t.status === "active" || t.status === "suspended") && (
                          <CheckCircle2 className="w-4 h-4 text-zinc-700" />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (() => {
                      const convoStat = conversations?.byTenant.find((c) => c.tenantId === t.id);
                      return (
                        <div className="px-14 pb-4 pt-1 bg-zinc-800/30 text-xs text-zinc-400 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <div className="text-zinc-400 mb-0.5">Tenant ID</div>
                            <div className="font-mono text-zinc-300 truncate">{t.id}</div>
                          </div>
                          <div>
                            <div className="text-zinc-400 mb-0.5">Slug</div>
                            <div className="font-mono text-zinc-300">{t.slug}</div>
                          </div>
                          <div>
                            <div className="text-zinc-400 mb-0.5">Region / Language</div>
                            <div className="text-zinc-300">{t.region} / {t.language}</div>
                          </div>
                          <div>
                            <div className="text-zinc-400 mb-0.5">Created</div>
                            <div className="text-zinc-300">{relativeTime(t.createdAt)}</div>
                          </div>
                          <div>
                            <div className="text-zinc-400 mb-0.5">Messages (24h / today)</div>
                            <div className={`font-medium ${(convoStat?.messagesLast24h ?? 0) > 0 ? "text-orange-300" : "text-zinc-500"}`}>
                              {convoStat ? `${convoStat.messagesLast24h} / ${convoStat.messagesToday}` : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-400 mb-0.5">Last Message</div>
                            <div className="text-zinc-300">{relativeTime(convoStat?.lastMessageAt ?? t.lastActivityAt)}</div>
                          </div>
                          {t.suspendedReason && (
                            <div className="col-span-2 md:col-span-4">
                              <div className="text-zinc-400 mb-0.5">Suspension Reason</div>
                              <div className="text-red-400">{t.suspendedReason}</div>
                            </div>
                          )}
                          {t.canaryGroup && (
                            <div>
                              <div className="text-zinc-400 mb-0.5">Canary Group</div>
                              <div className="text-purple-400">{t.canaryGroup}</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pool action hint (only when not healthy) */}
        {pool && pool.status !== "healthy" && (
          <div className={`rounded-xl border p-4 text-sm ${poolStatusBg(pool.status)}`}>
            <div className={`font-semibold mb-1 ${poolStatusColor(pool.status)}`}>Pool Action Required</div>
            <div className="text-zinc-200 font-mono text-xs">{pool.action}</div>
          </div>
        )}

      </div>
    </div>
  );
}
