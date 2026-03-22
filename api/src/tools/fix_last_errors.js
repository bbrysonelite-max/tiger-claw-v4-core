const fs = require('fs');
const path = require('path');

const filesToCleanContext = [
  'tiger_keys.ts',
  'tiger_move.ts',
  'tiger_objection.ts',
  'tiger_onboard.ts',
  'tiger_score_1to10.ts',
  'tiger_scout.ts',
  'tiger_search.ts'
];

for (const f of filesToCleanContext) {
  const p = path.join(__dirname, f);
  let content = fs.readFileSync(p, 'utf8');
  // Target the specific ToolContext rogue formats that didn't have a storage property
  content = content.replace(/interface ToolContext\s*\{[\s\S]*?logger:\s*\{[\s\S]*?\}\s*;/g, '/* removed */');
  content = content.replace(/interface ToolContext\s*\{[\s\S]*?\n\}\n/g, ''); 
  fs.writeFileSync(p, content);
}

// Fix tiger_export.ts missing tenantId
let exportPath = path.join(__dirname, 'tiger_export.ts');
let exportContent = fs.readFileSync(exportPath, 'utf8');
if (!exportContent.includes('const tenantId = context.agentId;')) {
    exportContent = exportContent.replace(/async function execute\([\s\S]*?\{\n/m, (match) => match + '  const tenantId = context.agentId;\n');
    fs.writeFileSync(exportPath, exportContent);
}

console.log('Last errors patched safely.');
