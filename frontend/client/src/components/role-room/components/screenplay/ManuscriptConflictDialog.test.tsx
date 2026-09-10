import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Manuscript } from '../../models/casting';
import { ManuscriptConflictDialog } from './ManuscriptConflictDialog';

const localManuscript: Manuscript = {
  id: 'manuscript-1',
  projectId: 'project-1',
  title: 'Troll',
  content: 'INT. STUE - DAG\n\nLokal tekst',
  version: 4,
};

const cloudManuscript: Manuscript = {
  ...localManuscript,
  content: 'INT. STUE - DAG\n\nSkytekst',
  version: 5,
};

describe('ManuscriptConflictDialog', () => {
  it('shows both versions and requires an explicit resolution', () => {
    const onKeepLocal = vi.fn();
    const onUseCloud = vi.fn();
    render(
      <ManuscriptConflictDialog
        open
        localManuscript={localManuscript}
        cloudManuscript={cloudManuscript}
        currentVersion={5}
        onContinueLocally={vi.fn()}
        onKeepLocal={onKeepLocal}
        onUseCloud={onUseCloud}
        onRefreshCloud={vi.fn()}
      />,
    );

    expect(screen.getByText('Din lokale versjon')).toBeTruthy();
    expect(screen.getByText('Nyeste skyversjon')).toBeTruthy();
    expect(screen.getByText((_text, element) => (
      element?.tagName === 'PRE' && Boolean(element.textContent?.includes('Lokal tekst'))
    ))).toBeTruthy();
    expect(screen.getByText((_text, element) => (
      element?.tagName === 'PRE' && Boolean(element.textContent?.includes('Skytekst'))
    ))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Behold min versjon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bruk skyversjonen' }));
    expect(onKeepLocal).toHaveBeenCalledTimes(1);
    expect(onUseCloud).toHaveBeenCalledTimes(1);
  });

  it('blocks resolution until the cloud copy can be refreshed', () => {
    const onRefreshCloud = vi.fn();
    render(
      <ManuscriptConflictDialog
        open
        localManuscript={localManuscript}
        cloudManuscript={null}
        currentVersion={5}
        onContinueLocally={vi.fn()}
        onKeepLocal={vi.fn()}
        onUseCloud={vi.fn()}
        onRefreshCloud={onRefreshCloud}
      />,
    );

    expect(screen.getByRole('button', { name: 'Behold min versjon' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Bruk skyversjonen' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Prøv å hente på nytt' }));
    expect(onRefreshCloud).toHaveBeenCalledTimes(1);
  });
});
