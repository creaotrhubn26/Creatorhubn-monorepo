import { useEffect } from 'react';

// Chrome-nøkkel (design-tokens `chrome`-namespace) → CSS-var på :root. Nøklene matcher backend-ALLOWED
// (bg/panelSolid/panel/border/text/textDim). Role Room-shellene faller tilbake fra disse via var(...).
export const ROLE_CHROME_VAR: Record<string, string> = {
  bg: '--role-chrome-bg',
  panelSolid: '--role-chrome-panel',
  panel: '--role-chrome-panel-glass',
  border: '--role-chrome-border',
  text: '--role-chrome-text',
  textDim: '--role-chrome-text-dim',
};

/**
 * useRoleRoomBrand — CreatorHub Design: token-driv Role Room-merkevaren fra design-tokens
 * (ws=theroleroom, RÅ override m/ raw:true-markør). Setter CSS-vars på :root som de var-drevne
 * flatene faller tilbake fra. INGEN override → vars uset → literalene gjelder → pikselidentisk.
 *
 * Kalles fra Role Room-monteringspunktene (casting-main har en egen inline-kopi; denne dekker
 * client-workspace/producer-flatene der cyan-familien dominerer).
 */
export function useRoleRoomBrand(): void {
  useEffect(() => {
    let live = true;
    fetch('/api/design/tokens?ws=theroleroom&raw=1', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || d.raw !== true || !d.tokens) return;
        const root = document.documentElement;
        const t = d.tokens as Record<string, unknown>;
        const valid = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
        if (valid(t.accent)) {
          const hex = t.accent;
          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
          root.style.setProperty('--role-accent', hex);
          root.style.setProperty('--role-border', `rgba(${r},${g},${b},0.32)`);
        }
        if (valid(t.portalAccent)) root.style.setProperty('--role-portal-accent', t.portalAccent);
        if (valid(t.cyanAccent)) root.style.setProperty('--role-cyan', t.cyanAccent);
        if (valid(t.violetAccent)) root.style.setProperty('--role-violet', t.violetAccent);
        // Chrome (Fase B-paritet m/ CreatorHub): shell-overflate-farger → --role-chrome-* CSS-vars.
        // Verdier kan være hex ELLER rgba() (backend har allerede validert mønsteret), så løs sjekk.
        const chrome = t.chrome;
        if (chrome && typeof chrome === 'object' && !Array.isArray(chrome)) {
          const c = chrome as Record<string, unknown>;
          for (const [k, cssVar] of Object.entries(ROLE_CHROME_VAR)) {
            const v = c[k];
            if (typeof v === 'string' && v) root.style.setProperty(cssVar, v);
          }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
}
