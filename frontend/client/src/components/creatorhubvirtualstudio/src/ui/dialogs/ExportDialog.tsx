import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Typography,
  Checkbox,
} from '@mui/material';
import { exportJSON, exportPDF } from '@/core/services/exporter';
import { useScene, useMeasurements } from '@/state/selectors';
import { getBrand, setBrandLogoDataUrl } from '@/core/services/config';

function useFileDataUrl() {
  const [dataUrl, setDataUrl] = React.useState<string | undefined>(undefined);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };
  return { dataUrl, onChange };
}

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scene = useScene();
  const measurements = useMeasurements();
  const [fmt, setFmt] = React.useState<'json' | 'pdf'>('pdf');
  const { dataUrl, onChange } = useFileDataUrl();
  const [useBrand, setUseBrand] = React.useState(true);
  const brand = getBrand();

  const doExport = async () => {
    const logo = useBrand ? (dataUrl ?? brand.logoDataUrl) : undefined;
    if (fmt ==='json') exportJSON(scene);
    else await exportPDF(scene, { logoDataUrl: logo, measurements });
    onClose();
  };

  const setAsBrand = () => {
    if (dataUrl) setBrandLogoDataUrl(dataUrl);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Export Set Plan</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <RadioGroup value={fmt} onChange={(e) => setFmt(e.target.value as any)}>
            <FormControlLabel
              value="pdf"
              control={<Radio />}
              label="PDF (A4, branded template, scaled room + dimensions)"
            />
            <FormControlLabel value="json" control={<Radio />} label="JSON (full scene data)" />
          </RadioGroup>
          <div>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Logo (PNG/SVG recommended)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <input type="file" accept="image/*" onChange={onChange} />
              <FormControlLabel
                control={
                  <Checkbox checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />
                }
                label="Use brand logo"
              />
              <Button disabled={!dataUrl} onClick={setAsBrand}>
                Set as brand
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Current brand: {brand.name} • {brand.website}
            </Typography>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={doExport}>
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}
