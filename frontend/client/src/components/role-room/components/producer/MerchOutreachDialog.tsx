/**
 * MerchOutreachDialog — Slice 4.
 *
 * Pre-filled tilbudsforespørsel for the selected supplier. Producer can
 * edit subject + body before opening in their email client (mailto:)
 * or copying to clipboard. Recipient email is filled when the supplier
 * scrape produced one; otherwise the producer adds it manually.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import {
  buildMailtoUrl,
  buildOutreachDraft,
} from '../../services/merchOutreachTemplate';
import type {
  RoleRoomAgentMerchProductCategory,
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';
import { useT } from '../../../../i18n';

interface MerchOutreachDialogProps {
  open: boolean;
  onClose: () => void;
  supplier: RoleRoomAgentMerchSupplier | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  /** Pre-fill the productCategory field. Optional. */
  productCategory?: RoleRoomAgentMerchProductCategory | null;
}

const MerchOutreachDialog: React.FC<MerchOutreachDialogProps> = ({
  open,
  onClose,
  supplier,
  bootstrap,
  productCategory,
}) => {
  const { t } = useT();
  const initialDraft = useMemo(() => {
    if (!supplier) return null;
    return buildOutreachDraft({
      supplier,
      bootstrap,
      productCategory: productCategory ?? null,
    });
  }, [supplier, bootstrap, productCategory]);

  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);

  // Re-init when the supplier changes
  useEffect(() => {
    if (initialDraft) {
      setRecipient(initialDraft.recipientEmail ?? '');
      setSubject(initialDraft.subject);
      setBody(initialDraft.body);
      setCopied(null);
    }
  }, [initialDraft]);

  if (!supplier) return null;

  const mailto = buildMailtoUrl({ recipientEmail: recipient || null, subject, body });

  const handleCopy = async (kind: 'subject' | 'body') => {
    const text = kind === 'subject' ? subject : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard may be unavailable in iframe / over http — caller can
      // still see the text in the field and copy manually.
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {t('merchOutreach.title', { name: supplier.name })}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label={t('merchOutreach.close')}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.6}>
          {/* Contact info found by the scraper */}
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {supplier.contact?.email ? (
              <Chip
                size="small"
                icon={<EmailIcon fontSize="small" />}
                label={supplier.contact.email}
                sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#bbf7d0' }}
              />
            ) : (
              <Chip
                size="small"
                icon={<EmailIcon fontSize="small" />}
                label={t('merchOutreach.emailMissing')}
                sx={{ bgcolor: 'rgba(250,204,21,0.12)', color: '#fde68a' }}
              />
            )}
            {supplier.contact?.phone ? (
              <Chip
                size="small"
                icon={<PhoneIcon fontSize="small" />}
                label={supplier.contact.phone}
                sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}
              />
            ) : null}
            {supplier.contact?.contactPageUrl ? (
              <Button
                href={supplier.contact.contactPageUrl}
                target="_blank"
                rel="noreferrer"
                size="small"
                variant="text"
                sx={{ textTransform: 'none' }}
              >
                {t('merchOutreach.contactPage')}
              </Button>
            ) : null}
          </Stack>

          {!supplier.contact?.email ? (
            <Alert severity="info">
              {t('merchOutreach.noEmailFound', { name: supplier.name })}
              {supplier.organizationNumber ? (
                <>
                  {' '}
                  <a
                    href={`https://www.brreg.no/enhet/${supplier.organizationNumber}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Brreg
                  </a>
                </>
              ) : null}
              {' '}{t('merchOutreach.orPaste')}
            </Alert>
          ) : null}

          <TextField
            label={t('merchOutreach.labelTo')}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="post@leverandor.no"
            fullWidth
            size="small"
          />
          <TextField
            label={t('merchOutreach.labelSubject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <IconButton size="small" onClick={() => handleCopy('subject')}>
                  {copied === 'subject' ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
                </IconButton>
              ),
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <TextField
              label={t('merchOutreach.labelMessage')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
              multiline
              minRows={14}
              maxRows={24}
            />
            <IconButton
              size="small"
              onClick={() => handleCopy('body')}
              sx={{ position: 'absolute', top: 4, right: 4 }}
            >
              {copied === 'body' ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
            {t('merchOutreach.templateNote')}<code>{t('merchOutreach.yourName')}</code>.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('merchOutreach.close')}</Button>
        <Button
          startIcon={<CopyIcon />}
          onClick={() => handleCopy('body')}
          variant="outlined"
        >
          {copied === 'body' ? t('merchOutreach.copied') : t('merchOutreach.copyMessage')}
        </Button>
        <Button
          startIcon={<EmailIcon />}
          variant="contained"
          disabled={!mailto}
          {...(mailto ? { href: mailto } : {})}
        >
          {t('merchOutreach.openInEmail')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MerchOutreachDialog;
