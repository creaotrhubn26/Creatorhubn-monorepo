const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Pattern to find error handlers that don't check headersSent
// Match: } catch (error) { ... res.status(500).json(...) }
const pattern = /(\} catch \(error\) \{[\s\S]*?)(\s+res\.status\(500\)\.json\([^)]+\))/g;

let replacements = 0;
content = content.replace(pattern, (match, catchBlock, statusLine) => {
  // Skip if already has headersSent check
  if (catchBlock.includes('headersSent')) {
    return match;
  }
  
  // Add headersSent check before the status line
  const indent = statusLine.match(/^\s*/)[0];
  const newStatusLine = `${indent}if (!res.headersSent) {\n${statusLine}\n${indent}}`;
  replacements++;
  return catchBlock + newStatusLine;
});

if (replacements > 0) {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Fixed ${replacements} error handlers`);
} else {
  console.log('ℹ️  No error handlers needed fixing (or already fixed)');
}
