import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Add,
  DragIndicator,
  Home,
  ViewModule,
  Crop169,
  ViewColumn,
  CheckBoxOutlineBlank,
  FormatListBulleted,
  Link as LinkIcon,
  SmartButton,
  Image,
  VideoLibrary,
  YouTube,
  Animation,
  Input as InputIcon,
  Label,
  Description,
} from '@mui/icons-material';
import { getVisualEditorTokens } from './visualEditorTokens';

interface ComponentItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

interface ComponentSection {
  id: string;
  label: string;
  items: ComponentItem[];
}

export const ComponentLibrarySidebar: React.FC = () => {
  const tokens = getVisualEditorTokens();
  const [expandedSections, setExpandedSections] = useState<string[]>(['layouts','basic']);
  const [selectedPage, setSelectedPage] = useState('home');

  const COMPONENT_SECTIONS: ComponentSection[] = [
    {
      id: 'layouts',
      label: tokens.componentLibrary.sections.layouts,
      items: [
        {
          id: 'sections',
          label: tokens.componentLibrary.items.layouts.sections.label,
          icon: <ViewModule />,
          description: tokens.componentLibrary.items.layouts.sections.description,
        },
        {
          id: 'container',
          label: tokens.componentLibrary.items.layouts.container.label,
          icon: <Crop169 />,
          description: tokens.componentLibrary.items.layouts.container.description,
        },
        {
          id: 'grid',
          label: tokens.componentLibrary.items.layouts.grid.label,
          icon: <ViewModule />,
          description: tokens.componentLibrary.items.layouts.grid.description,
        },
        {
          id: 'columns',
          label: tokens.componentLibrary.items.layouts.columns.label,
          icon: <ViewColumn />,
          description: tokens.componentLibrary.items.layouts.columns.description,
        },
      ],
    },
    {
      id: 'basic',
      label: tokens.componentLibrary.sections.basic,
      items: [
        {
          id: 'div',
          label: tokens.componentLibrary.items.basic.div.label,
          icon: <CheckBoxOutlineBlank />,
          description: tokens.componentLibrary.items.basic.div.description,
        },
        {
          id: 'list',
          label: tokens.componentLibrary.items.basic.list.label,
          icon: <FormatListBulleted />,
          description: tokens.componentLibrary.items.basic.list.description,
        },
        {
          id: 'list-item',
          label: tokens.componentLibrary.items.basic.listItem.label,
          icon: <FormatListBulleted />,
          description: tokens.componentLibrary.items.basic.listItem.description,
        },
        {
          id: 'link',
          label: tokens.componentLibrary.items.basic.link.label,
          icon: <LinkIcon />,
          description: tokens.componentLibrary.items.basic.link.description,
        },
        {
          id: 'button',
          label: tokens.componentLibrary.items.basic.button.label,
          icon: <SmartButton />,
          description: tokens.componentLibrary.items.basic.button.description,
        },
      ],
    },
    {
      id: 'media',
      label: tokens.componentLibrary.sections.media,
      items: [
        {
          id: 'image',
          label: tokens.componentLibrary.items.media.image.label,
          icon: <Image />,
          description: tokens.componentLibrary.items.media.image.description,
        },
        {
          id: 'video',
          label: tokens.componentLibrary.items.media.video.label,
          icon: <VideoLibrary />,
          description: tokens.componentLibrary.items.media.video.description,
        },
        {
          id: 'youtube',
          label: tokens.componentLibrary.items.media.youtube.label,
          icon: <YouTube />,
          description: tokens.componentLibrary.items.media.youtube.description,
        },
        {
          id: 'lottie',
          label: tokens.componentLibrary.items.media.lottie.label,
          icon: <Animation />,
          description: tokens.componentLibrary.items.media.lottie.description,
        },
      ],
    },
    {
      id: 'forms',
      label: tokens.componentLibrary.sections.forms,
      items: [
        {
          id: 'form',
          label: tokens.componentLibrary.items.forms.form.label,
          icon: <Description />,
          description: tokens.componentLibrary.items.forms.form.description,
        },
        {
          id: 'label',
          label: tokens.componentLibrary.items.forms.label.label,
          icon: <Label />,
          description: tokens.componentLibrary.items.forms.label.description,
        },
        {
          id: 'input',
          label: tokens.componentLibrary.items.forms.input.label,
          icon: <InputIcon />,
          description: tokens.componentLibrary.items.forms.input.description,
        },
      ],
    },
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  return (
    <Box
      sx={{
        width: 280,
        bgcolor: '#FAFAFA',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          {tokens.componentLibrary.pagesLabel}
        </Typography>
      </Box>

      {/* Pages Tree */}
      <Box sx={{ px: 1, py: 1, bgcolor: 'white', borderBottom: 1, borderColor: 'divider' }}>
        <ListItemButton
          selected={selectedPage === 'home'}
          onClick={() => setSelectedPage('home')}
          sx={{
            borderRadius: 1,
            py: 0.5
            , '&.Mui-selected': { bgcolor: 'action.selected',
            }}}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Home fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={tokens.componentLibrary.homeLabel} primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </ListItemButton>
      </Box>

      {/* Component Sections */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
        {/* Layouts Heading */}
        <Box sx={{ px: 2, mb: 1 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {tokens.componentLibrary.sections.layouts}
          </Typography>
        </Box>

        {COMPONENT_SECTIONS.map((section) => (
          <Box key={section.id} sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => toggleSection(section.id)}
              sx={{
                py: 0.75
               , px: 2, '&:hover': {
                  bgcolor: 'action.hover',
                }}}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {expandedSections.includes(section.id) ? (
                  <ExpandMore fontSize="small" />
                ) : (
                  <ChevronRight fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={section.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 600}} />
            </ListItemButton>

            <Collapse in={expandedSections.includes(section.id)} timeout="auto">
              <List disablePadding sx={{ pl: 2 }}>
                {section.items.map((item) => (
                  <ListItem
                    key={item.id}
                    disablePadding
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover', '& .drag-handle': {
                          opacity: 1,
                        },
                      }}}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        py: 1,
                        px: 1.5
                       , cursor: 'grab',
                        borderRadius: 1}}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('componentType', item.id);
                      }}
                    >
                      <DragIndicator
                        className="drag-handle"
                        fontSize="small"
                        sx={{
                          mr: 1,
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: 'text.disabled'}} />
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: '#F5F5F5',
                          borderRadius: 1,
                          mr: 1.5 }}>
                        {React.cloneElement(item.icon as React.ReactElement, {
                          fontSize: 'small',
                          sx: { color: 'text.secondary' },
                        })}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      </Box>
                      <IconButton size="small" sx={{ opacity: 0.5 }}>
                        <Add fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
