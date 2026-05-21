// @ts-nocheck
/**
 * PrintOrderDialog — Slice 9X.82 (Pixieset #2, Pic-Time aesthetic)
 *
 * Per-bilde print-bestilling. Brudepar klikker "Print" på et bilde →
 * dialogen åpnes med curated cards av tilgjengelige størrelser
 * (digital, 8x10, 16x20, canvas, etc). Stine sin print_products-
 * katalog driver innholdet.
 *
 * Wraps eksisterende POST /api/client/gallery/:accessToken/print-order
 * som svarer med Stripe Checkout-URL.
 *
 * Pic-Time-aesthetic: cream paper, Cormorant serif, magazine-grid av
 * størrelses-kort, hard-edge submit-knapp, italic helper-tekst.
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  ShoppingBag as BagIcon,
  Remove as MinusIcon,
  Add as PlusIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

interface PrintProduct {
  id: string;
  name: string;
  description?: string | null;
  sizeLabel?: string | null;
  material?: string | null;
  unitPrice: number;
  currency: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  galleryPassword?: string | null;
  /** Bildet klient klikket "Print" på — pre-selectes i checkout */
  imageId: string;
  imageThumbnail?: string | null;
  imageTitle?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
}

const PrintOrderDialog: React.FC<Props> = ({
  open,
  onClose,
  accessToken,
  galleryPassword,
  imageId,
  imageThumbnail,
  imageTitle,
  clientEmail,
  clientName,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (galleryPassword) h['x-gallery-password'] = galleryPassword;
    return h;
  }, [galleryPassword]);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'print-products', galleryPassword],
    queryFn: async () => apiRequest(`/api/client/gallery/${accessToken}/print-products`, { headers }),
    enabled: open && !!accessToken,
  });

  const products: PrintProduct[] = productsData?.products || productsData?.data || [];

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const formatPrice = (cents: number, currency: string) => {
    // unit_price er lagret som major-units (NOK), ikke cents
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: currency || 'NOK',
      maximumFractionDigits: 0,
    }).format(cents);
  };

  const handleCheckout = async () => {
    if (!selectedProductId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/print-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          items: [{ productId: selectedProductId, imageId, quantity }],
          clientEmail: clientEmail || '',
          clientName: clientName || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkoutUrl) {
        setError(data?.error || 'Kunne ikke starte betalingen. Prøv igjen.');
        setSubmitting(false);
        return;
      }
      // Redirect til Stripe Checkout
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e?.message || 'Noe gikk galt. Prøv igjen.');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSelectedProductId(null);
    setQuantity(1);
    setError(null);
    onClose();
  };

  const total = selectedProduct ? selectedProduct.unitPrice * quantity : 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(180deg, #fdfaf5 0%, #f7f1e8 100%)',
          color: '#1a1612',
          minHeight: { xs: '100vh', sm: '85vh' },
          borderRadius: { xs: 0, sm: 3 },
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
        <IconButton
          onClick={handleClose}
          disabled={submitting}
          aria-label="Lukk"
          sx={{
            color: '#1a1612',
            bgcolor: 'rgba(255,255,255,0.6)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 3, sm: 5, md: 7 } }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 5 } }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.32em',
              color: '#a8957e',
              textTransform: 'uppercase',
              mb: 1.5,
            }}
          >
            · Bestill print ·
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: SERIF_STACK,
              fontWeight: 400,
              fontSize: { xs: '2rem', sm: '2.8rem' },
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              color: '#1a1612',
              mb: 1,
            }}
          >
            {imageTitle || 'Ditt bilde'}
          </Typography>
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              fontSize: '1rem',
              color: '#5a4f42',
            }}
          >
            Velg størrelse og materiale
          </Typography>
        </Box>

        {/* ── Bilde-forhåndsvisning ──────────────────────────────────── */}
        {imageThumbnail && (
          <Box
            sx={{
              maxWidth: 280,
              mx: 'auto',
              mb: 4,
              boxShadow: '0 12px 32px rgba(26,22,18,0.18)',
              borderRadius: 0.5,
              overflow: 'hidden',
            }}
          >
            <img
              src={imageThumbnail}
              alt={imageTitle || ''}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Box>
        )}

        {/* ── Produkt-kort ───────────────────────────────────────────── */}
        {productsLoading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#d97706' }} />
          </Box>
        ) : products.length === 0 ? (
          <Alert
            severity="info"
            sx={{
              bgcolor: 'rgba(217,119,6,0.08)',
              color: '#1a1612',
              border: '1px solid rgba(217,119,6,0.32)',
            }}
          >
            Print-katalogen er ikke konfigurert ennå. Kontakt fotografen.
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 2,
              mb: 4,
            }}
          >
            {products.map((p) => {
              const isSelected = p.id === selectedProductId;
              return (
                <Box
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProductId(p.id);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    p: 2.5,
                    bgcolor: isSelected ? 'rgba(217,119,6,0.10)' : 'rgba(255,255,255,0.6)',
                    border: `2px solid ${isSelected ? '#d97706' : 'rgba(168,149,126,0.32)'}`,
                    borderRadius: 1,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#d97706',
                      bgcolor: 'rgba(217,119,6,0.04)',
                    },
                    '&:focus-visible': { outline: '2px solid #d97706', outlineOffset: 2 },
                  }}
                >
                  {isSelected && (
                    <CheckIcon
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: '#d97706',
                        fontSize: 22,
                      }}
                    />
                  )}
                  <Typography
                    sx={{
                      fontFamily: SERIF_STACK,
                      fontSize: '1.4rem',
                      fontWeight: 500,
                      color: '#1a1612',
                      mb: 0.5,
                      pr: 3,
                    }}
                  >
                    {p.name}
                  </Typography>
                  {(p.sizeLabel || p.material) && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#5a4f42',
                        fontStyle: 'italic',
                        display: 'block',
                        mb: 1,
                      }}
                    >
                      {[p.sizeLabel, p.material].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                  {p.description && (
                    <Typography
                      variant="body2"
                      sx={{ color: '#5a4f42', mb: 1.5, lineHeight: 1.5, fontSize: '0.85rem' }}
                    >
                      {p.description}
                    </Typography>
                  )}
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(168,149,126,0.24)' }} />
                  <Typography
                    sx={{
                      fontFamily: SERIF_STACK,
                      fontSize: '1.6rem',
                      fontWeight: 500,
                      color: '#1a1612',
                    }}
                  >
                    {formatPrice(p.unitPrice, p.currency)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* ── Antall-velger ──────────────────────────────────────────── */}
        {selectedProduct && (
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 3 }}
          >
            <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: '#5a4f42' }}>
              Antall
            </Typography>
            <IconButton
              size="small"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Færre"
              sx={{ border: '1px solid #a8957e', color: '#1a1612' }}
            >
              <MinusIcon fontSize="small" />
            </IconButton>
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontSize: '1.4rem',
                minWidth: 32,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {quantity}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Flere"
              sx={{ border: '1px solid #a8957e', color: '#1a1612' }}
            >
              <PlusIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ maxWidth: 540, mx: 'auto', mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* ── Total + checkout-knapp ─────────────────────────────────── */}
        {selectedProduct && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                fontSize: '1rem',
                color: '#5a4f42',
                mb: 0.5,
              }}
            >
              Totalt
            </Typography>
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontSize: '2.4rem',
                fontWeight: 400,
                color: '#1a1612',
                mb: 3,
                letterSpacing: '-0.02em',
              }}
            >
              {formatPrice(total, selectedProduct.currency)}
            </Typography>
            <Button
              onClick={handleCheckout}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} sx={{ color: '#fdfaf5' }} /> : <BagIcon />}
              sx={{
                bgcolor: '#1a1612',
                color: '#fdfaf5',
                fontFamily: '"Inter", "Segoe UI", sans-serif',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
                px: 5,
                py: 1.8,
                borderRadius: 0,
                minWidth: 240,
                '&:hover': { bgcolor: '#2d2620' },
                '&.Mui-disabled': { bgcolor: '#a8957e', color: '#fdfaf5' },
              }}
            >
              {submitting ? 'Sender til betaling…' : 'Gå til betaling'}
            </Button>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 2, color: '#a8957e', fontStyle: 'italic' }}
            >
              Sikker betaling via Stripe · Levering 7–14 dager
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PrintOrderDialog;
