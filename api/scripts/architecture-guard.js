const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const FORBIDDEN_PACKAGES = [
  '@anthropic-ai/sdk',
  '@agent-relay/openclaw',
  'openclaw'
];

let violations = [];

const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

for (const forbidden of FORBIDDEN_PACKAGES) {
  if (allDeps[forbidden]) {
    violations.push(forbidden);
  }
}

if (violations.length > 0) {
  console.error('\n=============================================================');
  console.error('🚨 ARCHITECTURE VIOLATION DETECTED 🚨');
  console.error('=============================================================');
  console.error('The following packages violate the locked v4 Stateless Gemini architecture:');
  violations.forEach(v => console.error(` - ${v}`));
  console.error('\nLOCKED DECISION: Tiger Claw uses Google Gemini on Cloud Run.');
  console.error('OpenClaw and per-tenant containers are permanently removed.');
  console.error('Any external skill MUST be ported to native Gemini Function-Calling Tools.');
  console.error('=============================================================\n');
  process.exit(1);
}

console.log('[architecture-guard] System architecture is compliant.');
