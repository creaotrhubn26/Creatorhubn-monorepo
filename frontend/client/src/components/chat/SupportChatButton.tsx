import React, { useState } from 'react';
import {
  Fab, Popover, Box, Typography, TextField, Button, CircularProgress,
  IconButton, Stack,
} from '@mui/material';
import HeadsetMic from '@mui/icons-material/HeadsetMic';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import { apiRequest } from '@/lib/queryClient';

export default function SupportChatButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const open = Boolean(anchor);

  const send = async () => {
    if (!msg.trim()) return;
    setState('sending');
    try {
      await apiRequest('/api/support/ticket', {
        method: 'POST',
        body: { message: msg.trim() },
      });
      setState('sent');
      setMsg('');
      setTimeout(() => {
        setState('idle');
        setAnchor(null);
      }, 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <>
      <Fab
        size="medium"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          bgcolor: '#1a2035',
          color: '#ff8c00',
          border: '1px solid rgba(255,140,0,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: '#222b45' },
          zIndex: 1300,
        }}
        aria-label="Kontakt støtte"
      >
        {open ? <Close fontSize="small" /> : <HeadsetMic fontSize="small" />}
      </Fab>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => { setAnchor(null); setState('idle'); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        PaperProps={{
          sx: {
            bgcolor: '#111827',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            p: 2.5,
            width: 320,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
              Trenger du hjelp?
            </Typography>
            <IconButton size="small" onClick={() => setAnchor(null)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            Beskriv hva du trenger hjelp til — vi svarer på e-post innen 24t.
          </Typography>

          {state === 'sent' ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 1 }}>
              <Check sx={{ color: '#4ade80', fontSize: 32 }} />
              <Typography sx={{ color: '#4ade80', fontWeight: 600, fontSize: 14 }}>Melding sendt!</Typography>
            </Stack>
          ) : (
            <>
              <TextField
                multiline
                minRows={3}
                maxRows={6}
                placeholder="F.eks. «Jeg får ikke logget inn» eller «Faktura-spørsmål»..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                disabled={state === 'sending'}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    fontSize: 13,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,140,0,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#ff8c00' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.3)' },
                }}
              />
              {state === 'error' && (
                <Typography variant="caption" sx={{ color: '#f87171' }}>
                  Noe gikk galt — prøv igjen eller send e-post til daniel@creatorhubn.com
                </Typography>
              )}
              <Button
                variant="contained"
                disabled={!msg.trim() || state === 'sending'}
                onClick={send}
                sx={{ bgcolor: '#ff8c00', color: 'white', fontWeight: 700, '&:hover': { bgcolor: '#e67e00' }, '&:disabled': { bgcolor: 'rgba(255,140,0,0.3)', color: 'rgba(255,255,255,0.4)' } }}
              >
                {state === 'sending' ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Send melding'}
              </Button>
            </>
          )}
        </Stack>
      </Popover>
    </>
  );
}
