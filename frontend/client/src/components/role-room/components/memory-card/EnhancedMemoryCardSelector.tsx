import React, { useState } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Chip, Stack } from '@mui/material';
import { MEMORY_CARD_DATABASE, formatCurrency } from '@/data/memory-card-database';

interface EnhancedMemoryCardSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  cameraId?: string;
  resolution?: string;
}

const EnhancedMemoryCardSelector: React.FC<EnhancedMemoryCardSelectorProps> = ({
  value = '',
  onChange,
  cameraId,
  resolution,
}) => {
  const [selectedCard, setSelectedCard] = useState(value);

  const handleChange = (newValue: string) => {
    setSelectedCard(newValue);
    onChange?.(newValue);
  };

  const selectedCardData = MEMORY_CARD_DATABASE.find(c => c.id === selectedCard);

  return (
    <Box>
      <FormControl fullWidth size="small">
        <InputLabel>Minnekort</InputLabel>
        <Select
          value={selectedCard}
          onChange={(e) => handleChange(e.target.value)}
          label="Minnekort"
        >
          {MEMORY_CARD_DATABASE.map((card) => (
            <MenuItem key={card.id} value={card.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Typography variant="body2">{card.brand} {card.model}</Typography>
                <Chip label={`${card.capacity}GB`} size="small" sx={{ ml: 1 }} />
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {selectedCardData && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip label={`Skriv: ${selectedCardData.speedWrite} MB/s`} size="small" variant="outlined" />
          <Chip label={`Les: ${selectedCardData.speedRead} MB/s`} size="small" variant="outlined" />
          <Chip label={formatCurrency(selectedCardData.priceNOK)} size="small" color="primary" />
        </Stack>
      )}
    </Box>
  );
};

export default EnhancedMemoryCardSelector;
