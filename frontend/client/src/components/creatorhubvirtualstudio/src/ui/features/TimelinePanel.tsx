import * as React from 'react';
import { Box, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';

export default function TimelinePanel() {
  const [items, setItems] = React.useState<{ id: string; label: string; ts: number }[]>([]);
  const snap = () =>
    setItems((l) => [
      ...l,
      { id: Math.random().toString(36).slice(2, 8), label: 'Snapshot', ts: Date.now() },
    ]);
  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography fontWeight={700}>Timeline</Typography>
        <Button variant="outlined" onClick={snap}>
          Add snapshot
        </Button>
      </Stack>
      <List dense>
        {items.map((x) => (
          <ListItem key={x.id}>
            <ListItemText primary={x.label} secondary={new Date(x.ts).toLocaleString()} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
