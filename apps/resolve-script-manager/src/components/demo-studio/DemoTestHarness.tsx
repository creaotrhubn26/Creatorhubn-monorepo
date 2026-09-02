/**
 * DemoTestHarness — minimal montering av DemoStudioShell for Playwright e2e
 * (?test=demo). Tauri-kall mockes via e2e/fixtures/demo-mock.ts.
 *
 * Denne harnessen hopper over hele App.tsx sitt komponenttre (inkl.
 * silentAuthCheck), så uten dette kallet forblir entitlements-cachen tom
 * for alltid — DemoStudioShell sin à-la-carte-gate (hasModule('marketing'))
 * ville da alltid vist «MODUL LÅST», uansett hva testen mocker på
 * /modules/entitlements.
 */
import { useEffect } from 'react';
import { DemoStudioShell } from './DemoStudioShell';
import { refreshEntitlements } from '../../entitlements';
import { useDemoStudio } from './demoStudioStore';

export function DemoTestHarness() {
  useEffect(() => {
    void refreshEntitlements();
    // Testene trenger av og til å nå AI Director sin «describe»-fase, som
    // krever tomme scene-narrasjoner (se hasGenerated i DemoStudioShell) —
    // ikke oppnåelig via vanlige klikk når malen kommer forhåndsutfylt.
    (window as unknown as { __DEMO_STUDIO_STORE__: typeof useDemoStudio }).__DEMO_STUDIO_STORE__ = useDemoStudio;
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0 }} data-testid="demo-harness">
      <DemoStudioShell />
    </div>
  );
}

export default DemoTestHarness;
