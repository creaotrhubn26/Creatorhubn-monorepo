import React from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

interface MemoryCardSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
}

const MemoryCardSelector: React.FC<MemoryCardSelectorProps> = ({
  value = '',
  onChange,
  label = 'Minnekort',
}) => {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        label={label}
      >
        <MenuItem value="cfexpress-a">CFexpress Type A</MenuItem>
        <MenuItem value="cfexpress-b">CFexpress Type B</MenuItem>
        <MenuItem value="sd-v90">SD UHS-II V90</MenuItem>
        <MenuItem value="sd-v60">SD UHS-II V60</MenuItem>
        <MenuItem value="sd-v30">SD UHS-I V30</MenuItem>
      </Select>
    </FormControl>
  );
};

export default MemoryCardSelector;
