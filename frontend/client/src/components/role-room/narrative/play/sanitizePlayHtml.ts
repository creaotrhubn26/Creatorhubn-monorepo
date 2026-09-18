/**
 * Sanitering av rendret element-HTML i Play Mode (DOMPurify, mal
 * role-room/cms/BlockRenderer.tsx). Kodeblokker er allerede fjernet av
 * runtime; mention-spans beholdes (class/data-id/data-kind) for stil.
 */

import DOMPurify from 'dompurify';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr', 'blockquote', 'span', 'img'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-id', 'data-kind', 'src', 'alt'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  RETURN_DOM_FRAGMENT: false as const,
  RETURN_DOM: false as const,
};

let hooked = false;
function ensureHook(): void {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      if (!/^https?:\/\//i.test(src)) node.removeAttribute('src');
    }
  });
}

export function sanitizePlayHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  ensureHook();
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
