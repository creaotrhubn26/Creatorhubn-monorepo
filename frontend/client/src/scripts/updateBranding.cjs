#!/usr/bin/env node

/**
 * CreatorHub Norge - Branding Update Script
 * Updates all hardcoded colors to use centralized branding
 */

const fs = require('fs');
const path = require('path');

// Brand color mappings
const BRAND_COLOR_MAPPINGS = {
  // Photography colors
  '#ff8c00': 'CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY',
  '#FF8C00': 'CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY',
  'ff8c00': 'CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY',
  
  // Videography colors
  '#e74c3c': 'CREATOR_HUB_BRANDING.colors.VIDEOGRAPHY',
  '#E74C3C': 'CREATOR_HUB_BRANDING.colors.VIDEOGRAPHY',
  'e74c3c': 'CREATOR_HUB_BRANDING.colors.VIDEOGRAPHY',
  
  // Music colors
  '#9b59b6': 'CREATOR_HUB_BRANDING.colors.MUSIC',
  '#9B59B6': 'CREATOR_HUB_BRANDING.colors.MUSIC',
  '9b59b6': 'CREATOR_HUB_BRANDING.colors.MUSIC',
  
  // Corporate colors
  '#27ae60': 'CREATOR_HUB_BRANDING.colors.CORPORATE',
  '#27AE60': 'CREATOR_HUB_BRANDING.colors.CORPORATE',
  '27ae60': 'CREATOR_HUB_BRANDING.colors.CORPORATE',
  
  // Primary colors
  '#1976d2': 'CREATOR_HUB_BRANDING.colors.PRIMARY',
  '#1976D2': 'CREATOR_HUB_BRANDING.colors.PRIMARY',
  '1976d2': 'CREATOR_HUB_BRANDING.colors.PRIMARY',
  
  // Error colors
  '#E30617': 'CREATOR_HUB_BRANDING.colors.ERROR',
  '#d32f2f': 'CREATOR_HUB_BRANDING.colors.ERROR',
  '#D32F2F': 'CREATOR_HUB_BRANDING.colors.ERROR',
  'd32f2f': 'CREATOR_HUB_BRANDING.colors.ERROR',
};

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'migrate-icons.cjs',
  'updateBranding.cjs',
  'CreatorHubBranding.ts', // Don't modify the branding file itself
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function updateFileContent(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let importAdded = false;

    // Check if file already imports CREATOR_HUB_BRANDING
    if (content.includes('CREATOR_HUB_BRANDING')) {
      return false;
    }

    // Apply color replacements
    Object.entries(BRAND_COLOR_MAPPINGS).forEach(([oldColor, newColor]) => {
      const patterns = [
        new RegExp(`color:\\s*['"]${oldColor}['"]`, 'g'),
        new RegExp(`color:\\s*['"]${oldColor}['"]`, 'g'),
        new RegExp(`'${oldColor}'`, 'g'),
        new RegExp(`"${oldColor}"`, 'g'),
        new RegExp(`\\b${oldColor}\\b`, 'g'),
      ];

      patterns.forEach(pattern => {
        const newContent = content.replace(pattern, newColor);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      });
    });

    // Add import if file was modified and doesn't already have it
    if (modified && !importAdded) {
      const importStatement = "import { CREATOR_HUB_BRANDING } from '../../constants/CreatorHubBranding';\n";
      
      // Find the best place to add the import
      const lines = content.split('\n');
      let insertIndex = 0;
      
      // Look for existing imports
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ') || lines[i].startsWith("import ")) {
          insertIndex = i + 1;
        } else if (lines[i].trim() === '' && insertIndex > 0) {
          break;
        }
      }
      
      // Insert the import
      lines.splice(insertIndex, 0, importStatement);
      content = lines.join('\n');
      importAdded = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !shouldExcludeFile(fullPath)) {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        if (!shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  const clientDir = path.join(__dirname, '..', '..', '..', 'client', 'src');
  const files = findFiles(clientDir);
  
  console.log(`🔍 Found ${files.length} files to check...`);
  
  let updatedCount = 0;
  
  files.forEach(file => {
    if (updateFileContent(file)) {
      updatedCount++;
    }
  });
  
  console.log(`\n🎉 Branding update complete! Updated ${updatedCount} files.`);
  console.log('\n📝 Next steps:');
  console.log('1. Run: npm run lint -- --fix');
  console.log('2. Test the application');
  console.log('3. Verify all colors are consistent');
}

if (require.main === module) {
  main();
}

module.exports = { updateFileContent, findFiles };



