"use client";

import { useState } from "react";
import { User, Mail, Bot, ArrowRight, Target } from "lucide-react";
import type { WizardState } from "../OnboardingModal";
import { cn } from "@/lib/utils";

interface IdentityProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

const NICHES = [
    { id: "network-marketer", name: "Network Marketing", icon: "🚀" },
    { id: "real-estate", name: "Real Estate", icon: "🏠" },
    { id: "health-wellness", name: "Health & Wellness", icon: "🌿" },
    { id: "airbnb-host", name: "Airbnb / STR", icon: "🔑" },
    { id: "baker", name: "Bakery / Food", icon: "🧁" },
    { id: "doctor", name: "Medical / Clinic", icon: "🩺" },
    { id: "gig-economy", name: "Gig / Freelance", icon: "🎸" },
    { id: "lawyer", name: "Legal Services", icon: "⚖️" },
    { id: "plumber", name: "Home Services", icon: "🔧" },
    { id: "sales-tiger", name: "Sales Professional", icon: "📈" },
    { id: "director-of-operations", name: "Director of Ops", icon: "🦅" },
    { id: "intelligence-specialist", name: "OSINT Researcher", icon: "🕵️" },
];

export default function StepIdentity({ state, updateState, onNext }: IdentityProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [localState, setLocalState] = useState(state);

    const handleContinue = async () => {
        if (!localState.yourName || !localState.email || !localState.botName) return;
        
        setLoading(true);
        setError("");

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.tigerclaw.io";
            // Strip any trailing slash
            const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
            
            const response = await fetch(`${base}/wizard/auth?email=${encodeURIComponent(localState.email)}`);
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error || "No purchase found. Please complete checkout on Stan Store first.");
            }

            const nicheName = NICHES.find(n => n.id === localState.nicheId)?.name || "Agent";
            // Save their botId which unlocks the rest of the flow!
            updateState({ ...localState, nicheName, botId: data.botId });
            onNext();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Identity & Niche</h3>
                <p className="text-white/50 text-base">Who are you, and what is your Tiger's mission?</p>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-pulse">
                    {error}
                </div>
            )}

            <div className="space-y-6 flex-1">
                {/* Niche Selection (Horizontal) */}
                <div className="space-y-3">
                    <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <Target className="w-3 h-3" /> Select Industry
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        {NICHES.map((n) => (
                            <button
                                key={n.id}
                                onClick={() => setLocalState({ ...localState, nicheId: n.id })}
                                className={cn(
                                    "p-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center gap-1",
                                    localState.nicheId === n.id 
                                        ? "bg-primary text-black border-primary" 
                                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                                )}
                            >
                                <span className="text-xl">{n.icon}</span>
                                <span className="text-[10px] uppercase truncate w-full text-center">{n.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 uppercase tracking-widest">Your Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="text"
                                value={localState.yourName}
                                onChange={(e) => setLocalState({ ...localState, yourName: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-10 text-sm focus:border-primary outline-none text-white"
                                placeholder="e.g. Brent Bryson"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 uppercase tracking-widest">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="email"
                                value={localState.email}
                                onChange={(e) => setLocalState({ ...localState, email: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-10 text-sm focus:border-primary outline-none text-white"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <Bot className="w-3 h-3" /> Agent Display Name
                    </label>
                    <div className="relative">
                        <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                            type="text"
                            value={localState.botName}
                            onChange={(e) => setLocalState({ ...localState, botName: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-10 text-sm focus:border-primary outline-none text-white font-bold"
                            placeholder="e.g. Prospect Scout"
                        />
                    </div>
                    <p className="text-[10px] text-white/20 italic italic">This is how your agent will introduce itself to prospects.</p>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleContinue}
                    disabled={!localState.yourName || !localState.email || !localState.botName || loading}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {loading ? "Authenticating..." : "Next: Configure AI"} 
                        {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </span>
                </button>
            </div>
        </div>
    );
}
