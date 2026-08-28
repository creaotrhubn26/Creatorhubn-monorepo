import { GEN_MODELS, falConfigured, higgsfieldConfigured } from './generative-media.js';
import { storyboardImageEstimatedCostUsd } from './storyboard-ai-context.js';
import { listPromptModelAdapters } from './storyboard-prompt-engine/model-adapters.js';

export interface StoryboardAIModelCatalogEntry {
  id: string;
  label: string;
  provider: string;
  modality: 'image' | 'video';
  estimatedCostUsd: number;
  configured: boolean;
  tier: 'draft' | 'quality' | 'cinematic';
  recommended: boolean;
}

export function storyboardAIModelCatalogView(): StoryboardAIModelCatalogEntry[] {
  const adapters = new Map(listPromptModelAdapters().map((entry) => [entry.id, entry]));
  const mini = adapters.get('gpt-image-1-mini')!;
  const image = adapters.get('gpt-image-2')!;
  const seedance = GEN_MODELS['seedance-2-i2v'];
  const higgsfield = GEN_MODELS['higgsfield-dop-i2v'];
  return [
    {
      id: mini.id, label: mini.label, provider: mini.provider, modality: 'image',
      estimatedCostUsd: storyboardImageEstimatedCostUsd('standard'),
      configured: Boolean(process.env.OPENAI_API_KEY), tier: 'draft', recommended: true,
    },
    {
      id: image.id, label: image.label, provider: image.provider, modality: 'image',
      estimatedCostUsd: storyboardImageEstimatedCostUsd('hd'),
      configured: Boolean(process.env.OPENAI_API_KEY), tier: 'quality', recommended: false,
    },
    {
      id: seedance.key, label: seedance.label, provider: seedance.provider, modality: 'video',
      estimatedCostUsd: 5 * (seedance.costPerSecondUsd ?? seedance.estCostUsd / 5),
      configured: falConfigured(), tier: 'quality', recommended: true,
    },
    {
      id: higgsfield.key, label: higgsfield.label, provider: higgsfield.provider,
      modality: 'video',
      estimatedCostUsd: 5 * (higgsfield.costPerSecondUsd ?? higgsfield.estCostUsd / 5),
      configured: higgsfieldConfigured(), tier: 'cinematic', recommended: false,
    },
  ];
}
