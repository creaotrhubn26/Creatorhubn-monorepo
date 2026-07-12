/**
 * useLandingAccent — CreatorHub Design: token-driv en landingssides primær-aksent.
 *
 * Setter `cssVar` på :root fra design-tokens (ws, RÅ `landingAccent` m/ raw:true-markør).
 * Ingen eksplisitt override → variabelen settes ikke → literal-fallbacken i landingssidens
 * palett gjelder → identisk. Bruker RÅ (ikke merget) så seedede workspace-aksenter (f.eks.
 * leadgrid connector-blå #2f6df0) IKKE lekker inn i landing-aksenten — landingAccent er en
 * egen, uavhengig nøkkel. Redigerbart via CreatorHub Design → Design-tokens → «Landingsside-aksent».
 */
import { useEffect } from 'react';

export function useLandingAccent(workspace: string, cssVar: string): void {
  useEffect(() => {
    let live = true;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || d.raw !== true) return;
        const hex = d.tokens && (d.tokens as Record<string, unknown>).landingAccent;
        if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
          document.documentElement.style.setProperty(cssVar, hex);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [workspace, cssVar]);
}
