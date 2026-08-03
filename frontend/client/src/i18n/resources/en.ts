import type { no } from './no';

// English translations. Typed against `no` so a missing/extra key is a compile error.
export const en: Record<keyof typeof no, string> = {
  'lang.switch': 'Switch language',

  // Story Writer — tabs
  'tabs.editor': 'Editor',
  'tabs.acts': 'Acts',
  'tabs.scenes': 'Scenes',
  'tabs.characters': 'Characters',
  'tabs.dialogue': 'Dialogue',
  'tabs.breakdown': 'Breakdown',
  'tabs.revisions': 'Revisions',
  'tabs.timeline': 'Timeline',
  'tabs.storyboard': 'Storyboard',
  'tabs.production': 'Production',

  // Story Writer — toolbar
  'toolbar.autoReview': 'Auto breakdown',
  'toolbar.autoReviewShort': 'Auto',
  'toolbar.runReview': 'Run breakdown now — refresh scenes and roles from the script',
  'toolbar.export': 'Export',
  'toolbar.exportShort': 'Export',
  'toolbar.saveNow': 'Save now',
  'toolbar.saveNowTooltip': 'Save now (auto-saves otherwise)',
  'toolbar.setTargetLength': 'Set target length',
  'toolbar.targetLength': 'Target {min} min',
  'toolbar.sendApproval': 'Send for approval',
  'toolbar.sendApprovalShort': 'Approval',
  'toolbar.sendApprovalTooltip': 'Send the script on to the client / approval view',
  'toolbar.manuscript': 'Manuscript',
  'toolbar.manuscriptShort': 'Script',

  // Manuscript menu
  'menu.yourManuscripts': 'Your manuscripts',
  'menu.yourManuscriptsDesc': 'Switch draft or rename',
  'menu.newManuscript': 'New manuscript',
  'menu.fromTemplate': 'From template…',
  'menu.importFile': 'Import file…',
  'menu.importFileDesc': 'From a previous export',

  // Writing mode
  'writingMode.enter': 'Writing mode',
  'writingMode.exit': 'Exit writing mode',
  'writingMode.tooltip': 'Hide everything else and write distraction-free (Esc to exit)',
  'writingMode.exitTooltip': 'Exit writing mode (Esc)',
};
