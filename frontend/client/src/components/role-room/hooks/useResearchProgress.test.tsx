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

const researchMockups = [
  {
    id: "draft-1",
    projectId: "project-1",
    researchId: "00000000-0000-4000-8000-000000000017",
    platform: "instagram",
    ordinal: 1,
    feedPostId: "research-post-1",
    mediaType: "image",
    status: "ready",
    stage: "finalized",
    progress: 100,
    title: "Trygg journalføring",
    caption: "Dokumentert research.",
    previewDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    mockupProjectId: "rr-mockup-1",
    variantId: "00000000-0000-4000-8000-000000000018",
  },
] as const;

const streamResponse = (payload: unknown) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        `event: done\ndata: ${JSON.stringify(payload)}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    text: async () => "",
  } as Response;
};

describe("useResearchProgress", () => {
  beforeEach(() => {
    saveSnapshotMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the streamed result once before exposing done state", async () => {
    let finishSave:
      ((value: RoleRoomAgentProducerBootstrapResult) => void) | null = null;
    saveSnapshotMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse({
          success: true,
          result: resultPayload,
          researchMockups,
        }),
      ),
    );

    const { result } = renderHook(() => useResearchProgress());

    act(() => {
      result.current.start({
        projectId: "project-1",
        websiteUrl: "https://medside.no",
      });
    });

    await waitFor(() => {
      expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
    });
    expect(saveSnapshotMock).toHaveBeenCalledWith("project-1", resultPayload);
    expect(result.current.status).toBe("streaming");

    act(() => {
      finishSave?.(resultPayload);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("done");
    });
    expect(result.current.result).toStrictEqual(resultPayload);
    expect(result.current.mockups).toEqual(researchMockups);
    expect(result.current.status).toBe("done");
    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
