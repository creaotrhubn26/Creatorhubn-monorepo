import React, { useMemo, useCallback } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Button,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import { Folder } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { PROJECT_TYPES } from './projectTypeConstants';

interface CustomProjectType {
  id: number;
  name: string;
  usageCount?: number;
  isGlobal?: boolean;
}

interface ProjectTypeSelectorProps {
  value: string;
  onChange: (value: string, isCustomType: boolean) => void;
  isCastingPlanner?: boolean;
  customTypes?: CustomProjectType[];
  onTrackUsage?: (id: number) => void;
  onAddCustomType?: () => void;
  showAddButton?: boolean;
}

export const ProjectTypeSelector: React.FC<ProjectTypeSelectorProps> = ({
  value,
  onChange,
  isCastingPlanner = false,
  customTypes = [],
  onTrackUsage,
  onAddCustomType,
  showAddButton = true,
}) => {
  const availableTypes = useMemo(() => {
    return Object.entries(PROJECT_TYPES)
      .filter(([key]) => !isCastingPlanner || key !== 'wedding');
  }, [isCastingPlanner]);

  const handleChange = useCallback((e: SelectChangeEvent<string>) => {
    const selectedTypeId = e.target.value;
    
    // Check if it's a custom type
    const customType = customTypes.find(
      (t) => t.name.toLowerCase() === selectedTypeId
    );
    
    if (customType && onTrackUsage) {
      onTrackUsage(customType.id);
    }
    
    onChange(selectedTypeId, !!customType);
  }, [customTypes, onChange, onTrackUsage]);

  return (
    <>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="project-type-label">Velg prosjekttype</InputLabel>
        <Select
          labelId="project-type-label"
          value={value || ''}
          onChange={handleChange}
        >
          {/* Default types from PROJECT_TYPES */}
          {availableTypes.map(([key, type]) => {
            const IconComponent = type.icon;
            return (
              <MenuItem key={key} value={key}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconComponent sx={{ fontSize: 20, color: 'primary.main' }} />
                  {type.name}
                </Box>
              </MenuItem>
            );
          })}

          {/* Dynamic custom types - Hidden in Casting Planner */}
          {!isCastingPlanner && customTypes.filter((t) => !t.isGlobal).length > 0 && (
            <MenuItem disabled sx={{ opacity: 0.6, fontWeight: 600 }}>
              — Custom Types —
            </MenuItem>
          )}
          {!isCastingPlanner &&
            customTypes
              .filter((t) => !t.isGlobal)
              .map((type) => (
                <MenuItem key={type.id} value={type.name.toLowerCase()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Folder sx={{ fontSize: 20, color: 'secondary.main' }} />
                    {type.name}
                    {type.usageCount && type.usageCount > 0 && (
                      <Chip
                        label={`${type.usageCount}x`}
                        size="small"
                        sx={{ ml: 'auto', height: 18 }}
                      />
                    )}
                  </Box>
                </MenuItem>
              ))}
        </Select>
      </FormControl>

      {!isCastingPlanner && showAddButton && onAddCustomType && (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddCustomType}
          fullWidth
        >
          Add Custom Project Type
        </Button>
      )}
    </>
  );
};












