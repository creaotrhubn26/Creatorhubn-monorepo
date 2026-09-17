/**
 * PhysicalAttributesSection.tsx
 *
 * Fysiske trekk i profilredigeringen, i den rekkefølgen casting-byråene
 * spør om dem. Nedtrekkene leser det delte vokabularet, så lagret id er den
 * samme uansett om skuespilleren fyller ut skjemaet på norsk eller engelsk.
 *
 * Etnisk opprinnelse ligger nederst, bak sitt eget ja/nei: det er en særlig
 * kategori etter GDPR art. 9 og skal ikke deles bare fordi et byrå har fått
 * demografi-tilgang.
 */

import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  BODY_MEASUREMENT_FIELDS,
  ETHNICITY_OPTIONS,
  EYE_COLOR_OPTIONS,
  FIGURE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  JEANS_LENGTHS,
  JEANS_WIDTHS,
  type VocabularyLocale,
  type VocabularyOption,
} from '../../../../../../shared/talent-physical-vocabulary';
import { palette } from '../theme';

export interface PhysicalForm {
  height_cm: number | '';
  hair_color: string;
  eye_color: string;
  ethnicity: string;
  ethnicityConsent: boolean;
  attributes: Record<string, string | number | boolean>;
}

interface Props {
  locale: VocabularyLocale;
  form: PhysicalForm;
  onChange: (next: PhysicalForm) => void;
}

const t = (locale: VocabularyLocale, no: string, en: string) => (locale === 'en' ? en : no);

function VocabularySelect({
  label,
  options,
  value,
  locale,
  onChange,
}: {
  label: string;
  options: VocabularyOption[];
  value: string;
  locale: VocabularyLocale;
  onChange: (next: string) => void;
}) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth size="small">
      <MenuItem value="">{t(locale, 'Ikke satt', 'Not set')}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.id} value={option.id}>
          {option[locale]}
        </MenuItem>
      ))}
    </TextField>
  );
}

export default function PhysicalAttributesSection({ locale, form, onChange }: Props) {
  const patchAttr = (key: string, value: string | number | boolean) =>
    onChange({ ...form, attributes: { ...form.attributes, [key]: value } });

  const attrText = (key: string) => {
    const raw = form.attributes[key];
    return raw === undefined || raw === null ? '' : String(raw);
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1.2 }}>
        {t(locale, 'Personlige trekk', 'Physical attributes')}
      </Typography>

      <Stack spacing={1.6}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
          <TextField
            label={t(locale, 'Høyde (cm)', 'Height (cm)')}
            type="number"
            value={form.height_cm}
            onChange={(e) => onChange({ ...form, height_cm: e.target.value ? Number(e.target.value) : '' })}
            fullWidth
            size="small"
          />
          <TextField
            label={t(locale, 'Måledato', 'Measurement date')}
            type="date"
            value={attrText('measured_at')}
            onChange={(e) => patchAttr('measured_at', e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            helperText={t(locale, 'Mål uten dato blir verdiløse etter et år.', 'Measurements without a date go stale.')}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
          <VocabularySelect
            label={t(locale, 'Hårfarge', 'Hair')}
            options={HAIR_COLOR_OPTIONS}
            value={form.hair_color}
            locale={locale}
            onChange={(next) => onChange({ ...form, hair_color: next })}
          />
          <VocabularySelect
            label={t(locale, 'Øyenfarge', 'Eye')}
            options={EYE_COLOR_OPTIONS}
            value={form.eye_color}
            locale={locale}
            onChange={(next) => onChange({ ...form, eye_color: next })}
          />
        </Stack>

        <VocabularySelect
          label={t(locale, 'Figur', 'Figure')}
          options={FIGURE_OPTIONS}
          value={String(form.attributes.figure ?? '')}
          locale={locale}
          onChange={(next) => patchAttr('figure', next)}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
          <TextField
            select
            label={t(locale, 'Jeans-bredde', 'Jeans width')}
            value={attrText('jeans_width')}
            onChange={(e) => patchAttr('jeans_width', Number(e.target.value))}
            fullWidth
            size="small"
          >
            <MenuItem value="">{t(locale, 'Ikke satt', 'Not set')}</MenuItem>
            {JEANS_WIDTHS.map((w) => (
              <MenuItem key={w} value={w}>{w}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t(locale, 'Jeans-lengde', 'Jeans length')}
            value={attrText('jeans_length')}
            onChange={(e) => patchAttr('jeans_length', Number(e.target.value))}
            fullWidth
            size="small"
          >
            <MenuItem value="">{t(locale, 'Ikke satt', 'Not set')}</MenuItem>
            {JEANS_LENGTHS.map((l) => (
              <MenuItem key={l} value={l}>{l}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
          <TextField
            label={t(locale, 'Klesstørrelse', 'Clothing size')}
            value={attrText('clothing_size')}
            onChange={(e) => patchAttr('clothing_size', e.target.value)}
            fullWidth
            size="small"
            placeholder={t(locale, 'f.eks. 50 (EU), 40 (UK)', 'e.g. 54 (DE), 44 (UK)')}
          />
          <TextField
            label={t(locale, 'Skostørrelse', 'Shoe size')}
            value={attrText('shoe_size')}
            onChange={(e) => patchAttr('shoe_size', e.target.value)}
            fullWidth
            size="small"
            placeholder={t(locale, 'f.eks. 42 (EU), 8 (UK)', 'e.g. 40 (DE), 6 (UK)')}
          />
        </Stack>

        <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
          {BODY_MEASUREMENT_FIELDS.map((field) => (
            <TextField
              key={field.id}
              label={`${field[locale]} (cm)`}
              type="number"
              value={attrText(field.id)}
              onChange={(e) => patchAttr(field.id, Number(e.target.value))}
              size="small"
              sx={{ minWidth: 130, flex: '1 1 130px' }}
            />
          ))}
        </Stack>

        <FormControlLabel
          control={
            <Checkbox
              checked={form.attributes.tattoos === true}
              onChange={(e) => patchAttr('tattoos', e.target.checked)}
              sx={{ color: palette.textMuted }}
            />
          }
          label={t(locale, 'Har tatoveringer', 'Tattoos')}
        />

        <TextField
          label={t(locale, 'Egne kostymer, rekvisitter, utstyr, instrumenter', 'Own costumes, props, equipment, instruments')}
          value={attrText('own_equipment')}
          onChange={(e) => patchAttr('own_equipment', e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={2}
        />

        {/* Særlig kategori — eget samtykke, ikke en del av demografien. */}
        <Box sx={{ borderTop: `1px solid ${palette.borderSubtle}`, pt: 1.8 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.ethnicityConsent}
                onChange={(e) =>
                  onChange({
                    ...form,
                    ethnicityConsent: e.target.checked,
                    ethnicity: e.target.checked ? form.ethnicity : '',
                  })
                }
                sx={{ color: palette.textMuted }}
              />
            }
            label={t(
              locale,
              'Jeg vil oppgi etnisk opprinnelse',
              'I want to state my ethnic origin',
            )}
          />
          <Alert
            severity="info"
            sx={{ mt: 0.8, mb: 1.4, bgcolor: 'rgba(98, 73, 223,0.1)', color: palette.textSecondary, fontSize: '0.82rem' }}
          >
            {t(
              locale,
              'Etnisk opprinnelse er en særlig kategori personopplysninger. Den deles kun med partnere du har gitt demografi-tilgang, og bare så lenge du lar dette stå på. Skrur du det av, slettes verdien.',
              'Ethnic origin is a special category of personal data. It is shared only with partners you have granted demographics access, and only while this stays on. Turning it off deletes the value.',
            )}
          </Alert>
          {form.ethnicityConsent && (
            <VocabularySelect
              label={t(locale, 'Etnisk opprinnelse', 'Ethnic origin')}
              options={ETHNICITY_OPTIONS}
              value={form.ethnicity}
              locale={locale}
              onChange={(next) => onChange({ ...form, ethnicity: next })}
            />
          )}
        </Box>
      </Stack>
    </Box>
  );
}
