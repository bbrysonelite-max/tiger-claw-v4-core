import { Router, type Request, type Response } from "express";
import { FLAVOR_REGISTRY } from "../config/flavors/index.js";

const router = Router();

// Get all flavors (minimal data for scouts)
router.get("/", (_req: Request, res: Response) => {
  const flavors = Object.values(FLAVOR_REGISTRY).map(f => ({
    key: f.key,
    displayName: f.displayName,
    scoutQueries: f.scoutQueries || []
  }));
  res.json(flavors);
});

export default router;
