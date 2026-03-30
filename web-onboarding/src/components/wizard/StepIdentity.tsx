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
    { id: "candle-maker", name: "Candle / Crafts", icon: "🕯️" },
    { id: "gig-economy", name: "Gig / Freelance", icon: "🎸" },
    { id: "lawyer", name: "Legal Services", icon: "⚖️" },
    { id: "plumber", name: "Home Services", icon: "🔧" },
    { id: "sales-tiger", name: "Sales Professional", icon: "📈" },
];

export default function StepIdentity({ state, updateState, onNext }: IdentityProps) {
    const [localState, setLocalState] = useState(state);

    const handleContinue = () => {
        if (!localState.nicheId || !localState.yourName || !localState.email || !localState.botName) return;
        const nicheName = NICHES.find(n => n.id === localState.nicheId)?.name || "Agent";
        updateState({ ...localState, nicheName });
        onNext();
    };

    const canProceed = !!(localState.nicheId && localState.yourName && localState.email && localState.botName);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Identity &amp; Niche</h3>
                <p className="text-white/90 text-lg">Who are you, and what is your Tiger&apos;s mission?</p>
            </div>

            <div className="space-y-6 flex-1">
                {/* Niche Selection */}
                <div className="space-y-3">
                    <label className="text-base font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Target className="w-4 h-4" /> Select Your Industry
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {NICHES.map((n) => (
                            <button
                                key={n.id}
                                onClick={() => setLocalState({ ...localState, nicheId: n.id })}
                                className={cn(
                                    "p-3 rounded-xl border font-bold transition-all flex flex-col items-center gap-1",
                                    localState.nicheId === n.id
                                        ? "bg-primary text-black border-primary"
                                        : "bg-white/5 border-white/20 text-white hover:border-white/40 hover:text-white"
                                )}
                            >
                                <span className="text-2xl">{n.icon}</span>
                                <span className="text-xs uppercase truncate w-full text-center leading-tight">{n.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-base font-bold text-white uppercase tracking-widest">Your Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/80" />
                            <input
                                type="text"
                                value={localState.yourName}
                                onChange={(e) => setLocalState({ ...localState, yourName: e.target.value })}
                                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                                tabIndex={1}
                                className="w-full bg-black/40 border border-white/30 rounded-xl px-4 py-3 pl-11 text-base text-white placeholder:text-white/70 focus:border-primary outline-none min-h-[48px] select-text cursor-text"
                                placeholder="e.g. Brent Bryson"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-base font-bold text-white uppercase tracking-widest">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/80" />
                            <input
                                type="email"
                                value={localState.email}
                                onChange={(e) => setLocalState({ ...localState, email: e.target.value })}
                                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                                tabIndex={2}
                                className="w-full bg-black/40 border border-white/30 rounded-xl px-4 py-3 pl-11 text-base text-white placeholder:text-white/70 focus:border-primary outline-none min-h-[48px] select-text cursor-text"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-base font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Bot className="w-4 h-4" /> Agent Display Name
                    </label>
                    <div className="relative">
                        <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/80" />
                        <input
                            type="text"
                            value={localState.botName}
                            onChange={(e) => setLocalState({ ...localState, botName: e.target.value })}
                            style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                            tabIndex={3}
                            className="w-full bg-black/40 border border-white/30 rounded-xl px-4 py-3 pl-11 text-base text-white font-bold placeholder:text-white/70 focus:border-primary outline-none min-h-[48px] select-text cursor-text"
                            placeholder="e.g. Prospect Scout"
                        />
                    </div>
                    <p className="text-sm text-white/90 italic">This is how your agent will introduce itself to prospects.</p>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleContinue}
                    disabled={!canProceed}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2 text-base">
                        Next: Connect Channel
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
