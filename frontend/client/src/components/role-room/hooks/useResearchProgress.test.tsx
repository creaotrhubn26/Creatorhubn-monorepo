import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useResearchProgress } from './useResearchProgress';
import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

const { saveSnapshotMock } = vi.hoisted(() => ({
  saveSnapshotMock: vi.fn(),
}));

vi.mock('../services/roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
  roleRoomAgentService: {
    saveSnapshot: saveSnapshotMock,
  },
}));

const resultPayload = {
  researchId: 'research-17',
  merchSuppliers: {
    recommendations: [{ productId: 'polo' }],
  },
} as unknown as RoleRoomAgentProducerBootstrapResult;

const streamResponse = (payload: unknown) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        `event: done\ndata: ${JSON.stringify(payload)}\n\n`,
      ));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    text: async () => '',
  } as Response;
};

describe('useResearchProgress', () => {
  beforeEach(() => {
    saveSnapshotMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the streamed result once before exposing done state', async () => {
    let finishSave: ((value: RoleRoomAgentProducerBootstrapResult) => void) | null = null;
    saveSnapshotMock.mockImplementation(() => new Promise((resolve) => {
      finishSave = resolve;
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse({
      success: true,
      result: resultPayload,
    })));

    const { result } = renderHook(() => useResearchProgress());

    act(() => {
      result.current.start({ projectId: 'project-1', websiteUrl: 'https://medside.no' });
    });

    await waitFor(() => {
      expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
    });
    expect(saveSnapshotMock).toHaveBeenCalledWith('project-1', resultPayload);
    expect(result.current.status).toBe('streaming');

    act(() => {
      finishSave?.(resultPayload);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });
    expect(result.current.result).toStrictEqual(resultPayload);
    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
