/**
 * PrintStoreSection — fysisk-print-katalog inne i klient-galleri-viewer.
 *
 * Slice 10.5. Henter tilgjengelige print-produkter for galleriet,
 * lar klient velge antall + bilde, og redirecter til Stripe Checkout
 * for betaling. Backend (Slice 10.4) håndterer ordre-persistens og
 * webhook-flyten.
 *
 * Datakilde:
 *   GET  /api/client/gallery/:accessToken/print-products
 *   POST /api/client/gallery/:accessToken/print-order
 *
 * Skjules helt (returnerer null) når fotografen ikke har noen aktive
 * print-produkter — så viewer er upåvirket for galleries uten print-
 * tilbud.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Divider,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

interface PrintProduct {
  id: string;
  name: string;
  description?: string;
  sizeLabel?: string;
  material?: string;
  unitPrice: number;
  currency: string;
}

interface CartLine {
  productId: string;
  imageId?: string | null;
  quantity: number;
  product: PrintProduct;
}

interface PrintStoreSectionProps {
  accessToken: string;
  galleryPassword: string | null;
  clientEmail?: string;
  clientName?: string;
  /** Optional: pre-select an image id (e.g. fra fullscreen-viewer). */
  defaultImageId?: string | null;
}

function fetchHeaders(galleryPassword: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(galleryPassword ? { 'x-gallery-password': galleryPassword } : {}),
  };
}

function apiBase(): string {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.DEV || window.location.hostname === 'localhost') return '';
  return import.meta.env.VITE_API_URL || '';
}

export function PrintStoreSection({
  accessToken,
  galleryPassword,
  clientEmail,
  clientName,
  defaultImageId,
}: PrintStoreSectionProps) {
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ products: PrintProduct[] }>({
    queryKey: ['/api/client/gallery', accessToken, 'print-products'],
    queryFn: async () => {
      const res = await fetch(
        `${apiBase()}/api/client/gallery/${accessToken}/print-products`,
        { headers: fetchHeaders(galleryPassword) },
      );
      if (!res.ok) return { products: [] };
      return res.json();
    },
    enabled: Boolean(accessToken),
  });
  const products = data?.products ?? [];

  const cartTotal = useMemo(() => {
    let total = 0;
    let currency = 'NOK';
    for (const line of cart.values()) {
      total += line.product.unitPrice * line.quantity;
      currency = line.product.currency;
    }
    return { total, currency };
  }, [cart]);

  const updateQuantity = (product: PrintProduct, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(product.id);
      } else {
        next.set(product.id, {
          productId: product.id,
          imageId: defaultImageId ?? null,
          quantity: Math.min(99, qty),
          product,
        });
      }
      return next;
    });
  };

  const handleCheckout = async () => {
    if (cart.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase()}/api/client/gallery/${accessToken}/print-order`,
        {
          method: 'POST',
          headers: fetchHeaders(galleryPassword),
          body: JSON.stringify({
            clientEmail,
            clientName,
            items: Array.from(cart.values()).map((line) => ({
              productId: line.productId,
              imageId: line.imageId,
              quantity: line.quantity,
            })),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.checkoutUrl) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  // Skjult når fotograf ikke har print-tilbud — viewer er upåvirket.
  if (products.length === 0) return null;

  return (
    <Card sx={{ mt: 3, bgcolor: 'rgba(15,16,24,0.85)', border: '1px solid rgba(255,186,108,0.18)' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: '#f6f2ea', fontWeight: 700 }}>
              Bestill fysiske prints
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.66)' }}>
              Velg størrelse + antall. Betaling og frakt via Stripe.
            </Typography>
          </Box>
          {cart.size > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.66)', display: 'block' }}>
                {cart.size} produkt-linjer
              </Typography>
              <Typography variant="h6" sx={{ color: '#ffba6c', fontWeight: 700 }}>
                {cartTotal.total.toFixed(2)} {cartTotal.currency}
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack spacing={1.5}>
          {products.map((product) => {
            const line = cart.get(product.id);
            const qty = line?.quantity ?? 0;
            return (
              <Box
                key={product.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid rgba(255,186,108,0.10)',
                  bgcolor: qty > 0 ? 'rgba(255,186,108,0.08)' : 'transparent',
                  transition: 'background 200ms',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ color: '#f6f2ea', fontWeight: 600 }}>
                    {product.name}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                    {product.sizeLabel && (
                      <Chip size="small" label={product.sizeLabel} variant="outlined" />
                    )}
                    {product.material && (
                      <Chip size="small" label={product.material} variant="outlined" />
                    )}
                  </Stack>
                  {product.description && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(246,242,234,0.55)', display: 'block', mt: 0.5 }}
                    >
                      {product.description}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ color: '#ffba6c', fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                  {product.unitPrice.toFixed(0)} {product.currency}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => updateQuantity(product, qty - 1)}
                    disabled={qty === 0}
                    sx={{ color: '#ffba6c' }}
                  >
                    −
                  </IconButton>
                  <TextField
                    size="small"
                    type="number"
                    value={qty}
                    onChange={(e) => updateQuantity(product, Math.max(0, Number(e.target.value) || 0))}
                    sx={{
                      width: 64,
                      '& input': { textAlign: 'center', color: '#f6f2ea' },
                    }}
                    inputProps={{ min: 0, max: 99 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => updateQuantity(product, qty + 1)}
                    sx={{ color: '#ffba6c' }}
                  >
                    +
                  </IconButton>
                </Stack>
              </Box>
            );
          })}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {cart.size > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,186,108,0.18)' }} />
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
              <Button
                variant="text"
                onClick={() => setCart(new Map())}
                disabled={submitting}
                sx={{ color: 'rgba(246,242,234,0.66)' }}
              >
                Tøm kurv
              </Button>
              <Button
                variant="contained"
                disabled={submitting || cart.size === 0}
                onClick={handleCheckout}
                sx={{ bgcolor: '#ffba6c', color: '#05060a', fontWeight: 700, '&:hover': { bgcolor: '#ffd28d' } }}
              >
                {submitting
                  ? 'Sender til Stripe…'
                  : `Bestill (${cartTotal.total.toFixed(0)} ${cartTotal.currency}) →`}
              </Button>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PrintStoreSection;
