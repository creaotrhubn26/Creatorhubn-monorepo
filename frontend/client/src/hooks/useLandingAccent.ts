/**
 * useLandingBrand — CreatorHub Design: token-driv en landingssides merkevare (aksent/bg/tekst).
 *
 * `map` = { design-token-nøkkel → CSS-variabel }, f.eks. { landingAccent: '--rrl-accent',
 * landingBg: '--rrl-bg', landingText: '--rrl-text' }. Setter hver CSS-var på :root fra
 * design-tokens (ws, RÅ m/ raw:true-markør). Ingen eksplisitt override → variabelen settes
 * ikke → literal-fallbacken i landingssidens palett gjelder → identisk. RÅ (ikke merget) så
 * seedede workspace-aksenter (leadgrid connector-blå) IKKE lekker inn — landing-nøklene er egne.
 * Redigerbart via CreatorHub Design → Design-tokens (Landingsside-aksent/-bakgrunn/-tekst).
 */
import { useEffect } from 'react';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function useLandingBrand(workspace: string, map: Record<string, string>): void {
  const mapKey = JSON.stringify(map);
  useEffect(() => {
    let live = true;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || d.raw !== true || !d.tokens) return;
        const tokens = d.tokens as Record<string, unknown>;
        const root = document.documentElement;
        for (const [tokenKey, cssVar] of Object.entries(JSON.parse(mapKey) as Record<string, string>)) {
          const v = tokens[tokenKey];
          if (typeof v === 'string' && HEX6.test(v)) root.style.setProperty(cssVar, v);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [workspace, mapKey]);
}

/** Bakoverkompatibel enkel-variant (kun aksent). */
export function useLandingAccent(workspace: string, cssVar: string): void {
  useLandingBrand(workspace, { landingAccent: cssVar });
}
