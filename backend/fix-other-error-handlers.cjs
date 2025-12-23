const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
const newLines = [];
let fixed400 = 0;
let fixed404 = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check for res.status(400) or res.status(404) that might need protection
  if (line.includes('res.status(400)') || line.includes('res.status(404)')) {
    // Skip if it's a return statement (those are usually safe)
    if (line.includes('return res.status')) {
      newLines.push(line);
      continue;
    }
    
    // Check if there's already a headersSent check
    let hasHeadersSent = false;
    for (let j = Math.max(0, i - 10); j < i; j++) {
      if (lines[j].includes('headersSent')) {
        hasHeadersSent = true;
        break;
      }
    }
    
    if (!hasHeadersSent) {
      const indent = line.match(/^\s*/)[0];
      newLines.push(`${indent}if (!res.headersSent) {`);
      newLines.push(line);
      newLines.push(`${indent}}`);
      if (line.includes('400')) fixed400++;
      if (line.includes('404')) fixed404++;
      continue;
    }
  }
  
  newLines.push(line);
}

if (fixed400 > 0 || fixed404 > 0) {
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  console.log(`✅ Fixed ${fixed400} status(400) and ${fixed404} status(404) handlers`);
} else {
  console.log('ℹ️  No additional error handlers needed fixing');
}
