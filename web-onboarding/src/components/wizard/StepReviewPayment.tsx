"use client";

import { useState } from "react";
import { CreditCard, Loader2, Zap, ArrowRight, Lock } from "lucide-react";
import type { WizardState } from "../OnboardingModal";

interface ReviewPaymentProps {
    state: WizardState;
    isDeploying: boolean;
    setIsDeploying: (v: boolean) => void;
    onLaunch: () => void;
    onNext: () => void;
}

import { API_BASE } from "@/lib/config";

export default function StepReviewPayment({ state, isDeploying, setIsDeploying, onLaunch, onNext }: ReviewPaymentProps) {
    const [error, setError] = useState("");

    const handleHatch = async () => {
        setError("");
        setIsDeploying(true);

        try {
            // Keys already validated at install time in StepAIConnection — skip re-validation here.
            // Transmit final wizard settings & Hatch Target
            const hatchResponse = await fetch(`${API_BASE}/wizard/hatch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    botId: state.botId,
                    name: state.botName || state.yourName, // Bot Display Name
                    email: state.email,
                    flavor: state.nicheId,
                    botToken: state.telegramBotToken || undefined,
                    lineToken: state.lineToken || undefined,
                    lineChannelSecret: state.lineChannelSecret || undefined,
                    customerProfile: state.customerProfile ?? undefined,
                })
            });

            const hatchData = await hatchResponse.json();
            if (!hatchResponse.ok || !hatchData.ok) {
                throw new Error(hatchData.error || "Failed to hatch agent.");
            }

            // Success! Proceed to the hatching spinner screen
            onLaunch();
            onNext();

        } catch (err: any) {
            setError(err.message);
            setIsDeploying(false);
        }
    };

    // Determine AI provider display
    const aiProvider = state.aiKeys.length > 0 ? (state.aiKeys[0].provider === 'openai' ? 'OpenAI' : 'Google Gemini') : 'None';
    const aiStatus = state.aiKeys.length > 0 ? 'Connected' : 'Not Connected';

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-3xl font-black mb-2 text-white italic">HATCH YOUR TIGER</h3>
                <p className="text-white/80 text-base">Your agent is configured and ready to hunt.</p>
            </div>

            <div className="space-y-6 flex-1">
                {/* Order Summary & Identity Card */}
                <div className="bg-black/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 bg-primary/5 text-center border-b border-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                        <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/30 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                            <Zap className="w-8 h-8 text-primary" />
                        </div>
                        <h4 className="text-xl font-black text-white">{state.botName}</h4>
                        <p className="text-primary font-mono text-xs uppercase tracking-[0.2em] mt-1">{state.nicheName} • Agent Core</p>
                    </div>

                    <div className="p-6 space-y-4">
                        <h4 className="text-base font-bold text-white uppercase tracking-widest flex items-center justify-between mb-2">
                            Order Summary
                            <CreditCard className="w-5 h-5" />
                        </h4>

                        <div className="flex justify-between items-center text-base border-b border-white/10 pb-3">
                            <span className="text-white">Subscription Plan</span>
                            <span className="font-bold text-white">{state.planName}</span>
                        </div>

                        <div className="flex justify-between items-center text-base border-b border-white/10 pb-3">
                            <span className="text-white">AI Provider</span>
                            <span className="font-bold text-white flex items-center gap-2">
                                {aiProvider} — {aiStatus}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1 pt-2">
                            <div className="flex justify-between items-end border-b-2 border-primary/20 pb-4">
                                <span className="text-white text-base font-bold uppercase tracking-widest">Your Plan</span>
                                <div className="text-right">
                                    <div className="text-sm text-green-400 font-bold">✓ Paid via Stan Store</div>
                                    <div className="text-2xl font-black text-white tracking-tighter">{state.planName} — {state.price}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex gap-3 text-left">
                            <div className="mt-0.5">
                                <Lock className="w-4 h-4 text-white/90" />
                            </div>
                            <p className="text-sm text-white/90 font-medium leading-relaxed">
                                ✅ 7-Day Money-Back Guarantee. Payments processed by <span className="text-white font-bold">Stan Store</span>.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">


                    {error && <p className="text-base text-red-400 text-center font-bold">{error}</p>}

                    <button
                        onClick={handleHatch}
                        disabled={isDeploying}
                        className="w-full relative group inline-flex h-16 items-center justify-center overflow-hidden rounded-2xl font-black text-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 bg-primary text-black shadow-[0_20px_50px_rgba(249,115,22,0.3)]"
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            {isDeploying ? (
                                <><Loader2 className="w-6 h-6 animate-spin" /> HATCHING...</>
                            ) : (
                                <>ACTIVATE AGENT NOW <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                            )}
                        </span>
                    </button>
                </div>
            </div>

            <p className="mt-4 text-sm text-white/90 uppercase tracking-widest text-center">
                Clicking activate will hatch your bot instantly. Watch the magic happen.
            </p>
        </div>
    );
}
