const fs = require('fs');
const path = require('path');

const targets = {
  'tiger_keys.ts': 176,
  'tiger_move.ts': 32,
  'tiger_objection.ts': 88,
  'tiger_onboard.ts': 87,
  'tiger_score_1to10.ts': 99,
  'tiger_scout.ts': 154,
  'tiger_search.ts': 20
};

for (const [file, lineNum] of Object.entries(targets)) {
  const p = path.join(__dirname, file);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  
  // The line number is 1-indexed, so index is lineNum - 1
  const lineIdx = lineNum - 1;
  
  if (lines[lineIdx] && lines[lineIdx].trim() === '}') {
    lines.splice(lineIdx, 1);
    fs.writeFileSync(p, lines.join('\n'));
    console.log(`Removed stray brace from ${file} at line ${lineNum}`);
  } else {
    console.log(`WARNING: Expected '}' at ${file}:${lineNum} but found '${lines[lineIdx]}'`);
  }
}
