import { describe, expect, it } from 'vitest';
import type { RoleRoomFeedPost } from '../../services/roleRoomAgentService';
import {
  buildLinkedInPublishIdempotencyKey,
  buildLinkedInPublishMedia,
  getLinkedInFutureSchedule,
} from './FeedPostDetailPanel';

const BASE_POST: RoleRoomFeedPost = {
  id: 'post-1',
  concept: 'educate',
  title: 'Tittel',
  caption: 'Caption',
  hashtags: ['#creatorhub'],
  callToAction: 'Les mer',
  imageStyle: 'clean',
  scheduledFor: null,
  backgroundColor: null,
  accentColor: null,
  textColor: null,
  logoPlacement: null,
  mediaType: 'image',
  locked: false,
  approvalState: 'approved',
};

describe('Feed Planner LinkedIn publish mapping', () => {
  it('falls back from a missing image to an honest text post', () => {
    expect(buildLinkedInPublishMedia(BASE_POST)).toMatchObject({
      mediaKind: 'text',
      error: null,
    });
  });

  it('maps reels to video and accepts LinkedIn carousels with up to 20 images', () => {
    expect(buildLinkedInPublishMedia({
      ...BASE_POST,
      mediaType: 'reel',
      customVideoDataUrl: 'data:video/mp4;base64,video',
    })).toMatchObject({
      mediaKind: 'video',
      videoUrl: 'data:video/mp4;base64,video',
      error: null,
    });

    const twentyImages = Array.from({ length: 20 }, (_, index) => `data:image/png;base64,${index}`);
    expect(buildLinkedInPublishMedia({
      ...BASE_POST,
      mediaType: 'carousel',
      customImageUrls: twentyImages,
    })).toMatchObject({ mediaKind: 'carousel', imageUrls: twentyImages, error: null });
    expect(buildLinkedInPublishMedia({
      ...BASE_POST,
      mediaType: 'carousel',
      customImageUrls: [...twentyImages, 'data:image/png;base64,21'],
    }).error).toContain('2–20');
  });

  it('only treats a valid future timestamp as scheduled', () => {
    const now = Date.UTC(2026, 7, 31, 12, 0, 0);
    expect(getLinkedInFutureSchedule('2026-08-31T13:00:00.000Z', now))
      .toBe('2026-08-31T13:00:00.000Z');
    expect(getLinkedInFutureSchedule('2026-08-31T11:00:00.000Z', now)).toBeNull();
    expect(getLinkedInFutureSchedule('not-a-date', now)).toBeNull();
  });

  it('keeps the idempotency key stable but fingerprints the complete media payload', () => {
    const firstImage = `data:image/png;base64,AAAA${'x'.repeat(200)}TAIL`;
    const secondImage = `data:image/png;base64,AAAA${'y'.repeat(200)}TAIL`;
    const firstPost = { ...BASE_POST, customImageUrl: firstImage };
    const secondPost = { ...BASE_POST, customImageUrl: secondImage };

    const firstKey = buildLinkedInPublishIdempotencyKey('project-1', firstPost);
    expect(buildLinkedInPublishIdempotencyKey('project-1', firstPost)).toBe(firstKey);
    expect(buildLinkedInPublishIdempotencyKey('project-1', secondPost)).not.toBe(firstKey);
    expect(firstKey).toMatch(/^role-room-linkedin:project-1:post-1:[a-f0-9]{16}$/);
  });
});
