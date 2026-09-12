// @ts-nocheck
/**
 * AiBuyCreditsModal — delt «Kjøp AI-kreditter»-modal (Photo + Video Room).
 * Viser saldo + pakker → Stripe Checkout-redirect.
 */
import React from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';
import { ws } from './workspaceTheme';
import { WsModal } from './ui';

const AiBuyCreditsModal: React.FC<{ open: boolean; onClose: () => void; credits: any; onBuy: (packId: string) => void }> = ({ open, onClose, credits, onBuy }) => (
  <WsModal open={open} onClose={onClose} title="Kjøp AI-kreditter" maxWidth="sm">
    <Stack spacing={2}>
      <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Forhåndsbetalt saldo for AI-redigering, -video og -restyle. Nåværende saldo: <b style={{ color: ws.green }}>${(credits?.balanceUsd ?? 0).toFixed(2)}</b></Typography>
      <Stack spacing={1}>
        {(credits?.packs || []).map((p: any) => (
          <Stack key={p.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>${p.creditUsd} kreditt</Typography>
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{Math.round(p.creditUsd / 0.18)}+ AI-redigeringer · {Math.round(p.creditUsd / 0.5)}+ korte videoer</Typography>
            </Box>
            <Button variant="contained" onClick={() => onBuy(p.id)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{p.priceNok} kr</Button>
          </Stack>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>Sikker betaling via Stripe. Kreditter trekkes per generering.</Typography>
    </Stack>
  </WsModal>
);

export default AiBuyCreditsModal;
