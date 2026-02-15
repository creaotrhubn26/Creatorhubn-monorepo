export type VisualEditorTokens = {
  toolbar: {
    editTitle: string;
    lastEditedLabel: string;
    breadcrumbs: {
      project: string;
      section: string;
    };
    saveStatus: {
      saving: string;
      saved: string;
      unsaved: string;
    };
    tooltips: {
      undo: string;
      redo: string;
      history: string;
      settings: string;
      preview: string;
      historyTitle: string;
    };
    historyEmpty: string;
    publishLabel: string;
  };
  legacyToolbar: {
    titleFallback: string;
    featuresLabel: string;
    dynamicControls: {
      extended: string;
      highPower: string;
    };
    actionTooltips: {
      undo: string;
      redo: string;
      save: string;
      undoWithShortcut: string;
      redoWithShortcut: string;
      saveWithShortcut: string;
    };
    viewTabs: {
      plan: string;
      designer: string;
      components: string;
      code: string;
      preview: string;
      seo: string;
    };
    dashboard: {
      label: string;
      showTooltip: string;
      hideTooltip: string;
    };
    gridControls: {
      snap: string;
      multi: string;
    };
    extraActions: {
      multiSelect: string;
      generateCode: string;
      fullscreen: string;
      settings: string;
      save: string;
    };
    status: {
      selectedSuffix: string;
      saving: string;
    };
    integrations: {
      assetLibrary: string;
      scrollStories: string;
      googleServices: string;
      notes: string;
      qualityAnalysis: string;
    };
    editActions: {
      copy: string;
      paste: string;
      delete: string;
      group: string;
      ungroup: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
      distributeHorizontally: string;
      distributeVertically: string;
      bringToFront: string;
      sendToBack: string;
    };
  };
  bottomToolbar: {
    brandLabel: string;
    deviceModes: {
      desktop: string;
      tablet: string;
      mobile: string;
    };
    tooltips: {
      undo: string;
      redo: string;
      screenshot: string;
      viewCode: string;
    };
    socialLabel: string;
  };
  gridControls: {
    showGrid: string;
    hideGrid: string;
    snapOn: string;
    snapOff: string;
    sizes: {
      small: string;
      medium: string;
      large: string;
    };
  };
  componentLibrary: {
    pagesLabel: string;
    homeLabel: string;
    sections: {
      layouts: string;
      basic: string;
      media: string;
      forms: string;
    };
    items: {
      layouts: {
        sections: { label: string; description: string };
        container: { label: string; description: string };
        grid: { label: string; description: string };
        columns: { label: string; description: string };
      };
      basic: {
        div: { label: string; description: string };
        list: { label: string; description: string };
        listItem: { label: string; description: string };
        link: { label: string; description: string };
        button: { label: string; description: string };
      };
      media: {
        image: { label: string; description: string };
        video: { label: string; description: string };
        youtube: { label: string; description: string };
        lottie: { label: string; description: string };
      };
      forms: {
        form: { label: string; description: string };
        label: { label: string; description: string };
        input: { label: string; description: string };
      };
    };
  };
  sidebar: {
    title: string;
    featuresLabel: string;
    tabs: {
      components: string;
      assets: string;
      tools: string;
    };
    searchPlaceholder: string;
    categoriesLabel: string;
    componentsLabel: string;
    categoryAll: string;
    categoryBasic: string;
    categoryLayout: string;
    categoryMedia: string;
    categoryText: string;
    categoryInteractive: string;
    assetsPanel: {
      title: string;
      openLibrary: string;
      scrollStories: string;
      googleServices: string;
    };
    toolsPanel: {
      title: string;
      noteEditor: string;
      settings: string;
    };
    components: {
      text: { label: string; description: string };
      button: { label: string; description: string };
      image: { label: string; description: string };
      card: { label: string; description: string };
      container: { label: string; description: string };
      grid: { label: string; description: string };
    };
  };
  propertiesPanel: {
    panelTitle: string;
    panelSubtitleSuffix: string;
    actions: {
      copy: string;
      duplicate: string;
      delete: string;
      lock: string;
      hide: string;
    };
    emptyState: {
      title: string;
      body: string;
      tipsTitle: string;
      tipSelect: string;
      tipMulti: string;
      tipEsc: string;
    };
    multiSelect: {
      title: string;
      objectsSuffix: string;
      bulkActions: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
      distributeHorizontally: string;
      distributeVertically: string;
      groupSelection: string;
    };
    singleSelect: {
      positionSize: string;
      typography: string;
      fillStroke: string;
      appearance: string;
      effects: string;
      content: string;
      link: string;
      behavior: string;
      alignment: string;
      format: string;
      status: string;
      save: string;
      cancel: string;
      placeholderText: string;
      layout: string;
    };
    labels: {
      id: string;
      x: string;
      y: string;
      width: string;
      height: string;
      opacity: string;
      rotation: string;
      radius: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: string;
      transparency: string;
      fontSize: string;
      size: string;
      fontWeight: string;
      lineHeight: string;
      letterSpacing: string;
      textAlign: string;
      fill: string;
      fillColor: string;
      stroke: string;
      strokeColor: string;
      background: string;
      border: string;
      shadow: string;
      content: string;
      linkUrl: string;
      openInNew: string;
      lockAspectRatio: string;
      padding: string;
      margin: string;
      display: string;
      textContent: string;
      buttonText: string;
      cardTitle: string;
      cardContent: string;
    };
    options: {
      auto: string;
      custom: string;
      left: string;
      center: string;
      right: string;
      justify: string;
      enabled: string;
      disabled: string;
      regular: string;
      bold: string;
      normal: string;
      lighter: string;
      bolder: string;
      fontRoboto: string;
      fontArial: string;
      fontHelvetica: string;
      displayBlock: string;
      displayInline: string;
      displayFlex: string;
      displayGrid: string;
    };
  };
  visualEditorPanel: {
    title: string;
    instructions: string;
    selectedLabel: string;
    elementLabel: string;
    saveTooltip: string;
    undoTooltip: string;
    previewTooltip: string;
    featureEditorTooltip: string;
    changesLabel: string;
    featuresLabel: string;
    toast: {
      enabledTitle: string;
      enabledDescription: string;
      disabledTitle: string;
      disabledDescription: string;
      colorChangedTitle: string;
      colorChangedDescription: string;
      saveSuccessTitle: string;
      saveSuccessDescription: string;
      saveErrorTitle: string;
      saveErrorDescription: string;
      undoTitle: string;
      undoDescription: string;
      featureUpdatedTitle: string;
      featureUpdatedDescription: string;
    };
    elementTypes: {
      button: string;
      text: string;
      background: string;
      icon: string;
    };
  };
  fab: {
    label: string;
    icon: 'edit' | 'palette' | 'paint' | 'visibility' | 'tune';
  };
  enhancedPage: {
    fabs: {
      unifiedStudio: string;
      accessibility: string;
      exportPanel: string;
      componentLibrary: string;
      shortcuts: string;
      codeEditor: string;
      livePreviewPanel: string;
      previewMode: string;
      settings: string;
    };
  };
  iconAnimation: {
    scaleHover: number;
    scaleActive: number;
    durationMs: number;
    easing: string;
  };
};

export const DEFAULT_VISUAL_EDITOR_TOKENS: VisualEditorTokens = {
  toolbar: {
    editTitle: 'Edit Visual Design',
    lastEditedLabel: 'Last edited 2 mins ago',
    breadcrumbs: {
      project: 'Visual Editor Project',
      section: 'Design',
    },
    saveStatus: {
      saving: 'Saving...',
      saved: 'Saved',
      unsaved: 'Unsaved',
    },
    tooltips: {
      undo: 'Undo',
      redo: 'Redo',
      history: 'History',
      settings: 'Settings',
      preview: 'Preview',
      historyTitle: 'History',
    },
    historyEmpty: 'No history yet',
    publishLabel: 'Publish',
  },
  legacyToolbar: {
    titleFallback: 'CreatorHub Visual Editor',
    featuresLabel: 'Features',
    dynamicControls: {
      extended: 'Extended',
      highPower: 'High Power',
    },
    actionTooltips: {
      undo: 'Undo',
      redo: 'Redo',
      save: 'Save',
      undoWithShortcut: 'Undo (Ctrl+Z)',
      redoWithShortcut: 'Redo (Ctrl+Y)',
      saveWithShortcut: 'Save (Ctrl+S)',
    },
    viewTabs: {
      plan: 'Plan',
      designer: 'Designer',
      components: 'Components',
      code: 'Code',
      preview: 'Preview',
      seo: 'SEO',
    },
    dashboard: {
      label: 'Dashboard',
      showTooltip: 'Show Unified Dashboard',
      hideTooltip: 'Hide Unified Dashboard',
    },
    gridControls: {
      snap: 'Snap',
      multi: 'Multi',
    },
    extraActions: {
      multiSelect: 'Multi-select',
      generateCode: 'Generate Code',
      fullscreen: 'Fullscreen',
      settings: 'Settings',
      save: 'Save',
    },
    status: {
      selectedSuffix: 'selected',
      saving: 'Saving...',
    },
    integrations: {
      assetLibrary: 'Asset Library',
      scrollStories: 'Scroll Stories',
      googleServices: 'Google Services',
      notes: 'Notes',
      qualityAnalysis: 'Quality Analysis',
    },
    editActions: {
      copy: 'Copy',
      paste: 'Paste',
      delete: 'Delete',
      group: 'Group',
      ungroup: 'Ungroup',
      alignLeft: 'Align Left',
      alignCenter: 'Align Center',
      alignRight: 'Align Right',
      distributeHorizontally: 'Distribute Horizontally',
      distributeVertically: 'Distribute Vertically',
      bringToFront: 'Bring to Front',
      sendToBack: 'Send to Back',
    },
  },
  bottomToolbar: {
    brandLabel: 'CREATORHUB',
    deviceModes: {
      desktop: 'Desktop',
      tablet: 'Tablet',
      mobile: 'Mobile',
    },
    tooltips: {
      undo: 'Undo',
      redo: 'Redo',
      screenshot: 'Screenshot',
      viewCode: 'View Code',
    },
    socialLabel: 'Social Media',
  },
  gridControls: {
    showGrid: 'Show Grid',
    hideGrid: 'Hide Grid',
    snapOn: 'Snap On',
    snapOff: 'Snap Off',
    sizes: {
      small: '8px',
      medium: '16px',
      large: '24px',
    },
  },
  componentLibrary: {
    pagesLabel: 'Pages',
    homeLabel: 'Home',
    sections: {
      layouts: 'Layouts',
      basic: 'Basic',
      media: 'Media',
      forms: 'Forms',
    },
    items: {
      layouts: {
        sections: { label: 'Sections', description: 'Add Column' },
        container: { label: 'Container', description: 'Add Button for action' },
        grid: { label: 'Grid', description: 'Divide blocks visually' },
        columns: { label: 'Columns', description: 'Add Menu to navigate' },
      },
      basic: {
        div: { label: 'Div Block', description: 'Add Column' },
        list: { label: 'List', description: 'Add Button for action' },
        listItem: { label: 'List Item', description: 'Divide blocks visually' },
        link: { label: 'Link Block', description: 'Add Menu to navigate' },
        button: { label: 'Button', description: 'Set time to this mail' },
      },
      media: {
        image: { label: 'Image', description: 'Add image' },
        video: { label: 'Video', description: 'Add Button for action' },
        youtube: { label: 'Youtube', description: 'Divide blocks visually' },
        lottie: { label: 'Lottie Animation', description: 'Add Menu to navigate' },
      },
      forms: {
        form: { label: 'Form Block', description: 'Add Column' },
        label: { label: 'Label', description: 'Add Button for action' },
        input: { label: 'Input', description: 'Divide blocks visually' },
      },
    },
  },
  sidebar: {
    title: 'Components',
    featuresLabel: 'Features',
    tabs: {
      components: 'Components',
      assets: 'Assets',
      tools: 'Tools',
    },
    searchPlaceholder: 'Search components...',
    categoriesLabel: 'Categories',
    componentsLabel: 'Components',
    categoryAll: 'All Components',
    categoryBasic: 'Basic',
    categoryLayout: 'Layout',
    categoryMedia: 'Media',
    categoryText: 'Text',
    categoryInteractive: 'Interactive',
    assetsPanel: {
      title: 'Asset Library',
      openLibrary: 'Open Asset Library',
      scrollStories: 'Scroll Stories',
      googleServices: 'Google Services',
    },
    toolsPanel: {
      title: 'Tools',
      noteEditor: 'Note Editor',
      settings: 'Settings',
    },
    components: {
      text: { label: 'Text', description: 'Add text content' },
      button: { label: 'Button', description: 'Interactive button' },
      image: { label: 'Image', description: 'Image placeholder' },
      card: { label: 'Card', description: 'Content card' },
      container: { label: 'Container', description: 'Layout container' },
      grid: { label: 'Grid', description: 'Grid layout' },
    },
  },
  propertiesPanel: {
    panelTitle: 'Properties',
    panelSubtitleSuffix: 'Element',
    actions: {
      copy: 'Copy',
      duplicate: 'Duplicate',
      delete: 'Delete',
      lock: 'Lock',
      hide: 'Hide',
    },
    emptyState: {
      title: 'No Selection',
      body: 'Select an element on the canvas to edit its properties',
      tipsTitle: 'Quick Tips',
      tipSelect: 'Click an element to select',
      tipMulti: 'Hold Shift to multi-select',
      tipEsc: 'Press Esc to deselect',
    },
    multiSelect: {
      title: 'Multiple Selection',
      objectsSuffix: 'objects',
      bulkActions: 'Bulk Actions',
      alignLeft: 'Align Left',
      alignCenter: 'Align Center',
      alignRight: 'Align Right',
      distributeHorizontally: 'Distribute Horizontally',
      distributeVertically: 'Distribute Vertically',
      groupSelection: 'Group Selection',
    },
    singleSelect: {
      positionSize: 'Position & Size',
      typography: 'Typography',
      fillStroke: 'Fill & Stroke',
      appearance: 'Appearance',
      effects: 'Effects',
      content: 'Content',
      link: 'Link',
      behavior: 'Behavior',
      alignment: 'Alignment',
      format: 'Format',
      status: 'Status',
      save: 'Save',
      cancel: 'Cancel',
      placeholderText: 'Placeholder text',
      layout: 'Layout',
    },
    labels: {
      id: 'ID',
      x: 'X',
      y: 'Y',
      width: 'Width',
      height: 'Height',
      opacity: 'Opacity',
      rotation: 'Rotation',
      radius: 'Radius',
      backgroundColor: 'Background Color',
      textColor: 'Text Color',
      borderRadius: 'Border Radius',
      transparency: 'Transparency',
      fontSize: 'Font Size',
      size: 'Size',
      fontWeight: 'Font Weight',
      lineHeight: 'Line Height',
      letterSpacing: 'Letter Spacing',
      textAlign: 'Text Align',
      fill: 'Fill',
      fillColor: 'Fill Color',
      stroke: 'Stroke',
      strokeColor: 'Stroke Color',
      background: 'Background',
      border: 'Border',
      shadow: 'Shadow',
      content: 'Content',
      linkUrl: 'Link URL',
      openInNew: 'Open in new tab',
      lockAspectRatio: 'Lock aspect ratio',
      padding: 'Padding',
      margin: 'Margin',
      display: 'Display',
      textContent: 'Text Content',
      buttonText: 'Button Text',
      cardTitle: 'Card Title',
      cardContent: 'Card Content',
    },
    options: {
      auto: 'Auto',
      custom: 'Custom',
      left: 'Left',
      center: 'Center',
      right: 'Right',
      justify: 'Justify',
      enabled: 'Enabled',
      disabled: 'Disabled',
      regular: 'Regular',
      bold: 'Bold',
      normal: 'Normal',
      lighter: 'Lighter',
      bolder: 'Bolder',
      fontRoboto: 'Roboto',
      fontArial: 'Arial',
      fontHelvetica: 'Helvetica',
      displayBlock: 'Block',
      displayInline: 'Inline',
      displayFlex: 'Flex',
      displayGrid: 'Grid',
    },
  },
  visualEditorPanel: {
    title: 'Visual Editor',
    instructions: 'Click elements to edit them. Changes are validated against branding guidelines.',
    selectedLabel: 'Selected element',
    elementLabel: 'Element',
    saveTooltip: 'Save changes',
    undoTooltip: 'Undo all changes',
    previewTooltip: 'Preview changes',
    featureEditorTooltip: 'Feature Editor',
    changesLabel: 'changes',
    featuresLabel: 'Platform Features',
    toast: {
      enabledTitle: 'Visual Editor enabled',
      enabledDescription: 'Click elements to edit them',
      disabledTitle: 'Visual Editor disabled',
      disabledDescription: 'Changes are saved',
      colorChangedTitle: 'Color updated',
      colorChangedDescription: 'Element updated with new color',
      saveSuccessTitle: 'Changes saved',
      saveSuccessDescription: 'changes saved',
      saveErrorTitle: 'Save failed',
      saveErrorDescription: 'Could not save changes',
      undoTitle: 'Changes reverted',
      undoDescription: 'All changes have been reverted',
      featureUpdatedTitle: 'Feature updated',
      featureUpdatedDescription: 'is now',
    },
    elementTypes: {
      button: 'Button',
      text: 'Text',
      background: 'Background',
      icon: 'Icon',
    },
  },
  fab: {
    label: 'Toggle visual editor',
    icon: 'edit',
  },
  enhancedPage: {
    fabs: {
      unifiedStudio: 'Unified Code Studio (Cmd+Shift+C)',
      accessibility: 'Accessibility (Cmd+Shift+A)',
      exportPanel: 'Export (Cmd+E)',
      componentLibrary: 'Component Library',
      shortcuts: 'Shortcuts (Cmd+K)',
      codeEditor: 'Code Editor',
      livePreviewPanel: 'Live Preview Panel',
      previewMode: 'Preview Mode',
      settings: 'Settings',
    },
  },
  iconAnimation: {
    scaleHover: 1.08,
    scaleActive: 0.96,
    durationMs: 140,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeTokens<T extends Record<string, unknown>>(base: T, override?: Partial<T>): T {
  if (!override) return base;
  const output = { ...base } as T;
  Object.keys(override).forEach((key) => {
    const baseValue = (base as Record<string, unknown>)[key];
    const overrideValue = (override as Record<string, unknown>)[key];
    if (isObject(baseValue) && isObject(overrideValue)) {
      (output as Record<string, unknown>)[key] = mergeTokens(
        baseValue as Record<string, unknown>,
        overrideValue as Partial<Record<string, unknown>>
      );
    } else if (overrideValue !== undefined) {
      (output as Record<string, unknown>)[key] = overrideValue;
    }
  });
  return output;
}

export function getVisualEditorTokens(): VisualEditorTokens {
  if (typeof window !== 'undefined') {
    const overrides = (window as unknown as { visualEditorTokens?: Partial<VisualEditorTokens> }).visualEditorTokens;
    return mergeTokens(DEFAULT_VISUAL_EDITOR_TOKENS, overrides);
  }
  return DEFAULT_VISUAL_EDITOR_TOKENS;
}
