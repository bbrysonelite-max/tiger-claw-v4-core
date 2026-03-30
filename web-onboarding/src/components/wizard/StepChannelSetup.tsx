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

    const hasLine = !!(state.lineToken?.trim() && state.lineChannelSecret?.trim());
    const canProceed = !!botUsername || hasLine;

    const handleNext = () => {
        if (!canProceed) {
            setProceedError("Configure at least one channel — Telegram or LINE.");
            return;
        }
        setProceedError("");
        onNext();
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Connect Your Channel</h3>
                <p className="text-white/90 text-lg">Configure Telegram, LINE, or both. At least one channel is required.</p>
            </div>

            <div className="flex flex-col gap-5 flex-1">
                {/* Telegram BYOB */}
                <div className={cn(
                    "flex flex-col p-6 rounded-2xl border transition-all",
                    botUsername
                        ? "bg-[#0088cc]/5 border-[#0088cc]/50"
                        : "bg-black/40 border-white/20"
                )}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 bg-[#0088cc]/10 rounded-xl flex items-center justify-center border border-[#0088cc]/20">
                            <Send className="h-6 w-6 text-[#0088cc]" />
                        </div>
                        <a
                            href="https://t.me/botfather"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1 font-bold"
                        >
                            OPEN BOTFATHER <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-xl font-bold text-white">Telegram Bot</h4>
                        <span className="text-xs text-white/80 font-bold uppercase tracking-widest border border-white/20 rounded px-1.5 py-0.5">Optional</span>
                    </div>

                    <p className="text-base text-white/90 mb-4 leading-relaxed">
                        1. Open{" "}
                        <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline font-bold">
                            @BotFather
                        </a>{" "}
                        in Telegram&nbsp;&nbsp;→&nbsp;&nbsp;
                        2. Send <code className="bg-white/10 px-1.5 py-0.5 rounded">/newbot</code>&nbsp;&nbsp;→&nbsp;&nbsp;
                        3. Choose a name and username&nbsp;&nbsp;→&nbsp;&nbsp;
                        4. Copy the <strong className="text-white">HTTP API token</strong>
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
                            className="w-full bg-black/40 border border-white/30 rounded-lg px-4 py-3 text-base text-white placeholder:text-white/70 focus:border-[#0088cc]/70 outline-none pr-12 min-h-[48px]"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {validating && <Loader2 className="w-5 h-5 text-white/80 animate-spin" />}
                            {!validating && botUsername && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                            {!validating && validationError && <AlertCircle className="w-5 h-5 text-red-400" />}
                        </div>
                    </div>

                    {botUsername && (
                        <p className="text-base text-green-400 mt-2 flex items-center gap-2 font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            @{botUsername} — Verified. Ready to hunt.
                        </p>
                    )}
                    {validationError && (
                        <p className="text-base text-red-400 mt-2 font-medium">{validationError}</p>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-white/70 uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-3 h-3 text-[#0088cc]" /> AES-256-GCM Encrypted at Rest
                    </div>
                </div>

                {/* LINE */}
                <div className={cn(
                    "flex flex-col p-5 rounded-2xl border transition-all",
                    hasLine ? "bg-[#00B900]/5 border-[#00B900]/50" : "bg-black/40 border-white/20 hover:border-white/30"
                )}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 bg-[#00B900]/10 rounded-xl flex items-center justify-center border border-[#00B900]/20">
                            <MessageCircle className="h-5 w-5 text-[#00B900]" />
                        </div>
                        <a
                            href="https://developers.line.biz/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1 font-bold"
                        >
                            GET CREDENTIALS <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                        <h4 className="text-xl font-bold text-white">LINE</h4>
                        <span className="text-xs text-white/80 font-bold uppercase tracking-widest border border-white/20 rounded px-1.5 py-0.5">Optional</span>
                    </div>
                    <input
                        type="password"
                        value={state.lineToken || ""}
                        onChange={(e) => { updateState({ lineToken: e.target.value }); setProceedError(""); }}
                        placeholder="Channel Access Token"
                        className="w-full bg-black/40 border border-white/30 rounded-lg px-4 py-3 text-base text-white placeholder:text-white/70 focus:border-[#00B900]/70 outline-none mb-3 min-h-[48px]"
                    />
                    <input
                        type="password"
                        value={state.lineChannelSecret || ""}
                        onChange={(e) => { updateState({ lineChannelSecret: e.target.value }); setProceedError(""); }}
                        placeholder="Channel Secret"
                        className="w-full bg-black/40 border border-white/30 rounded-lg px-4 py-3 text-base text-white placeholder:text-white/70 focus:border-[#00B900]/70 outline-none mb-3 min-h-[48px]"
                    />
                    {hasLine && (
                        <p className="text-base text-green-400 font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" /> LINE configured — APAC market ready.
                        </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-white/70 uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-3 h-3 text-[#00B900]" /> AES-256-GCM Encrypted at Rest
                    </div>
                </div>
            </div>

            {proceedError && (
                <p className="mt-4 text-base text-orange-400 text-center font-bold">{proceedError}</p>
            )}

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleNext}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2 text-base">
                        Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
