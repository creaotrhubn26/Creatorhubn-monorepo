import * as React from 'react';
import { Box, Button, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { listRoomTemplates, saveRoomTemplate, loadRoomTemplate } from'@/core/services/templates';

export default function TemplateManager() {
  const [list, setList] = React.useState(listRoomTemplates());
  const save = async () => {
    await saveRoomTemplate();
    setList(listRoomTemplates());
  };
  const load = async (id: string) => {
    await loadRoomTemplate(id);
  };
  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography fontWeight={600} fontSize={13} color="#1e293b">Room Templates</Typography>
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
          Save Current
        </Button>
      </Stack>
      <List dense>
        {list.map((t) => (
          <ListItemButton key={t.id} onClick={() => load(t.id)}>
            <ListItemText primary={t.name} secondary={`${t.size[0]} x ${t.size[2]} m`} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
