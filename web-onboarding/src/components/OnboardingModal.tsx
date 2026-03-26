"use client";

import { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Wizard Steps
import StepIdentity from "./wizard/StepIdentity";
import StepAIConnection from "./wizard/StepAIConnection";
import StepReviewPayment from "./wizard/StepReviewPayment";
import PostPaymentSuccess from "./wizard/PostPaymentSuccess";

export interface AIKeyConfig {
    provider: "google" | "openai" | "anthropic" | "grok" | "openrouter" | "kimi";
    key: string;
    model: string;
    label: string;
}

export interface WizardState {
    nicheId: string;
    nicheName: string;
    botName: string;
    yourName: string;
    email: string;
    planId: "lite" | "pro" | "white-label";
    planName: string;
    price: string;
    connectionType: "byok" | "managed";
    aiKeys: AIKeyConfig[];
    whatsappEnabled: boolean;
    lineToken?: string;
    contactsRaw: string;
    botId?: string;
    tenantSlug?: string;
}

const initialState: WizardState = {
    nicheId: "",
    nicheName: "",
    botName: "",
    yourName: "",
    email: "",
    planId: "pro",
    planName: "Tiger-Claw Pro",
    price: "$147.00/mo",
    connectionType: "byok",
    aiKeys: [],
    whatsappEnabled: false,
    contactsRaw: "",
};

const SESSION_KEY = "tiger_wizard_state";

function loadPersistedState(): WizardState {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) return { ...initialState, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return initialState;
}

export default function OnboardingModal({ onClose, initialEmail }: { onClose: () => void; initialEmail?: string }) {
    const [step, setStep] = useState(1);
    const [state, setState] = useState<WizardState>(() => {
        const persisted = loadPersistedState();
        return initialEmail ? { ...persisted, email: initialEmail } : persisted;
    });
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentComplete, setDeploymentComplete] = useState(false);

    const totalSteps = 3;


    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const updateState = (updates: Partial<WizardState>) => {
        setState((prev) => {
            const next = { ...prev, ...updates };
            try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const handleLaunch = async () => {
        // StepReviewPayment handles the Stripe redirect internally.
        // This just sets the deploying state for the loading UI.
        setIsDeploying(true);
    };

    if (deploymentComplete) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <div className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden glass-card shadow-2xl relative">
                    <PostPaymentSuccess state={state} onClose={onClose} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden glass-card shadow-2xl relative my-auto"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        {step > 1 && !isDeploying && (
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h2 className="font-bold text-xl">Agent Setup</h2>
                            <div className="text-white/50 text-sm mt-1">
                                Step {step} of {totalSteps}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isDeploying}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/5 h-1">
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Step Content */}
                <div className="p-8 min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {step === 1 && (
                                <StepIdentity
                                    state={state}
                                    updateState={updateState}
                                    onNext={handleNext}
                                />
                            )}
                            {step === 2 && (
                                <StepAIConnection
                                    state={state}
                                    updateState={updateState}
                                    onNext={handleNext}
                                />
                            )}
                            {step === 3 && (
                                <StepReviewPayment
                                    state={state}
                                    isDeploying={isDeploying}
                                    setIsDeploying={setIsDeploying}
                                    onLaunch={handleLaunch}
                                    onNext={() => {
                                        try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
                                        setDeploymentComplete(true);
                                    }}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
