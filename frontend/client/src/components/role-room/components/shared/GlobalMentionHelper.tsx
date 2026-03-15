import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import globalTagService from '../../services/globalTagService';

interface GlobalMentionHelperProps {
  text: string;
  localCandidates?: string[];
  onApplySuggestion: (name: string) => void;
  autoTagTitle?: string;
  suggestionTitle?: string;
}

const normalizeToken = (value: string): string =>
  value
    .toLocaleLowerCase('no-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9æøå\s-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsName = (text: string, name: string): boolean => {
  if (!text.trim() || !name.trim()) return false;
  const escapedName = escapeRegex(name.trim());
  const boundaryPattern = new RegExp(`(^|[^A-Za-z0-9ÆØÅæøå])${escapedName}([^A-Za-z0-9ÆØÅæøå]|$)`, 'i');
  return boundaryPattern.test(text);
};

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    const currentRow = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const replaceCost = previousRow[j] + (left[i] === right[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
    }
    previousRow = currentRow;
  }
  return previousRow[right.length];
};

export function GlobalMentionHelper({
  text,
  localCandidates = [],
  onApplySuggestion,
  autoTagTitle = 'Auto-tagget',
  suggestionTitle = 'Mener du?',
}: GlobalMentionHelperProps) {
  const [globalTags, setGlobalTags] = useState<string[]>([]);

  const rawSeededCandidates = useMemo(
    () =>
      localCandidates
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2),
    [localCandidates],
  );

  const seedKey = useMemo(
    () => rawSeededCandidates.map((value) => normalizeToken(value)).sort((a, b) => a.localeCompare(b, 'no-NO')).join('|'),
    [rawSeededCandidates],
  );

  // Keep a stable candidate array when logical content is unchanged.
  const seededCandidates = useMemo(() => rawSeededCandidates, [seedKey]);

  useEffect(() => {
    let isMounted = true;
    const syncGlobalTags = async () => {
      try {
        const tags = seedKey
          ? await globalTagService.add(seededCandidates)
          : await globalTagService.load();
        if (isMounted) {
          setGlobalTags((previous) => {
            if (previous.length === tags.length && previous.every((value, index) => value === tags[index])) {
              return previous;
            }
            return tags;
          });
        }
      } catch (error) {
        console.warn('Kunne ikke laste globalt tag-register:', error);
        if (isMounted) {
          setGlobalTags((previous) => (previous.length === 0 ? previous : []));
        }
      }
    };
    void syncGlobalTags();
    return () => {
      isMounted = false;
    };
  }, [seedKey, seededCandidates]);

  const mentionCandidates = useMemo(() => {
    const deduped = new Set<string>();
    for (const candidate of [...seededCandidates, ...globalTags]) {
      if (typeof candidate !== 'string') continue;
      const cleaned = candidate.trim();
      if (!cleaned) continue;
      deduped.add(cleaned);
    }
    return Array.from(deduped).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [globalTags, seededCandidates]);

  const trailingToken = useMemo(() => {
    const match = text.match(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u);
    return match?.[1] ?? '';
  }, [text]);

  const autoTagChips = useMemo(() => {
    if (!text.trim()) return [] as string[];
    return mentionCandidates.filter((name) => containsName(text, name));
  }, [mentionCandidates, text]);

  const didYouMeanSuggestions = useMemo(() => {
    const normalizedToken = normalizeToken(trailingToken);
    if (normalizedToken.length < 2) return [] as string[];
    const rankedMatches = mentionCandidates
      .map((fullName) => {
        const nameTokens = fullName
          .split(/\s+/)
          .map((token) => normalizeToken(token))
          .filter((token) => token.length >= 2);
        if (nameTokens.length === 0) return null;
        if (nameTokens.some((token) => token === normalizedToken)) return null;
        let bestDistance = Number.POSITIVE_INFINITY;
        let hasPrefixMatch = false;
        for (const token of nameTokens) {
          hasPrefixMatch ||= token.startsWith(normalizedToken);
          const distance = levenshteinDistance(normalizedToken, token);
          if (distance < bestDistance) bestDistance = distance;
        }
        if (!Number.isFinite(bestDistance)) return null;
        if (!hasPrefixMatch && bestDistance > 2) return null;
        if (containsName(text, fullName)) return null;
        return { fullName, hasPrefixMatch, bestDistance };
      })
      .filter((value): value is { fullName: string; hasPrefixMatch: boolean; bestDistance: number } => value !== null)
      .sort((left, right) => {
        if (left.hasPrefixMatch !== right.hasPrefixMatch) return left.hasPrefixMatch ? -1 : 1;
        if (left.bestDistance !== right.bestDistance) return left.bestDistance - right.bestDistance;
        return left.fullName.localeCompare(right.fullName, 'no-NO');
      });

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const match of rankedMatches) {
      const normalizedName = normalizeToken(match.fullName);
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);
      deduped.push(match.fullName);
      if (deduped.length >= 4) break;
    }
    return deduped;
  }, [mentionCandidates, text, trailingToken]);

  if (autoTagChips.length === 0 && didYouMeanSuggestions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1.1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {autoTagChips.length > 0 && (
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            border: '1px solid rgba(124,77,255,0.28)',
            background: 'linear-gradient(135deg, rgba(18,24,52,0.82) 0%, rgba(36,22,70,0.78) 100%)',
          }}
        >
          <Typography sx={{ color: '#9ec5ff', fontWeight: 700, fontSize: '0.8rem', mb: 0.75 }}>
            {autoTagTitle}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {autoTagChips.map((name) => (
              <Chip
                key={`mention-auto-${name}`}
                size="small"
                label={`@${name}`}
                sx={{
                  bgcolor: 'rgba(124,77,255,0.25)',
                  color: '#efe8ff',
                  border: '1px solid rgba(168,122,255,0.48)',
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {didYouMeanSuggestions.length > 0 && (
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            border: '1px solid rgba(56,189,248,0.25)',
            background: 'linear-gradient(135deg, rgba(8,32,58,0.82) 0%, rgba(14,34,72,0.78) 100%)',
          }}
        >
          <Typography sx={{ color: '#7dd3fc', fontWeight: 700, fontSize: '0.8rem', mb: 0.75 }}>
            {suggestionTitle}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {didYouMeanSuggestions.map((name) => (
              <Chip
                key={`mention-suggest-${name}`}
                size="small"
                clickable
                onClick={() => onApplySuggestion(name)}
                label={name}
                sx={{
                  bgcolor: 'rgba(56,189,248,0.16)',
                  color: '#e2f2ff',
                  border: '1px solid rgba(56,189,248,0.5)',
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default GlobalMentionHelper;
