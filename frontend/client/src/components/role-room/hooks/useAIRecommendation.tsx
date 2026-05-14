/**
 * useAIRecommendation — komponerer toast-systemet med en localStorage-dedup
 * så AI-anbefalinger (og senere onboarding-tour-steg) vises maksimalt én
 * gang per bruker.
 */

import { useCallback, useMemo, useRef } from 'react';
import { Box, Button, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useToast } from '../components/ToastStack';
import {
  createAIRecommendationDedupAdapter,
  type AIRecommendationDedupAdapter,
} from '../utils/aiRecommendationDedup';

export interface AIRecommendationPayload {
  /** Stabil id — én anbefaling vises maksimalt én gang per bruker. */
  recommendationId: string;
  /** Hovedmelding. Kan inneholde emoji/markdown-fritt tekst. */
  message: string;
  /** Valgfri CTA-knapp-tekst. */
  actionLabel?: string;
  /** Callback når CTA klikkes. */
  onAction?: () => void;
  /** Hvor lenge toast vises (ms). null = persistent. Default: 12000ms. */
  durationMs?: number | null;
  /** Tving visning selv om den er sett før (bra for "vis igjen"-knapper). */
  force?: boolean;
}

interface UseAIRecommendationOptions {
  /** Sesjon-/bruker-id så dedup skiller mellom kontoer på samme maskin. */
  userKey?: string | null;
  /** Egendefinert adapter for tester (DI). */
  adapter?: AIRecommendationDedupAdapter;
}

export interface UseAIRecommendationResult {
  /** Vis en anbefaling dersom den ikke er sett før (eller force=true). */
  recommend: (payload: AIRecommendationPayload) => boolean;
  /** Glem at en anbefaling er sett (så den kan vises igjen). */
  forget: (recommendationId: string) => void;
  /** Glem ALLE sett-anbefalinger for denne brukeren. */
  forgetAll: () => void;
  /** Sjekk om en anbefaling er sett tidligere. */
  hasSeen: (recommendationId: string) => boolean;
}

const AI_TOAST_PREFIX = '✨ ';

export function useAIRecommendation(
  options: UseAIRecommendationOptions = {},
): UseAIRecommendationResult {
  const toast = useToast();
  const adapterRef = useRef<AIRecommendationDedupAdapter | null>(null);
  const adapter = useMemo<AIRecommendationDedupAdapter>(() => {
    if (options.adapter) return options.adapter;
    if (!adapterRef.current) {
      adapterRef.current = createAIRecommendationDedupAdapter({ userKey: options.userKey });
    }
    return adapterRef.current;
  }, [options.adapter, options.userKey]);

  const recommend = useCallback<UseAIRecommendationResult['recommend']>((payload) => {
    const { recommendationId, message, actionLabel, onAction, durationMs, force } = payload;
    if (!recommendationId) return false;
    if (!force && adapter.hasSeen(recommendationId)) return false;

    adapter.markSeen(recommendationId);

    // Vi får toast-id tilbake fra showToast, men action-noden bygges før den
    // returneres. Bruker en mutable ref-holder så lukke-knappene kan referere
    // til id-en når brukeren klikker.
    const idHolder: { current: string | null } = { current: null };
    const action = actionLabel && onAction ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Button
          size="small"
          variant="text"
          onClick={() => {
            onAction();
            if (idHolder.current) toast.removeToast(idHolder.current);
          }}
          sx={{
            color: '#b86bff',
            fontWeight: 700,
            textTransform: 'none',
          }}
        >
          {actionLabel}
        </Button>
        <IconButton
          size="small"
          aria-label="Avvis anbefaling"
          color="inherit"
          onClick={() => {
            if (idHolder.current) toast.removeToast(idHolder.current);
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : undefined;

    const id = toast.showToast({
      severity: 'info',
      message: `${AI_TOAST_PREFIX}${message}`,
      duration: durationMs === undefined ? 12000 : durationMs,
      action,
    });
    idHolder.current = id;

    return true;
  }, [adapter, toast]);

  const forget = useCallback((recommendationId: string) => {
    adapter.forget(recommendationId);
  }, [adapter]);

  const forgetAll = useCallback(() => {
    adapter.forgetAll();
  }, [adapter]);

  const hasSeen = useCallback((recommendationId: string) => {
    return adapter.hasSeen(recommendationId);
  }, [adapter]);

  return { recommend, forget, forgetAll, hasSeen };
}
