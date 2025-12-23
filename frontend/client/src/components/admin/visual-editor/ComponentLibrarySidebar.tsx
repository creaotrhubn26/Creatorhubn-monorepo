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

const COMPONENT_SECTIONS: ComponentSection[] = [
  {
    id: 'layouts',
    label: 'Layouts',
    items: [
      { id: 'sections', label: 'Sections', icon: <ViewModule />, description: 'Add Column' },
      {
        id: 'container',
        label: 'Container',
        icon: <Crop169 />,
        description: 'Add Button for action',
      },
      { id: 'grid', label: 'Grid', icon: <ViewModule />, description: 'Divide blocks visually' },
      {
        id: 'columns',
        label: 'Columns',
        icon: <ViewColumn />,
        description: 'Add Menu to navigate',
      },
    ],
  },
  {
    id: 'basic',
    label: 'Basic',
    items: [
      { id: 'div', label: 'Div Block', icon: <CheckBoxOutlineBlank />, description: 'Add Column' },
      {
        id: 'list',
        label: 'List',
        icon: <FormatListBulleted />,
        description: 'Add Button for action',
      },
      {
        id: 'list-item',
        label: 'List Item',
        icon: <FormatListBulleted />,
        description: 'Divide blocks visually',
      },
      { id: 'link', label: 'Link Block', icon: <LinkIcon />, description: 'Add Menu to navigate' },
      {
        id: 'button',
        label: 'Button',
        icon: <SmartButton />,
        description: 'Set time to this mail',
      },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    items: [
      { id: 'image', label: 'Image', icon: <Image />, description: 'Add image' },
      { id: 'video', label: 'Video', icon: <VideoLibrary />, description: 'Add Button for action' },
      { id: 'youtube', label: 'Youtube', icon: <YouTube />, description: 'Divide blocks visually' },
      {
        id: 'lottie',
        label: 'Lottie Animation',
        icon: <Animation />,
        description: 'Add Menu to navigate',
      },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    items: [
      { id: 'form', label: 'Form Block', icon: <Description />, description: 'Add Column' },
      { id: 'label', label: 'Label', icon: <Label />, description: 'Add Button for action' },
      { id: 'input', label: 'Input', icon: <InputIcon />, description: 'Divide blocks visually' },
    ],
  },
];

export const ComponentLibrarySidebar: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['layouts','basic']);
  const [selectedPage, setSelectedPage] = useState('home');

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
          Pages
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
          <ListItemText primary="Home" primaryTypographyProps={{ fontSize: '0.875rem' }} />
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
            Layouts
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
