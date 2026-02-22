const { execSync } = require('child_process');
const fs = require('fs');
const files = [
  'client/src/components/tutorial/InteractiveTutorialCreator.tsx',
  'client/src/components/admin/visual-editor/ComponentLibrary.tsx',
  'client/src/components/chat/ChatWidget.tsx',
  'client/src/components/file-management/FilesTab.tsx',
  'client/src/components/memory-card/MemoryCardSelector.tsx',
  'client/src/components/universal/UniversalSettingsPanel.tsx',
  'client/src/components/admin/visual-editor/CodeEditorPanel.tsx',
  'client/src/components/admin/visual-editor/AccessibilityChecker.tsx',
  'client/src/components/universal/misc/CameraEquipmentManager.tsx',
  'client/src/components/academy/AcademyFloatingActionMenu.tsx',
  'client/src/components/project/ProjectHealthCheck.tsx',
  'client/src/components/unused/submissions/SubmissionsOverview.tsx',
];
const parser = require('@babel/parser');
for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    console.log('OK: ' + f);
  } catch(e) {
    console.log('FAIL: ' + f + ' => ' + e.message.split('\n')[0]);
  }
}
