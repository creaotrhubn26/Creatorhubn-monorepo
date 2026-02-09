/**
 * Modal Templates Library
 * Pre-configured modal templates for ModalCreator component
 */

export interface ModalTemplate {
  id: string;
  name: string;
  description: string;
  category: 'dialog' | 'confirm' | 'form' | 'display' | 'custom' | 'complex';
  thumbnail: string;
  tags: string[];
  structure: {
    type: 'simple' | 'form' | 'complex';
    sections: string[];
    actions: string[];
    styles: {
      width: number;
      height: number;
      theme: 'light' | 'dark' | 'custom';
      borderRadius: number;
      shadows: boolean;
  };
};
  preview: {
    title: string;
    content: string;
    buttons: string[];
};
  code: {
    jsx: string;
    css?: string;
    dependencies?: string[];
};
}

export const MODAL_TEMPLATES = [
  {
    id: 'simple-dialog',
    name: 'Simple Dialog',
    description: 'Basic modal with title, content and action buttons',
    category: 'dialog' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['basic','dialog','modal'],
    structure: {
      type: 'simple' as const,
      sections: ['header','content','actions'],
      actions: ['cancel','save'],
      styles: {
        width: 500,
        height: 300,
        theme: 'light' as const,
        borderRadius: 8,
        shadows: true
    }
  },
    preview: {
      title: 'Simple Dialog',
      content: 'Are you sure you want to proceed?',
      buttons: ['Cancel','Save']
  },
    code: {
      jsx: `<Dialog open={open} onClose={handleClose}>
  <DialogTitle>Simple Dialog</DialogTitle>
  <DialogContent>
    <Typography>Are you sure you want to proceed?</Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm}>Save</Button>
  </DialogActions>
</Dialog>`,
      css: `.dialog-modal { 
  min-width: 500px; 
  max-width: 90vw; 
}`
  }
},
  {
    id: 'form-dialog',
    name: 'Form Dialog',
    description: 'Modal with form fields for data collection',
    category: 'form' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['form','input','validation'],
    structure: {
      type: 'form' as const,
      sections: ['header','form-fields','validation','actions'],
      actions: ['cancel','reset','submit'],
      styles: {
        width: 600,
        height: 400,
        theme: 'light' as const,
        borderRadius: 8,
        shadows: true
    }
  },
    preview: {
      title: 'Form Dialog',
      content: 'Enter your information below',
      buttons: ['Cancel','Reset','Submit']
  },
    code: {
      jsx: `<Dialog open={open} onClose={handleClose}>
  <DialogTitle>Form Dialog</DialogTitle>
  <DialogContent>
    <form onSubmit={handleSubmit}>
      <TextField fullWidth label="Name" />
      <TextField fullWidth label="Email" />
    </form>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleReset}>Reset</Button>
    <Button type="submit">Submit</Button>
  </DialogActions>
</Dialog>`,
      css: `.form-dialog .MuiDialogContent-root {
  padding: 24px; 
}

.form-dialog .MuiTextField-root {
  margin-bottom: 16px; 
}`
  }
},
  {
    id: 'confirmation-modal',
    name: 'Confirmation Modal',
    description: 'Warning-style modal for confirmations',
    category: 'confirm' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['confirmation','warning','action'],
    structure: {
      type: 'simple' as const,
      sections: ['icon','title','message','actions'],
      actions: ['cancel','confirm'],
      styles: {
        width: 400,
        height: 250,
        theme: 'light' as const,
        borderRadius: 8,
        shadows: true
    }
  },
    preview: {
      title: 'Confirm Action',
      content: 'This action cannot be undone. Are you sure?',
      buttons: ['Cancel','Confirm']
  },
    code: {
      jsx: `<Dialog open={open} onClose={handleClose}>
  <DialogTitle>
    <Box display="flex" alignItems="center">
      <WarningIcon color="warning" sx={{ mr: 1 }} />
      Confirm Action
    </Box>
  </DialogTitle>
  <DialogContent>
    <Typography>This action cannot be undone. Are you sure?</Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button color="error" onClick={handleConfirm}>Confirm</Button>
  </DialogActions>
</Dialog>`,
      css: `.confirmation-dialog {
  text-align: center; 
}

.confirmation-dialog .MuiDialogTitle-root {
  justify-content: center; 
}`
  }
},
  {
    id: 'display-modal',
    name: 'Display Modal',
    description: 'For showcasing content, images, or information',
    category: 'display' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['display','content','read-only'],
    structure: {
      type: 'simple' as const,
      sections: ['header','content','optional-actions'],
      actions: ['close'],
      styles: {
        width: 700,
        height: 500,
        theme: 'light' as const,
        borderRadius: 12,
        shadows: true
    }
  },
    preview: {
      title: 'Display Content',
      content: 'Browse, read, or view information',
      buttons: ['Close']
  },
    code: {
      jsx: `<Dialog open={open} onClose={handleClose} maxWidth="md">
  <DialogTitle>Display Content</DialogTitle>
  <DialogContent>
    <Container maxWidth="md">
      <Typography variant="h6">Information</Typography>
      <Typography variant="body1">
        Browse, read, or view information
      </Typography>
    </Container>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Close</Button>
  </DialogActions>
</Dialog>`
  }
},
  {
    id: 'project-creation-modal',
    name: 'New Project',
    description: 'Advanced project creation modal with step wizard and memory card integration',
    category: 'complex' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['project-creation','wizard','complex','workflow','integration'],
    structure: {
      type: 'complex' as const,
      sections: ['wizard-steps','form-fields','memory-cards','validation','navigation','actions'],
      actions: ['cancel','previous','next','finish'],
      styles: {
        width: 900,
        height: 700,
        theme: 'light' as const,
        borderRadius: 12,
        shadows: true
    }
  },
    preview: {
      title: 'Create New Project',
      content: 'Multi-step wizard with memory card configuration',
      buttons: ['Cancel','Previous','Next','Create']
  },
    code: {
      jsx: `import ProjectCreationWithMemoryCards from '../../project/ProjectCreationWithMemoryCards';

<Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
  <DialogTitle>Create New Project</DialogTitle>
  <DialogContent sx={{ p: 0 }}>
    <ProjectCreationWithMemoryCards
      profession={profession}
      userId={userId}
      onProjectCreated={handleProjectCreated}
      onMeetingCreate={onMeetingCreate}
      onProjectUpdate={onProjectUpdate}
      onWorklogCreate={onWorklogCreate}
      selectedProject={selectedProject}
      onProjectSelect={onProjectSelect}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleFinish} variant="contained">Create Project</Button>
  </DialogActions>
</Dialog>`,
      dependencies: [
        '../../../project/ProjectCreationWithMemoryCards','@mui/material/Stepper','@mui/material/Step','@mui/material/StepLabel'
      ]
  }
},
  {
    id: 'settings-modal',
    name: 'Settings Modal',
    description: 'Complex modal with tabs and multiple sections',
    category: 'custom' as const,
    thumbnail: 'data:image/svg+xml;base4,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+',
    tags: ['settings','complex','tabs'],
    structure: {
      type: 'complex' as const,
      sections: ['tabs','content','navigation','actions'],
      actions: ['cancel','apply','save'],
      styles: {
        width: 800,
        height: 600,
        theme: 'light' as const,
        borderRadius: 16,
        shadows: true
    }
  },
    preview: {
      title: 'Settings Configuration',
      content: 'Customize your application settings',
      buttons: ['Cancel','Apply','Save']
  },
    code: {
      jsx: `<Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
  <DialogTitle>Settings Configuration</DialogTitle>
  <DialogContent>
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Tab label="General" />
      <Tab label="Advanced" />
    </Tabs>
    {activeTab === 0 && <GeneralSettings />}
    {activeTab === 1 && <AdvancedSettings />}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleApply}>Apply</Button>
    <Button variant="contained" onClick={handleSave}>Save</Button>
  </DialogActions>
</Dialog>`,
      dependencies: ['@mui/material/Tabs','@mui/material/Tab']
  }
}
];

export const getTemplateByCategory = (category: string) => {
  return MODAL_TEMPLATES.filter(template => template.category === category);
};

export const getTemplateById = (id: string) => {
  return MODAL_TEMPLATES.find(template => template.id === id);
};

export const getTemplateTags = () => {
  const allTags = MODAL_TEMPLATES.flatMap(template => template.tags);
  return Array.from(new Set(allTags));
};
