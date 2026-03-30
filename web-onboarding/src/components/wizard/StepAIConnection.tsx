"use client";

import { useState } from "react";
import { ArrowRight, Trash2, Key, Info, Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WizardState, AIKeyConfig } from "../OnboardingModal";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/config";

interface AIConnectionProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

const PROVIDERS = [
    { id: "google",      name: "Gemini",      icon: "💎", url: "https://aistudio.google.com/apikey",              model: "gemini-2.0-flash",      free: true,  help: "Free tier available. Get a key at Google AI Studio in under 60 seconds." },
    { id: "openai",      name: "OpenAI",       icon: "🧠", url: "https://platform.openai.com/api-keys",            model: "gpt-4o-mini",           free: false, help: "Industry standard. Needs credits loaded on your account." },
    { id: "grok",        name: "Grok",         icon: "✖️", url: "https://console.x.ai/",                           model: "grok-2-1212",           free: false, help: "Real-time X/Twitter data access. Great for social selling." },
    { id: "openrouter",  name: "OpenRouter",   icon: "🌐", url: "https://openrouter.ai/keys",                      model: "openai/gpt-4o-mini",    free: true,  help: "One key unlocks Llama, Mistral, and 50+ models. Free tier available." },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];

function detectProvider(key: string): ProviderId | null {
    if (key.startsWith("AIza"))    return "google";
    if (key.startsWith("xai-"))   return "grok";
    if (key.startsWith("sk-or-")) return "openrouter";
    if (key.startsWith("sk-"))    return "openai";
    return null;
}

type InstallState = "idle" | "validating" | "success" | "error";

export default function StepAIConnection({ state, updateState, onNext }: AIConnectionProps) {
    const [selectedProvider, setSelectedProvider] = useState<ProviderId>("google");
    const [tempKey, setTempKey] = useState("");
    const [installState, setInstallState] = useState<InstallState>("idle");
    const [installError, setInstallError] = useState("");
    const [detectedHint, setDetectedHint] = useState("");

    const maxKeys = 2;
    const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)!;

    const handleKeyChange = (value: string) => {
        setTempKey(value);
        setInstallState("idle");
        setInstallError("");

        const detected = detectProvider(value.trim());
        if (detected && detected !== selectedProvider) {
            setSelectedProvider(detected);
            const name = PROVIDERS.find(p => p.id === detected)!.name;
            setDetectedHint(`${name} key detected — provider auto-selected`);
        } else if (!detected) {
            setDetectedHint("");
        }
    };

    const handleInstall = async () => {
        const key = tempKey.trim();
        if (!key || state.aiKeys.length >= maxKeys) return;

        setInstallState("validating");
        setInstallError("");

        try {
            let sessionToken: string | undefined;
            try { sessionToken = sessionStorage.getItem("tc_session") ?? undefined; } catch { /* ignore */ }

            const response = await fetch(`${API_BASE}/wizard/validate-key`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {}),
                },
                body: JSON.stringify({
                    botId: state.botId,
                    keys: [{ provider: selectedProvider, key, model: currentProvider.model }],
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.valid) {
                const detail = data.details?.find((d: any) => d.status === "error");
                throw new Error(detail?.error || "Key validation failed. Double-check and try again.");
            }

            const label = state.aiKeys.length === 0
                ? `${currentProvider.name} — Primary`
                : `${currentProvider.name} — Backup`;

            const newKey: AIKeyConfig = {
                provider: selectedProvider as any,
                key,
                model: currentProvider.model,
                label,
            };

            setInstallState("success");
            setDetectedHint("");
            updateState({ aiKeys: [...state.aiKeys, newKey] });

            setTimeout(() => {
                setTempKey("");
                setInstallState("idle");
            }, 1200);

        } catch (err: any) {
            setInstallState("error");
            setInstallError(err.message);
        }
    };

    const removeKey = (index: number) => {
        const newKeys = [...state.aiKeys];
        newKeys.splice(index, 1);
        updateState({ aiKeys: newKeys });
    };

    const slotLabel = state.aiKeys.length === 0 ? "Primary" : "Backup";

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 text-white">AI Power Core</h3>
                <p className="text-white/80 text-lg leading-relaxed">
                    Use any AI provider you already have. Add a Backup key and your agent automatically switches if your Primary ever hits a rate limit.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                {/* Left: Provider Selection & Key Input */}
                <div className="space-y-4">
                    {/* Provider tiles */}
                    <div className="grid grid-cols-2 gap-2">
                        {PROVIDERS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedProvider(p.id);
                                    setDetectedHint("");
                                    window.open(p.url, "_blank", "noopener,noreferrer");
                                }}
                                className={cn(
                                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center group",
                                    selectedProvider === p.id
                                        ? "bg-primary/10 border-primary text-white"
                                        : "bg-black/20 border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                                )}
                            >
                                <span className="text-2xl mb-1">{p.icon}</span>
                                <span className="text-sm font-bold uppercase tracking-tight">{p.name}</span>
                                {p.free
                                    ? <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded mt-1 font-bold">FREE</span>
                                    : <span className="text-xs text-white/40 mt-1">get key →</span>
                                }
                            </button>
                        ))}
                    </div>

                    {/* Config panel */}
                    <div className="space-y-3 bg-white/5 p-5 rounded-2xl border border-white/20">
                        <div>
                            <h4 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                                <Key className="w-4 h-4 text-primary" />
                                Installing: <span className="text-primary">{slotLabel}</span> — {currentProvider.name}
                            </h4>
                            <p className="text-base text-white/70">{currentProvider.help}</p>
                        </div>

                        <p className="text-sm text-white/60 text-center">
                            Tap a provider above to select it and open its key page.
                        </p>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={tempKey}
                                    onChange={(e) => handleKeyChange(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                                    placeholder={`Paste your ${currentProvider.name} key here...`}
                                    style={{ WebkitUserSelect: "text", userSelect: "text" }}
                                    tabIndex={0}
                                    disabled={installState === "validating" || installState === "success"}
                                    className={cn(
                                        "w-full bg-black/40 border rounded-lg px-4 py-3 text-base font-mono text-white outline-none select-text cursor-text transition-colors min-h-[48px] placeholder:text-white/40",
                                        installState === "error"   ? "border-red-500/60 focus:border-red-400" :
                                        installState === "success" ? "border-green-500/60" :
                                                                     "border-white/30 focus:border-primary"
                                    )}
                                />
                            </div>
                            <button
                                onClick={handleInstall}
                                disabled={!tempKey || state.aiKeys.length >= maxKeys || installState === "validating" || installState === "success"}
                                className="bg-primary text-black px-4 rounded-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all font-bold text-sm min-w-[80px] flex items-center justify-center gap-1 min-h-[48px]"
                            >
                                {installState === "validating" ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking</> :
                                 installState === "success"    ? <><Check className="w-4 h-4" /> Done!</> :
                                                                 "INSTALL"}
                            </button>
                        </div>

                        {detectedHint && installState === "idle" && (
                            <p className="text-base text-green-400 flex items-center gap-2 font-medium">
                                <Check className="w-4 h-4" /> {detectedHint}
                            </p>
                        )}

                        {installState === "error" && installError && (
                            <p className="text-base text-red-400 flex items-center gap-2 font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {installError}
                            </p>
                        )}

                        <p className="text-sm text-white/50 italic">
                            AES-256-GCM encrypted. Your key never leaves the hardened server environment.
                        </p>
                    </div>
                </div>

                {/* Right: Installed keys */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white/70 uppercase tracking-widest">
                        {state.aiKeys.length === 0
                            ? "Waiting for Primary Key"
                            : state.aiKeys.length === 1
                            ? "Primary Active — Backup Optional"
                            : "Primary + Backup Active ✓"}
                    </h4>

                    <div className="space-y-3 min-h-[180px]">
                        {state.aiKeys.length === 0 ? (
                            <div className="h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 text-center gap-3">
                                <Shield className="w-8 h-8 text-white/20" />
                                <div>
                                    <p className="text-base text-white/60 font-bold">No key installed yet</p>
                                    <p className="text-sm text-white/50 mt-1">Pick a provider on the left and paste your key.<br/>Gemini has a free tier if you need one.</p>
                                </div>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {state.aiKeys.map((k, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-black/40 flex items-center justify-center text-xl">
                                                {PROVIDERS.find(p => p.id === k.provider)?.icon}
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-white flex items-center gap-2">
                                                    {k.label}
                                                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Verified</span>
                                                </div>
                                                <div className="text-sm text-white/50 font-mono mt-0.5">****{k.key.slice(-4)}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeKey(i)}
                                            className="text-white/40 hover:text-red-400 transition-colors p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>

                    {state.aiKeys.length > 0 && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 items-start">
                            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-base text-blue-300 leading-relaxed">
                                {state.aiKeys.length === 2
                                    ? <><strong>Failover Active:</strong> If your Primary hits a rate limit, Backup takes over instantly. Zero downtime for your prospects.</>
                                    : <><strong>Optional:</strong> Add a Backup key from any provider. If your Primary ever rate-limits, your Tiger never misses a beat.</>
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
                <p className="text-sm text-white/60">
                    {state.aiKeys.length === 0
                        ? "You need at least one key to continue."
                        : state.aiKeys.length === 1
                        ? "Good to go. Backup key is optional but recommended."
                        : "Perfect. Your Tiger has a primary brain and a safety net."}
                </p>
                <button
                    onClick={onNext}
                    disabled={state.aiKeys.length === 0}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2 text-base">
                        Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
