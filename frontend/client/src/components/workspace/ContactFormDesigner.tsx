// @ts-nocheck
/**
 * ContactFormDesigner — drag-and-drop bygger for produsentens egne kontaktskjema.
 * Lagrer til /api/contact-forms; innsendinger blir forespørsler. Gir hostet lenke
 * (/skjema/:token) + embed-snutt. Mørk workspace-stil; live forhåndsvisning.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, TextField, MenuItem, Select, Switch, IconButton, CircularProgress, Divider, Tooltip } from '@mui/material';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicator from '@mui/icons-material/DragIndicator';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Check from '@mui/icons-material/Check';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { apiRequest } from '@/lib/queryClient';
import { ws } from './workspaceTheme';
import { WsCard, WsTag } from './ui';

const FIELD_TYPES = [
  { v: 'text', l: 'Tekst' }, { v: 'email', l: 'E-post' }, { v: 'tel', l: 'Telefon' },
  { v: 'textarea', l: 'Lang tekst' }, { v: 'select', l: 'Nedtrekk' }, { v: 'radio', l: 'Radio' },
  { v: 'date', l: 'Dato' }, { v: 'number', l: 'Tall' }, { v: 'checkbox', l: 'Avkrysning' },
];
const MAP_OPTS = [
  { v: '', l: 'Egendefinert' }, { v: 'name', l: 'Navn' }, { v: 'email', l: 'E-post' }, { v: 'phone', l: 'Telefon' },
  { v: 'description', l: 'Melding' }, { v: 'projectType', l: 'Prosjekttype' }, { v: 'eventDate', l: 'Dato' },
  { v: 'budget', l: 'Budsjett' }, { v: 'location', l: 'Sted' },
];
const uid = () => 'f_' + Math.random().toString(36).slice(2, 9);
const ti = { '& .MuiOutlinedInput-root': { fontSize: 13, color: ws.text, bgcolor: ws.panel, '& fieldset': { borderColor: ws.borderSoft }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ws.accent } }, '& input::placeholder': { color: ws.textFaint, opacity: 1 } };
const sel = { fontSize: 13, color: ws.text, bgcolor: ws.panel, '.MuiOutlinedInput-notchedOutline': { borderColor: ws.borderSoft }, '.MuiSvgIcon-root': { color: ws.textDim } };

function FieldRow({ field, onChange, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const up = (patch: any) => onChange({ ...field, ...patch });
  const hasOpts = field.type === 'select' || field.type === 'radio';
  return (
    <Box ref={setNodeRef} style={style} sx={{ p: 1.25, mb: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', color: ws.textFaint, display: 'flex' }}><DragIndicator sx={{ fontSize: 19 }} /></Box>
        <TextField size="small" value={field.label} onChange={(e) => up({ label: e.target.value })} placeholder="Etikett" sx={{ ...ti, flex: 1 }} />
        <Select size="small" value={field.type} onChange={(e) => up({ type: e.target.value })} sx={{ ...sel, width: 120 }}>
          {FIELD_TYPES.map((t) => <MenuItem key={t.v} value={t.v}>{t.l}</MenuItem>)}
        </Select>
        <Tooltip title="Lagres som"><Select size="small" value={field.mapTo || ''} onChange={(e) => up({ mapTo: e.target.value || null })} sx={{ ...sel, width: 120 }}>
          {MAP_OPTS.map((m) => <MenuItem key={m.v} value={m.v}>{m.l}</MenuItem>)}
        </Select></Tooltip>
        <Tooltip title="Påkrevd"><Switch size="small" checked={!!field.required} onChange={(e) => up({ required: e.target.checked })} /></Tooltip>
        <IconButton size="small" onClick={onDelete} sx={{ color: ws.textFaint, '&:hover': { color: ws.red } }}><DeleteOutline sx={{ fontSize: 18 }} /></IconButton>
      </Stack>
      {hasOpts && (
        <TextField size="small" fullWidth sx={{ ...ti, mt: 1 }} value={(field.options || []).join(', ')} onChange={(e) => up({ options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
          placeholder="Valg, kommaseparert (f.eks. Bryllup, Portrett, Bedrift)" />
      )}
    </Box>
  );
}

const ContactFormDesigner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [form, setForm] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    apiRequest('/api/contact-forms')
      .then(async (r: any) => {
        const list = r?.forms || [];
        if (list.length) { setForm(list[0]); return; }
        const c: any = await apiRequest('/api/contact-forms', { method: 'POST', body: { title: 'Kontakt oss' } });
        setForm(c?.form || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patch = (p: any) => setForm((f: any) => ({ ...f, ...p }));
  const patchBrand = (p: any) => setForm((f: any) => ({ ...f, branding: { ...(f.branding || {}), ...p } }));
  const setFields = (fields: any[]) => setForm((f: any) => ({ ...f, fields }));

  const addField = () => setFields([...(form.fields || []), { id: uid(), type: 'text', label: 'Nytt felt', placeholder: '', required: false, options: [], mapTo: null }]);
  const onDragEnd = (e: any) => {
    const { active, over } = e; if (!over || active.id === over.id) return;
    const ids = form.fields.map((f: any) => f.id);
    setFields(arrayMove(form.fields, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  const save = async () => {
    if (!form) return;
    if (!form.fields?.some((f: any) => f.mapTo === 'email')) { window.alert('Skjemaet må ha minst ett felt som lagres som «E-post» (det er slik forespørselen rutes til deg).'); return; }
    setSaving(true);
    try {
      const r: any = await apiRequest(`/api/contact-forms/${form.id}`, { method: 'PUT', body: { title: form.title, intro: form.intro, fields: form.fields, branding: form.branding, isActive: true } });
      if (r?.form) setForm(r.form);
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); }
    finally { setSaving(false); }
  };

  const copy = (text: string, key: string) => { try { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1800); } catch { /* */ } };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;
  if (!form) return <Box sx={{ p: 4, textAlign: 'center', color: ws.textDim }}>Kunne ikke laste skjema.</Box>;

  const shareUrl = form.shareUrl || `${window.location.origin}/skjema/${form.token}`;
  const embed = `<iframe src="${shareUrl}" style="width:100%;max-width:560px;height:720px;border:0" title="Kontaktskjema"></iframe>`;
  const accent = form.branding?.accent || '#ff8c00';

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton onClick={onBack} sx={{ color: ws.textDim }}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Kontaktskjema</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Bygg ditt eget skjema. Innsendinger lander rett i Forespørsler — med din e-post bakt inn, så de havner alltid hos deg.</Typography>
        </Box>
        <Button variant="contained" disabled={saving} onClick={save} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{saving ? 'Lagrer …' : 'Lagre'}</Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        {/* Bygger */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <WsCard sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Overskrift & intro</Typography>
            <TextField size="small" fullWidth sx={{ ...ti, mb: 1 }} value={form.title || ''} onChange={(e) => patch({ title: e.target.value })} placeholder="Tittel (f.eks. «Be om tilbud»)" />
            <TextField size="small" fullWidth multiline minRows={2} sx={ti} value={form.intro || ''} onChange={(e) => patch({ intro: e.target.value })} placeholder="Kort intro-tekst (valgfritt)" />
          </WsCard>

          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>Felter</Typography>
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Dra for å endre rekkefølge</Typography>
            </Stack>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={(form.fields || []).map((f: any) => f.id)} strategy={verticalListSortingStrategy}>
                {(form.fields || []).map((f: any) => (
                  <FieldRow key={f.id} field={f}
                    onChange={(nf: any) => setFields(form.fields.map((x: any) => x.id === f.id ? nf : x))}
                    onDelete={() => setFields(form.fields.filter((x: any) => x.id !== f.id))} />
                ))}
              </SortableContext>
            </DndContext>
            <Button size="small" startIcon={<AddCircleOutline />} onClick={addField} sx={{ mt: 0.5, color: ws.accent, textTransform: 'none', fontWeight: 600 }}>Legg til felt</Button>
          </WsCard>

          <WsCard sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Utseende</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Aksentfarge</Typography>
                <input type="color" value={accent} onChange={(e) => patchBrand({ accent: e.target.value })} style={{ width: 34, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
              </Stack>
              <TextField size="small" sx={{ ...ti, flex: 1, minWidth: 180 }} value={form.branding?.logoUrl || ''} onChange={(e) => patchBrand({ logoUrl: e.target.value })} placeholder="Logo-URL (valgfritt)" />
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <TextField size="small" sx={{ ...ti, flex: 1, minWidth: 180 }} value={form.branding?.submitLabel || ''} onChange={(e) => patchBrand({ submitLabel: e.target.value })} placeholder="Knapp-tekst (Send forespørsel)" />
              <TextField size="small" sx={{ ...ti, flex: 1, minWidth: 180 }} value={form.branding?.thankYouMessage || ''} onChange={(e) => patchBrand({ thankYouMessage: e.target.value })} placeholder="Takk-melding etter innsending" />
            </Stack>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Del skjemaet</Typography>
            <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 0.75 }}>Hostet lenke — del den, eller legg den i «kontakt oss»-knappen på nettsiden din:</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <TextField size="small" fullWidth sx={ti} value={shareUrl} InputProps={{ readOnly: true }} />
              <Button size="small" startIcon={copied === 'url' ? <Check /> : <ContentCopy />} onClick={() => copy(shareUrl, 'url')} sx={{ color: copied === 'url' ? ws.green : ws.accent, textTransform: 'none', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{copied === 'url' ? 'Kopiert' : 'Kopier'}</Button>
            </Stack>
            <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 0.75 }}>Embed — lim inn i nettsiden din (iframe):</Typography>
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth multiline sx={ti} value={embed} InputProps={{ readOnly: true }} />
              <Button size="small" startIcon={copied === 'embed' ? <Check /> : <ContentCopy />} onClick={() => copy(embed, 'embed')} sx={{ color: copied === 'embed' ? ws.green : ws.accent, textTransform: 'none', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{copied === 'embed' ? 'Kopiert' : 'Kopier'}</Button>
            </Stack>
          </WsCard>
        </Box>

        {/* Live forhåndsvisning */}
        <Box sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0, position: { md: 'sticky' }, top: 16 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Forhåndsvisning</Typography>
          <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 3, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
            {form.branding?.logoUrl && <Box component="img" src={form.branding.logoUrl} alt="" sx={{ maxHeight: 40, mb: 1.5 }} />}
            <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#1a1f29' }}>{form.title || 'Kontakt oss'}</Typography>
            {form.intro && <Typography sx={{ fontSize: 13, color: '#5a6472', mt: 0.5, mb: 1.5 }}>{form.intro}</Typography>}
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              {(form.fields || []).map((f: any) => (
                <Box key={f.id}>
                  {f.type !== 'checkbox' && <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#2c3340', mb: 0.5 }}>{f.label}{f.required && <span style={{ color: accent }}> *</span>}</Typography>}
                  {f.type === 'textarea' ? <Box sx={{ height: 64, border: '1px solid #d7dbe0', borderRadius: 1.5, bgcolor: '#fff' }} />
                    : f.type === 'select' ? <Box sx={{ height: 38, border: '1px solid #d7dbe0', borderRadius: 1.5, bgcolor: '#fff', display: 'flex', alignItems: 'center', px: 1.25, color: '#aab2bd', fontSize: 13 }}>Velg …</Box>
                    : f.type === 'checkbox' ? <Typography sx={{ fontSize: 13, color: '#2c3340' }}>☐ {f.label}</Typography>
                    : f.type === 'radio' ? <Stack spacing={0.5}>{(f.options || ['Valg 1']).map((o: string, i: number) => <Typography key={i} sx={{ fontSize: 13, color: '#2c3340' }}>○ {o}</Typography>)}</Stack>
                    : <Box sx={{ height: 38, border: '1px solid #d7dbe0', borderRadius: 1.5, bgcolor: '#fff' }} />}
                </Box>
              ))}
              <Box sx={{ mt: 1, height: 42, borderRadius: 2, bgcolor: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{form.branding?.submitLabel || 'Send forespørsel'}</Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
};

export default ContactFormDesigner;
