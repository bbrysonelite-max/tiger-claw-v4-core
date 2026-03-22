"use client";

import { Check, ArrowRight, Zap, ShieldCheck } from "lucide-react";
import type { WizardState } from "../OnboardingModal";
import { cn } from "@/lib/utils";

interface PlanSelectionProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

const PLANS = [
    {
        id: "demo",
        name: "72 Hour Free Demo",
        price: "$0.00",
        description: "Hatch a temporary agent to test the tech.",
        features: [
            "72 Hour Expiry",
            "50 Message Limit",
            "Standard AI",
            "Instantly Provisioned"
        ],
        icon: Zap,
        color: "blue"
    },
    {
        id: "lite",
        name: "Tiger Lite",
        price: "$97.00",
        description: "Permanent agent for individual marketers.",
        features: [
            "1 AI Agent Hatching",
            "Unlimited Prospect Finds",
            "Core Niche Personas",
            "Bring Your Own Key (BYOK)"
        ],
        icon: ShieldCheck,
        color: "blue"
    },
    {
        id: "pro",
        name: "Tiger Pro",
        price: "$147.00",
        description: "Premium power for high-volume hunters.",
        features: [
            "4-Key AI Rotation",
            "Multi-Session Scaling",
            "Priority Hatching Queue",
            "Custom Niche Tuning",
            "Full Platform Access"
        ],
        icon: Zap,
        color: "orange"
    }
] as const;

export default function StepPlanSelection({ state, updateState, onNext }: PlanSelectionProps) {
    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Select Your Plan</h3>
                <p className="text-white/50 text-base leading-relaxed">
                    Choose the power level for your new agent.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                {PLANS.map((plan) => (
                    <button
                        key={plan.id}
                        onClick={() => updateState({ 
                            planId: plan.id as any, 
                            planName: plan.name, 
                            price: plan.price 
                        })}
                        className={cn(
                            "relative flex flex-col p-6 rounded-2xl border text-left transition-all duration-300 group",
                            state.planId === plan.id 
                                ? "bg-white/5 border-primary ring-1 ring-primary shadow-[0_0_30px_rgba(249,115,22,0.1)]" 
                                : "bg-black/40 border-white/10 hover:border-white/20"
                        )}
                    >
                        {state.planId === plan.id && (
                            <div className="absolute top-4 right-4 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                <Check className="h-4 w-4 text-black font-bold" />
                            </div>
                        )}

                        <div className="mb-4">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-colors",
                                state.planId === plan.id ? "bg-primary/20 text-primary" : "bg-white/5 text-white/40"
                            )}>
                                <plan.icon className="h-6 w-6" />
                            </div>
                            <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{plan.name}</h4>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-white">{plan.price}</span>
                                <span className="text-xs text-white/40 uppercase tracking-widest">/ month</span>
                            </div>
                        </div>

                        <ul className="space-y-3 mt-4 border-t border-white/5 pt-4 flex-1">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </button>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onNext}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
