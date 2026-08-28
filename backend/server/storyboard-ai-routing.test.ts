import { describe, expect, it } from 'vitest';
import { storyboardAIModelCatalogView } from './storyboard-ai-routing.js';

describe('storyboard AI model catalog', () => {
  it('keeps inexpensive providers as defaults and Higgsfield opt-in', () => {
    const catalog = storyboardAIModelCatalogView();
    expect(catalog.map((entry) => entry.id)).toEqual([
      'gpt-image-1-mini', 'gpt-image-2', 'seedance-2-i2v', 'higgsfield-dop-i2v',
    ]);
    expect(catalog.find((entry) => entry.id === 'gpt-image-1-mini')?.recommended).toBe(true);
    expect(catalog.find((entry) => entry.id === 'seedance-2-i2v')?.recommended).toBe(true);
    expect(catalog.find((entry) => entry.id === 'higgsfield-dop-i2v')?.recommended).toBe(false);
  });
});
