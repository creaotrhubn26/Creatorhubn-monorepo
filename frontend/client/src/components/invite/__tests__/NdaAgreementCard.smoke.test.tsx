// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NdaAgreementCard } from '../NdaAgreementCard';

describe('Sprint 6.15 — NdaAgreementCard', () => {
  it('renders NDA heading + version', () => {
    render(<NdaAgreementCard onSign={() => {}} />);
    expect(screen.getByText(/Konfidensialitetsavtale/)).toBeInTheDocument();
    expect(screen.getByText(/Versjon 1\.0/)).toBeInTheDocument();
  });

  it('disables inputs until user scrolls through NDA', () => {
    render(<NdaAgreementCard onSign={() => {}} />);
    const nameField = screen.getByLabelText(/Fullt juridisk navn/);
    expect(nameField).toBeDisabled();
  });

  it('emits null signature when fields are empty', () => {
    const onSign = vi.fn();
    render(<NdaAgreementCard onSign={onSign} />);
    expect(onSign).toHaveBeenCalledWith(null);
  });

  it('emits valid signature when scroll + name + checkbox are all set', () => {
    const onSign = vi.fn();
    render(<NdaAgreementCard onSign={onSign} defaultFullName="Test Tester" />);

    // Simulate scroll-to-bottom
    const ndaText = screen.getByRole('document', { name: /NDA-tekst/ });
    Object.defineProperty(ndaText, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(ndaText, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(ndaText, 'scrollTop', { value: 500, configurable: true });
    fireEvent.scroll(ndaText);

    // Check agreement
    fireEvent.click(screen.getByRole('checkbox'));

    const last = onSign.mock.calls[onSign.mock.calls.length - 1][0];
    expect(last).toBeTruthy();
    expect(last.fullName).toBe('Test Tester');
    expect(last.agreed).toBe(true);
    expect(last.ndaVersion).toBe('1.0');
    expect(typeof last.signedAt).toBe('string');
  });

  it('rejects names under 2 characters', () => {
    const onSign = vi.fn();
    render(<NdaAgreementCard onSign={onSign} defaultFullName="A" />);

    const ndaText = screen.getByRole('document', { name: /NDA-tekst/ });
    Object.defineProperty(ndaText, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(ndaText, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(ndaText, 'scrollTop', { value: 500, configurable: true });
    fireEvent.scroll(ndaText);
    fireEvent.click(screen.getByRole('checkbox'));

    // Last call should still be null — name too short
    const last = onSign.mock.calls[onSign.mock.calls.length - 1][0];
    expect(last).toBeNull();
  });

  it('respects custom ndaVersion in returned signature', () => {
    const onSign = vi.fn();
    render(<NdaAgreementCard onSign={onSign} ndaVersion="2.5" defaultFullName="Anna Andersen" />);

    const ndaText = screen.getByRole('document', { name: /NDA-tekst/ });
    Object.defineProperty(ndaText, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(ndaText, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(ndaText, 'scrollTop', { value: 500, configurable: true });
    fireEvent.scroll(ndaText);
    fireEvent.click(screen.getByRole('checkbox'));

    const last = onSign.mock.calls[onSign.mock.calls.length - 1][0];
    expect(last?.ndaVersion).toBe('2.5');
  });
});
