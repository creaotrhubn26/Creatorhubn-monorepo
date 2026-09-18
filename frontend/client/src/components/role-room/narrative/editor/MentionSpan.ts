/**
 * MentionSpan — Tiptap-node for referanser til elementer/variabler/komponenter.
 *
 * Rendres som <span class="mention mention-<kind>" data-id data-kind>label</span>,
 * samme form som Arcweaves mentions, slik at skriptlaget (narrative-script/html.ts)
 * kan gjøre dem om til @[id]-tokens. Ingen ny npm-avhengighet.
 */

import { Node, mergeAttributes } from '@tiptap/core';

export type MentionKind = 'element' | 'variable' | 'component';

export interface MentionSpanAttrs {
  id: string;
  kind: MentionKind;
  label: string;
}

export const MentionSpan = Node.create({
  name: 'mentionSpan',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-id') ?? '',
        renderHTML: (attrs: { id?: string }) => ({ 'data-id': attrs.id ?? '' }),
      },
      kind: {
        default: 'element',
        parseHTML: (element: HTMLElement) => {
          const explicit = element.getAttribute('data-kind');
          if (explicit) return explicit;
          const cls = element.getAttribute('class') ?? '';
          if (/variable/.test(cls)) return 'variable';
          if (/component/.test(cls)) return 'component';
          return 'element';
        },
        renderHTML: (attrs: { kind?: string }) => ({ 'data-kind': attrs.kind ?? 'element' }),
      },
      label: {
        default: '',
        parseHTML: (element: HTMLElement) => element.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.mention' }, { tag: 'span[data-kind]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = String(node.attrs.kind ?? 'element');
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: `mention mention-${kind}` }),
      String(node.attrs.label ?? ''),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.label ?? '');
  },
});

export const NARRATIVE_EDITOR_EXTENSIONS = [MentionSpan];
