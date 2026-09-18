import { describe, expect, it } from 'vitest';
import { normalizeFeedPostsPayload } from './role-room-feed-plan.js';

function post(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    concept: '',
    title: '',
    caption: 'Caption',
    hashtags: [],
    callToAction: '',
    imageStyle: '',
    mediaType: 'carousel',
    ...overrides,
  };
}

describe('LinkedIn media in Role Room feed plans', () => {
  it('preserves carousel images, parallel names and video through normalization', () => {
    const imageA = 'data:image/png;base64,YQ==';
    const imageB = 'data:image/png;base64,Yg==';
    const video = 'data:video/mp4;base64,Yw==';
    const [normalized] = normalizeFeedPostsPayload([
      post('post-1', {
        customImageUrls: [imageA, imageB],
        customImageNames: ['a.png', 'b.png'],
        customVideoDataUrl: video,
        customVideoName: 'clip.mp4',
      }),
    ]);

    expect(normalized.customImageUrls).toEqual([imageA, imageB]);
    expect(normalized.customImageNames).toEqual(['a.png', 'b.png']);
    expect(normalized.customVideoDataUrl).toBe(video);
    expect(normalized.customVideoName).toBe('clip.mp4');
  });

  it('requires at least two carousel images and caps the list at twenty', () => {
    const images = Array.from(
      { length: 21 },
      (_, index) => `data:image/png;base64,${Buffer.from(String(index)).toString('base64')}`,
    );
    const [single, capped] = normalizeFeedPostsPayload([
      post('single', { customImageUrls: [images[0]] }),
      post('capped', { customImageUrls: images }),
    ]);

    expect(single.customImageUrls).toBeNull();
    expect(capped.customImageUrls).toHaveLength(20);
  });

  it('drops an oversized image atomically instead of storing corrupt clipped base64', () => {
    const tooLarge = `data:image/png;base64,${'A'.repeat(2_000_001)}`;
    const [normalized] = normalizeFeedPostsPayload([
      post('post-1', {
        customImageUrl: tooLarge,
        customImageUrls: [tooLarge, 'data:image/png;base64,YQ=='],
      }),
    ]);

    expect(normalized.customImageUrl).toBeNull();
    expect(normalized.customImageUrls).toBeNull();
  });

  it('keeps carousel names aligned when an invalid middle image is removed', () => {
    const imageA = 'data:image/png;base64,YQ==';
    const imageB = 'data:image/png;base64,Yg==';
    const [normalized] = normalizeFeedPostsPayload([
      post('post-1', {
        customImageUrls: [imageA, 'data:text/plain;base64,YmFk', imageB],
        customImageNames: ['a.png', 'invalid.txt', 'b.png'],
      }),
    ]);

    expect(normalized.customImageUrls).toEqual([imageA, imageB]);
    expect(normalized.customImageNames).toEqual(['a.png', 'b.png']);
  });

  it('rejects an oversized video before any base64 decode can occur', () => {
    const oversizedVideo = `data:video/mp4;base64,${'A'.repeat(40_000_001)}`;
    const [normalized] = normalizeFeedPostsPayload([
      post('post-1', {
        customVideoDataUrl: oversizedVideo,
        customVideoName: 'oversized.mp4',
      }),
    ]);

    expect(normalized.customVideoDataUrl).toBeNull();
    expect(normalized.customVideoName).toBeNull();
  });

  it('enforces a combined inline-media budget for the complete plan', () => {
    const roughlyOneMb = `data:image/png;base64,${'A'.repeat(999_970)}`;
    const normalized = normalizeFeedPostsPayload(
      Array.from({ length: 23 }, (_, index) =>
        post(`post-${index}`, { customImageUrls: [roughlyOneMb, roughlyOneMb] })),
    );

    expect(normalized.slice(0, 22).every((entry) => entry.customImageUrls?.length === 2)).toBe(true);
    expect(normalized[22].customImageUrls).toBeNull();
  });
});
