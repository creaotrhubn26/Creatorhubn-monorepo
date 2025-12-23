#!/usr/bin/env node

/**
 * CreatorHub Norge - Icon Migration Script
 * Updates all components to use the centralized CreatorHubIcons system
 */

const fs = require('fs');
const path = require('path');

// Icon mapping for migration
const ICON_MIGRATIONS = {
  // Old Material UI imports to new CreatorHubIcons
  'PhotoCamera': 'PhotographyIcon',
  'Videocam': 'VideographyIcon', 
  'LibraryMusic': 'MusicProductionIcon',
  'Store': 'CorporateIcon',
  'Favorite': 'RingIcon',
  'CameraAlt': 'PhotographyIcon',
  'MusicNote': 'MusicProductionIcon',
  'Business': 'CorporateIcon',
  'PhotoCameraAlt': 'PhotographyIcon',
  'Videocamcam': 'VideographyIcon',
  'MusicNoteNote': 'MusicProductionIcon',
  'DirectionsBusiness': 'CorporateIcon',
};

// Import statements to replace
const IMPORT_REPLACEMENTS = [
  {
    // Replace individual Material UI icon imports
    pattern: /import\s*{\s*([^}]*?)(PhotoCamera|Videocam|LibraryMusic|Store|Favorite|CameraAlt|MusicNote|Business|PhotoCameraAlt|Videocamcam|MusicNoteNote|DirectionsBusiness)([^}]*?)\s*}\s*from\s*['"]@mui\/icons-material['"];?/g,
    replacement: (match, before, icon, after) => {
      const newIcon = ICON_MIGRATIONS[icon];
      if (newIcon) {
        return `import { ${before}${newIcon}${after} } from '@mui/icons-material';`;
      }
      return match;
    }
  },
  {
    // Add CreatorHubIcons import if not present
    pattern: /import\s*{\s*([^}]*?)(PhotographyIcon|VideographyIcon|MusicProductionIcon|CorporateIcon|RingIcon)([^}]*?)\s*}\s*from\s*['"]@mui\/icons-material['"];?/g,
    replacement: (match, before, icon, after) => {
      return `import { ${before}${icon}${after} } from '../shared/CreatorHubIcons';`;
    }
  }
];

// Component usage replacements
const USAGE_REPLACEMENTS = [
  {
    pattern: /<PhotoCamera\s*\/?>/g,
    replacement: '<PhotographyIcon />'
  },
  {
    pattern: /<Videocam\s*\/?>/g,
    replacement: '<VideographyIcon />'
  },
  {
    pattern: /<LibraryMusic\s*\/?>/g,
    replacement: '<MusicProductionIcon />'
  },
  {
    pattern: /<Store\s*\/?>/g,
    replacement: '<CorporateIcon />'
  },
  {
    pattern: /<Favorite\s*\/?>/g,
    replacement: '<RingIcon />'
  },
  {
    pattern: /<CameraAlt\s*\/?>/g,
    replacement: '<PhotographyIcon />'
  },
  {
    pattern: /<MusicNote\s*\/?>/g,
    replacement: '<MusicProductionIcon />'
  },
  {
    pattern: /<Business\s*\/?>/g,
    replacement: '<CorporateIcon />'
  },
  {
    pattern: /<PhotoCameraAlt\s*\/?>/g,
    replacement: '<PhotographyIcon />'
  },
  {
    pattern: /<Videocamcam\s*\/?>/g,
    replacement: '<VideographyIcon />'
  },
  {
    pattern: /<MusicNoteNote\s*\/?>/g,
    replacement: '<MusicProductionIcon />'
  },
  {
    pattern: /<DirectionsBusiness\s*\/?>/g,
    replacement: '<CorporateIcon />'
  }
];

function migrateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Apply import replacements
    IMPORT_REPLACEMENTS.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    // Apply usage replacements
    USAGE_REPLACEMENTS.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

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
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  const clientDir = path.join(__dirname, '..', '..', '..', '..', 'client', 'src');
  const files = findFiles(clientDir);
  
  console.log(`🔍 Found ${files.length} files to check...`);
  
  let updatedCount = 0;
  
  files.forEach(file => {
    if (migrateFile(file)) {
      updatedCount++;
    }
  });
  
  console.log(`\n🎉 Migration complete! Updated ${updatedCount} files.`);
  console.log('\n📝 Next steps:');
  console.log('1. Run: npm run lint -- --fix');
  console.log('2. Test the application');
  console.log('3. Remove unused icon imports manually if needed');
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, findFiles };
