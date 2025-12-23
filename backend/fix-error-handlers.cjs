const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Pattern to find error handlers: } catch (error) { ... res.status(500).json(...) }
// We'll use a more targeted approach - find catch blocks that end with res.status(500)

let replacements = 0;
const lines = content.split('\n');
const newLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Look for catch blocks
  if (line.includes('} catch (error) {') || line.includes('} catch (err) {') || line.includes('} catch(e) {')) {
    newLines.push(line);
    i++;
    
    // Look ahead to find the res.status(500) line
    let foundStatus500 = false;
    let j = i;
    let catchBlockLines = [];
    
    while (j < lines.length && !lines[j].includes('} catch') && !lines[j].trim().startsWith('});')) {
      catchBlockLines.push(lines[j]);
      
      // Check if this line has res.status(500) without headersSent check
      if (lines[j].includes('res.status(500)') && !content.substring(0, content.indexOf(lines[j])).includes('headersSent')) {
        foundStatus500 = true;
        break;
      }
      
      j++;
    }
    
    if (foundStatus500) {
      // Find the res.status(500) line in catchBlockLines
      for (let k = 0; k < catchBlockLines.length; k++) {
        const catchLine = catchBlockLines[k];
        if (catchLine.includes('res.status(500)')) {
          // Check if previous lines already have headersSent check
          const beforeLine = catchBlockLines.slice(0, k).join('\n');
          if (!beforeLine.includes('headersSent')) {
            // Add headersSent check
            const indent = catchLine.match(/^\s*/)[0];
            newLines.push(...catchBlockLines.slice(0, k));
            newLines.push(`${indent}if (!res.headersSent) {`);
            newLines.push(catchLine);
            newLines.push(`${indent}}`);
            newLines.push(...catchBlockLines.slice(k + 1));
            replacements++;
            i = j;
            continue;
          }
        }
      }
    } else {
      // No status 500 found, just add the catch block as-is
      newLines.push(...catchBlockLines);
      i = j;
    }
  } else {
    newLines.push(line);
    i++;
  }
}

if (replacements > 0) {
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  console.log(`✅ Fixed ${replacements} error handlers`);
} else {
  console.log('ℹ️  Using simpler approach - fixing common patterns...');
  
  // Simpler approach: replace common patterns
  const patterns = [
    // Pattern 1: res.status(500).json({ error: ... });
    {
      find: /(\s+)(res\.status\(500\)\.json\(\{[^}]*error[^}]*\}\);)/g,
      replace: (match, indent, statusLine) => {
        return `${indent}if (!res.headersSent) {\n${indent}  ${statusLine}\n${indent}}`;
      }
    },
    // Pattern 2: res.status(500).json({ error: '...' });
    {
      find: /(\s+)(res\.status\(500\)\.json\(\{ error: '[^']+' \}\);)/g,
      replace: (match, indent, statusLine) => {
        return `${indent}if (!res.headersSent) {\n${indent}  ${statusLine}\n${indent}}`;
      }
    }
  ];
  
  let totalReplacements = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern.find);
    if (matches) {
      content = content.replace(pattern.find, pattern.replace);
      totalReplacements += matches.length;
    }
  }
  
  if (totalReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed ${totalReplacements} error handlers using pattern matching`);
  } else {
    console.log('⚠️  Could not automatically fix error handlers. Manual fix needed.');
  }
}

