// @ts-nocheck
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock framer-motion så exit-animasjonen kjøres synkront og elementet
// faktisk forlater DOM når toast-state fjerner det. Uten dette holder
// AnimatePresence elementet i DOM mens den animerer ut og testene flakker.
vi.mock('framer-motion', () => ({
  motion: { div: 'div' },
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));

import { ToastProvider, useToast } from '../ToastStack';

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function ShowToastButton({ severity = 'success', message = 'Lagret' }: { severity?: string; message?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        if (severity === 'success') toast.showSuccess(message);
        else if (severity === 'error') toast.showError(message);
        else if (severity === 'warning') toast.showWarning(message);
        else toast.showInfo(message);
      }}
    >
      Trigger
    </button>
  );
}

describe('Sprint A.7 — ToastStack auto-dismiss + hover-pause', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto-dismisser success-toast etter default-duration (5s) når bruker ikke hover', () => {
    render(
      <ToastProvider>
        <ShowToastButton message="Storyboard lagret" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    expect(screen.getByText('Storyboard lagret')).toBeInTheDocument();

    advance(4999);
    expect(screen.queryByText('Storyboard lagret')).toBeInTheDocument();

    advance(2);
    expect(screen.queryByText('Storyboard lagret')).not.toBeInTheDocument();
  });

  it('pauser timer mens bruker hover, og resumer ved mouseLeave', () => {
    render(
      <ToastProvider>
        <ShowToastButton message="Inspirasjon lagret" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    const toastEl = screen.getByText('Inspirasjon lagret');
    expect(toastEl).toBeInTheDocument();

    advance(3000);

    // motion.div er forelderen som har onMouseEnter/onMouseLeave.
    const motionWrapper = toastEl.closest('div[style*="pointer-events"]') as HTMLElement;
    expect(motionWrapper).toBeTruthy();
    fireEvent.mouseEnter(motionWrapper);

    // Hover holder toasten — ingen dismiss selv etter 10s ekstra
    advance(10_000);
    expect(screen.queryByText('Inspirasjon lagret')).toBeInTheDocument();

    // Resume: 2s gjenstår etter 3s før hover. Nesten 2s holder den fortsatt.
    fireEvent.mouseLeave(motionWrapper);
    advance(1999);
    expect(screen.queryByText('Inspirasjon lagret')).toBeInTheDocument();

    // Etter at gjenstående tid utløper er den borte.
    advance(2);
    expect(screen.queryByText('Inspirasjon lagret')).not.toBeInTheDocument();
  });

  it('error-toast holder lenger (10s) enn success-toast (5s)', () => {
    render(
      <ToastProvider>
        <ShowToastButton severity="error" message="Noe gikk galt" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    expect(screen.getByText('Noe gikk galt')).toBeInTheDocument();

    // 5s er ikke nok for error (success-default)
    advance(5_001);
    expect(screen.queryByText('Noe gikk galt')).toBeInTheDocument();

    // Etter totalt 10s er den borte
    advance(5_000);
    expect(screen.queryByText('Noe gikk galt')).not.toBeInTheDocument();
  });

  it('respekterer eksplisitt duration som overstyrer default', () => {
    function ExplicitDurationTrigger() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.showSuccess('Kort', 1000)}>
          Trigger
        </button>
      );
    }

    render(
      <ToastProvider>
        <ExplicitDurationTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    expect(screen.getByText('Kort')).toBeInTheDocument();

    advance(1001);
    expect(screen.queryByText('Kort')).not.toBeInTheDocument();
  });
});
