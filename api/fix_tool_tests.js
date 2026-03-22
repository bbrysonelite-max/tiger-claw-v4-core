const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'src', 'tools', '__tests__');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

for (const file of files) {
    const fullPath = path.join(testDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Expected tool object name derived from the filename
    const toolName = file.replace('.test.ts', ''); // e.g. "tiger_settings"
    
    // Claude assumed camelCase function exports
    const camelName = toolName.replace(/_([a-z])/g, (g) => g[1].toUpperCase()); // e.g. "tigerSettings"
    const alternateCamel = toolName.replace("tiger_", "tiger"); // just in case

    // Fix imports
    content = content.replace(new RegExp(`import \\{\\s*${camelName}\\s*\\}`, 'g'), `import { ${toolName} }`);
    content = content.replace(new RegExp(`import \\{\\s*${alternateCamel}\\s*\\}`, 'g'), `import { ${toolName} }`);

    // Fix function calls -> object.execute calls
    content = content.replace(new RegExp(`${camelName}\\(`, 'g'), `${toolName}.execute(`);
    content = content.replace(new RegExp(`${alternateCamel}\\(`, 'g'), `${toolName}.execute(`);

    // Some tests might have `const result = await tigerSettings({}, ctx)` -> `tiger_settings.execute({}, ctx)`
    fs.writeFileSync(fullPath, content);
    console.log(`[FIXED] ${file}`);
}
