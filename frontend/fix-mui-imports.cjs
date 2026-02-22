/**
 * Automated MUI import fixer script
 * Fixes garbled icon names, made-up icons, comment-corrupted imports,
 * Timeline components (move to @mui/lab), Props types, etc.
 */
const fs = require('fs');
const path = require('path');

// Load valid exports
const materialExports = new Set(fs.readFileSync('/tmp/mui-material-exports.txt', 'utf8').trim().split('\n'));
const iconsExports = new Set(fs.readFileSync('/tmp/mui-icons-exports.txt', 'utf8').trim().split('\n'));

// Mapping of garbled/invalid icon names to valid ones
const ICON_REPLACEMENTS = {
  // Doubled/garbled names
  'PlayArrowArrow': 'PlayArrow',
  'PhotoCameraAlt': 'PhotoCamera',
  'PhotoCameraAltFront': 'PhotoCamera',
  'Videocamcam': 'Videocam',
  'LibraryMusicNote': 'LibraryMusic',
  'DirectionsBusiness': 'Business',
  'CalendarTodayToday': 'CalendarToday',
  'VideocamCall': 'VideoCall',
  'VideocamLibrary': 'VideoLibrary',
  'MusicNoteNote': 'MusicNote',
  'ContentContentCopy': 'ContentCopy',
  'FilterListList': 'FilterList',
  'BoxChart': 'BarChart',
  'VolumeUpUp': 'VolumeUp',
  'FormatFormatBold': 'FormatBold',
  'FormatFormatItalic': 'FormatItalic',
  'FormatFormatUnderlinedd': 'FormatUnderlined',
  'FormatFormatAlignLeft': 'FormatAlignLeft',
  'FormatFormatAlignCenter': 'FormatAlignCenter',
  'FormatFormatAlignRight': 'FormatAlignRight',
  'AttachDescription': 'AttachFile',
  'FlashOnOn': 'FlashOn',
  'DirectionsBusinessCenter': 'BusinessCenter',
  'ShoppingDirectionsCart': 'ShoppingCart',
  'CreditDirectionsCard': 'CreditCard',
  'DirectionsCardGiftcard': 'CardGiftcard',
  'LocalDirectionsBoatping': 'LocalShipping',
  'DescriptionContentCopy': 'ContentCopy',
  'DescriptionUpload': 'CloudUpload',
  'GridOnOn': 'GridOn',
  'MonitorFavorite': 'Monitor',
  'VideocamDescription': 'Videocam',
  'CameraAltAlt': 'CameraAlt',
  'PlayArrowlistAddCheck': 'PlaylistAddCheck',
  'FlowSheetOutlined': 'AccountTree',
  'FilterListVintage': 'FilterVintage',
  'ViewGridOn': 'GridView',
  
  // Made-up icon names → valid replacements 
  'FlowChart': 'AccountTree',
  'Integration': 'IntegrationInstructions',
  'Behavior': 'Psychology',
  'Layout': 'ViewQuilt',
  'Template': 'Description',
  'Design': 'Brush',
  'Plugin': 'Extension',
  'Export': 'FileDownload',
  'VersionControl': 'History',
  'Workflow': 'AccountTree',
  'AI': 'AutoAwesome',
  'ML': 'ModelTraining',
  'Revenue': 'AttachMoney',
  'Client': 'Person',
  'System': 'SettingsApplications',
  'Audit': 'FactCheck',
  'Conflict': 'Warning',
  'Resolve': 'CheckCircle',
  'Globe': 'Public',
  'PublicOn': 'Public',
  'Branch': 'ForkRight',
  'Diff': 'Compare',
  'Rollback': 'Undo',
  'Move': 'OpenWith',
  'Copy': 'ContentCopy',
  'Rename': 'DriveFileRenameOutline',
  'Split': 'CallSplit',
  'Toggle': 'ToggleOn',
  'Test': 'BugReport',
  'Development': 'Code',
  'Production': 'RocketLaunch',
  'MouseIcon': 'Mouse',
  'Sparkles': 'AutoAwesome',
  'Grammar': 'Spellcheck',
  'Flow': 'Timeline',
  'Vocabulary': 'MenuBook',
  'Structure': 'AccountTree',
  'Tone': 'TuneOutlined',
  'GoogleIcon': 'Google',
  'Drive': 'CloudQueue',
  'Wedding': 'Favorite',
  'Drone': 'FlightTakeoff',
  'CameraStand': 'CameraOutdoor',
  'ManualMode': 'Tune',
  'Priority': 'PriorityHigh',
  'Wall': 'Wallpaper',
  'Corner': 'CropSquare',
  'Ceiling': 'Roofing',
  'AcousticPanel': 'Equalizer',
  'Aperture': 'Camera',
  'Confetti': 'Celebration',
  'VideoCamera': 'Videocam',
  'SignatureOutlined': 'Draw',
  'AudioSettings': 'Tune',
  'AudioDescription': 'Audiotrack',
  'DraftSaved': 'Drafts',
  'Rocket': 'RocketLaunch',
  'Images': 'Collections',
  'Cut': 'ContentCut',
  'TikTok': 'MusicVideo',
  'Snapchat': 'ChatBubble',
  'PushPinterest': 'PushPin',
  'Speed': 'Speed',
  'Screenshot': 'Screenshot',
  'Mobile': 'PhoneAndroid',
  'CircularProgress': 'HourglassEmpty',
  'Switch': 'ToggleOn',
  'WorkflowOutlined': 'AccountTree',
};

// Verify all replacements exist
for (const [bad, good] of Object.entries(ICON_REPLACEMENTS)) {
  if (!iconsExports.has(good)) {
    console.warn(`WARNING: Replacement icon "${good}" (for "${bad}") doesn't exist in @mui/icons-material`);
  }
}

// Timeline components that need @mui/lab
const TIMELINE_COMPONENTS = ['Timeline', 'TimelineItem', 'TimelineSeparator', 'TimelineConnector', 'TimelineContent', 'TimelineDot', 'TimelineOppositeContent'];

// MUI material types that aren't exported from root in MUI v6
const MATERIAL_TYPES = {
  'ButtonProps': '@mui/material/Button',
  'SliderProps': '@mui/material/Slider',
  'TabsProps': '@mui/material/Tabs',
  'TabProps': '@mui/material/Tab',
  'DialogProps': '@mui/material/Dialog',
  'IconButtonProps': '@mui/material/IconButton',
  'TooltipProps': '@mui/material/Tooltip',
  'BoxProps': '@mui/material/Box',
  'SelectProps': '@mui/material/Select',
  'TextFieldProps': '@mui/material/TextField',
  'SwitchProps': '@mui/material/Switch',
  'BadgeProps': '@mui/material/Badge',
  'SelectChangeEvent': '@mui/material/Select',
  'SvgIconProps': '@mui/material/SvgIcon',
  'AlertColor': '@mui/material/Alert',
};

// Non-existent @mui/material components
const MATERIAL_REPLACEMENTS = {
  'ColorPicker': null, // Remove, use a custom component or div
  'TabPanel': null,
  'CardTitle': null,
  'TreeItem': null,
  'Palette': null,
  'ToggleOnButton': null,
  'ListItemSecondary': null,
  'MuiCard': 'Card',
  'Confetti': null,
  'Image': null,
};

function findFiles(dir, exts) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          results.push(...findFiles(full, exts));
        } else if (exts.some(e => item.endsWith(e))) {
          results.push(full);
        }
      } catch { /* intentionally empty - file may not exist */ }
    }
  } catch { /* intentionally empty - file may not exist */ }
  return results;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const relPath = path.relative('/workspaces/Creatorhubn-monorepo/frontend', filePath);
  
  // Fix comment-corrupted imports first
  // Pattern: comments mixed into import blocks like "// Alert removed - Zero Toast Compliance\n  ComponentName"
  // Remove comment lines from within import { } blocks
  const importBlockRegex = /import\s*\{([^}]+)\}\s*from\s*['"](@mui\/material|@mui\/icons-material|@mui\/lab)['"]/g;
  
  let newContent = content.replace(importBlockRegex, (match, imports, pkg) => {
    // Remove comment lines within the import block
    let cleanedImports = imports
      .split('\n')
      .map(line => {
        // Remove full comment lines
        if (line.trim().startsWith('//')) return '';
        // Remove inline comments
        return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      })
      .join('\n');
    
    // Parse individual import names
    let names = cleanedImports.split(',')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('//'));
    
    // Fix each name
    const timelineImports = [];
    const typeImports = {};
    const fixedNames = [];
    
    for (let name of names) {
      if (!name) continue;
      
      // Handle "Name as Alias" syntax
      const asMatch = name.match(/^(\w+)\s+as\s+(\w+)$/);
      const originalName = asMatch ? asMatch[1] : name;
      const alias = asMatch ? asMatch[2] : null;
      
      if (pkg === '@mui/material') {
        // Check Timeline components
        if (TIMELINE_COMPONENTS.includes(originalName)) {
          timelineImports.push(name);
          continue;
        }
        
        // Check type imports
        if (MATERIAL_TYPES[originalName]) {
          if (!typeImports[MATERIAL_TYPES[originalName]]) {
            typeImports[MATERIAL_TYPES[originalName]] = [];
          }
          typeImports[MATERIAL_TYPES[originalName]].push(name);
          continue;
        }
        
        // Check non-existent material components
        if (MATERIAL_REPLACEMENTS[originalName] !== undefined) {
          if (MATERIAL_REPLACEMENTS[originalName]) {
            fixedNames.push(alias ? `${MATERIAL_REPLACEMENTS[originalName]} as ${alias}` : MATERIAL_REPLACEMENTS[originalName]);
          }
          // else: remove entirely (null)
          continue;
        }
        
        // Check if valid
        if (materialExports.has(originalName)) {
          fixedNames.push(name);
        } else {
          console.log(`  [WARN] Unknown @mui/material export: "${originalName}" in ${relPath} - removing`);
        }
      } else if (pkg === '@mui/icons-material') {
        // Apply icon replacements
        if (ICON_REPLACEMENTS[originalName]) {
          const replacement = ICON_REPLACEMENTS[originalName];
          if (alias) {
            fixedNames.push(`${replacement} as ${alias}`);
          } else {
            // Use alias to preserve original name used in JSX
            fixedNames.push(`${replacement} as ${originalName}`);
          }
          continue;
        }
        
        // Check if valid
        if (iconsExports.has(originalName)) {
          fixedNames.push(name);
        } else {
          // Try common fixes
          console.log(`  [WARN] Unknown @mui/icons-material export: "${originalName}" in ${relPath} - removing`);
        }
      }
    }
    
    // Build result
    let result = '';
    
    if (fixedNames.length > 0) {
      if (fixedNames.length <= 3) {
        result = `import { ${fixedNames.join(', ')} } from '${pkg}'`;
      } else {
        result = `import {\n  ${fixedNames.join(',\n  ')},\n} from '${pkg}'`;
      }
    }
    
    // Add timeline imports as separate import from @mui/lab
    if (timelineImports.length > 0) {
      const timelineStr = `import { ${timelineImports.join(', ')} } from '@mui/lab'`;
      if (result) {
        result = result + ';\n' + timelineStr;
      } else {
        result = timelineStr;
      }
    }
    
    // Add type imports
    for (const [source, typeNames] of Object.entries(typeImports)) {
      const typeStr = `import type { ${typeNames.join(', ')} } from '${source}'`;
      if (result) {
        result = result + ';\n' + typeStr;
      } else {
        result = typeStr;
      }
    }
    
    if (!result) {
      // All imports were removed - return empty but mark for cleanup
      return `/* EMPTY_IMPORT_REMOVED */`;
    }
    
    return result;
  });
  
  // Clean up empty import markers
  newContent = newContent.replace(/\/\* EMPTY_IMPORT_REMOVED \*\/;?\n?/g, '');
  
  if (newContent !== content) {
    modified = true;
    fs.writeFileSync(filePath, newContent);
    console.log(`FIXED: ${relPath}`);
  }
  
  return modified;
}

// Main
const srcDir = '/workspaces/Creatorhubn-monorepo/frontend/client/src';
const files = findFiles(srcDir, ['.tsx', '.ts']);

let fixedCount = 0;
for (const file of files) {
  if (fixFile(file)) fixedCount++;
}

console.log(`\nDone. Fixed ${fixedCount} files.`);
