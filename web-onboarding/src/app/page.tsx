"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { Zap, Bot, Shield, ArrowRight } from "lucide-react";

// TODO: Paste Stripe Payment Link URL here when it's created in the Stripe dashboard.
// Product: Tiger Claw, Price: $147/mo. Success redirect should be set in the Stripe
// dashboard to: https://tigerclaw.io/signup?email={CUSTOMER_EMAIL}
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/TODO_REPLACE_ME";

// Suspense boundary required by Next.js App Router
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
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
          className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.05] max-w-4xl mx-auto"
        >
          A thousand recruits <br className="hidden md:block" />
          <span className="gradient-text">in your pocket.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-white/70 !leading-relaxed mb-12 max-w-xl mx-auto"
        >
          Your bot. Your AI key. Your leads. Running while you sleep.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          <a
            href={STRIPE_PAYMENT_LINK}
            className="group relative inline-flex h-16 items-center justify-center overflow-hidden rounded-full font-bold px-10 bg-primary text-black text-lg transition-all hover:scale-105 active:scale-95"
          >
            <span className="flex items-center gap-3">
              Get your agent now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </a>
          <p className="text-white/40 text-sm mt-2">$147/month · 7-day money-back guarantee</p>
        </motion.div>

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

        <p className="text-white/30 text-xs mt-16">
          Already purchased?{" "}
          <a href="/signup" className="text-white/60 hover:text-white underline underline-offset-2">
            Set up your agent →
          </a>
        </p>
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
