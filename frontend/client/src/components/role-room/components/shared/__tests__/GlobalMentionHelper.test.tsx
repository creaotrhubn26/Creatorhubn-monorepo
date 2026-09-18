import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalMentionHelper from '../GlobalMentionHelper';
import globalTagService from '../../../services/globalTagService';

vi.mock('../../../services/globalTagService', () => ({
  default: {
    add: vi.fn(),
    load: vi.fn(),
  },
}));

describe('GlobalMentionHelper candidate scope', () => {
  beforeEach(() => {
    vi.mocked(globalTagService.add).mockReset();
    vi.mocked(globalTagService.load).mockReset();
  });

  it('keeps character suggestions local and ignores equipment from the global registry', () => {
    vi.mocked(globalTagService.load).mockResolvedValue([
      'Apple iPad Pro 11 (4th gen)',
      'Autel EVO Lite+',
      'Canon EOS 850D',
    ]);

    const { rerender } = render(
      <GlobalMentionHelper
        text="DANIE"
        localCandidates={['DANIEL']}
        onApplySuggestion={() => undefined}
        suggestionTitle="Mener du denne karakteren?"
        candidateScope="local"
      />,
    );

    expect(screen.getByText('DANIEL')).not.toBeNull();

    rerender(
      <GlobalMentionHelper
        text="AUT"
        localCandidates={['DANIEL']}
        onApplySuggestion={() => undefined}
        suggestionTitle="Mener du denne karakteren?"
        candidateScope="local"
      />,
    );

    expect(screen.queryByText('Autel EVO Lite+')).toBeNull();
    expect(globalTagService.load).not.toHaveBeenCalled();
    expect(globalTagService.add).not.toHaveBeenCalled();
  });

  it('preserves global suggestions for note fields by default', async () => {
    vi.mocked(globalTagService.add).mockResolvedValue([
      'DANIEL',
      'Autel EVO Lite+',
    ]);

    render(
      <GlobalMentionHelper
        text="AUTE"
        localCandidates={['DANIEL']}
        onApplySuggestion={() => undefined}
      />,
    );

    expect(await screen.findByText('Autel EVO Lite+')).not.toBeNull();
    expect(globalTagService.add).toHaveBeenCalledWith(['DANIEL']);
  });
});
