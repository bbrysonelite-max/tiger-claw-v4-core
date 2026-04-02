"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, ArrowRight, MessageCircle } from "lucide-react";
import type { WizardState } from "../OnboardingModal";
import { motion, AnimatePresence } from "framer-motion";

interface PostPaymentSuccessProps {
    state: WizardState;
    onClose: () => void;
}

import { API_BASE } from "@/lib/config";

const STEPS = [
    { label: "Subscription confirmed", detail: "Payment verified — you're in." },
    { label: "Bot registered", detail: "Tiger has a name. Your token is live." },
    { label: "ICP loaded", detail: "Tiger knows exactly who to hunt for." },
    { label: "First hunt begins at dawn", detail: "Morning report incoming at 7 AM UTC." },
];

// Each step shows for ~7 seconds. Total runtime: 28s — well inside the 30s provisioning window.
const STEP_INTERVAL_MS = 7000;

export default function PostPaymentSuccess({ state, onClose }: PostPaymentSuccessProps) {
    const [status, setStatus] = useState<"deploying" | "live" | "timeout" | "error">("deploying");
    const [botUsername, setBotUsername] = useState<string | null>(null);
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    // Animate through steps while deploying
    useEffect(() => {
        if (status !== "deploying") return;
        if (currentStep >= STEPS.length - 1) return;
        const t = setTimeout(() => setCurrentStep((s) => s + 1), STEP_INTERVAL_MS);
        return () => clearTimeout(t);
    }, [currentStep, status]);

    // Poll /wizard/bot-status
    useEffect(() => {
        const botId = state.botId;
        if (!botId) { setStatus("error"); return; }

        let retries = 0;
        const MAX_RETRIES = 40; // 2 minutes
        let isMounted = true;
        let pollTimer: ReturnType<typeof setTimeout>;

        const poll = async () => {
            if (!isMounted) return;
            try {
                const res = await fetch(`${API_BASE}/wizard/bot-status?botId=${encodeURIComponent(botId)}`);
                if (!isMounted) return;
                const data = await res.json();
                if (data.status === "live") {
                    setBotUsername(data.botUsername ?? null);
                    setTelegramLink(data.telegramLink ?? (data.botUsername ? `https://t.me/${data.botUsername}` : null));
                    if (data.tenantSlug) setDashboardUrl(`/dashboard?slug=${encodeURIComponent(data.tenantSlug)}`);
                    setStatus("live");
                    return;
                }
                if (data.status === "error") { setStatus("error"); return; }
            } catch { /* keep polling */ }
            if (!isMounted) return;
            retries++;
            if (retries < MAX_RETRIES) {
                pollTimer = setTimeout(poll, 3000);
            } else {
                setStatus("timeout");
            }
        };
        poll();
        return () => { isMounted = false; clearTimeout(pollTimer); };
    }, [state.botId]);

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
            {status === "live" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />
            )}

            {/* Icon */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative z-10 mb-6"
            >
                {status === "deploying" ? (
                    <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" />
                        <BotIcon />
                    </div>
                ) : (
                    <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center mx-auto text-black shadow-[0_0_50px_rgba(249,115,22,0.4)]">
                        <CheckCircle2 className="h-12 w-12" />
                    </div>
                )}
            </motion.div>

            <h2 className="text-3xl font-black mb-2 relative z-10 text-white">
                {status === "deploying" ? "Tiger is waking up." :
                 status === "live" ? "Agent Deployed" :
                 status === "timeout" ? "Still Deploying..." :
                 "Session Error"}
            </h2>

            {/* Deploying: step-by-step progress */}
            {status === "deploying" && (
                <div className="w-full max-w-sm mt-6 mb-4 relative z-10 space-y-3 text-left">
                    {STEPS.map((step, i) => {
                        const done = i < currentStep;
                        const active = i === currentStep;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: i <= currentStep ? 1 : 0.25, x: 0 }}
                                transition={{ duration: 0.4, delay: i === currentStep ? 0 : 0 }}
                                className="flex items-start gap-3"
                            >
                                <div className="mt-0.5 flex-shrink-0">
                                    {done ? (
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                    ) : active ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-white/20" />
                                    )}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${active ? "text-white" : done ? "text-white/70" : "text-white/30"}`}>
                                        {step.label}
                                    </p>
                                    <AnimatePresence>
                                        {active && (
                                            <motion.p
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="text-xs text-white/60 mt-0.5"
                                            >
                                                {step.detail}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Timeout / error copy */}
            {(status === "timeout" || status === "error") && (
                <p className="text-white/90 text-lg mb-8 max-w-md mx-auto relative z-10 !leading-relaxed">
                    {status === "timeout"
                        ? `Your agent is still being set up — check your email or refresh in a minute.`
                        : `We couldn't verify your session. Contact support if you were charged.`}
                </p>
            )}

            {/* Live state */}
            {status === "live" && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 border border-[#22c55e]/30 rounded-2xl p-8 relative w-full mb-8"
                >
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="h-16 w-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center border border-[#22c55e]/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                            <MessageCircle className="h-8 w-8 text-[#22c55e]" />
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-black text-2xl text-white flex items-center justify-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]"></span>
                                </span>
                                Agent Activated
                            </h4>
                            <p className="text-white/90 text-base">
                                Your Tiger is awake and waiting at <span className="text-[#22c55e] font-mono font-bold">@{botUsername}</span>
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 w-full">
                            <a
                                href={telegramLink ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-3 font-black text-lg py-5 px-8 rounded-2xl bg-[#22c55e] hover:bg-[#1eb04b] text-black transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_40px_rgba(34,197,94,0.3)]"
                            >
                                START CHAT ON TELEGRAM <ArrowRight className="h-6 w-6" />
                            </a>

                            {dashboardUrl && (
                                <a
                                    href={dashboardUrl}
                                    className="inline-flex items-center justify-center gap-2 font-bold py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/90 text-sm border border-white/10"
                                >
                                    Access Admin Dashboard
                                </a>
                            )}
                        </div>

                        <p className="text-[10px] text-white/70 uppercase tracking-[0.2em] font-bold text-center mt-2">
                            Send /start to your bot
                        </p>

                        <div className="w-full mt-6 pt-6 border-t border-white/10 text-left">
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-primary mb-4 flex items-center justify-between">
                                Optional Enhancements
                                <span className="text-white/70 text-[9px] bg-white/5 px-2 py-1 rounded">Do this later</span>
                            </h5>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#25D366]"></div> WhatsApp Outreach
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <p className="text-xs text-white/80">Deploy a mirrored brain directly into any WhatsApp number.</p>
                                </div>
                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#00B900]"></div> LINE Official Account
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <p className="text-xs text-white/80">Capture the Asian market with LINE OA integration.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {status === "live" && (
                <button
                    onClick={() => { if (dashboardUrl) { window.location.href = dashboardUrl; } else { onClose(); } }}
                    className="text-white/70 hover:text-white transition-colors text-sm font-semibold uppercase tracking-widest relative z-10 hover:underline"
                >
                    Or close this window and go to Dashboard
                </button>
            )}
        </div>
    );
}

function BotIcon() {
    return (
        <svg className="h-10 w-10 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    );
}
