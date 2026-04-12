"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Rocket,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TelegramTokenInput from "@/components/signup/TelegramTokenInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.tigerclaw.io";

// The only customer-facing flavor. Hardcoded — no picker. Multi-product
// returns later when there's a second product to sell.
const DEFAULT_FLAVOR = "network-marketer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyResponse {
  ok?: boolean;
  valid?: boolean;
  botId?: string;
  sessionToken?: string;
  slug?: string;
  message?: string;
  error?: string;
}

interface HatchResponse {
  ok?: boolean;
  success?: boolean;
  tenant?: {
    slug: string;
    name: string;
  };
  slug?: string;
  botUsername?: string;
  error?: string;
  field?: string;
}

interface FormState {
  agentName: string;
  telegramToken: string;
  aiKey: string;
}

interface FormErrors {
  agentName?: string;
  telegramToken?: string;
  aiKey?: string;
  general?: string;
}

// ---------------------------------------------------------------------------
// Email Gate (isolated, removable)
// ---------------------------------------------------------------------------

interface EmailGateProps {
  prefillEmail: string;
  onVerified: (email: string, botId: string, sessionToken: string) => void;
}

function EmailGate({ prefillEmail, onVerified }: EmailGateProps) {
  const [email, setEmail] = useState(prefillEmail);
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const verify = useCallback(
    async (emailToCheck: string) => {
      const trimmed = emailToCheck.trim();
      if (!trimmed) return;

      setStatus("checking");
      setErrorMsg("");

      try {
        const res = await fetch(`${API_URL}/auth/verify-purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const data: VerifyResponse = await res.json();

        if ((data.ok || data.valid) && data.botId) {
          localStorage.setItem("tc_session_token", data.sessionToken ?? "");
          localStorage.setItem("tc_bot_id", data.botId);
          onVerified(trimmed, data.botId, data.sessionToken ?? "");
        } else {
          setStatus("error");
          setErrorMsg(
            data.message || data.error ||
              "We couldn't find a purchase for this email. Contact support at support@tigerclaw.io."
          );
        }
      } catch {
        setStatus("error");
        setErrorMsg("Could not reach the server. Check your connection and try again.");
      }
    },
    [onVerified]
  );

  // Auto-verify when email is prefilled from URL param
  useEffect(() => {
    if (prefillEmail) {
      verify(prefillEmail);
    }
  }, [prefillEmail, verify]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Agent</h1>
          <p className="text-white/60">Enter the email you used to purchase Tiger Claw.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setStatus("idle");
              setErrorMsg("");
            }}
            placeholder="your@email.com"
            required
            className="w-full bg-zinc-900/80 border border-white/20 rounded-xl px-4 py-4 text-base text-white placeholder:text-white/40 outline-none focus:border-orange-500/60 transition-colors min-h-[56px]"
          />

          {status === "error" && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "checking"}
            className="w-full h-14 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
          >
            {status === "checking" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying purchase...
              </>
            ) : (
              "Continue →"
            )}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          Need help?{" "}
          <a href="mailto:support@tigerclaw.io" className="text-orange-400 hover:underline">
            support@tigerclaw.io
          </a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success State
// ---------------------------------------------------------------------------

interface SuccessStateProps {
  botUsername: string;
}

function SuccessState({ botUsername }: SuccessStateProps) {
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSlug(localStorage.getItem("tc_slug"));
  }, []);

  const telegramUrl = `https://t.me/${botUsername}`;
  const displayLink = `t.me/${botUsername}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(telegramUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts — fall back to prompt
      window.prompt("Copy this link:", telegramUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-8 sm:p-12 text-center">
          <div className="text-5xl mb-4">🐯</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Your agent is live.</h1>
          <p className="text-white/60 text-base mb-8 max-w-md mx-auto">
            Share this link. Your agent already knows who to look for, what to say, and when to book
            the call.
          </p>

          <div className="bg-zinc-950/80 border border-white/10 rounded-xl px-4 py-4 mb-6">
            <code className="text-orange-400 font-mono text-base sm:text-lg break-all">
              {displayLink}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 h-14 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy link
                </>
              )}
            </button>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-14 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 hover:border-white/30 text-white font-bold text-base flex items-center justify-center gap-2 transition-all"
            >
              Open in Telegram
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
          </div>
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          Lost your bot? Go back to{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            @BotFather
          </a>{" "}
          — your token and bot username are always there.
        </p>

        {slug && (
          <p className="text-center mt-4">
            <a
              href={`/dashboard?slug=${slug}`}
              className="text-white/30 hover:text-white/60 text-sm transition-colors"
            >
              View your dashboard →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading helper
// ---------------------------------------------------------------------------

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
          <span className="text-orange-400 font-bold text-sm">{number}</span>
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-white/50 text-sm ml-11">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Signup Form
// ---------------------------------------------------------------------------

interface SignupFormProps {
  email: string;
  botId: string;
}

function SignupForm({ email, botId }: SignupFormProps) {
  const [form, setForm] = useState<FormState>({
    agentName: "",
    telegramToken: "",
    aiKey: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [telegramValid, setTelegramValid] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState<{ botUsername: string } | null>(null);

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
  };

  const handleTelegramValidation = ({
    valid,
    username,
  }: {
    valid: boolean;
    username: string | null;
  }) => {
    setTelegramValid(valid);
    setTelegramUsername(username);
    if (valid) {
      setErrors((prev) => ({ ...prev, telegramToken: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.agentName.trim()) newErrors.agentName = "Agent name is required.";
    else if (form.agentName.trim().length > 30)
      newErrors.agentName = "Agent name must be 30 characters or fewer.";
    if (!form.telegramToken.trim()) {
      newErrors.telegramToken = "Bot token is required.";
    } else if (!telegramValid) {
      newErrors.telegramToken = "Bot token must be validated before launching.";
    }
    if (!form.aiKey.trim()) newErrors.aiKey = "Gemini API key is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLaunch = async () => {
    if (!validate()) return;

    setLaunching(true);
    setErrors({});

    try {
      const payload = {
        botId,
        name: form.agentName.trim(),
        email,
        flavor: DEFAULT_FLAVOR,
        botToken: form.telegramToken.trim(),
        aiKey: form.aiKey.trim(),
        preferredChannel: "telegram" as const,
        region: "us-en",
        language: "en",
      };

      const res = await fetch(`${API_URL}/wizard/hatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: HatchResponse = await res.json();

      if (res.ok && (data.success || data.ok)) {
        const tenantSlug = data.slug ?? data.tenant?.slug ?? "";
        if (tenantSlug) {
          localStorage.setItem("tc_slug", tenantSlug);
        }
        setSuccess({
          botUsername: data.botUsername || telegramUsername || form.agentName.trim(),
        });
      } else {
        // Map server field errors back to form fields
        const fieldMap: Record<string, keyof FormErrors> = {
          botToken: "telegramToken",
          telegramBotToken: "telegramToken",
          aiKey: "aiKey",
          name: "agentName",
        };

        const fieldError = data.field ? fieldMap[data.field] : undefined;
        if (fieldError) {
          setErrors({ [fieldError]: data.error || "Invalid value." });
        } else {
          setErrors({ general: data.error || "Launch failed. Please try again or contact support." });
        }
      }
    } catch {
      setErrors({ general: "Could not reach the server. Check your connection and try again." });
    } finally {
      setLaunching(false);
    }
  };

  if (success) {
    return <SuccessState botUsername={success.botUsername} />;
  }

  return (
    <div className="min-h-screen px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Launch Your Tiger Agent
          </h1>
          <p className="text-orange-400 font-semibold text-sm mb-1">
            Your agent will be live in about 2 minutes.
          </p>
          <p className="text-white/50 text-sm">
            Setting up for <span className="text-white/70">{email}</span>
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {/* ---------------------------------------------------------------- */}
          {/* Section 1 — Agent name                                           */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={1}
              title="Name your Tiger"
              subtitle="This becomes your bot's display name in Telegram."
            />

            <input
              type="text"
              value={form.agentName}
              onChange={(e) => updateForm("agentName", e.target.value)}
              maxLength={30}
              placeholder="e.g. Tiger, Max, Scout"
              className={cn(
                "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none transition-colors min-h-[52px]",
                errors.agentName
                  ? "border-red-500/60 focus:border-red-400"
                  : "border-white/20 focus:border-orange-500/60"
              )}
            />
            <div className="flex justify-between mt-1">
              {errors.agentName ? (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errors.agentName}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-white/30 ml-auto">{form.agentName.length}/30</span>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Section 2 — Telegram                                             */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={2}
              title="Connect your Telegram bot"
              subtitle="Your agent needs a Telegram bot token to operate."
            />

            <TelegramTokenInput
              value={form.telegramToken}
              onChange={(v) => updateForm("telegramToken", v)}
              onValidationChange={handleTelegramValidation}
              error={errors.telegramToken}
            />
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Section 3 — AI key                                               */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={3}
              title="Add your AI key"
              subtitle="Your agent uses Google Gemini. The key stays encrypted on our servers."
            />

            {/* Guidance */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 text-sm text-white/80 leading-relaxed space-y-1 mb-4">
              <p className="font-semibold text-white/90">Get a free key in 60 seconds:</p>
              <ol className="list-decimal list-inside space-y-1 text-white/70">
                <li>
                  Go to{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline inline-flex items-center gap-1"
                  >
                    aistudio.google.com/app/apikey <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Sign in with your Google account</li>
                <li>
                  Click <strong className="text-white">Create API key</strong> — copy it and paste
                  it below
                </li>
              </ol>
              <p className="text-white/50 text-xs pt-1">
                You need a Google account. Most people already have one (Gmail, YouTube, Android).
              </p>
            </div>

            <input
              type="password"
              value={form.aiKey}
              onChange={(e) => updateForm("aiKey", e.target.value)}
              placeholder="Paste your Gemini API key (starts with AIza...)"
              className={cn(
                "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none transition-colors min-h-[52px]",
                errors.aiKey
                  ? "border-red-500/60 focus:border-red-400"
                  : "border-white/20 focus:border-orange-500/60"
              )}
            />
            {errors.aiKey && (
              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errors.aiKey}
              </p>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* General error                                                    */}
          {/* ---------------------------------------------------------------- */}
          {errors.general && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Launch button                                                    */}
          {/* ---------------------------------------------------------------- */}
          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="w-full h-16 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
          >
            {launching ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Launching your agent...
              </>
            ) : (
              <>
                <Rocket className="w-6 h-6" />
                LAUNCH MY AGENT →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root page — reads email from URL, gates then shows form
// ---------------------------------------------------------------------------

function SignupPageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const emailParam = searchParams.get("email") ?? "";

  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [botId, setBotId] = useState("");
  const [stripeError, setStripeError] = useState("");

  const handleVerified = (email: string, id: string, _sessionToken: string) => {
    setVerifiedEmail(email);
    setBotId(id);
    setVerified(true);
  };

  // Auto-verify from Stripe session_id — customer never types email
  useEffect(() => {
    if (!sessionId || verified) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/stripe-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();

        if (res.ok && data.ok && data.botId) {
          localStorage.setItem("tc_session_token", data.sessionToken ?? "");
          localStorage.setItem("tc_bot_id", data.botId);
          handleVerified(data.email, data.botId, data.sessionToken ?? "");
        } else {
          setStripeError(data.error || "Could not verify payment session.");
        }
      } catch {
        setStripeError("Could not reach the server. Please refresh the page.");
      }
    })();
  }, [sessionId, verified]);

  // Stripe session auto-verify in progress
  if (sessionId && !verified && !stripeError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 gap-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-white/60 text-base">Verifying your payment...</p>
      </div>
    );
  }

  // Stripe session failed — fall back to email gate with error shown
  if (sessionId && stripeError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 gap-4">
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 max-w-md">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{stripeError}</span>
        </div>
        <EmailGate prefillEmail="" onVerified={handleVerified} />
      </div>
    );
  }

  if (!verified) {
    return <EmailGate prefillEmail={emailParam} onVerified={handleVerified} />;
  }

  return <SignupForm email={verifiedEmail} botId={botId} />;
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}
