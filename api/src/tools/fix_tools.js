const fs = require('fs');
const path = require('path');

const toolsDir = __dirname;
const files = fs.readdirSync(toolsDir).filter(f => f.startsWith('tiger_') && f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(toolsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Remove local interface ToolContext and ToolResult
  content = content.replace(/interface ToolContext\s*\{[\s\S]*?storage:\s*\{[^}]*?\};\s*\n\}/g, '');
  content = content.replace(/interface ToolResult\s*\{[\s\S]*?\n\}/g, '');

  // 2. Add import for ToolContext and ToolResult if not present
  if (!content.includes('import { ToolContext')) {
    content = `import { ToolContext, ToolResult } from "./ToolContext.js";\n` + content;
  }

  // 3. Fix generic Promise return types natively missing from async functions
  content = content.replace(/(async\s+function\s+\w+\s*\([^)]*\)\s*:\s*)(ToolResult)(\s*\{)/g, (match, p1, p2, p3) => `${p1}Promise<${p2}>${p3}`);
  content = content.replace(/(async\s+function\s+\w+\s*\([^)]*\)\s*:\s*)(void|string|boolean|number)(\s*\{)/g, (match, p1, p2, p3) => `${p1}Promise<${p2}>${p3}`);

  // 4. Fix duplicate context declarations
  content = content.replace(/const\s+context\s+=\s+this\.getContext\(\);/g, '// const context = this.getContext();');
  content = content.replace(/const\s+context\s+=\s+options\.context;/g, '// const context = options.context;');

  // 5. Fix T undefined in 'async function execute<T>' -> 'async function execute'
  content = content.replace(/async\s+function\s+execute\s*<\s*T\s*>/g, 'async function execute');

  // 6. Fix missing workdir (only match whole word 'workdir')
  // Find instances where workdir is used without context
  content = content.replace(/path\.join\(\s*workdir\s*,/g, 'path.join(context.workdir,');
  content = content.replace(/const\s+(\w+)\s*=\s*workdir;/g, 'const $1 = context.workdir;');
  // Specific fix for file system read operations using workdir directly
  content = content.replace(/fs\.readFileSync\(\s*workdir/g, 'fs.readFileSync(context.workdir');

  // 7. Fix un-exported asyncs inside tiger_search.ts causing TS1029
  content = content.replace(/async\s+export\s+function/g, 'export async function');

  // 8. Fix specific 'record is of type unknown' by appending 'any' cast defensively on the exact variables, not single-letter regexes
  // Instead of regex 'r.' which breaks 'logger', match specific common object methods
  content = content.replace(/\(r as any\)/g, 'r'); // clean up previous if needed
  content = content.replace(/\(record as any\)/g, 'record');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched safely: ${file}`);
  }
}
console.log('All tools safely patched.');
