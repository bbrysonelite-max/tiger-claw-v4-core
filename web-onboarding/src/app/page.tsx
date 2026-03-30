"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Bot, Lock, ArrowRight, Loader2 } from "lucide-react";
import OnboardingModal from "@/components/OnboardingModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.tigerclaw.io";

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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>();
  const [verifiedBotId, setVerifiedBotId] = useState<string | undefined>();
  const [verifiedName, setVerifiedName] = useState<string | undefined>();
  const [sessionToken, setSessionToken] = useState<string | undefined>();

  // Purchase verification state
  const [purchaseEmail, setPurchaseEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | undefined>();

  // Auto-populate email from ?email= query param (linked from Stan Store receipt).
  // If present, pre-fills the input AND auto-triggers verify so the customer lands
  // directly in the wizard without any manual step.
  const autoTriggered = useRef(false);
  const pendingAutoEmail = useRef<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam && !autoTriggered.current) {
      autoTriggered.current = true;
      const clean = emailParam.toLowerCase();
      pendingAutoEmail.current = clean;
      setPurchaseEmail(clean);
    }
  }, [searchParams]);

  // Core verify logic — accepts email explicitly so it can be called from effects
  // or from the button handler without depending on state timing.
  const handleVerifyPurchaseWithEmail = async (email: string) => {
    setVerifyError(undefined);
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error ?? "Verification failed. Please try again.");
        return;
      }
      // Store session token for subsequent wizard API calls.
      // Clear any stale wizard state so fresh botId is never shadowed by old data.
      try {
        sessionStorage.removeItem("tiger_wizard_state");
        sessionStorage.setItem("tc_session", data.sessionToken);
      } catch { /* ignore */ }
      setSessionToken(data.sessionToken);
      setVerifiedEmail(email);
      setVerifiedBotId(data.botId);
      setVerifiedName(data.name);
      setWizardOpen(true);
    } catch {
      setVerifyError("Network error. Please check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  // Fire verify-purchase once the auto-populated email lands in state
  useEffect(() => {
    if (pendingAutoEmail.current && purchaseEmail === pendingAutoEmail.current) {
      pendingAutoEmail.current = null;
      handleVerifyPurchaseWithEmail(purchaseEmail);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseEmail]);

  const handleVerifyPurchase = async () => {
    const email = purchaseEmail.trim().toLowerCase();
    if (!email) {
      setVerifyError("Please enter your email.");
      return;
    }
    setPurchaseEmail(email);
    await handleVerifyPurchaseWithEmail(email);
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden flex flex-col justify-center">
      {/* Premium Gradient Orbs */}
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
          v4.0 Enterprise Ready
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-tight max-w-4xl mx-auto"
        >
          Deploy Your <br className="hidden md:block" />
          <span className="gradient-text">Agent in 60 Seconds</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-white/90 !leading-relaxed mb-12 max-w-2xl mx-auto font-medium"
        >
          Your AI key. Your bot. Your control. Deploy a live sales agent in 60 seconds. Stop wiring tools, start selling.
        </motion.p>

        {/* Purchase verification form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-3 max-w-md mx-auto"
        >
          <p className="text-white/60 text-sm font-medium mb-1">Already purchased? Enter your email to set up your agent.</p>
          <div className="flex w-full gap-2">
            <input
              type="email"
              value={purchaseEmail}
              onChange={(e) => { setPurchaseEmail(e.target.value); setVerifyError(undefined); }}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPurchase()}
              placeholder="your@email.com"
              className="flex-1 h-12 rounded-full px-5 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-primary text-sm"
              disabled={verifying}
            />
            <button
              onClick={handleVerifyPurchase}
              disabled={verifying}
              className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full font-bold px-6 bg-primary text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:scale-100 whitespace-nowrap"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Set Up My Agent <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </div>
          {verifyError && (
            <p className="text-red-400 text-sm text-center">{verifyError}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left"
        >
          <FeatureCard
            icon={<Lock className="w-6 h-6 text-primary" />}
            title="BYOB Enabled"
            description="Bring Your Own Bot — connect your own Telegram bot token and AI API key. Your credentials, your control."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-primary" />}
            title="18 Built-In Tools"
            description="Prospecting, objection handling, nurture sequences, hive intelligence — running the moment you connect."
          />
          <FeatureCard
            icon={<Bot className="w-6 h-6 text-primary" />}
            title="15 Industry Flavors"
            description="Pre-trained agents for network marketing, real estate, sales, fitness, trades, and more. Ready in 60 seconds."
          />
        </motion.div>
      </div>

      {wizardOpen && (
        <OnboardingModal
          onClose={() => setWizardOpen(false)}
          initialEmail={verifiedEmail}
          initialBotId={verifiedBotId}
          initialName={verifiedName}
          sessionToken={sessionToken}
        />
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-colors relative group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-white/80 leading-relaxed text-sm font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}
