import { Router, type Request, type Response } from "express";
import { tiger_refine } from "../tools/tiger_refine.js";
import { isAlreadyMined } from "../services/market_intel.js";

const router = Router();

// v5 Data Refinery endpoint
router.post("/refine", async (req: Request, res: Response) => {
  const { rawContent, sourceUrl, extractionGoal, domain } = req.body;

  if (!rawContent) {
    return res.status(400).json({ ok: false, error: "rawContent is required" });
  }

  try {
    // 1. Deduplication check (The Moat Guard)
    if (sourceUrl && await isAlreadyMined(sourceUrl)) {
      return res.json({ 
        ok: true, 
        output: "URL already mined. Skipping to protect the moat.", 
        data: { duplicated: true } 
      });
    }

    // Mock ToolContext for direct execution
    const mockContext: any = {
      sessionKey: "cluster-worker",
      logger: console,
      config: {}
    };

    const result = await tiger_refine.execute(
      { rawContent, sourceUrl, extractionGoal, domain },
      mockContext
    );

    res.json(result);
  } catch (err) {
    console.error("[mining] Refinement error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
