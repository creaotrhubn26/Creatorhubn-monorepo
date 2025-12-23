const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Count current instances
const beforeCount = (content.match(/res\.status\(500\)/g) || []).length;
console.log(`Found ${beforeCount} instances of res.status(500)`);

// Fix all res.status(500) that are not already protected by headersSent check
// This regex finds res.status(500) lines that don't have headersSent check in the preceding 10 lines
const lines = content.split('\n');
const newLines = [];
let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if this line has res.status(500)
  if (line.includes('res.status(500)')) {
    // Check if there's already a headersSent check in the previous lines (within same catch block)
    let hasHeadersSent = false;
    let j = i - 1;
    let braceCount = 0;
    
    // Look backwards to find the start of the catch block
    while (j >= 0 && j >= i - 20) {
      if (lines[j].includes('headersSent')) {
        hasHeadersSent = true;
        break;
      }
      if (lines[j].includes('} catch')) {
        break; // Reached start of catch block
      }
      j--;
    }
    
    if (!hasHeadersSent) {
      // Add headersSent check
      const indent = line.match(/^\s*/)[0];
      newLines.push(`${indent}if (!res.headersSent) {`);
      newLines.push(line);
      newLines.push(`${indent}}`);
      fixed++;
      continue;
    }
  }
  
  newLines.push(line);
}

if (fixed > 0) {
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  console.log(`✅ Fixed ${fixed} error handlers`);
} else {
  console.log('ℹ️  All error handlers already have headersSent checks');
}
