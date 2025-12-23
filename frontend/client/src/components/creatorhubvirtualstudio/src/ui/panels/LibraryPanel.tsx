import * as React from 'react';
import { Box, Tabs, Tab, Stack, TextField, InputAdornment, Grid, Typography, Button, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  listMergedLibrary,
  searchMergedLibrary,
  type AssetType,
  type LibraryAsset,
} from '@/core/services/library';
import { saveUserAsset } from '@/core/services/userLibrary';
// Static import for Hyper3D script
import { scanAndAddAllModels } from '../../scripts/scanAndAddHyper3DModels';

function useLibrary(type: AssetType) {
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<LibraryAsset[]>([]);
  const refresh = React.useCallback(async () => {
    const list = await searchMergedLibrary(type, q);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LibraryPanel.tsx:16',message:'Library items loaded',data:{type,query:q,count:list.length,items:list.map(i=>({id:i.id,title:i.title,hasModelUrl:!!i.data?.modelUrl,modelUrl:i.data?.modelUrl}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    setItems(list);
  }, [type, q]);
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  return { q, setQ, items, refresh };
}

function Card({ a }: { a: LibraryAsset }) {
  const [open, setOpen] = React.useState(false);
  const isUser = a.id.startsWith('user_,');
  const onMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const onDoubleClick = () => {
    const ev = new CustomEvent('ch-add-asset', { detail: { asset: a } });
    window.dispatchEvent(ev as any);
  };
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ asset: a }));
  };
  return (
    <Box
      onDoubleClick={onDoubleClick}
      draggable
      onDragStart={onDragStart}
      sx={{
        cursor: 'pointer',
        border: '1px solid #2a2a2a',
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: '#2a2a2a',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: '#6a6a6a',
          bgcolor: '#3a3a3a',
          transform: 'translateY(-3px) scale(1.02)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          zIndex: 1
        },
        '&:active': {
          transform: 'translateY(-1px) scale(0.98)',
          boxShadow: '0 3px 8px rgba(0,0,0,0.4)'
        }
      }}
    >
      <img
        src={a.thumbUrl || '/library/generic.png'}
        alt={a.title}
        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
      />
      {isUser ? (
        <Box
          onClick={onMenu}
          sx={{
            position: 'absolute',
            right: 6,
            top: 6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            cursor: 'pointer'}}
        >
          ⋯
        </Box>
      ) : null}
      {open && isUser ? (
        <Box
          sx={{
            position: 'absolute',
            right: 6,
            top: 30,
            bgcolor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 1,
            overflow: 'hidden'}}
        >
          <Box
            component="button"
            onClick={() => {
              const title = prompt('Rename asset', a.title) || a.title;
              window.dispatchEvent(
                new CustomEvent('ch-user-asset-rename', { detail: { id: a.id, title } }) as any,
              );
              setOpen(false);
            }}
            style={{
              display: 'block',
              padding: 6,
              width: 120,
              background: '#fff',
              border: 0,
              textAlign: 'left',
              cursor: 'pointer'}}
          >
            Rename
          </Box>
          <Box
            component="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('ch-user-asset-delete', { detail: { id: a.id } }) as any,
              );
              setOpen(false);
            }}
            style={{
              display: 'block',
              padding: 6,
              width: 120,
              background: '#fff',
              border: 0,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#ef4444'}}
          >
            Delete
          </Box>
        </Box>
      ) : null}
      <Box sx={{ p: 1, bgcolor: '#2a2a2a' }}>
        <Typography fontWeight={600} variant="body2" sx={{ color: '#ffffff', fontSize: 12 }}>
          {a.title}
        </Typography>
        <Typography variant="caption" sx={{ color: '#888888', fontSize: 10 }}>
          {a.type}
        </Typography>
      </Box>
    </Box>
  );
}

export default function LibraryPanel() {
  const [tab, setTab] = React.useState<AssetType>('light');
  const { q, setQ, items, refresh } = useLibrary(tab);
  const [scanning, setScanning] = React.useState(false);

  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const id = 'user_' + Math.random().toString(36).slice(2, 8);
        const title = f.name.replace(/\.[^/.]+$/, '');
      await saveUserAsset({
        id,
        type: tab,
        title,
        thumbDataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      });
      await refresh();
    };
    reader.readAsDataURL(f);
  };

  const scanForHyper3DModels = async () => {
    setScanning(true);
    try {
      const results = await scanAndAddAllModels();
      console.log('Scan results:', results);
      alert(`Scan complete!\nAdded: ${results.added}\nSkipped: ${results.skipped}\nFailed: ${results.failed}\nNot found: ${results.notFound}`);
      await refresh();
    } catch (error) {
      console.error('Failed to scan for Hyper3D models:', error);
      alert(`Failed to scan for Hyper3D models: ${error instanceof Error ? error.message : String(error)}\n\nCheck console for details.`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Box sx={{ p: 1, bgcolor: '#1a1a1a' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={600} fontSize={14} color="#ffffff">Studio Library</Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Scan and add Hyper3D models to library">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesomeIcon fontSize="small" />}
              onClick={scanForHyper3DModels}
              disabled={scanning}
              sx={{
                textTransform: 'none',
                fontSize: 11,
                borderColor: '#3a3a3a',
                color: '#ffffff',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#5a5a5a',
                  bgcolor: '#2a2a2a',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                },
                '&:active': {
                  transform: 'translateY(0)'
                },
                '&:disabled': {
                  opacity: 0.5
                }
              }}
            >
              {scanning ? 'Scanning...' : 'Add Hyper3D'}
            </Button>
          </Tooltip>
          <input
            ref={fileRef}
            onChange={upload}
            type="file"
            accept="image/*,.glb,.gltf"
            style={{ display: 'none' }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => fileRef.current?.click()}
            sx={{
              textTransform: 'none',
              fontSize: 11,
              borderColor: '#3a3a3a',
              color: '#ffffff',
              bgcolor: '#2a2a2a',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#5a5a5a',
                bgcolor: '#333333',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Upload
          </Button>
        </Stack>
      </Stack>
      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        variant="fullWidth" 
        sx={{ 
          mb: 1,
          '& .MuiTab-root': {
            color: '#888888',
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 600,
            '&.Mui-selected': {
              color: '#ffffff',
            },
          },
          '& .MuiTabs-indicator': {
            bgcolor: '#ffffff',
          },
        }}
      >
        <Tab value="light" label="Lights" />
        <Tab value="model" label="Models" />
        <Tab value="prop" label="Props" />
      </Tabs>
      <TextField
        size="small"
        placeholder={`Search ${tab}s…`}
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: '#888888' }} />
            </InputAdornment>
          )}}
        sx={{ 
          mb: 1,
          '& .MuiInputBase-root': {
            bgcolor: '#2a2a2a',
            color: '#ffffff',
            '& fieldset': { borderColor: '#3a3a3a' },
            '&:hover fieldset': { borderColor: '#4a4a4a' },
            '&.Mui-focused fieldset': { borderColor: '#ffffff' }
          },
          '& input': { color: '#ffffff' },
          '& input::placeholder': { color: '#666666' }
        }}
      />
      <Grid container spacing={1}>
        {items.map((a) => (
          <Grid item xs={6} key={a.id}>
            <Card a={a} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
