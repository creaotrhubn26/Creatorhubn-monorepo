import {
  buildInitialStoryArcPanelState,
  storyArcPanelStateReducer,
} from '../useStoryArcPanelStateReducer';

describe('useStoryArcPanelStateReducer', () => {
  it('builds initial state with configurable composition-guide default', () => {
    const enabledState = buildInitialStoryArcPanelState(true);
    const disabledState = buildInitialStoryArcPanelState(false);

    expect(enabledState.showCompositionGuides).toBe(true);
    expect(disabledState.showCompositionGuides).toBe(false);
    expect(enabledState.showProgramMonitor).toBe(true);
    expect(enabledState.showExportDialog).toBe(false);
  });

  it('updates a single flag with direct boolean values', () => {
    const initial = buildInitialStoryArcPanelState(false);
    const next = storyArcPanelStateReducer(initial, {
      type: 'set_flag',
      key: 'showExportDialog',
      value: true,
    });

    expect(next.showExportDialog).toBe(true);
    expect(next.showSyncDialog).toBe(false);
  });

  it('supports functional updates for toggle semantics', () => {
    const initial = buildInitialStoryArcPanelState(false);
    const next = storyArcPanelStateReducer(initial, {
      type: 'set_flag',
      key: 'showAutoMonitor',
      value: (previous) => !previous,
    });

    expect(next.showAutoMonitor).toBe(true);
  });

  it('returns original reference when value is unchanged', () => {
    const initial = buildInitialStoryArcPanelState(false);
    const next = storyArcPanelStateReducer(initial, {
      type: 'set_flag',
      key: 'showAutoMonitor',
      value: false,
    });

    expect(next).toBe(initial);
  });
});
