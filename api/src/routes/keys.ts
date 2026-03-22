import { Router, type Request, type Response } from "express";

const router = Router();

router.post("/validate", async (req: Request, res: Response) => {
    try {
        const { provider, key } = req.body;

        if (!provider || !key || typeof key !== "string" || typeof provider !== "string") {
            return res.status(400).json({ valid: false, reason: "invalid_request" });
        }

        if (provider === "google") {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (resp.ok) {
                return res.json({ valid: true, model: "gemini-2.5-flash" });
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
