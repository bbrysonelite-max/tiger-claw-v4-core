import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import TelegramBot from "node-telegram-bot-api";

// ─── Shared Admin Auth ────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env["ADMIN_TOKEN"] ?? "";

if (process.env["NODE_ENV"] === "production" && ADMIN_TOKEN.length < 32) {
  throw new Error("[FATAL] ADMIN_TOKEN must be at least 32 characters in production.");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const incoming = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

  // Constant-time comparison prevents timing oracle attacks
  let authorized = false;
  try {
    if (incoming.length > 0 && ADMIN_TOKEN.length > 0) {
      const a = Buffer.from(incoming);
      const b = Buffer.from(ADMIN_TOKEN);
      authorized = a.length === b.length && timingSafeEqual(a, b);
    }
  } catch {
    authorized = false;
  }

  if (authorized) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

// ─── Shared Admin Alerts ──────────────────────────────────────────────────────

export async function sendAdminAlert(message: string): Promise<void> {
  const adminToken = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
  const adminChatId = process.env["ADMIN_TELEGRAM_CHAT_ID"];

  if (!adminToken || !adminChatId) {
    console.warn("[admin] ADMIN_TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_CHAT_ID missing — alert suppressed:", message);
    return;
  }

  try {
    const bot = new TelegramBot(adminToken);
    await bot.sendMessage(adminChatId, `🛡️ *ADMIN ALERT*\n\n${message}`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[admin] Failed to send admin alert:", err);
  }
}
