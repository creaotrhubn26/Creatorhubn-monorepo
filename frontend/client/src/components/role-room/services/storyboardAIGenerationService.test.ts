import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/queryClient', () => ({ apiFetch: vi.fn() }));
vi.mock('./storyboardApiService', () => ({
  upsertStoryboard: vi.fn(),
  generateAIImage: vi.fn(),
}));

import { apiFetch } from '@/lib/queryClient';
import { generateAIImage, upsertStoryboard } from './storyboardApiService';
import { StoryboardAIGenerationService } from './storyboardAIGenerationService';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUpsert = vi.mocked(upsertStoryboard);
const mockedGenerate = vi.mocked(generateAIImage);

describe('StoryboardAIGenerationService compatibility facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes identified frames through the production-aware Storyboard Room API', async () => {
    mockedUpsert.mockResolvedValue({
      id: 'storyboard-1',
    } as Awaited<ReturnType<typeof upsertStoryboard>>);
    mockedGenerate.mockResolvedValue({
      storyboard: {
        imageData: 'data:image/png;base64,result',
      } as Awaited<ReturnType<typeof upsertStoryboard>>,
      composedPrompt: 'compiled production prompt',
      revisedPrompt: null,
    });
    const service = new StoryboardAIGenerationService();

    const result = await service.generateFrame({
      projectId: 'project-1',
      storyboardId: 'shot-list-1',
      frameId: 'frame-1',
      prompt: 'Nora ved vinduet',
      template: 'documentary',
      size: '1024x1536',
      cameraAngle: 'close-up',
    });

    expect(result).toMatchObject({
      success: true,
      imageUrl: 'data:image/png;base64,result',
      prompt: 'compiled production prompt',
    });
    expect(mockedUpsert).toHaveBeenCalledWith('project-1', expect.objectContaining({
      frameId: 'frame-1',
      width: 1024,
      height: 1792,
      workflowLevel: 'ai-reference',
    }));
    expect(mockedGenerate).toHaveBeenCalledWith(
      'project-1',
      'storyboard-1',
      expect.objectContaining({ aspectRatio: '1024x1792', quality: 'standard' }),
    );
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it('keeps the legacy route only for callers without a frame identity', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: 'legacy-image',
        prompt: 'legacy prompt',
        model: 'gpt-image-1',
      }),
    } as Response);
    const service = new StoryboardAIGenerationService();

    const result = await service.generateFrame({ prompt: 'Legacy import' });

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe('legacy-image');
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/storyboards/generate-frame',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});
