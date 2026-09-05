// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listFeedMockupLinks: vi.fn(),
  listMockupProjects: vi.fn(),
  createFeedMockupLink: vi.fn(),
  deleteFeedMockupLink: vi.fn(),
}));

vi.mock('../../services/roleRoomAgentService', () => ({
  default: mocks,
}));

import FeedPostMockupLinks from './FeedPostMockupLinks';

const link = {
  id: 'link-1',
  workspaceProjectId: 'medside-project',
  platform: 'instagram' as const,
  feedPostId: 'post-1',
  feedPostTitle: 'Trygg journalføring',
  feedPostCaption: 'Caption',
  mockupProjectId: 'mockup-medside',
  mockupName: 'MedSide feed',
  mockupRevision: 2,
  lastAppliedRevision: null,
  lastAppliedSha256: null,
  lastAppliedAt: null,
  stale: false,
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

describe('FeedPostMockupLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listFeedMockupLinks.mockResolvedValue([]);
    mocks.listMockupProjects.mockResolvedValue([{
      id: 'mockup-medside',
      name: 'MedSide feed',
      status: 'draft',
      template: 'feed',
      workspaceProjectId: null,
      revision: 2,
      projectUpdatedAt: 1788560000000,
      updatedAt: '2026-09-05T10:00:00.000Z',
      accessRole: 'owner',
    }]);
    mocks.createFeedMockupLink.mockResolvedValue(link);
    mocks.deleteFeedMockupLink.mockResolvedValue(undefined);
  });

  it('links an existing Post Agent project without creating or importing a duplicate', async () => {
    render(<FeedPostMockupLinks projectId="medside-project" platform="instagram" postId="post-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Koble design' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Koble' }));

    await waitFor(() => expect(mocks.createFeedMockupLink).toHaveBeenCalledWith({
      workspaceProjectId: 'medside-project',
      platform: 'instagram',
      feedPostId: 'post-1',
      mockupProjectId: 'mockup-medside',
    }));
    expect(mocks.listMockupProjects).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText(/MedSide feed/i)).length).toBeGreaterThan(0);
  });

  it('does not render the bridge for the unsupported YouTube feed surface', () => {
    const { container } = render(
      <FeedPostMockupLinks projectId="medside-project" platform="youtube" postId="post-1" />,
    );
    expect(container.innerHTML).toBe('');
    expect(mocks.listFeedMockupLinks).not.toHaveBeenCalled();
  });
});
