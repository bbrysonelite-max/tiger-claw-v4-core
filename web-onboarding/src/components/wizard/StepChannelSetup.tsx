"use client";

import { MessageSquare, MessageCircle, ArrowRight, ShieldCheck, HelpCircle, ExternalLink } from "lucide-react";
import type { WizardState } from "../OnboardingModal";
import { cn } from "@/lib/utils";

interface ChannelSetupProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

export default function StepChannelSetup({ state, updateState, onNext }: ChannelSetupProps) {
    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">Channel Outreach</h3>
                <p className="text-white/50 text-base">Connect your Tiger to more circles. You can always redo this later.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {/* WhatsApp */}
                <div className={cn(
                    "flex flex-col p-6 rounded-2xl border transition-all relative group",
                    state.whatsappEnabled ? "bg-primary/5 border-primary" : "bg-black/40 border-white/10 hover:border-white/20"
                )}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center border border-[#25D366]/20">
                            <MessageSquare className="h-6 w-6 text-[#25D366]" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={state.whatsappEnabled}
                                onChange={(e) => updateState({ whatsappEnabled: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/20 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]/40 peer-checked:after:bg-[#25D366]"></div>
                        </label>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">WhatsApp Outreach</h4>
                    <p className="text-xs text-white/40 leading-relaxed mb-4">
                        Link your WhatsApp account to enable automated messaging. Your agent will send a QR code to your Telegram to sync.
                    </p>
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-3 h-3 text-[#25D366]" /> Secure Session Persistent
                    </div>
                </div>

                {/* LINE */}
                <div className={cn(
                    "flex flex-col p-6 rounded-2xl border transition-all relative group",
                    state.lineToken ? "bg-primary/5 border-primary" : "bg-black/40 border-white/10 hover:border-white/20"
                )}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 bg-[#00B900]/10 rounded-xl flex items-center justify-center border border-[#00B900]/20">
                            <MessageCircle className="h-6 w-6 text-[#00B900]" />
                        </div>
                        <a href="https://developers.line.biz/" target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold">
                            GET TOKEN <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">LINE Official Account</h4>
                    <input 
                        type="password"
                        value={state.lineToken || ""}
                        onChange={(e) => updateState({ lineToken: e.target.value })}
                        placeholder="Paste LINE Channel Token..."
                        className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white focus:border-primary outline-none mb-4"
                    />
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-3 h-3 text-[#00B900]" /> APAC Market Specialist
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3">
                <HelpCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-300/60 leading-relaxed italic">
                    "Skip these for now if you just want to talk to your bot on Telegram. You can add them later via your agent's Cockpit URL."
                </p>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onNext}
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-8 bg-primary text-black transition-all hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Complete Setup <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
}
