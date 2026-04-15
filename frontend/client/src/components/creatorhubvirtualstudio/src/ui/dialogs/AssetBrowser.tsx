// @ts-nocheck
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { loadAsset } from '@/core/services/assets';

const SAMPLE_ASSETS = [
  { id: 'stool', url: '/assets/stool.glb', type: 'gltf' as const },
  { id: 'crate', url: '/assets/crate.glb', type: 'gltf' as const },
];

export default function AssetBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = async (a: any) => {
    try {
      await loadAsset(a);
      alert(`Loaded ${a.id}`);
    } catch (e) {
      alert('Failed to load asset. Check console.');
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assets</DialogTitle>
      <DialogContent>
        <List>
          {SAMPLE_ASSETS.map((a) => (
            <ListItemButton key={a.id} onClick={() => add(a)}>
              <ListItemText primary={a.id} secondary={a.url} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
