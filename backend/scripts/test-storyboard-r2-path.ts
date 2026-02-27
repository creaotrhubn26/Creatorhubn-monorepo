/* eslint-disable no-console */
import { buildStoryboardPackR2ObjectKey, DEFAULT_STORYBOARD_PACK_R2_PREFIX } from '../server/storyboardPackStorage.js';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const run = () => {
  const keyWithDefault = buildStoryboardPackR2ObjectKey({
    packId: 'pack-1',
    slotId: 'slot-2',
    fileName: 'frame.png',
  });
  assert(
    keyWithDefault === `${DEFAULT_STORYBOARD_PACK_R2_PREFIX}/pack-1/slot-2/frame.png`,
    `Default prefix mismatch: ${keyWithDefault}`,
  );

  const keyWithCustomPrefix = buildStoryboardPackR2ObjectKey({
    prefix: '/theroleroom/storyboard_assets/',
    packId: 'pack-1',
    slotId: 'slot-2',
    fileName: 'frame.png',
  });
  assert(
    keyWithCustomPrefix === 'theroleroom/storyboard_assets/pack-1/slot-2/frame.png',
    `Custom prefix normalization mismatch: ${keyWithCustomPrefix}`,
  );

  console.log('Storyboard R2 key prefix checks: OK');
};

run();
