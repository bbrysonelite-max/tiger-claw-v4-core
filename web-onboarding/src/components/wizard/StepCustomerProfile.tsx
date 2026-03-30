"use client";

import { ArrowRight, Users, TrendingUp } from "lucide-react";
import type { WizardState, CustomerProfile } from "../OnboardingModal";

interface CustomerProfileProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

const CUSTOMER_FIELDS: {
    key: keyof CustomerProfile;
    label: string;
    placeholder: string;
}[] = [
    {
        key: "idealCustomer",
        label: "Who is your ideal customer?",
        placeholder: "e.g., Women 30-55 concerned about skin aging",
    },
    {
        key: "problem",
        label: "What problem do they have?",
        placeholder: "e.g., Wrinkles, dark circles, acne scarring",
    },
    {
        key: "notWorking",
        label: "What's not working for them?",
        placeholder: "e.g., Cheap products that don't deliver results",
    },
    {
        key: "whereToFind",
        label: "Where do they hang out online?",
        placeholder: "e.g., Facebook groups, Instagram, TikTok",
    },
];

const PROSPECT_FIELDS: {
    key: keyof CustomerProfile;
    label: string;
    placeholder: string;
}[] = [
    {
        key: "prospectIdeal",
        label: "Who is your ideal prospect?",
        placeholder: "e.g., Ambitious professionals looking for a side income",
    },
    {
        key: "prospectProblem",
        label: "What problem do they have?",
        placeholder: "e.g., Trading time for money, no financial freedom",
    },
    {
        key: "prospectNotWorking",
        label: "What's not working for them?",
        placeholder: "e.g., Traditional jobs with no upside, MLMs that overpromise",
    },
    {
        key: "prospectWhereToBeThem",
        label: "Where do they hang out online?",
        placeholder: "e.g., LinkedIn, entrepreneur Facebook groups, YouTube",
    },
];

export default function StepCustomerProfile({ state, updateState, onNext }: CustomerProfileProps) {
    const profile = state.customerProfile ?? {
        idealCustomer: "", problem: "", notWorking: "", whereToFind: "",
    };

    const isNetworkMarketer = state.nicheId === "network-marketer";

    const update = (key: keyof CustomerProfile, value: string) => {
        updateState({ customerProfile: { ...profile, [key]: value } });
    };

    const canProceed = profile.idealCustomer.trim().length > 0 && profile.problem.trim().length > 0;

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Your Ideal Customer</h3>
                <p className="text-white/80 text-lg">
                    Your Tiger needs to know who to hunt. These answers are loaded into your bot before it goes live — it will never ask your customers these questions.
                </p>
            </div>

            <div className="flex flex-col gap-5 flex-1">
                {/* Customer / Product Section */}
                <div className="flex flex-col gap-5">
                    {CUSTOMER_FIELDS.map(({ key, label, placeholder }) => (
                        <div key={key} className="flex flex-col gap-2">
                            <label className="text-base font-bold text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary shrink-0" />
                                {label}
                            </label>
                            <input
                                type="text"
                                value={(profile[key] as string) ?? ""}
                                onChange={(e) => update(key, e.target.value)}
                                placeholder={placeholder}
                                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-primary focus:outline-none transition-colors"
                            />
                        </div>
                    ))}
                </div>

                {/* Prospect / Business Opportunity Section — network marketing only */}
                {isNetworkMarketer && (
                    <div className="flex flex-col gap-5 mt-4 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 mb-1">
                            <TrendingUp className="w-5 h-5 text-primary shrink-0" />
                            <h4 className="text-lg font-bold text-white">Your Ideal Prospect (Business Opportunity)</h4>
                        </div>
                        <p className="text-white/80 text-base -mt-3">
                            Who are you recruiting into your team? Your Tiger will qualify prospects for the business — not just the product.
                        </p>
                        {PROSPECT_FIELDS.map(({ key, label, placeholder }) => (
                            <div key={key} className="flex flex-col gap-2">
                                <label className="text-base font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                                    {label}
                                </label>
                                <input
                                    type="text"
                                    value={(profile[key] as string) ?? ""}
                                    onChange={(e) => update(key, e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-primary focus:outline-none transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
