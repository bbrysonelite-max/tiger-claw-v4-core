"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelegramTokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (result: { valid: boolean; username: string | null }) => void;
  error?: string;
}

export default function TelegramTokenInput({
  value,
  onChange,
  onValidationChange,
  error,
}: TelegramTokenInputProps) {
  const [validating, setValidating] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const token = value.trim();
    if (!token) {
      setBotUsername(null);
      setValidationError("");
      onValidationChange({ valid: false, username: null });
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      setBotUsername(null);
      setValidationError("");
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok) {
          setBotUsername(data.result.username);
          onValidationChange({ valid: true, username: data.result.username });
        } else {
          setValidationError("Invalid token — double-check it in @BotFather.");
          onValidationChange({ valid: false, username: null });
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "Validation timed out — check your connection and try again."
            : "Could not reach Telegram. Check your connection.";
        setValidationError(msg);
        onValidationChange({ valid: false, username: null });
      } finally {
        clearTimeout(deadline);
        setValidating(false);
      }
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      {/* Guidance */}
      <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 text-sm text-white/80 leading-relaxed space-y-1">
        <p>
          <span className="text-orange-400 font-bold">Step 1:</span>{" "}
          Open{" "}
          <a
            href="https://t.me/botfather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-medium"
          >
            @BotFather
          </a>{" "}
          in Telegram
        </p>
        <p>
          <span className="text-orange-400 font-bold">Step 2:</span>{" "}
          Send{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">/newbot</code> — choose a
          name, then a username ending in <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">bot</code>
        </p>
        <p>
          <span className="text-orange-400 font-bold">Step 3:</span>{" "}
          Copy the HTTP API token BotFather gives you and paste it below
        </p>
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your bot token (e.g. 7654321:AAFxyz...)"
          className={cn(
            "w-full bg-black/40 border rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 outline-none pr-12 min-h-[52px] transition-colors",
            botUsername
              ? "border-green-500/60 focus:border-green-400"
              : validationError || error
              ? "border-red-500/60 focus:border-red-400"
              : "border-white/20 focus:border-orange-500/60"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {validating && <Loader2 className="w-5 h-5 text-white/60 animate-spin" />}
          {!validating && botUsername && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {!validating && (validationError || error) && !botUsername && (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
      </div>

      {/* Status messages */}
      {botUsername && (
        <p className="text-sm text-green-400 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          @{botUsername} — Verified. Ready to hunt.
        </p>
      )}
      {validationError && !botUsername && (
        <p className="text-sm text-red-400 font-medium">{validationError}</p>
      )}
      {error && !validationError && !botUsername && (
        <p className="text-sm text-red-400 font-medium">{error}</p>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest font-bold">
        <ShieldCheck className="w-3 h-3 text-orange-500" /> AES-256-GCM Encrypted at Rest
      </div>
    </div>
  );
}
