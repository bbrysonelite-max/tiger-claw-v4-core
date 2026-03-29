// Tiger Claw — Secret Loader (Volume Mounts)
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.4 Hardening
//
// Reads secrets from /secrets/* (mounted via GCP Secret Manager)
// and populates process.env to maintain backward compatibility.
//
// FIX 2026-03-29: Cloud Run mounts each secret as a DIRECTORY
// (e.g. /secrets/DATABASE_URL/ containing a version file),
// not as a plain file. We now detect directories and read
// the first non-hidden file inside them.

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

const SECRETS_DIR = "/secrets";

export function loadSecrets(): void {
  if (!existsSync(SECRETS_DIR)) {
    console.log("[secrets] /secrets directory not found — skipping volume mount injection (likely local dev).");
    return;
  }

  try {
    const entries = readdirSync(SECRETS_DIR);
    console.log(`[secrets] Found ${entries.length} mounted secrets in ${SECRETS_DIR}.`);

    for (const name of entries) {
      if (name.startsWith(".")) continue;

      const fullPath = join(SECRETS_DIR, name);
      try {
        const stat = statSync(fullPath);
        let content: string;

        if (stat.isDirectory()) {
          // Cloud Run volume mounts: secret is a directory containing version file(s)
          const inner = readdirSync(fullPath).filter(f => !f.startsWith("."));
          if (inner.length === 0) {
            console.warn(`[secrets] Secret directory "${name}" is empty — skipping.`);
            continue;
          }
          content = readFileSync(join(fullPath, inner[0]), "utf8").trim();
        } else {
          content = readFileSync(fullPath, "utf8").trim();
        }

        process.env[name] = content;
        console.log(`[secrets] Loaded secret "${name}" into process.env.`);
      } catch (err) {
        console.warn(`[secrets] Failed to read secret "${name}":`, (err as Error).message);
      }
    }
    console.log("[secrets] Volume mount secret injection complete.");
  } catch (err) {
    console.error("[secrets] Error reading /secrets directory:", err);
  }
}
