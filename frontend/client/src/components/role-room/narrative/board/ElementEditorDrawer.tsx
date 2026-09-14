/**
 * ElementEditorDrawer — redigerer ett element: tittel, innhold (Tiptap via
 * RichTextEditor), tema, custom-ID, forgreningsbetingelser, jumper-mål,
 * festede komponenter og attributter. Lagrer med If-Match (versjon) via
 * storen; 409 vises som konflikt-snackbar i workspacet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Flag as StartIcon,
  Add as AddIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material';
import { RichTextEditor } from '../../components/RichTextEditor';
import {
  ELEMENT_KIND_LABELS,
  NARRATIVE_THEMES,
  htmlToText,
  type NarrativeAttribute,
  type NarrativeBranchCondition,
  type NarrativeElement,
  type NarrativeGraph,
} from '../narrativeTypes';
import { narrativeColors, ELEMENT_THEME_COLORS } from '../narrativeTheme';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';

export interface ElementEditorDrawerProps {
  open: boolean;
  element: NarrativeElement | null;
  graph: NarrativeGraph;
  store: UseNarrativeGraphResult;
  onClose: () => void;
  onDeleted?: () => void;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function titleToHtml(text: string): string {
  const t = text.trim();
  return t ? `<p>${escapeHtml(t)}</p>` : '';
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

export function ElementEditorDrawer({ open, element, graph, store, onClose, onDeleted }: ElementEditorDrawerProps) {
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [theme, setTheme] = useState('default');
  const [customId, setCustomId] = useState('');
  const [conditions, setConditions] = useState<NarrativeBranchCondition[]>([]);
  const [jumperTargetId, setJumperTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');

  // Nullstill skjema når et annet element åpnes (eller versjonen endres utenfra).
  useEffect(() => {
    if (!element) return;
    setTitle(htmlToText(element.titleHtml));
    setContentHtml(element.contentHtml);
    setTheme(element.theme || 'default');
    setCustomId(element.customId ?? '');
    setConditions(element.branchConditions.map((c) => ({ ...c })));
    setJumperTargetId(element.jumperTargetId);
  }, [element?.id, element?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!element) return false;
    return (
      titleToHtml(title) !== element.titleHtml
      || contentHtml !== element.contentHtml
      || theme !== element.theme
      || (customId.trim() || null) !== element.customId
      || JSON.stringify(conditions) !== JSON.stringify(element.branchConditions)
      || jumperTargetId !== element.jumperTargetId
    );
  }, [element, title, contentHtml, theme, customId, conditions, jumperTargetId]);

  const attachedComponentIds = useMemo(
    () => (element ? graph.elementComponents.filter((ec) => ec.elementId === element.id).sort((a, b) => a.sortOrder - b.sortOrder).map((ec) => ec.componentId) : []),
    [graph.elementComponents, element],
  );
  const attachedComponents = useMemo(
    () => attachedComponentIds.map((id) => graph.components.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c),
    [attachedComponentIds, graph.components],
  );
  const attributes = useMemo<NarrativeAttribute[]>(
    () => (element ? graph.attributes.filter((a) => a.ownerKind === 'element' && a.ownerId === element.id) : []),
    [graph.attributes, element],
  );
  const jumperTargets = useMemo(
    () => graph.elements.filter((e) => e.kind !== 'note' && e.id !== element?.id),
    [graph.elements, element?.id],
  );
  const boardName = (boardId: string) => graph.boards.find((b) => b.id === boardId)?.name ?? '';

  const save = async () => {
    if (!element || !dirty || saving) return;
    setSaving(true);
    try {
      await store.patchElement(element.id, {
        titleHtml: titleToHtml(title),
        contentHtml,
        theme,
        customId: customId.trim() || null,
        ...(element.kind === 'branch' ? { branchConditions: conditions } : {}),
        ...(element.kind === 'jumper' ? { jumperTargetId } : {}),
      });
    } catch {
      /* feil/konflikt vises av workspacet via store.error / store.conflict */
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isStart = !!element && graph.settings.startingElementId === element.id;

  return (
    <Drawer
      anchor="right"
      open={open && !!element}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: narrativeColors.bgPanel,
          color: narrativeColors.text,
          borderLeft: `1px solid ${narrativeColors.borderStrong}`,
          position: 'absolute',
          height: '100%',
        },
      }}
      data-testid="narrative-element-drawer"
    >
      {element ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
            <Chip size="small" label={ELEMENT_KIND_LABELS[element.kind]} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} />
            <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: narrativeColors.textDim, flex: 1 }}>
              v{element.version}
            </Typography>
            {element.kind !== 'note' ? (
              <Tooltip title={isStart ? 'Dette er startelementet' : 'Sett som startelement'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={isStart}
                    onClick={() => void store.updateSettings({ startingElementId: element.id })}
                    sx={{ color: isStart ? narrativeColors.accent : narrativeColors.textDim }}
                    aria-label="Sett som startelement"
                  >
                    <StartIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title="Slett element">
              <IconButton
                size="small"
                onClick={async () => {
                  if (!window.confirm('Slette elementet og alle koblingene dets?')) return;
                  await store.deleteElement(element.id);
                  onDeleted?.();
                  onClose();
                }}
                sx={{ color: narrativeColors.error }}
                aria-label="Slett element"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onClose} sx={{ color: narrativeColors.textDim }} aria-label="Lukk">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="Tittel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
                fullWidth
                sx={fieldSx}
                inputProps={{ 'data-testid': 'narrative-element-title' }}
              />

              {element.kind === 'jumper' ? (
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel id="jumper-target-label">Hopp til</InputLabel>
                  <Select
                    labelId="jumper-target-label"
                    label="Hopp til"
                    value={jumperTargetId ?? ''}
                    onChange={(e) => setJumperTargetId(e.target.value ? String(e.target.value) : null)}
                  >
                    <MenuItem value="">— Ingen —</MenuItem>
                    {jumperTargets.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {htmlToText(t.titleHtml) || 'Uten tittel'}
                        <Typography component="span" sx={{ ml: 1, fontSize: 11, color: narrativeColors.textDim }}>
                          {boardName(t.boardId)}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}

              {element.kind === 'branch' ? (
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: narrativeColors.textDim, mb: 0.75 }}>
                    Betingelser (if / elseif / else)
                  </Typography>
                  <Stack spacing={1}>
                    {conditions.map((c, i) => (
                      <Box key={c.id} sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: 11, width: 36, pt: 1.25, color: narrativeColors.textDim }}>
                          {i === 0 ? 'if' : c.script ? 'elif' : 'else'}
                        </Typography>
                        <Stack spacing={0.5} sx={{ flex: 1 }}>
                          <TextField
                            size="small"
                            placeholder={i === 0 ? 'gold >= 10' : 'tomt = else'}
                            value={c.script ?? ''}
                            onChange={(e) => setConditions((cs) => cs.map((x) => (x.id === c.id ? { ...x, script: e.target.value || null } : x)))}
                            sx={{ ...fieldSx, '& input': { fontFamily: 'monospace', fontSize: 12 } }}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            placeholder="Etikett på utgangen (valgfri)"
                            value={c.label ?? ''}
                            onChange={(e) => setConditions((cs) => cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value || null } : x)))}
                            sx={fieldSx}
                            fullWidth
                          />
                        </Stack>
                        <Stack>
                          <IconButton size="small" disabled={i === 0} onClick={() => setConditions((cs) => { const n = cs.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} sx={{ color: narrativeColors.textDim }} aria-label="Flytt opp"><UpIcon sx={{ fontSize: 16 }} /></IconButton>
                          <IconButton size="small" disabled={i === conditions.length - 1} onClick={() => setConditions((cs) => { const n = cs.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} sx={{ color: narrativeColors.textDim }} aria-label="Flytt ned"><DownIcon sx={{ fontSize: 16 }} /></IconButton>
                          <IconButton size="small" onClick={() => setConditions((cs) => cs.filter((x) => x.id !== c.id))} sx={{ color: narrativeColors.error }} aria-label="Fjern betingelse"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Stack>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setConditions((cs) => [...cs, { id: `cond_${Math.random().toString(36).slice(2, 10)}`, script: null, label: null }])}
                      sx={{ alignSelf: 'flex-start', color: narrativeColors.accent }}
                    >
                      Legg til betingelse
                    </Button>
                  </Stack>
                </Box>
              ) : null}

              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: narrativeColors.textDim, mb: 0.75 }}>Innhold</Typography>
                <RichTextEditor
                  key={`${element.id}:${element.version}`}
                  value={contentHtml}
                  onChange={setContentHtml}
                  placeholder={element.kind === 'note' ? 'Skriv notatet…' : 'Skriv dialog, beskrivelse eller arcscript i en kodeblokk…'}
                  minHeight={160}
                  accentColor={narrativeColors.accent}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ ...fieldSx, minWidth: 140 }}>
                  <InputLabel id="theme-label">Tema</InputLabel>
                  <Select labelId="theme-label" label="Tema" value={theme} onChange={(e) => setTheme(String(e.target.value))}>
                    {NARRATIVE_THEMES.map((t) => (
                      <MenuItem key={t} value={t}>
                        <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: ELEMENT_THEME_COLORS[t].border, mr: 1 }} />
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Custom-ID"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  size="small"
                  sx={{ ...fieldSx, flex: 1 }}
                  inputProps={{ style: { fontFamily: 'monospace' } }}
                />
              </Stack>

              {element.kind === 'element' || element.kind === 'branch' ? (
                <>
                  <Divider sx={{ borderColor: narrativeColors.borderStrong }} />
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: narrativeColors.textDim, mb: 0.75 }}>Komponenter</Typography>
                    <Autocomplete
                      multiple
                      size="small"
                      options={graph.components}
                      getOptionLabel={(c) => c.name}
                      value={attachedComponents}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      onChange={(_e, next) => void store.setElementComponents(element.id, next.map((c) => c.id))}
                      renderInput={(params) => <TextField {...params} placeholder={graph.components.length ? 'Velg komponenter…' : 'Ingen komponenter ennå'} sx={fieldSx} />}
                      renderTags={(value, getTagProps) => value.map((c, index) => (
                        <Chip {...getTagProps({ index })} key={c.id} label={c.name} size="small" />
                      ))}
                    />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: narrativeColors.textDim, mb: 0.75 }}>Attributter</Typography>
                    <Stack spacing={0.75}>
                      {attributes.map((a) => (
                        <Box key={a.id} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Typography sx={{ fontSize: 12, minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</Typography>
                          <TextField
                            size="small"
                            defaultValue={typeof a.value === 'string' ? a.value : JSON.stringify(a.value ?? '')}
                            onBlur={(e) => {
                              const raw = e.target.value;
                              const value = a.type === 'int' || a.type === 'float' ? Number(raw) : a.type === 'bool' ? raw === 'true' : raw;
                              void store.patchAttribute(a.id, { value });
                            }}
                            sx={{ ...fieldSx, flex: 1 }}
                          />
                          <IconButton size="small" onClick={() => void store.deleteAttribute(a.id)} sx={{ color: narrativeColors.error }} aria-label="Fjern attributt">
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ))}
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField
                          size="small"
                          placeholder="Nytt attributt-navn"
                          value={newAttrName}
                          onChange={(e) => setNewAttrName(e.target.value)}
                          sx={{ ...fieldSx, flex: 1 }}
                        />
                        <Button
                          size="small"
                          disabled={!newAttrName.trim()}
                          onClick={async () => {
                            await store.createAttribute({ ownerKind: 'element', ownerId: element.id, name: newAttrName.trim(), type: 'string', value: '' });
                            setNewAttrName('');
                          }}
                          sx={{ color: narrativeColors.accent }}
                        >
                          Legg til
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                </>
              ) : null}
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.25, borderTop: `1px solid ${narrativeColors.borderStrong}`, alignItems: 'center' }}>
            <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, flex: 1 }}>
              {dirty ? 'Ulagrede endringer — ⌘S for å lagre' : 'Alt lagret'}
            </Typography>
            <Button onClick={onClose} sx={{ color: narrativeColors.textDim }}>Lukk</Button>
            <Button
              variant="contained"
              disabled={!dirty || saving}
              onClick={() => void save()}
              data-testid="narrative-element-save"
              sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </Box>
        </Box>
      ) : null}
    </Drawer>
  );
}
