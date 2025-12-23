import * as React from 'react';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from'@mui/material';

export default function GearPresetManager() {
  const [name, setName] = React.useState('Preset');
  const [list, setList] = React.useState<{ id: string; name: string }[]>([]);
  const save = () => setList((l) => [...l, { id: Math.random().toString(36).slice(2, 8), name }]);
  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography fontWeight={600} fontSize={13} color="#1e293b">Gear Presets</Typography>
        <Stack direction="row" spacing={1}>
          <TextField 
            size="small" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            sx={{
              '& .MuiInputBase-root': { fontSize: 12, height: 32 }
            }}
          />
          <Button 
            variant="outlined" 
            onClick={save}
            size="small"
            sx={{ 
              textTransform: 'none',
              fontSize: 11,
              borderColor: '#d1d5db',
              color: '#0f172a',
              '&:hover': {
                borderColor: '#94a3b8',
                bgcolor: '#f8fafc'
              }
            }}
          >
            Save
          </Button>
        </Stack>
      </Stack>
      <List dense>
        {list.map((p) => (
          <ListItemButton key={p.id}>
            <ListItemText primary={p.name} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
