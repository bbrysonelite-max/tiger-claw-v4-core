"use client";

import { useState } from "react";
import { ExternalLink, ArrowRight, Trash2, Key, Info, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WizardState, AIKeyConfig } from "../OnboardingModal";
import { cn } from "@/lib/utils";

interface AIConnectionProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

const PROVIDERS = [
    { id: "google", name: "Gemini", icon: "💎", url: "https://aistudio.google.com/apikey", model: "gemini-2.0-flash", free: true, help: "Free tier available. Fastest hatching." },
    { id: "openai", name: "OpenAI", icon: "🧠", url: "https://platform.openai.com/api-keys", model: "gpt-4o-mini", free: false, help: "Industry standard. Needs credits." },
    { id: "anthropic", name: "Anthropic", icon: "🗿", url: "https://console.anthropic.com/settings/keys", model: "claude-3-5-haiku", free: false, help: "High intelligence. Great for niche tuning." },
    { id: "grok", name: "Grok", icon: "✖️", url: "https://console.x.ai/", model: "grok-2-1212", free: false, help: "Real-time X data access." },
    { id: "openrouter", name: "OpenRouter", icon: "🌐", url: "https://openrouter.ai/keys", model: "auto", free: true, help: "Access Llama & more via one key." },
    { id: "kimi", name: "Kimi", icon: "🌙", url: "https://platform.moonshot.cn/", model: "kimi-latest", free: false, help: "Specialized for Asian markets." },
] as const;

export default function StepAIConnection({ state, updateState, onNext }: AIConnectionProps) {
    const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[number]["id"]>("google");
    const [tempKey, setTempKey] = useState("");

    const maxKeys = 2;

    const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)!;

    const addKey = () => {
        if (!tempKey) return;
        const label = state.aiKeys.length === 0 ? `${currentProvider.name} — Primary` : `${currentProvider.name} — Backup`;
        const newKey: AIKeyConfig = {
            provider: selectedProvider as any,
            key: tempKey,
            model: currentProvider.model,
            label,
        };
        updateState({ aiKeys: [...state.aiKeys, newKey] });
        setTempKey("");
    };

    const removeKey = (index: number) => {
        const newKeys = [...state.aiKeys];
        newKeys.splice(index, 1);
        updateState({ aiKeys: newKeys });
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 text-white">AI Power Core</h3>
                <p className="text-white/50 text-base leading-relaxed">
                    Use any AI provider you already have. Add a Backup key and your agent automatically switches if your Primary ever hits a rate limit.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                    {/* Left: Provider Selection & Key Input */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-3">
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProvider(p.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center",
                                        selectedProvider === p.id 
                                            ? "bg-primary/10 border-primary text-white" 
                                            : "bg-black/20 border-white/5 text-white/40 hover:border-white/20"
                                    )}
                                >
                                    <span className="text-2xl mb-1">{p.icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">{p.name}</span>
                                    {p.free && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded mt-1">FREE OPTION</span>}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/10">
                            <div className="flex flex-col gap-1 mb-2">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Key className="w-4 h-4 text-primary" /> {currentProvider.name} Configuration
                                </h4>
                                <p className="text-[11px] text-white/40">{currentProvider.help}</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <a 
                                    href={currentProvider.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs hover:bg-primary/20 transition-all group"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> 
                                    GET YOUR {currentProvider.name.toUpperCase()} KEY HERE (OPENS NEW TAB)
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                </a>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tempKey}
                                        onChange={(e) => setTempKey(e.target.value)}
                                        placeholder={`Paste ${currentProvider.name} key...`}
                                        style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                                        tabIndex={0}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-mono focus:border-primary outline-none select-text cursor-text"
                                    />
                                    <button
                                        onClick={addKey}
                                        disabled={!tempKey || state.aiKeys.length >= maxKeys}
                                        className="bg-primary text-black px-4 rounded-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all font-bold text-xs"
                                    >
                                        INSTALL
                                    </button>
                                </div>
                            </div>
                            
                            <p className="text-[10px] text-white/30 italic">
                                Encryption: AES-256-GCM secured. Keys never leave the hardened environment.
                            </p>
                        </div>
                    </div>

                    {/* Right: Active Rotation / Config */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                            {state.aiKeys.length === 0 ? "No Keys Installed" : state.aiKeys.length === 1 ? "Primary Active — Backup Optional" : "Primary + Backup Active"}
                        </h4>
                        
                        <div className="space-y-3 min-h-[200px]">
                            {state.aiKeys.length === 0 ? (
                                <div className="h-full border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                                    <Shield className="w-8 h-8 text-white/10 mb-3" />
                                    <p className="text-sm text-white/20">No keys added yet.<br/>Your agent needs at least one brain.</p>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {state.aiKeys.map((k, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-black/40 flex items-center justify-center text-lg">
                                                    {PROVIDERS.find(p => p.id === k.provider)?.icon}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{k.label}</div>
                                                    <div className="text-[10px] text-white/40 font-mono">****{k.key.slice(-4)}</div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeKey(i)}
                                                className="text-white/20 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {state.aiKeys.length > 0 && (
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 items-start">
                                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                                    {state.aiKeys.length === 2
                                        ? <><strong>Failover Active:</strong> If your Primary key hits a rate limit, your Backup takes over automatically. Zero downtime.</>
                                        : <><strong>Add a Backup key</strong> from any provider to protect against rate limits and outages.</>
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end items-center">

                <button
                    onClick={onNext}
                    disabled={state.aiKeys.length === 0}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Continue to Launch <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
