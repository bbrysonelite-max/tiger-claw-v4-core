import { Router, type Request, type Response } from "express";
import { verifySessionToken } from "./auth.js";

const router = Router();

// Require a valid wizard session — prevents public key-fishing
function requireSession(req: Request, res: Response, next: () => void): void {
    const token = req.headers["x-session-token"] as string | undefined;
    if (!token || !verifySessionToken(token)) {
        res.status(401).json({ valid: false, reason: "unauthorized" });
        return;
    }
    next();
}

router.post("/validate", requireSession, async (req: Request, res: Response) => {
    try {
        const { provider, key } = req.body;

        if (!provider || !key || typeof key !== "string" || typeof provider !== "string") {
            return res.status(400).json({ valid: false, reason: "invalid_request" });
        }

        if (provider === "google") {
            // Use header instead of query param — key in URL is logged by Google infra
            const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
                headers: { "x-goog-api-key": key },
            });
            if (resp.ok) {
                return res.json({ valid: true, model: "gemini-2.0-flash" });
            } else if (resp.status === 400 || resp.status === 403) {
                return res.json({ valid: false, reason: "invalid_api_key" });
            } else if (resp.status === 429) {
                return res.json({ valid: false, reason: "insufficient_quota" });
            } else {
                return res.json({ valid: false, reason: "network_error" });
            }
        }

        return res.status(400).json({ valid: false, reason: "unsupported_provider" });

    } catch (err) {
        console.error("[keys] Validation error:", err);
        return res.status(500).json({ valid: false, reason: "network_error" });
    }
});

export default router;
