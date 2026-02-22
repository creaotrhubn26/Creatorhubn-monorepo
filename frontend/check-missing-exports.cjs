const fs = require('fs');
const { execSync } = require('child_process');

// Get all exports from CreatorHubIcons
const iconsFile = fs.readFileSync('client/src/components/shared/CreatorHubIcons.tsx', 'utf8');
const exportedNames = new Set();

// Named exports: export { X as Y }
for (const m of iconsFile.matchAll(/export\s*\{([^}]+)\}/g)) {
  for (const item of m[1].split(',')) {
    const asMatch = item.match(/as\s+(\w+)/);
    if (asMatch) exportedNames.add(asMatch[1].trim());
    else {
      const name = item.trim();
      if (name) exportedNames.add(name);
    }
  }
}

// Direct exports: export const/function/etc
for (const m of iconsFile.matchAll(/export\s+(const|function|class|type|interface)\s+(\w+)/g)) {
  exportedNames.add(m[2]);
}

// Get all named imports from files importing CreatorHubIcons
const grepResult = execSync("grep -rh 'from.*CreatorHubIcons' client/src/ --include='*.tsx' --include='*.ts' | grep 'import {'", { encoding: 'utf8' });
const needed = new Set();
for (const line of grepResult.split('\n')) {
  const match = line.match(/import\s*\{([^}]+)\}/);
  if (match) {
    for (let item of match[1].split(',')) {
      item = item.replace(/\s+as\s+\w+/, '').trim();
      if (item && !item.includes('*')) needed.add(item);
    }
  }
}

const missing = [...needed].filter(n => !exportedNames.has(n)).sort();
console.log('Total exports:', exportedNames.size);
console.log('Total needed:', needed.size);
console.log('Missing:', missing.length);
missing.forEach(m => console.log('  -', m));

// Also check which ones are imported from MUI in the file
const muiImports = new Set();
for (const m of iconsFile.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@mui\/icons-material'/g)) {
  for (const item of m[1].split(',')) {
    const name = item.replace(/\s+as\s+\w+/, '').trim();
    if (name) muiImports.add(name);
  }
}

console.log('\nMissing icons that ARE imported from MUI:');
missing.filter(m => muiImports.has(m)).forEach(m => console.log('  + already imported:', m));

console.log('\nMissing icons NOT imported from MUI:');
missing.filter(m => !muiImports.has(m)).forEach(m => console.log('  ! needs import:', m));
