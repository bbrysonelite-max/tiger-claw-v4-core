// Tiger Claw — Secret Loader (Volume Mounts)
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.4 Hardening
//
// Reads secrets from /secrets/* (mounted via GCP Secret Manager)
// and populates process.env to maintain backward compatibility.

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const SECRETS_DIR = "/secrets";

export function loadSecrets(): void {
  if (!existsSync(SECRETS_DIR)) {
    console.log("[secrets] /secrets directory not found — skipping volume mount injection (likely local dev).");
    return;
  }

  try {
    const files = readdirSync(SECRETS_DIR);
    console.log(`[secrets] Found ${files.length} mounted secrets in ${SECRETS_DIR}.`);

    for (const filename of files) {
      // Skip hidden files/directories (like ..data, ..2026_03_15_...)
      if (filename.startsWith(".")) continue;

      const fullPath = join(SECRETS_DIR, filename);
      try {
        const content = readFileSync(fullPath, "utf8").trim();
        process.env[filename] = content;
        // console.log(`[secrets] Injected process.env["${filename}"] from volume.`);
      } catch (err) {
        console.warn(`[secrets] Failed to read secret file "${filename}":`, err);
      }
    }
    console.log("[secrets] Volume mount secret injection complete.");
  } catch (err) {
    console.error("[secrets] Error reading /secrets directory:", err);
  }
}
