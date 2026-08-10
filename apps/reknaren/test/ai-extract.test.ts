import { describe, expect, it } from 'vitest';
import {
  ClaudeDocumentExtractor,
  DocumentExtractionError,
  DocumentExtractionNotConfiguredError,
} from '../src/pipeline/ai-extract.js';

function fakeFetch(responder: (bodyObj: Record<string, unknown>) => { status: number; body?: unknown }) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    calls.push({ url, headers: init.headers, body });
    const r = responder(body);
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body,
      text: async () => '',
    };
  };
  return { impl, calls };
}

const toolResponse = (input: Record<string, unknown>) => ({
  status: 200,
  body: { content: [{ type: 'text', text: 'ser på bilaget' }, { type: 'tool_use', name: 'record_bilag', input }] },
});

describe('ClaudeDocumentExtractor', () => {
  it('uten nøkkel: configured=false og extract kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const ex = new ClaudeDocumentExtractor(undefined, 'claude-sonnet-4-6', impl);
    expect(ex.configured).toBe(false);
    await expect(ex.extract(Buffer.from('x'), 'a.pdf', 'application/pdf')).rejects.toBeInstanceOf(
      DocumentExtractionNotConfiguredError,
    );
    expect(calls).toHaveLength(0);
  });

  it('mapper Claude-svaret til ExtractedData (øre som bigint, ingen mva-utrekning)', async () => {
    const { impl, calls } = fakeFetch(() =>
      toolResponse({
        documentType: 'supplier_invoice',
        vendorName: 'Foto AS',
        vendorOrgNumber: '999 888 777',
        invoiceNumber: 'F-1042',
        invoiceDate: '2026-02-01',
        dueDate: '2026-02-15',
        currency: 'NOK',
        net: '1234.56',
        vat: '308.64',
        gross: '1543.20',
        lineItems: [{ description: 'Kamera', amount: '1234.56' }],
        vatBreakdown: [{ ratePct: '25', base: '1234.56', vat: '308.64' }],
      }),
    );
    const ex = new ClaudeDocumentExtractor('sk-ant-key', 'claude-sonnet-4-6', impl);
    const data = await ex.extract(Buffer.from('%PDF'), 'faktura.pdf', 'application/pdf');
    expect(data.documentType).toBe('supplier_invoice');
    expect(data.vendorName).toBe('Foto AS');
    expect(data.vendorOrgNumber).toBe('999888777'); // mellomrom fjernet
    expect(data.netMinor).toBe(123456n);
    expect(data.vatMinor).toBe(30864n);
    expect(data.grossMinor).toBe(154320n);
    expect(data.lineItems).toEqual([{ description: 'Kamera', amountMinor: 123456n }]);
    expect(data.vatBreakdown).toEqual([{ ratePct: '25', baseMinor: 123456n, vatMinor: 30864n }]);
    // riktig API-form: tool-use tvunget + x-api-key
    expect(calls[0]!.headers['x-api-key']).toBe('sk-ant-key');
    expect((calls[0]!.body as { tool_choice?: unknown }).tool_choice).toMatchObject({ name: 'record_bilag' });
  });

  it('sender PDF som document-blokk og bilde som image-blokk', async () => {
    const { impl, calls } = fakeFetch(() => toolResponse({ documentType: 'receipt' }));
    const ex = new ClaudeDocumentExtractor('k', 'claude-sonnet-4-6', impl);
    await ex.extract(Buffer.from('%PDF'), 'a.pdf', 'application/pdf');
    await ex.extract(Buffer.from('img'), 'b.png', 'image/png');
    const firstBlock = (b: Record<string, unknown>) =>
      ((b.messages as Array<{ content: Array<{ type: string; source?: { media_type?: string } }> }>)[0]!.content)[0]!;
    expect(firstBlock(calls[0]!.body).type).toBe('document');
    expect(firstBlock(calls[0]!.body).source?.media_type).toBe('application/pdf');
    expect(firstBlock(calls[1]!.body).type).toBe('image');
    expect(firstBlock(calls[1]!.body).source?.media_type).toBe('image/png');
  });

  it('er robust mot ugyldige beløp (feltet blir tomt, ikke krasj)', async () => {
    const { impl } = fakeFetch(() => toolResponse({ documentType: 'receipt', net: 'tull', gross: '99.00' }));
    const ex = new ClaudeDocumentExtractor('k', 'claude-sonnet-4-6', impl);
    const data = await ex.extract(Buffer.from('x'), 'a.jpg', 'image/jpeg');
    expect(data.netMinor).toBeUndefined();
    expect(data.grossMinor).toBe(9900n);
  });

  it('401 fra Anthropic → NotConfigured; 500 → DocumentExtractionError', async () => {
    const auth = new ClaudeDocumentExtractor('k', 'm', fakeFetch(() => ({ status: 401 })).impl);
    await expect(auth.extract(Buffer.from('x'), 'a.pdf', 'application/pdf')).rejects.toBeInstanceOf(DocumentExtractionNotConfiguredError);
    const err = new ClaudeDocumentExtractor('k', 'm', fakeFetch(() => ({ status: 500 })).impl);
    await expect(err.extract(Buffer.from('x'), 'a.pdf', 'application/pdf')).rejects.toBeInstanceOf(DocumentExtractionError);
  });
});
