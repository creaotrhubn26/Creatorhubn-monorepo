import { describe, expect, it } from 'vitest';
import { liveSetReducer, makeInitialState } from './useLiveSet';

function withScene() {
  return makeInitialState({
    initialScene: { id: 'scene-1', name: 'Scene 1' },
    operatorId: 'tester',
    deviceId: 'device-test',
  });
}

describe('useLiveSet reducer', () => {
  it('blocks roll without active scene', () => {
    const initial = makeInitialState({ operatorId: 'tester', deviceId: 'device-test' });
    const next = liveSetReducer(initial, { type: 'ROLL', meta: { eventId: 'e1', seq: 1, capturedAt: new Date().toISOString() } });
    expect(next.liveState).toBe('idle');
    expect(next.lastError).toMatch(/scene/i);
  });

  it('applies deterministic flow idle -> rolling -> cut -> setup-complete -> idle', () => {
    const start = withScene();
    const rolling = liveSetReducer(start, { type: 'ROLL', meta: { eventId: 'e1', seq: 1, capturedAt: new Date().toISOString() } });
    expect(rolling.liveState).toBe('rolling');
    expect(rolling.seq).toBe(1);

    const cut = liveSetReducer(rolling, { type: 'CUT', meta: { eventId: 'e2', seq: 2, capturedAt: new Date().toISOString() } });
    expect(cut.liveState).toBe('cut');
    expect(cut.takes.length).toBe(1);
    expect(cut.seq).toBe(2);

    const setup = liveSetReducer(cut, { type: 'SETUP_COMPLETE', meta: { eventId: 'e3', seq: 3, capturedAt: new Date().toISOString() } });
    expect(setup.liveState).toBe('setup-complete');
    expect(setup.seq).toBe(3);

    const idle = liveSetReducer(setup, { type: 'ADVANCE_SCENE', meta: { eventId: 'e4', seq: 4, capturedAt: new Date().toISOString() } });
    expect(idle.liveState).toBe('idle');
    expect(idle.seq).toBe(4);
  });

  it('blocks duplicate cut for the same roll token', () => {
    const start = withScene();
    const rolling = liveSetReducer(start, { type: 'ROLL', meta: { eventId: 'roll-1', seq: 1, capturedAt: new Date().toISOString() } });
    const firstCut = liveSetReducer(rolling, { type: 'CUT', meta: { eventId: 'cut-1', seq: 2, capturedAt: new Date().toISOString() } });
    const secondCut = liveSetReducer(firstCut, { type: 'CUT', meta: { eventId: 'cut-2', seq: 3, capturedAt: new Date().toISOString() } });
    expect(secondCut.takes.length).toBe(1);
    expect(secondCut.lastError).toMatch(/cut/i);
  });

  it('blocks captureTake without shot id', () => {
    const start = withScene();
    const next = liveSetReducer(start, {
      type: 'CAPTURE_TAKE',
      payload: { shotId: '', notes: 'invalid' },
      meta: { eventId: 'e1', seq: 1, capturedAt: new Date().toISOString() },
    });
    expect(next.takes.length).toBe(0);
    expect(next.lastError).toMatch(/shot/i);
  });
});
