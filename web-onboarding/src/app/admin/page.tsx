"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Activity, Users, MessageCircle, DollarSign, Database, 
    RefreshCw, Shield, AlertTriangle, CheckCircle2, 
    Bot, Clock, ArrowRight, Loader2, Key, Globe,
    Search, Filter, ChevronDown, ChevronRight, Zap
} from "lucide-react";
import { API_BASE } from "@/lib/config";

// --- Types ---

interface PipelineHealth {
    totalFacts: number;
    factsLast24h: number;
    factsLast7d: number;
    oldestFact: string | null;
    newestFact: string | null;
    byVertical: { vertical: string; count: number; newest: string }[];
    byRegion: { region: string; count: number; newest: string }[];
    staleVerticals: string[];
    healthy: boolean;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: string;
    botUsername: string;
    onboardingPhase: string;
    lastActive: string;
    isCanary: boolean;
    messages24h?: number;
}

interface AdminMetrics {
    activeTenants: number;
    foundingMembers: number;
    totalHiveSignals: number;
    totalHiveEvents: number;
    newAgentsToday: number;
}

interface ConversationStats {
    totalLast24h: number;
    totalToday: number;
    byTenant: { tenantId: string; messagesLast24h: number }[];
}

interface CostStats {
    totals: {
        platformCalls: number;
        byokCalls: number;
        emergencyCalls: number;
        estimatedCost: string;
    };
}

// --- Main Component ---

export default function AdminDashboard() {
    const [token, setToken] = useState<string>(() => {
        if (typeof window !== "undefined") return localStorage.getItem("tc_admin_token") ?? "";
        return "";
    });
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Data states
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [pipeline, setPipeline] = useState<PipelineHealth | null>(null);
    const [tenants, setTenants] = useState<Tenant[] | null>(null);
    const [convos, setConvos] = useState<ConversationStats | null>(null);
    const [costs, setCosts] = useState<CostStats | null>(null);
    const [platformHealth, setPlatformHealth] = useState<{ name: string; status: "ok" | "error"; message: string }[] | null>(null);

    const fetchData = useCallback(async (authToken: string) => {
        setLoading(true);
        setError(null);
        try {
            const headers = { "Authorization": `Bearer ${authToken}` };
            
            // Fetch all required admin data in parallel
            const [mRes, pRes, tRes, cRes, costRes] = await Promise.all([
                fetch(`${API_BASE}/admin/metrics`, { headers }),
                fetch(`${API_BASE}/admin/pipeline/health`, { headers }),
                fetch(`${API_BASE}/admin/dashboard/tenants`, { headers }),
                fetch(`${API_BASE}/admin/conversations`, { headers }),
                fetch(`${API_BASE}/admin/costs`, { headers }),
            ]);

            if (mRes.status === 401) {
                setIsAuthorized(false);
                throw new Error("Invalid admin token");
            }

            if (!mRes.ok || !pRes.ok || !tRes.ok || !cRes.ok || !costRes.ok) {
                throw new Error("Failed to fetch one or more dashboard metrics");
            }

            const [m, p, t, c, cost] = await Promise.all([
                mRes.json(), pRes.json(), tRes.json(), cRes.json(), costRes.json()
            ]);

            setMetrics(m);
            setPipeline(p);

            // Platform health — fire separately, never block main dashboard load
            fetch(`${API_BASE}/admin/platform-health`, { headers })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.services) setPlatformHealth(data.services); })
                .catch(() => {});
            
            // Merge conversation stats into tenant data for the fleet table
            const tenantList = t.tenants.map((tenant: any) => ({
                ...tenant,
                messages24h: c.byTenant.find((s: any) => s.tenantId === tenant.id)?.messagesLast24h || 0
            }));
            setTenants(tenantList);
            
            setConvos(c);
            setCosts(cost);
            setLastUpdated(new Date());
            setIsAuthorized(true);
            localStorage.setItem("tc_admin_token", authToken);
        } catch (err: any) {
            console.error("Dashboard fetch error:", err);
            setError(err.message);
            if (err.message === "Invalid admin token") {
                setIsAuthorized(false);
                localStorage.removeItem("tc_admin_token");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-login if token saved, auto-refresh every 5 minutes
    useEffect(() => {
        if (token && !isAuthorized) {
            fetchData(token);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isAuthorized && token) {
            const interval = setInterval(() => fetchData(token), 300000);
            return () => clearInterval(interval);
        }
    }, [isAuthorized, token, fetchData]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!token.trim()) return;
        fetchData(token.trim());
    };

    // --- Auth Gate ---
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 selection:bg-primary selection:text-black">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2rem] p-10 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
                    
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-8 mx-auto">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    
                    <h1 className="text-3xl font-black text-center text-white mb-2 tracking-tight">Operator Center</h1>
                    <p className="text-white/40 text-center text-sm mb-10 leading-relaxed px-4">
                        Secure command center for Tiger Claw v4. Enter your admin token to manage the fleet.
                    </p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative group">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="password" 
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Admin Token"
                                className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                                autoFocus
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-black font-bold py-4 rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                            Authorize Access
                        </button>
                    </form>
                    
                    <AnimatePresence>
                        {error && (
                            <motion.p 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-red-400 text-center text-sm mt-6 font-medium"
                            >
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-primary selection:text-black">
            {/* Header */}
            <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-2xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-black text-xl tracking-tight leading-none">Operator Command</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-bold">System Online · v4.1</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        {lastUpdated && (
                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-white/20 text-[10px] font-bold uppercase tracking-wider">Last Sync</span>
                                <span className="text-white/40 text-xs font-mono">{lastUpdated.toLocaleTimeString()}</span>
                            </div>
                        )}
                        <button 
                            onClick={() => fetchData(token)}
                            disabled={loading}
                            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
                            title="Manual Refresh"
                        >
                            <RefreshCw className={`h-5 w-5 text-white/60 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-16">
                
                {/* Section 1: Platform Pulse */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Activity className="h-4 w-4 text-blue-400" />
                        </div>
                        <h2 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Platform Pulse</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard
                            title="Active Agents"
                            value={metrics?.activeTenants?.toString() || "—"}
                            icon={<Users className="h-6 w-6 text-blue-400" />}
                            trend={`+${metrics?.newAgentsToday || 0} today`}
                        />
                        <StatCard 
                            title="Messages (24h)"
                            value={convos?.totalLast24h?.toLocaleString() || "—"}
                            icon={<MessageCircle className="h-6 w-6 text-green-400" />}
                            trend={`${convos?.totalToday || 0} Today`}
                        />
                        <StatCard 
                            title="Platform Cost (24h)"
                            value={costs?.totals?.estimatedCost || "—"}
                            icon={<DollarSign className="h-6 w-6 text-amber-400" />}
                            trend={`${costs?.totals?.platformCalls || 0} API Calls`}
                        />
                        <StatCard 
                            title="Mine Status"
                            value={pipeline?.healthy ? "Healthy" : "Stale"}
                            icon={
                                <div className="relative flex h-3 w-3">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pipeline?.healthy ? 'bg-green-500' : 'bg-red-500'} opacity-75`} />
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${pipeline?.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>
                            }
                            subtitle={pipeline?.newestFact ? `Sync: ${timeAgo(pipeline.newestFact)}` : "No data"}
                            color={pipeline?.healthy ? "green" : "red"}
                        />
                    </div>
                </section>

                {/* Section 2: Fleet Dashboard */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <h2 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Fleet Deployment</h2>
                        </div>
                        <div className="text-white/20 text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                            {tenants?.length || 0} Registered Units
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Identity</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 text-center">CH</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Vertical</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Last Active</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 text-right">Burn (24h)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {tenants?.map((t) => (
                                        <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm group-hover:text-primary transition-colors">{t.name}</span>
                                                    <span className="text-[10px] font-mono text-white/30 tracking-tight">{t.slug}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <StatusBadge status={t.status} phase={t.onboardingPhase} />
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                {t.botUsername !== 'Unassigned' ? (
                                                    <div className="h-6 w-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto" title={t.botUsername}>
                                                        <span className="text-[10px]">✈️</span>
                                                    </div>
                                                ) : <span className="text-white/10">—</span>}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                    {t.slug.split('-').slice(0, 2).join(' ')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-white/40 text-xs">
                                                    <Clock className="h-3 w-3 opacity-50" />
                                                    {t.lastActive !== 'Never' ? timeAgo(t.lastActive) : 'Inactive'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className={`font-mono font-bold text-sm ${t.messages24h && t.messages24h > 0 ? 'text-primary' : 'text-white/10'}`}>
                                                    {t.messages24h || 0}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Section 3: Data Mine */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <Database className="h-4 w-4 text-amber-400" />
                        </div>
                        <h2 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Intelligence Moat</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Summary Card */}
                        <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-10 space-y-10 shadow-2xl backdrop-blur-sm flex flex-col justify-between">
                            <div className="space-y-2">
                                <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">Total Refined Facts</p>
                                <p className="text-6xl font-black text-white tracking-tighter tabular-nums">
                                    {pipeline?.totalFacts?.toLocaleString() || "—"}
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">Last 24h</p>
                                    <p className={`text-2xl font-black tabular-nums ${pipeline?.factsLast24h && pipeline.factsLast24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        +{pipeline?.factsLast24h?.toLocaleString() || "0"}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">Last 7d</p>
                                    <p className="text-2xl font-black text-white tabular-nums">
                                        {pipeline?.factsLast7d?.toLocaleString() || "0"}
                                    </p>
                                </div>
                            </div>
                            
                            {pipeline?.staleVerticals && pipeline.staleVerticals.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-red-500/5 border border-red-500/20 rounded-[1.5rem] p-6 flex items-start gap-4"
                                >
                                    <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Stale Pipelines Detected</p>
                                        <p className="text-white/40 text-[11px] leading-relaxed">
                                            {pipeline.staleVerticals.slice(0, 3).join(", ")} {pipeline.staleVerticals.length > 3 ? `+${pipeline.staleVerticals.length - 3} more` : ""} require manual harvest.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Chart / List Card */}
                        <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-sm">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-10 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                Vertical Saturation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                {pipeline?.byVertical?.slice(0, 10).map((v) => (
                                    <div key={v.vertical} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-white/70 font-bold text-xs">{v.vertical}</span>
                                                <span className="text-white/20 text-[9px] font-mono">NEWEST: {timeAgo(v.newest)}</span>
                                            </div>
                                            <span className="text-white font-mono text-xs font-bold">{v.count.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-white/[0.03] h-1.5 rounded-full overflow-hidden border border-white/5">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (v.count / (pipeline.totalFacts || 1)) * 500)}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="bg-gradient-to-r from-primary/40 to-primary h-full rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Platform Health */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <Shield className="h-4 w-4 text-red-400" />
                        </div>
                        <h2 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Platform Services</h2>
                        {platformHealth && (
                            <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
                                platformHealth.every(s => s.status === "ok")
                                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}>
                                {platformHealth.filter(s => s.status === "ok").length}/{platformHealth.length} OK
                            </span>
                        )}
                    </div>
                    <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] overflow-hidden">
                        {!platformHealth ? (
                            <div className="p-8 text-white/20 text-xs font-mono text-center">Checking services...</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {platformHealth.map(svc => (
                                    <div key={svc.name} className="flex items-center gap-4 px-8 py-4">
                                        <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                                            {svc.status === "ok" ? (
                                                <>
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-50" />
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                                                </>
                                            ) : (
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                            )}
                                        </div>
                                        <span className="text-[11px] font-black text-white/60 uppercase tracking-widest w-40 flex-shrink-0">{svc.name}</span>
                                        <span className={`text-[10px] font-mono ${svc.status === "ok" ? "text-white/30" : "text-red-400"}`}>
                                            {svc.message}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Footer */}
                <footer className="pt-20 pb-20 border-t border-white/5 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3 grayscale opacity-30">
                        <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center">
                            <Shield className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Tiger Claw Intelligence</span>
                    </div>
                    <p className="text-white/10 text-[9px] text-center font-mono max-w-sm leading-relaxed uppercase tracking-widest">
                        Stateless Architecture · Multi-Region Deployment · Cross-Tenant Hive Logic · Prop: BotCraft Works 2026
                    </p>
                    <button 
                        onClick={() => { setIsAuthorized(false); setToken(""); }}
                        className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                        <Shield className="h-3 w-3" />
                        De-authorize Command Center
                    </button>
                </footer>
            </main>
        </div>
    );
}

// --- Sub-components ---

function StatCard({ title, value, icon, trend, subtitle, color }: { 
    title: string, 
    value: string, 
    icon: React.ReactNode, 
    trend?: string, 
    subtitle?: string,
    color?: 'green' | 'red' | 'blue' | 'amber'
}) {
    return (
        <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-8 shadow-lg hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">{title}</span>
                <div className={`h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/5`}>
                    {icon}
                </div>
            </div>
            <div className={`text-4xl font-black tracking-tighter ${color === 'red' ? 'text-red-500' : color === 'green' ? 'text-green-400' : 'text-white'}`}>
                {value}
            </div>
            {trend && (
                <div className="mt-4 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider">{trend}</span>
                </div>
            )}
            {subtitle && <div className="text-white/20 text-[10px] font-medium mt-1 uppercase tracking-widest">{subtitle}</div>}
        </div>
    );
}

function StatusBadge({ status, phase }: { status: string, phase: string }) {
    const isComplete = status === 'active' || status === 'live' || phase === 'complete';
    
    if (isComplete) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/5 border border-green-500/10 text-[9px] font-black uppercase tracking-wider text-green-500/70">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Deployed
            </span>
        );
    }
    
    if (status === 'suspended') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/5 border border-red-500/10 text-[9px] font-black uppercase tracking-wider text-red-500/70">
                <AlertTriangle className="h-2.5 w-2.5" />
                Suspended
            </span>
        );
    }

    return (
        <span className="inline-flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/5 border border-amber-500/10 text-[9px] font-black uppercase tracking-wider text-amber-500/70">
                <Clock className="h-2.5 w-2.5" />
                {status.replace('_', ' ')}
            </span>
            <span className="text-[8px] font-mono text-white/20 pl-1">PHASE: {phase}</span>
        </span>
    );
}

function timeAgo(date: string | Date | null): string {
    if (!date) return "N/A";
    const d = typeof date === 'string' ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "JUST NOW";
    if (mins < 60) return `${mins}M AGO`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}H AGO`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}D AGO`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
