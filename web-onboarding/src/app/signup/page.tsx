"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TelegramTokenInput from "@/components/signup/TelegramTokenInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.tigerclaw.io";

// ---------------------------------------------------------------------------
// Flavor data (9 customer-facing flavors)
// ---------------------------------------------------------------------------

interface Flavor {
  key: string;
  displayName: string;
  description: string;
}

const FLAVORS: Flavor[] = [
  {
    key: "network-marketer",
    displayName: "Network Marketer",
    description: "Finds prospects ready to join or buy from a network marketing business",
  },
  {
    key: "real-estate",
    displayName: "Real Estate Agent",
    description: "Finds buyers and sellers ready to make a move",
  },
  {
    key: "health-wellness",
    displayName: "Health & Wellness",
    description: "Finds people ready to invest in their health transformation",
  },
  {
    key: "mortgage-broker",
    displayName: "Mortgage Broker",
    description: "Finds homebuyers and homeowners ready to talk loans",
  },
  {
    key: "lawyer",
    displayName: "Lawyer / Attorney",
    description: "Finds people who need legal help and are ready to consult",
  },
  {
    key: "airbnb-host",
    displayName: "Airbnb Host",
    description: "Finds travelers and helps maximize bookings",
  },
  {
    key: "plumber",
    displayName: "Plumber / Trades Professional",
    description: "Finds homeowners and businesses that need trades work",
  },
  {
    key: "sales-tiger",
    displayName: "Sales Tiger",
    description: "Finds high-value prospects and closes deals aggressively",
  },
];

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
  flavor: string;
  agentName: string;
  whoTheyAre: string;
  whatTheyWant: string;
  whereTheyAre: string;
  telegramToken: string;
  aiKey: string;
}

interface FormErrors {
  flavor?: string;
  agentName?: string;
  whoTheyAre?: string;
  whatTheyWant?: string;
  whereTheyAre?: string;
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
  agentName: string;
  botUsername: string;
}

function SuccessState({ agentName, botUsername }: SuccessStateProps) {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(localStorage.getItem("tc_slug"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-4xl font-bold text-white mb-2">{agentName} is ready to hunt.</h1>
        <p className="text-white/50 text-base mb-10">
          Your agent already knows who you&apos;re hunting. One message starts it.
        </p>

        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 bg-[#0088cc] hover:bg-[#0099dd] text-white font-bold text-xl px-6 py-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mb-8"
        >
          Open Telegram → Meet {agentName}
          <ExternalLink className="w-5 h-5 shrink-0" />
        </a>

        <ul className="flex flex-col gap-3 text-left mb-10">
          <li className="text-white/70 text-base">
            Say hello. Your agent already knows who you&apos;re hunting.
          </li>
          <li className="text-white/70 text-base">
            Every morning at 7 AM, {agentName} sends you a hunt report.
          </li>
          <li className="text-white/70 text-base">
            The Hive is watching. Every run makes the intelligence sharper.
          </li>
        </ul>

        {slug && (
          <a
            href={`/dashboard?slug=${slug}`}
            className="text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            View your dashboard →
          </a>
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
    flavor: "",
    agentName: "",
    whoTheyAre: "",
    whatTheyWant: "",
    whereTheyAre: "",
    telegramToken: "",
    aiKey: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [telegramValid, setTelegramValid] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState<{ agentName: string; botUsername: string } | null>(null);

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

    if (!form.flavor) newErrors.flavor = "Please select an agent type.";
    if (!form.agentName.trim()) newErrors.agentName = "Agent name is required.";
    else if (form.agentName.trim().length > 30)
      newErrors.agentName = "Agent name must be 30 characters or fewer.";
    if (!form.whoTheyAre.trim()) newErrors.whoTheyAre = "Please describe your ideal customer.";
    if (!form.whatTheyWant.trim()) newErrors.whatTheyWant = "Please describe what they want.";
    if (!form.whereTheyAre.trim()) newErrors.whereTheyAre = "Please describe where they are online.";
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
        flavor: form.flavor,
        botToken: form.telegramToken.trim(),
        aiKey: form.aiKey.trim(),
        customerProfile: {
          idealCustomer: form.whoTheyAre.trim(),
          problem: form.whatTheyWant.trim(),
          notWorking: "",
          whereToFind: form.whereTheyAre.trim(),
        },
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
          agentName: form.agentName.trim(),
          botUsername: data.botUsername || telegramUsername || form.agentName.trim(),
        });
      } else {
        // Map server field errors back to form fields
        const fieldMap: Record<string, keyof FormErrors> = {
          botToken: "telegramToken",
          telegramBotToken: "telegramToken",
          aiKey: "aiKey",
          name: "agentName",
          flavor: "flavor",
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
    return <SuccessState agentName={success.agentName} botUsername={success.botUsername} />;
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
          {/* Section 1 — Flavor picker                                        */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={1}
              title="What kind of agent do you want?"
              subtitle="Choose the niche that best matches your business."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FLAVORS.map((flavor) => (
                <button
                  key={flavor.key}
                  type="button"
                  onClick={() => updateForm("flavor", flavor.key)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all",
                    form.flavor === flavor.key
                      ? "bg-orange-500/10 border-orange-500/60 ring-1 ring-orange-500/40"
                      : "bg-zinc-900/60 border-white/10 hover:border-white/30 hover:bg-zinc-900"
                  )}
                >
                  <div
                    className={cn(
                      "font-semibold text-sm mb-1 transition-colors",
                      form.flavor === flavor.key ? "text-orange-400" : "text-white"
                    )}
                  >
                    {flavor.displayName}
                  </div>
                  <div className="text-white/50 text-xs leading-relaxed">{flavor.description}</div>
                </button>
              ))}
            </div>

            {errors.flavor && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errors.flavor}
              </p>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Section 2 — Agent name                                           */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={2}
              title="Give your agent a name"
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
          {/* Section 3 — ICP                                                  */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={3}
              title="Who are you trying to reach?"
              subtitle="Your agent reads this before every conversation. The more specific you are, the better it hunts."
            />

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Describe your ideal customer in one sentence.
                </label>
                <textarea
                  value={form.whoTheyAre}
                  onChange={(e) => updateForm("whoTheyAre", e.target.value)}
                  rows={2}
                  placeholder={`e.g. "Ambitious women 30–50 who are tired of their 9-to-5 and want financial independence."`}
                  className={cn(
                    "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none resize-none transition-colors",
                    errors.whoTheyAre
                      ? "border-red-500/60 focus:border-red-400"
                      : "border-white/20 focus:border-orange-500/60"
                  )}
                />
                {errors.whoTheyAre && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errors.whoTheyAre}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  What problem are they trying to solve, or what do they want more of?
                </label>
                <textarea
                  value={form.whatTheyWant}
                  onChange={(e) => updateForm("whatTheyWant", e.target.value)}
                  rows={2}
                  placeholder={`e.g. "They want a side income they can run from their phone without quitting their job."`}
                  className={cn(
                    "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none resize-none transition-colors",
                    errors.whatTheyWant
                      ? "border-red-500/60 focus:border-red-400"
                      : "border-white/20 focus:border-orange-500/60"
                  )}
                />
                {errors.whatTheyWant && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errors.whatTheyWant}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Where do they spend time online?
                </label>
                <textarea
                  value={form.whereTheyAre}
                  onChange={(e) => updateForm("whereTheyAre", e.target.value)}
                  rows={2}
                  placeholder={`e.g. "Facebook groups, Instagram, TikTok, LinkedIn."`}
                  className={cn(
                    "w-full bg-zinc-900/80 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none resize-none transition-colors",
                    errors.whereTheyAre
                      ? "border-red-500/60 focus:border-red-400"
                      : "border-white/20 focus:border-orange-500/60"
                  )}
                />
                {errors.whereTheyAre && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errors.whereTheyAre}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Section 4 — Telegram                                             */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={4}
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
          {/* Section 5 — AI key                                               */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <SectionHeading
              number={5}
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
  const emailParam = searchParams.get("email") ?? "";

  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [botId, setBotId] = useState("");

  const handleVerified = (email: string, id: string, _sessionToken: string) => {
    setVerifiedEmail(email);
    setBotId(id);
    setVerified(true);
  };

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
