// Tiger Claw — Token Crypto & Telegram Utilities
// AES-256-GCM encryption for bot tokens stored at rest.
// All bot tokens are BYOB — operators provide their own BotFather token.
// There is no platform bot pool. Do not re-introduce pool operations here.

import * as crypto from "crypto";
import * as https from "https";
import * as http from "http";

// ---------------------------------------------------------------------------
// Encryption helpers
// AES-256-GCM with a 32-byte key derived from ENCRYPTION_KEY via SHA-256.
// Stored format: "enc:iv_hex:authtag_hex:ciphertext_hex"
// ---------------------------------------------------------------------------

function getEncKey(): Buffer | null {
  const raw = process.env["ENCRYPTION_KEY"];
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getEncKey();
  if (!key) {
    throw new Error("[FATAL] ENCRYPTION_KEY is required but not set in the environment. Cannot safely encrypt.");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(stored: string): string {
  if (!stored.startsWith("enc:")) return stored; // plaintext (support legacy dev/test data)

  const key = getEncKey();
  if (!key) throw new Error("[FATAL] ENCRYPTION_KEY is required but not set in the environment.");

  const [, ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Malformed encrypted token");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// ---------------------------------------------------------------------------
// Telegram API helper
// ---------------------------------------------------------------------------

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function telegramRequest<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramResponse<T>> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: "api.telegram.org",
      path: `/bot${token}/${method}`,
      method: bodyStr ? "POST" : "GET",
      headers: {
        ...(bodyStr ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as TelegramResponse<T>);
        } catch {
          reject(new Error(`Non-JSON from Telegram (${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Telegram request timed out")); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Bot customization — updates the BYOB bot's display name and description.
// Called with the operator's bot token after hatch.
// ---------------------------------------------------------------------------

export async function customizeBotIdentity(
  token: string,
  botName: string,
  description: string,
  shortDescription: string,
  languageCode?: string
): Promise<void> {
  const body = languageCode ? { language_code: languageCode } : {};

  const calls: Array<[string, Record<string, unknown>]> = [
    ["setMyName", { name: botName, ...body }],
    ["setMyDescription", { description, ...body }],
    ["setMyShortDescription", { short_description: shortDescription, ...body }],
  ];

  for (const [method, params] of calls) {
    try {
      const result = await telegramRequest(token, method, params);
      if (!result.ok) {
        console.warn(`[pool] ${method} returned not-ok: ${result.description}`);
      }
    } catch (err) {
      console.warn(`[pool] ${method} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP request helper for internal API calls (non-Telegram)
// ---------------------------------------------------------------------------
export function httpPost(url: string, body: Record<string, unknown>, authToken: string): void {
  const parsed = new URL(url);
  const bodyStr = JSON.stringify(body);
  const lib = parsed.protocol === "https:" ? https : (http as unknown as typeof https);

  const req = lib.request(
    {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        "Authorization": `Bearer ${authToken}`,
      },
    },
    () => {}
  );
  req.on("error", (err) => { console.error("[pool] httpPost failed:", err.message); });
  req.write(bodyStr);
  req.end();
}
