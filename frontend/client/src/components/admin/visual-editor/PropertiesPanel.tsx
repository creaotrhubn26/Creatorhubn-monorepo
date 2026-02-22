import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  Link as LinkIcon,
  Visibility,
} from '@mui/icons-material';

export const PropertiesPanel: React.FC = () => {
  const [sizeMode, setSizeMode] = useState<'auto' | 'custom'>('auto');
  const [textAlign, setTextAlign] = useState('left');

  return (
    <Box
      sx={{
        width: 300,
        bgcolor: 'white',
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          Selector
        </Typography>
        <Box
          sx={{
            mt: 1,
            p: 1.5
           , bgcolor: '#F5F5F5',
            borderRadius: 1,
            border: '1px dashed #DDD'}}>
          <Typography variant="caption" color="text.secondary">
            Select a class or tag
          </Typography>
        </Box>
      </Box>

      {/* Scrollable Properties */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Layout Section */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Layout
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant={sizeMode === 'auto' ? 'contained' : 'outlined'}
                size="small"
                fullWidth
                sx={{ textTransform: 'none' }}
                onClick={() => setSizeMode('auto')}

              >
                Block
              </Button>
              <Button variant="outlined" size="small" fullWidth sx={{ textTransform: 'none' }}>
                Flex
              </Button>
              <Button variant="outlined" size="small" fullWidth sx={{ textTransform: 'none' }}>
                Grid
              </Button>
              <Button variant="outlined" size="small" fullWidth sx={{ textTransform: 'none' }}>
                None
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Size Section */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Size
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Width
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant={sizeMode === 'auto' ? 'contained' : 'outlined'}
                    size="small"
                    sx={{ textTransform: 'none', minWidth: 60 }}>
                    Auto
                  </Button>
                  <TextField
                    size="small"
                    value="0"
                    sx={{ width: 80 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
                </Box>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Height
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    sx={{ textTransform: 'none', minWidth: 60 }}>
                    Auto
                  </Button>
                  <TextField
                    size="small"
                    value="0"
                    sx={{ width: 80 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="Min W" size="small" value="0" sx={{ flex: 1 }} />
              <TextField label="Min H" size="small" value="0" sx={{ flex: 1 }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Max W" size="small" placeholder="None" sx={{ flex: 1 }} />
              <TextField label="Max H" size="small" placeholder="Nonce" sx={{ flex: 1 }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <Visibility fontSize="small" />
              <Typography variant="body2">Overflow</Typography>
              <Select size="small" value="visible" sx={{ ml: 'auto', minWidth: 120 }}>
                <MenuItem value="visible">Visible</MenuItem>
                <MenuItem value="hidden">Hidden</MenuItem>
                <MenuItem value="scroll">Scroll</MenuItem>
                <MenuItem value="auto">Auto</MenuItem>
              </Select>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Spacing Section */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Spacing
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            {/* Spacing Diagram */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 140,
                border: '2px solid #E0E0E0',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2}}>
              {/* Top */}
              <TextField
                size="small"
                value="24"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 60}} />
              {/* Right */}
              <TextField
                size="small"
                value="0"
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 60}} />
              {/* Bottom */}
              <TextField
                size="small"
                value="0"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 60}} />
              {/* Left */}
              <TextField
                size="small"
                value="32"
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 60}} />
              {/* Center Link Icon */}
              <IconButton size="small" sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <LinkIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Top" size="small" value="32" sx={{ flex: 1 }} />
              <TextField label="Right" size="small" value="0" sx={{ flex: 1 }} />
              <TextField label="Bottom" size="small" value="32" sx={{ flex: 1 }} />
              <TextField label="Left" size="small" value="32" sx={{ flex: 1 }} />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Typography Section */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Typography
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <ToggleButtonGroup
              value={textAlign}
              exclusive
              onChange={(_, value) => value && setTextAlign(value)}
              size="small"
              fullWidth
              sx={{ mb: 2 }}>
              <ToggleButton value="left">
                <FormatAlignLeft fontSize="small" />
              </ToggleButton>
              <ToggleButton value="center">
                <FormatAlignCenter fontSize="small" />
              </ToggleButton>
              <ToggleButton value="right">
                <FormatAlignRight fontSize="small" />
              </ToggleButton>
              <ToggleButton value="justify">
                <FormatAlignJustify fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            <Select fullWidth size="small" value="roboto" sx={{ mb: 2 }}>
              <MenuItem value="roboto">Roboto</MenuItem>
              <MenuItem value="arial">Arial</MenuItem>
              <MenuItem value="helvetica">Helvetica</MenuItem>
              <MenuItem value="times">Times New Roman</MenuItem>
            </Select>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Select size="small" value="regular" sx={{ flex: 1 }}>
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="bold">Bold</MenuItem>
                <MenuItem value="light">Light</MenuItem>
              </Select>
              <TextField
                size="small"
                value="20"
                sx={{ width: 80 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Height"
                size="small"
                value="0"
                placeholder="Auto"
                sx={{ flex: 1 }} />
              <TextField label="Spacing" size="small" value="0" sx={{ flex: 1 }} />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Backgrounds Section */}
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Backgrounds
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Color</Typography>
              <TextField size="small" value="FFFFFF" sx={{ flex: 1 }} />
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#FFFFFF',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1}} />
            </Box>

            <Select fullWidth size="small" value="none" sx={{ mt: 2 }}>
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="contain">Contain</MenuItem>
              <MenuItem value="cover">Cover</MenuItem>
            </Select>
          </AccordionDetails>
        </Accordion>

        {/* Borders Section */}
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Borders
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="Top" size="small" value="0" sx={{ flex: 1 }} />
              <TextField label="Right" size="small" value="0" sx={{ flex: 1 }} />
              <TextField label="Bottom" size="small" value="0" sx={{ flex: 1 }} />
              <TextField label="Left" size="small" value="0" sx={{ flex: 1 }} />
            </Box>

            <Select fullWidth size="small" value="solid">
              <MenuItem value="solid">Solid</MenuItem>
              <MenuItem value="dashed">Dashed</MenuItem>
              <MenuItem value="dotted">Dotted</MenuItem>
            </Select>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <Typography variant="body2">Color</Typography>
              <TextField size="small" value="000000" sx={{ flex: 1 }} />
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#000000',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1}} />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};
