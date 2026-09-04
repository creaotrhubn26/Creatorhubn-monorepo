import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchCatalog,
  getMerchMockupStatus,
  listMerchConcepts,
  saveMerchConcept,
} from '../../services/roleRoomAgentClaudeApi';
import MerchMockupPreview from './MerchMockupPreview';

vi.mock('../../services/roleRoomAgentClaudeApi', () => ({
  generateMerchMockup: vi.fn(),
  getMerchCatalog: vi.fn(),
  getMerchMockupStatus: vi.fn(),
  listMerchConcepts: vi.fn(),
  saveMerchConcept: vi.fn(),
  setMerchConceptStatus: vi.fn(),
  MerchMockupError: class MerchMockupError extends Error {},
}));

const bootstrap = {
  companyProfile: {
    companyName: 'Medinnova AS',
    logoUrl: 'https://example.test/medinnova-logo.png',
  },
  planningDraft: {
    brandGuide: {
      logoUrl: 'https://example.test/medinnova-logo.png',
      colors: [
        { label: 'Primær', hex: '#0F766E' },
        { label: 'Sekundær', hex: '#7C3AED' },
      ],
    },
  },
  merchSuppliers: {
    recommendations: [],
    suppliers: [],
  },
};

const tshirtSpec = {
  productId: 'tshirt' as const,
  label: 'T-skjorte',
  provider: 'printful' as const,
  providerProductId: 71,
  defaultVariantId: 4011,
  defaultColorName: 'White',
  defaultColorHex: '#FFFFFF',
  techniques: ['dtg' as const, 'dtfilm' as const, 'embroidery' as const],
  placements: [
    { id: 'front', label: 'Front', maxWidthMm: 300, maxHeightMm: 400, defaultWidthMm: 220, defaultHeightMm: 180, techniques: ['dtg' as const, 'dtfilm' as const] },
    { id: 'back', label: 'Rygg', maxWidthMm: 300, maxHeightMm: 400, defaultWidthMm: 250, defaultHeightMm: 220, techniques: ['dtg' as const, 'dtfilm' as const] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMerchMockupStatus).mockImplementation(() => new Promise(() => {}));
  vi.mocked(getMerchCatalog).mockImplementation(() => new Promise(() => {}));
  vi.mocked(listMerchConcepts).mockImplementation(() => new Promise(() => {}));
});

describe('MerchMockupPreview', () => {
  it('places the actual logo and lets the producer override or restore the logo-matched color', () => {
    render(<MerchMockupPreview projectId="project-1" bootstrap={bootstrap as never} />);

    const concept = screen.getByTestId('merch-photoreal-concept');
    expect(concept.getAttribute('data-product')).toBe('tshirt');
    expect(concept.getAttribute('data-color')).toBe('#0F766E');
    expect(screen.getByTestId('merch-concept-logo').getAttribute('src')).toBe('https://example.test/medinnova-logo.png');
    expect(screen.getByTestId('merch-concept-exact-color').getAttribute('data-color')).toBe('#0F766E');
    expect(screen.getByText('Matchet fra logo-paletten')).toBeTruthy();
    expect(concept.querySelector('img')?.getAttribute('src')).toContain('blank-tshirt-cutout-v2');

    fireEvent.click(screen.getByRole('button', { name: 'Velg Sort #171717' }));
    expect(concept.getAttribute('data-color')).toBe('#171717');
    expect(screen.getByTestId('merch-concept-exact-color').getAttribute('data-color')).toBe('#171717');
    expect(screen.getByText('Valgt · #171717')).toBeTruthy();

    fireEvent.click(screen.getByText('Match logo'));
    expect(concept.getAttribute('data-color')).toBe('#0F766E');

    fireEvent.click(screen.getByText('Hettegenser'));
    expect(concept.getAttribute('data-product')).toBe('hoodie');
    expect(concept.querySelector('img')?.getAttribute('src')).toContain('blank-hoodie-cutout-v2');
  });

  it('uses a real catalog color and persists the complete production decision', async () => {
    vi.mocked(getMerchMockupStatus).mockResolvedValue({ configured: true, provider: 'printful', products: [tshirtSpec] });
    vi.mocked(getMerchCatalog).mockResolvedValue({
      productId: 'tshirt',
      variants: [{
        id: 9876,
        productId: 71,
        name: 'Forest / M',
        size: 'M',
        colorName: 'Forest',
        colorHex: '#10776F',
        colorHex2: null,
        imageUrl: 'https://example.test/printful-forest.jpg',
      }],
    });
    vi.mocked(listMerchConcepts).mockResolvedValue([]);
    vi.mocked(saveMerchConcept).mockResolvedValue({
      deduplicated: false,
      concept: {
        id: 'concept-1', projectId: 'project-1', conceptKey: 'a'.repeat(64), productId: 'tshirt',
        supplierKey: null, supplierName: null, provider: 'printful', providerProductId: 71,
        providerVariantId: 9876, providerColorName: 'Forest', providerColorHex: '#10776F',
        requestedColorHex: '#0F766E', logoUrl: 'https://example.test/medinnova-logo.png',
        logoVariant: 'original', placement: 'front', printWidthMm: 250, printHeightMm: 180,
        technique: 'dtg', mockupUrls: [], status: 'draft', createdByUserId: 'user-1',
        updatedByUserId: 'user-1', approvedByUserId: null, approvedAt: null,
        createdAt: '2026-09-03T10:00:00.000Z', updatedAt: '2026-09-03T10:00:00.000Z',
      },
    });

    render(<MerchMockupPreview projectId="project-1" bootstrap={bootstrap as never} />);

    await screen.findByText('Forest · #10776F · match 99%');
    const concept = screen.getByTestId('merch-photoreal-concept');
    expect(concept.getAttribute('data-source')).toBe('printful-catalog');
    expect(concept.getAttribute('data-color')).toBe('#10776F');

    fireEvent.change(screen.getByLabelText('Bredde (mm)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /Lagre konsept/i }));

    await waitFor(() => expect(saveMerchConcept).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveMerchConcept).mock.calls[0][1]).toMatchObject({
      provider: 'printful',
      providerProductId: 71,
      providerVariantId: 9876,
      providerColorHex: '#10776F',
      requestedColorHex: '#0F766E',
      logoVariant: 'original',
      placement: 'front',
      printWidthMm: 250,
      printHeightMm: 180,
      technique: 'dtg',
    });
    expect(await screen.findByText('Konseptet er lagret i prosjektet.')).toBeTruthy();
  });
});
