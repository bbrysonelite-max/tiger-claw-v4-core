// Tiger Claw — Agent Browser Service (Eyes & Hands)
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.6 Autonomous Research
//
// Wraps the 'agent-browser' skill to allow Tigers to hunt on the live web.

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface BrowserAction {
  action: "open" | "click" | "fill" | "snapshot" | "screenshot";
  url?: string;
  selector?: string;
  text?: string;
}

/**
 * Executes a browser command via the agent-browser CLI.
 */
export async function runBrowserAction(action: BrowserAction): Promise<string> {
  let cmd = "npx agent-browser ";
  
  switch (action.action) {
    case "open":
      cmd += `open "${action.url}"`;
      break;
    case "snapshot":
      cmd += "snapshot -i";
      break;
    case "click":
      cmd += `click ${action.selector}`;
      break;
    case "fill":
      cmd += `fill ${action.selector} "${action.text}"`;
      break;
    case "screenshot":
      cmd += "screenshot";
      break;
  }

  try {
    console.log(`[browser] Executing: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) console.warn(`[browser] Stderr: ${stderr}`);
    return stdout;
  } catch (err: any) {
    console.error(`[browser] Action failed: ${err.message}`);
    throw err;
  }
}

/**
 * High-level tool for Tigers to research a prospect.
 */
export async function huntProspect(name: string, company?: string): Promise<string> {
  const query = encodeURIComponent(`${name} ${company || ""} linkedin`);
  const searchUrl = `https://www.google.com/search?q=${query}`;
  
  console.log(`[browser] Starting hunt for: ${name}`);
  await runBrowserAction({ action: "open", url: searchUrl });
  const snapshot = await runBrowserAction({ action: "snapshot" });
  
  // The agent will then process this snapshot to find the LinkedIn URL
  return snapshot;
}
