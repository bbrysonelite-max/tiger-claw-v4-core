"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Bot, Shield, ArrowRight, Loader2 } from "lucide-react";

// Suspense boundary required by Next.js App Router for useSearchParams
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Please enter your email."); return; }
    router.push(`/signup?email=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden flex flex-col justify-center">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#22c55e]/10 rounded-full blur-[128px] pointer-events-none mix-blend-screen" />

      <div className="container mx-auto px-6 py-20 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur text-sm text-white/80 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Live · Hunting Now
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-tight max-w-4xl mx-auto"
        >
          Deploy Your <br className="hidden md:block" />
          <span className="gradient-text">Agent in 2 Minutes</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-white/70 !leading-relaxed mb-12 max-w-xl mx-auto"
        >
          Your bot. Your AI key. Your leads. Running while you sleep.
        </motion.p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-3 max-w-md mx-auto"
        >
          <p className="text-white/40 text-sm mb-1">Already purchased? Enter your email to activate.</p>
          <div className="flex w-full gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as any)}
              placeholder="your@email.com"
              className="flex-1 h-12 rounded-full px-5 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-primary text-sm"
            />
            <button
              type="submit"
              className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-6 bg-primary text-black transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                Launch <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left"
        >
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-primary" />}
            title="Your Keys, Your Data"
            description="Bring your own Telegram bot and AI key. Nothing is shared. Everything is encrypted."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-primary" />}
            title="26 Built-In Tools"
            description="Prospecting, scoring, nurture, objection handling, morning reports — live the moment you connect."
          />
          <FeatureCard
            icon={<Bot className="w-6 h-6 text-primary" />}
            title="Hunts While You Sleep"
            description="Your agent runs 24/7. You wake up to leads, scores, and follow-ups already queued."
          />
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-colors relative group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-white/70 leading-relaxed text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}
