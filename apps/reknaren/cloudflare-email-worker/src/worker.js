/**
 * Cloudflare Email Worker — inn-e-post for Reknaren (gratis-vegen).
 *
 * Cloudflare Email Routing tar imot e-post til virksomhetenes bilag-adresse
 * (bilag.<hex>@<domene>) og kaller denne workeren. Vi parser meldingen, plukker
 * ut bilag-vedleggene, og POST-er dem til Reknarens inn-e-post-webhook — som ruter
 * på mottakeradressen og lagrer dem som `forward`-bilag.
 *
 * Secrets (wrangler secret put):
 *   REKNAREN_WEBHOOK_URL     f.eks. https://ledgerly-coss.onrender.com/api/inbound/email
 *   REKNAREN_INBOUND_SECRET  samme verdi som API-ens REKNAREN_INBOUND_SECRET
 */
import PostalMime from 'postal-mime';

// Bare ekte bilag-typer sendes videre (signaturer/sporingsbilder droppes).
const BILAG_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'text/xml',
  'application/xml',
]);

export default {
  async email(message, env) {
    // message.raw er en ReadableStream; base64-encoding gir vedleggene rett på JSON-form.
    const email = await PostalMime.parse(message.raw, { attachmentEncoding: 'base64' });

    const attachments = (email.attachments || [])
      .filter((a) => a.filename && BILAG_MIME.has((a.mimeType || '').toLowerCase()))
      .map((a) => ({ filename: a.filename, contentType: a.mimeType, contentBase64: a.content }));

    if (attachments.length === 0) return; // ingenting å ta inn — slipp meldingen stille

    const res = await fetch(env.REKNAREN_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-inbound-secret': env.REKNAREN_INBOUND_SECRET,
      },
      // message.to = adressen Cloudflare rutet på (virksomhetens bilag-adresse).
      body: JSON.stringify({ to: message.to, attachments }),
    });

    if (!res.ok) {
      // Kast ved feil (5xx/nettverk) så leverandøren kan prøve igjen senere.
      const detail = await res.text().catch(() => '');
      throw new Error(`Reknaren-webhook svarte ${res.status}: ${detail.slice(0, 200)}`);
    }
  },
};
