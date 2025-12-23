import * as React from 'react';
import {
  Box,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DoneIcon from '@mui/icons-material/Done';
import { listGobos, searchGobos, getGoboUrl } from '@/core/services/gobo';
import { useActions, useScene } from '@/state/selectors';

export default function GoboBrowser() {
  const [q, setQ] = React.useState('');
  const [list, setList] = React.useState(listGobos());
  const { updateNode } = useActions();
  const scene = useScene();
  const selId = scene.selection[0];
  const node = scene.nodes.find((n) => n.id === selId && n.light);

  React.useEffect(() => {
    setList(searchGobos(q));
  }, [q]);

  const apply = (id: string) => {
    if (!node) return;
    updateNode(node.id, { userData: { ...(node.userData || {}), goboId: id } });
  };

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography fontWeight={700}>Gobo Browser</Typography>
      </Stack>
      <TextField
        size="small"
        placeholder="Search gobos..."
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )}}
        sx={{ mb: 1 }}
      />
      <Grid container spacing={1}>
        {list.map((g) => (
          <Grid key={g.id} item xs={6}>
            <Box
              sx={{
                position: 'relative',
                border: '1px solid #e2e8f0',
                borderRadius: 1.5,
                overflow: 'hidden',
                cursor: node ? 'pointer' : 'default'}}
              onClick={() => apply(g.id)}
            >
              <img
                src={getGoboUrl(g.id)}
                alt={g.title}
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'invert(1)'}}
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: 6,
                  bottom: 6,
                  bgcolor: 'rgba(255,255,255,0.8)',
                  borderRadius: 1,
                  px: 0.5}}
              >
                <Typography variant="caption">{g.title}</Typography>
              </Box>
              {node?.userData?.goboId === g.id ? (
                <Tooltip title="Applied to selected light">
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 6,
                      top: 6,
                      bgcolor: '#22c55e',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'grid',
                      placeItems: 'center'}}
                  >
                    <DoneIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Tooltip>
              ) : null}
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
