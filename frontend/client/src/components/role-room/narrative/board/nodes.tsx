/**
 * reactflow-nodetyper for Story Graph.
 *
 * Kobling-regler (Arcweave):
 *  - element: ubegrenset ut/inn (én kilde-handle 'default')
 *  - branch:  én kilde-handle per betingelse (id = betingelsens id)
 *  - jumper:  ingen utganger, ubegrenset innganger
 *  - note:    ingen handles
 */

import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Chip, Typography } from '@mui/material';
import {
  CallSplit as BranchIcon,
  MoveDown as JumperIcon,
  StickyNote2 as NoteIcon,
  Flag as StartIcon,
} from '@mui/icons-material';
import { htmlToText, type NarrativeElement } from '../narrativeTypes';
import { narrativeColors, themeColors } from '../narrativeTheme';

export interface NarrativeNodeData {
  element: NarrativeElement;
  isStart: boolean;
  /** Tittel på jumper-målet (kun for kind=jumper). */
  jumperTargetTitle?: string | null;
  /** Antall komponenter festet (vises som chip). */
  componentNames?: string[];
}

const HANDLE_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  background: narrativeColors.accent,
  border: `2px solid ${narrativeColors.bgBase}`,
};

function NodeFrame({
  data, selected, children, icon,
}: { data: NarrativeNodeData; selected: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  const { element } = data;
  const colors = themeColors(element.theme);
  const title = htmlToText(element.titleHtml) || (element.kind === 'note' ? 'Notat' : 'Uten tittel');
  return (
    <Box
      data-testid={`narrative-node-${element.id}`}
      data-kind={element.kind}
      sx={{
        width: element.width,
        minHeight: element.height,
        borderRadius: 2,
        border: `2px solid ${selected ? narrativeColors.accent : colors.border}`,
        boxShadow: selected ? `0 0 0 3px ${narrativeColors.accentSoft}` : '0 6px 18px rgba(0,0,0,0.35)',
        bgcolor: narrativeColors.bgCard,
        color: narrativeColors.text,
        overflow: 'hidden',
        fontSize: 13,
      }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75,
          bgcolor: colors.header, borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {data.isStart ? <StartIcon sx={{ fontSize: 16, color: narrativeColors.accent }} titleAccess="Startelement" /> : null}
        {icon}
        <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        {element.customId ? (
          <Typography sx={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7 }}>#{element.customId}</Typography>
        ) : null}
      </Box>
      <Box sx={{ px: 1.25, py: 1 }}>{children}</Box>
    </Box>
  );
}

function ContentPreview({ html, max = 180 }: { html: string; max?: number }) {
  const text = htmlToText(html);
  if (!text) return <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, fontStyle: 'italic' }}>Tomt innhold</Typography>;
  return (
    <Typography sx={{ fontSize: 12, color: narrativeColors.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text.length > max ? `${text.slice(0, max)}…` : text}
    </Typography>
  );
}

function ComponentChips({ names }: { names?: string[] }) {
  if (!names || names.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
      {names.slice(0, 4).map((n) => (
        <Chip key={n} label={n} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.08)', color: narrativeColors.text }} />
      ))}
      {names.length > 4 ? <Chip label={`+${names.length - 4}`} size="small" sx={{ height: 20, fontSize: 10 }} /> : null}
    </Box>
  );
}

export const ElementNode = React.memo(function ElementNode({ data, selected }: NodeProps<NarrativeNodeData>) {
  return (
    <NodeFrame data={data} selected={!!selected}>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <ContentPreview html={data.element.contentHtml} />
      <ComponentChips names={data.componentNames} />
      <Handle type="source" position={Position.Right} id="default" style={HANDLE_STYLE} />
    </NodeFrame>
  );
});

export const BranchNode = React.memo(function BranchNode({ data, selected }: NodeProps<NarrativeNodeData>) {
  const conditions = data.element.branchConditions;
  const count = Math.max(conditions.length, 1);
  return (
    <NodeFrame data={data} selected={!!selected} icon={<BranchIcon sx={{ fontSize: 16, color: narrativeColors.warning }} />}>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      {conditions.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: narrativeColors.warning }}>Ingen betingelser — åpne for å legge til.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {conditions.map((c, i) => (
            <Box key={c.id} sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0.75, pr: 1 }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: narrativeColors.textDim, minWidth: 34 }}>
                {i === 0 ? 'if' : c.script ? 'elif' : 'else'}
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.label ?? c.script ?? '—'}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {conditions.map((c, i) => (
        <Handle
          key={c.id}
          type="source"
          position={Position.Right}
          id={c.id}
          style={{ ...HANDLE_STYLE, top: `${((i + 1) / (count + 1)) * 100}%` }}
        />
      ))}
      {conditions.length === 0 ? <Handle type="source" position={Position.Right} id="default" style={HANDLE_STYLE} /> : null}
    </NodeFrame>
  );
});

export const JumperNode = React.memo(function JumperNode({ data, selected }: NodeProps<NarrativeNodeData>) {
  return (
    <NodeFrame data={data} selected={!!selected} icon={<JumperIcon sx={{ fontSize: 16, color: '#60a5fa' }} />}>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>
        {data.jumperTargetTitle ? `→ ${data.jumperTargetTitle}` : 'Ingen mål valgt'}
      </Typography>
    </NodeFrame>
  );
});

export const NoteNode = React.memo(function NoteNode({ data, selected }: NodeProps<NarrativeNodeData>) {
  const colors = themeColors(data.element.theme === 'default' ? 'amber' : data.element.theme);
  return (
    <Box
      data-testid={`narrative-node-${data.element.id}`}
      data-kind="note"
      sx={{
        width: data.element.width,
        minHeight: data.element.height,
        p: 1.25,
        borderRadius: 1,
        bgcolor: colors.header,
        border: `1px dashed ${selected ? narrativeColors.accent : colors.border}`,
        color: narrativeColors.text,
        fontSize: 12,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: narrativeColors.textDim }}>
        <NoteIcon sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{htmlToText(data.element.titleHtml) || 'Notat'}</Typography>
      </Box>
      <ContentPreview html={data.element.contentHtml} max={400} />
    </Box>
  );
});

export const NARRATIVE_NODE_TYPES = {
  element: ElementNode,
  branch: BranchNode,
  jumper: JumperNode,
  note: NoteNode,
};
