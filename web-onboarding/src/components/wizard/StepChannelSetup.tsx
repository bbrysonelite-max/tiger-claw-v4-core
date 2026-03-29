"use client";

import { useState, useEffect } from "react";
import { MessageCircle, ArrowRight, ShieldCheck, ExternalLink, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { WizardState } from "../OnboardingModal";
import { cn } from "@/lib/utils";

interface ChannelSetupProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

export default function StepChannelSetup({ state, updateState, onNext }: ChannelSetupProps) {
    const [validating, setValidating] = useState(false);
    const [botUsername, setBotUsername] = useState<string | null>(null);
    const [validationError, setValidationError] = useState("");
    const [proceedError, setProceedError] = useState("");

    useEffect(() => {
        const token = state.telegramBotToken?.trim();
        if (!token) {
            setBotUsername(null);
            setValidationError("");
            return;
        }

        const timer = setTimeout(async () => {
            setValidating(true);
            setBotUsername(null);
            setValidationError("");
            try {
                const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
                const data = await res.json();
                if (data.ok) {
                    setBotUsername(data.result.username);
                } else {
                    setValidationError("Invalid token — double-check it in @BotFather.");
                }
            } catch {
                setValidationError("Could not reach Telegram. Check your connection.");
            } finally {
                setValidating(false);
            }
        }, 700);

        return () => clearTimeout(timer);
    }, [state.telegramBotToken]);

    const handleNext = () => {
        if (!botUsername) {
            setProceedError("A Telegram bot token is required. Follow the steps above to get one.");
            return;
        }
        setProceedError("");
        onNext();
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Connect Your Telegram Bot</h3>
                <p className="text-white/50 text-base">Create a free bot with @BotFather in 60 seconds. Paste the token — Tiger Claw does the rest.</p>
            </div>

            <div className="flex flex-col gap-5 flex-1">
                {/* Telegram BYOB — Required */}
                <div className={cn(
                    "flex flex-col p-6 rounded-2xl border transition-all",
                    botUsername
                        ? "bg-[#0088cc]/5 border-[#0088cc]/50"
                        : "bg-black/40 border-white/10"
                )}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 bg-[#0088cc]/10 rounded-xl flex items-center justify-center border border-[#0088cc]/20">
                            <Send className="h-6 w-6 text-[#0088cc]" />
                        </div>
                        <a
                            href="https://t.me/botfather"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                        >
                            OPEN BOTFATHER <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-white">Telegram Bot</h4>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-widest border border-primary/30 rounded px-1.5 py-0.5">Required</span>
                    </div>

                    <p className="text-xs text-white/40 mb-4 leading-relaxed">
                        1. Open{" "}
                        <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline">
                            @BotFather
                        </a>{" "}
                        in Telegram&nbsp;&nbsp;→&nbsp;&nbsp;
                        2. Send <code className="bg-white/10 px-1 rounded">/newbot</code>&nbsp;&nbsp;→&nbsp;&nbsp;
                        3. Choose a name and username&nbsp;&nbsp;→&nbsp;&nbsp;
                        4. Copy the <strong className="text-white/70">HTTP API token</strong>
                    </p>

                    <div className="relative">
                        <input
                            type="password"
                            value={state.telegramBotToken || ""}
                            onChange={(e) => {
                                updateState({ telegramBotToken: e.target.value });
                                setProceedError("");
                            }}
                            placeholder="Paste bot token (e.g. 7654321:AAFxyz...)"
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white focus:border-[#0088cc]/50 outline-none pr-10"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {validating && <Loader2 className="w-4 h-4 text-white/30 animate-spin" />}
                            {!validating && botUsername && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                            {!validating && validationError && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </div>
                    </div>

                    {botUsername && (
                        <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            @{botUsername} — Verified. Ready to hunt.
                        </p>
                    )}
                    {validationError && (
                        <p className="text-xs text-red-400 mt-2">{validationError}</p>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-3 h-3 text-[#0088cc]" /> AES-256-GCM Encrypted at Rest
                    </div>
                </div>

                {/* Optional channels */}
                <div className="grid grid-cols-1 gap-4">
                    {/* LINE */}
                    <div className={cn(
                        "flex flex-col p-5 rounded-2xl border transition-all",
                        state.lineToken ? "bg-primary/5 border-primary" : "bg-black/40 border-white/10 hover:border-white/20"
                    )}>
                        <div className="flex items-start justify-between mb-3">
                            <div className="h-10 w-10 bg-[#00B900]/10 rounded-xl flex items-center justify-center border border-[#00B900]/20">
                                <MessageCircle className="h-5 w-5 text-[#00B900]" />
                            </div>
                            <a
                                href="https://developers.line.biz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                            >
                                GET TOKEN <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">LINE <span className="text-[10px] text-white/30 font-normal">Optional</span></h4>
                        <input
                            type="password"
                            value={state.lineToken || ""}
                            onChange={(e) => updateState({ lineToken: e.target.value })}
                            placeholder="Paste LINE Channel Token..."
                            className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-primary outline-none mb-2"
                        />
                        <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-bold">
                            <ShieldCheck className="w-3 h-3 text-[#00B900]" /> APAC Market Specialist
                        </div>
                    </div>
                </div>
            </div>

            {proceedError && (
                <p className="mt-4 text-sm text-red-400 text-center font-medium">{proceedError}</p>
            )}

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleNext}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
