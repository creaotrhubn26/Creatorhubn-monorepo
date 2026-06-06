/**
 * DemoTestHarness — minimal montering av DemoStudioShell for Playwright e2e
 * (?test=demo). Tauri-kall mockes via e2e/fixtures/demo-mock.ts.
 */
import { DemoStudioShell } from './DemoStudioShell';

export function DemoTestHarness() {
  return (
    <div style={{ position: 'fixed', inset: 0 }} data-testid="demo-harness">
      <DemoStudioShell />
    </div>
  );
}

export default DemoTestHarness;
