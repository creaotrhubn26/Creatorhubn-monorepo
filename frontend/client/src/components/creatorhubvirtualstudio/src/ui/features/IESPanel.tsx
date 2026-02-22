import * as React from 'react';
import {
  Box,
  Button,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useScene, useActions } from '@/state/selectors';
import { parseIES, renderIESToCanvas } from '@/core/services/ies';

const SAMPLES = [
  { id: 'sample-wide', title: 'Sample Wide', url: '/ies/sample-wide.png' },
  { id: 'sample-narrow', title: 'Sample Narrow', url: '/ies/sample-narrow.png' },
];

export default function IESPanel() {
  const scene = useScene();
  const { updateNode } = useActions();
  const selId = scene.selection[0];
  const node = scene.nodes.find((n) => n.id === selId && n.light);
  const [dataUrl, setDataUrl] = React.useState<string>('');
  const [parsedInfo, setParsedInfo] = React.useState<string>('');

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const prof = parseIES(text);
    if (!prof) {
      alert('Failed to parse IES');
      return;
    }
    const cvs = renderIESToCanvas(prof, 256);
    const url = cvs.toDataURL('image/png');
    setDataUrl(url);
    setParsedInfo(`Angles: ${prof.angles.length} • Slice: ${prof.intensities.length}`);
  };

  const apply = (sampleId?: string) => {
    if (!node) return;
    if (sampleId) {
      updateNode(node.id, {
        userData: { ...(node.userData || {}), iesId: sampleId, iesDataUrl: undefined },
      });
    } else if (dataUrl) {
      updateNode(node.id, {
        userData: { ...(node.userData || {}), iesId: 'custom', iesDataUrl: dataUrl },
      });
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={600} fontSize={13} color="#1e293b" gutterBottom>IES Profiles</Typography>
      {!node ? (
        <Typography variant="caption" color="text.secondary">
          Select a light to apply IES.
        </Typography>
      ) : null}

      <Typography sx={{ mt: 1 }} variant="caption" color="text.secondary">
        Samples
      </Typography>
      <Grid container spacing={1} sx={{ mt: 0.5 }}>
        {SAMPLES.map((s) => (
          <Grid item xs={6} key={s.id}>
            <Box
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: 1.5,
                overflow: 'hidden',
                cursor: node ? 'pointer' : 'default'}}
              onClick={() => apply(s.id)}
            >
              <img
                src={s.url}
                alt={s.title}
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'invert(1)'}}
              />
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption">{s.title}</Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
        <input
          id="ies-upload"
          type="file"
          accept=".ies,.IES,text/plain"
          style={{ display: 'none' }}
          onChange={onUpload}
        />
        <label htmlFor="ies-upload">
          <Button component="span" variant="outlined" size="small">
            Upload .IES
          </Button>
        </label>
        <Button
          disabled={!dataUrl || !node}
          variant="contained"
          size="small"
          onClick={() => apply()}
        >
          Apply to Light
        </Button>
      </Stack>

      {dataUrl ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {parsedInfo}
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              border: '1px solid #e2e8f0',
              borderRadius: 1,
              overflow: 'hidden',
              width: '100%'}}
          >
            <img
              src={dataUrl}
              alt="IES Cookie"
              style={{ width: '100%', display: 'block', filter: 'invert(1)' }}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
