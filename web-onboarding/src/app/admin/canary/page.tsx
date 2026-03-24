"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, RefreshCw, LogOut, CheckCircle2, AlertCircle, Bot, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.tigerclaw.io';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isCanary: boolean;
  botUsername: string;
  status: string;
  onboardingComplete: boolean;
  onboardingPhase: string;
  lastActive: string;
}

export default function CanaryDashboard() {
  const [token, setToken] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const savedToken = localStorage.getItem("tiger_admin_token");
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      fetchTenants(savedToken);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    localStorage.setItem("tiger_admin_token", token);
    setIsAuthenticated(true);
    fetchTenants(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("tiger_admin_token");
    setToken("");
    setIsAuthenticated(false);
    setTenants([]);
  };

  const fetchTenants = async (authToken: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/dashboard/tenants`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Invalid Admin Token");
        }
        throw new Error(`Error: ${res.statusText}`);
      }
      
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-white/10 p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center border border-primary/50 text-primary shadow-[0_0_15px_rgba(255,102,0,0.5)]">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Tiger Fleet Command</h1>
          <p className="text-white/50 text-center mb-8 text-sm">Authorized personnel only.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter ADMIN_TOKEN"
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              Authenticate
            </button>
            {error && <p className="text-red-400 text-sm text-center pt-2">{error}</p>}
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Canary Fleet Dashboard
            </h1>
            <p className="text-white/50 mt-1">Real-time status of all active and onboarding Tiger Claw tenants.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchTenants(token)}
              disabled={loading}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Unified Table */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-white/50 text-sm">
                  <th className="px-6 py-4 font-medium">Tenant</th>
                  <th className="px-6 py-4 font-medium">Telegram Bot</th>
                  <th className="px-6 py-4 font-medium">Onboarding Status</th>
                  <th className="px-6 py-4 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map((tenant) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={tenant.id} 
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        {tenant.name}
                        {tenant.isCanary && (
                          <span className="px-2 py-0.5 text-[10px] uppercase font-black bg-primary/20 text-primary border border-primary/30 rounded-full">
                            Canary
                          </span>
                        )}
                      </div>
                      <div className="text-white/40 text-xs mt-1 font-mono">{tenant.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Bot className="w-4 h-4 text-white/40" />
                        {tenant.botUsername}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tenant.onboardingComplete ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Complete
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium">
                          <AlertCircle className="w-4 h-4" />
                          Incomplete <span className="text-yellow-500/50 hidden sm:inline">({tenant.onboardingPhase})</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <Activity className="w-4 h-4 text-white/40" />
                        {tenant.lastActive === 'Never' ? 'Never' : new Date(tenant.lastActive).toLocaleString()}
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {tenants.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-white/40">
                      No tenants found. The fleet is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
