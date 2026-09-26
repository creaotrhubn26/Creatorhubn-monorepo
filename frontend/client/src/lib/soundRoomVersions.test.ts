import { describe, expect, it } from 'vitest';
import { latestApprovedSoundRoomVersion, newestSoundRoomVersion, sortSoundRoomVersionsNewest } from './soundRoomVersions';

const versions = [
  { id: 'v15', version_number: 15, status: 'under_review' },
  { id: 'v17', version_number: 17, status: 'under_review' },
  { id: 'v16', version_number: 16, status: 'approved' },
];

describe('Sound Room version semantics', () => {
  it('selects the highest version number even when an older mix is still under review', () => {
    expect(newestSoundRoomVersion(versions)?.id).toBe('v17');
    expect(sortSoundRoomVersionsNewest(versions).map((version) => version.id)).toEqual(['v17', 'v16', 'v15']);
  });

  it('keeps the latest approved version distinct from the newest review version', () => {
    expect(latestApprovedSoundRoomVersion(versions)?.id).toBe('v16');
  });
});
