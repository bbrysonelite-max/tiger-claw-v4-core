import { Request, Response, NextFunction } from "express";
import TelegramBot from "node-telegram-bot-api";

// ─── Shared Admin Auth ────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env["ADMIN_TOKEN"] ?? "";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  
  if (token === ADMIN_TOKEN) {
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
