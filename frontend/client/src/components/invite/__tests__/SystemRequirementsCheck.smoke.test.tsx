// @ts-nocheck
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemRequirementsCheck } from '../SystemRequirementsCheck';

describe('Sprint 6.15 — SystemRequirementsCheck', () => {
  it('renders the System-krav heading after mount', async () => {
    render(<SystemRequirementsCheck />);
    await waitFor(() => {
      expect(screen.getByText('System-krav')).toBeInTheDocument();
    });
  });

  it('lists at minimum browser/viewport/localStorage/cookies/webgl entries', async () => {
    render(<SystemRequirementsCheck />);
    await waitFor(() => {
      expect(screen.getByText('Nettleser')).toBeInTheDocument();
    });
    expect(screen.getByText('Skjermstørrelse')).toBeInTheDocument();
    expect(screen.getByText('localStorage')).toBeInTheDocument();
    expect(screen.getByText('Cookies')).toBeInTheDocument();
    expect(screen.getByText('WebGL')).toBeInTheDocument();
  });

  it('invokes onReport with a structured report', async () => {
    const onReport = vi.fn();
    render(<SystemRequirementsCheck onReport={onReport} />);
    await waitFor(() => {
      expect(onReport).toHaveBeenCalled();
    });
    const report = onReport.mock.calls[0][0];
    expect(report).toMatchObject({
      browserFamily: expect.any(String),
      os: expect.any(String),
      results: expect.any(Array),
      overallSeverity: expect.stringMatching(/pass|warn|fail/),
      cookiesEnabled: expect.any(Boolean),
      localStorageAvailable: expect.any(Boolean),
    });
    expect(report.results.length).toBeGreaterThanOrEqual(5);
  });

  it('renders the overall severity chip', async () => {
    render(<SystemRequirementsCheck />);
    await waitFor(() => {
      const chips = screen.queryAllByText(/Alt OK|Med advarsler|Vil ikke fungere/);
      expect(chips.length).toBeGreaterThan(0);
    });
  });
});
