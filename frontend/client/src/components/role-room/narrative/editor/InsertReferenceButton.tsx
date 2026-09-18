/**
 * InsertReferenceButton — «Sett inn referanse»: meny med elementer, variabler
 * og komponenter som settes inn som MentionSpan i editoren.
 */

import React, { useMemo, useState } from 'react';
import { IconButton, ListSubheader, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { AlternateEmail as ReferenceIcon } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';
import { htmlToText, type NarrativeGraph } from '../narrativeTypes';
import type { MentionKind } from './MentionSpan';

export interface InsertReferenceButtonProps {
  editor: Editor;
  graph: NarrativeGraph;
  /** Elementet som redigeres (ekskluderes fra lista). */
  currentElementId?: string | null;
  buttonSx?: Record<string, unknown>;
}

interface RefOption { id: string; kind: MentionKind; label: string; hint?: string }

export function InsertReferenceButton({ editor, graph, currentElementId, buttonSx }: InsertReferenceButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const groups = useMemo(() => {
    const elements: RefOption[] = graph.elements
      .filter((e) => e.kind !== 'note' && e.id !== currentElementId)
      .map((e): RefOption => ({ id: e.id, kind: 'element', label: htmlToText(e.titleHtml) || 'Uten tittel', hint: graph.boards.find((b) => b.id === e.boardId)?.name }))
      .slice(0, 200);
    const variables: RefOption[] = graph.variables.map((v): RefOption => ({ id: v.id, kind: 'variable', label: v.name, hint: v.type }));
    const components: RefOption[] = graph.components.map((c): RefOption => ({ id: c.id, kind: 'component', label: c.name, hint: c.folderPath || undefined }));
    return { elements, variables, components };
  }, [graph, currentElementId]);

  const insert = (opt: RefOption) => {
    setAnchor(null);
    editor.chain().focus().insertContent({ type: 'mentionSpan', attrs: { id: opt.id, kind: opt.kind, label: opt.label } }).run();
  };

  const section = (title: string, items: RefOption[]) => (items.length === 0 ? null : [
    <ListSubheader key={`h-${title}`} sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 10, letterSpacing: 1 }}>{title}</ListSubheader>,
    ...items.map((opt) => (
      <MenuItem key={`${opt.kind}-${opt.id}`} onClick={() => insert(opt)} dense data-testid={`narrative-ref-${opt.kind}-${opt.id}`}>
        <Typography sx={{ fontSize: 13, flex: 1 }}>{opt.label}</Typography>
        {opt.hint ? <Typography sx={{ fontSize: 10, opacity: 0.6, ml: 2 }}>{opt.hint}</Typography> : null}
      </MenuItem>
    )),
  ]);

  const empty = groups.elements.length + groups.variables.length + groups.components.length === 0;

  return (
    <>
      <Tooltip title="Sett inn referanse (element, variabel, komponent)" enterDelay={500}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={buttonSx} aria-label="Sett inn referanse" data-testid="narrative-insert-reference">
          <ReferenceIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
        </IconButton>
      </Tooltip>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 260 } } }}>
        {empty ? <MenuItem disabled>Ingen referanser tilgjengelig ennå.</MenuItem> : null}
        {section('ELEMENTER', groups.elements)}
        {section('VARIABLER', groups.variables)}
        {section('KOMPONENTER', groups.components)}
      </Menu>
    </>
  );
}
