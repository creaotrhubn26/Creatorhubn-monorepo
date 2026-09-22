import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProjectQuickCreate from './ProjectQuickCreate';

describe('ProjectQuickCreate', () => {
  it('keeps submission disabled until the user provides a name or starting point', () => {
    render(<ProjectQuickCreate onContinue={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Fortsett' })).toBeDisabled();
  });

  it('trims a typed name and uses the blank project type when submitted with Enter', async () => {
    const onContinue = vi.fn();
    render(<ProjectQuickCreate onContinue={onContinue} />);

    const name = screen.getByRole('textbox', { name: 'Hva jobber du med' });
    fireEvent.change(name, { target: { value: '  Ny reklamefilm  ' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() => expect(onContinue).toHaveBeenCalledWith({
      name: 'Ny reklamefilm',
      projectType: 'blank',
    }));
  });

  it('uses the selected starting point as both fallback name and project type', async () => {
    const onContinue = vi.fn();
    render(<ProjectQuickCreate onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Film & video' }));
    expect(screen.getByText('Opptak, etterarbeid og levering')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fortsett' }));

    await waitFor(() => expect(onContinue).toHaveBeenCalledWith({
      name: 'Film & video',
      projectType: 'film',
    }));
  });

  it('does not submit while a creation request is already in progress', () => {
    const onContinue = vi.fn();
    render(<ProjectQuickCreate onContinue={onContinue} busy />);

    const name = screen.getByRole('textbox', { name: 'Hva jobber du med' });
    fireEvent.change(name, { target: { value: 'Prosjekt' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Oppretter…' })).toBeDisabled();
  });
});
