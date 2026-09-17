// @vitest-environment jsdom
// Modusvelgeren hadde sin egen liste: fire av åtte modus, pluss én oppføring
// — «Casting-modus» — som ikke var en ProfessionMode i det hele tatt. Å velge
// den satte en verdi isProfessionMode forkaster, så brukeren havnet stille
// tilbake i produksjonsmodus. Testene her binder menyen til typen.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_PROFESSION_MODES,
  PROFESSION_MODE_META,
  isProfessionMode,
} from '../config/professionMode';
import { ProfessionModeChip } from './ProfessionModeChip';

describe('profession mode metadata', () => {
  it('describes every mode the type allows', () => {
    for (const mode of ALL_PROFESSION_MODES) {
      expect(PROFESSION_MODE_META[mode]).toBeDefined();
      expect(PROFESSION_MODE_META[mode].label).toBeTruthy();
      expect(PROFESSION_MODE_META[mode].description).toBeTruthy();
    }
  });

  it('describes nothing the type does not allow', () => {
    for (const key of Object.keys(PROFESSION_MODE_META)) {
      expect(isProfessionMode(key)).toBe(true);
    }
    expect(isProfessionMode('casting')).toBe(false);
  });
});

describe('ProfessionModeChip menu', () => {
  const openMenu = (mode = 'production') => {
    const onSwitch = vi.fn();
    render(<ProfessionModeChip mode={mode} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByText(PROFESSION_MODE_META.production.label));
    return onSwitch;
  };

  it('offers every switchable mode except the current one', () => {
    openMenu('production');

    const expected = ALL_PROFESSION_MODES
      .filter((m) => m !== 'production' && PROFESSION_MODE_META[m].switchable);

    for (const mode of expected) {
      expect(screen.getByText(PROFESSION_MODE_META[mode].label)).toBeInTheDocument();
    }
  });

  it('no longer offers a mode the system cannot store', () => {
    openMenu('production');

    expect(screen.queryByText('Casting-modus')).toBeNull();
  });

  it('leaves out modes that are not a finished surface yet', () => {
    openMenu('production');

    // student er super-admin-preview; ingen oppføring er bedre enn en som skuffer.
    expect(PROFESSION_MODE_META.student.switchable).toBe(false);
    expect(screen.queryByText(PROFESSION_MODE_META.student.label)).toBeNull();
  });

  it('switches to a real mode when one is picked', () => {
    const onSwitch = openMenu('production');

    fireEvent.click(screen.getByText(PROFESSION_MODE_META.education.label));

    expect(onSwitch).toHaveBeenCalledWith('education');
  });
});
