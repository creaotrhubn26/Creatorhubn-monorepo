-- 0093_gallery_contract_gating.sql
-- Stine sin bekymring: kunden laster ned uten signert kontrakt eller
-- flere bilder enn avtalt. Denne migrasjonen legger til (1) hard-link
-- mellom galleri og kontrakt, og (2) audit-log per nedlasting så
-- enforcement-koden kan summere brukte bilder og blokkere når
-- contractedImages-limit er nådd.

-- 1. Galleri ↔ Kontrakt-kobling. NULL betyr ingen kontrakt knyttet
-- (bakoverkompatibelt — eksisterende gallerier funker som før).
ALTER TABLE photographer_client_galleries
  ADD COLUMN IF NOT EXISTS contract_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS photographer_client_galleries_contract_idx
  ON photographer_client_galleries (contract_id);

COMMENT ON COLUMN photographer_client_galleries.contract_id IS
  'Referanse til contracts.id. Når satt, gates download på contract.signature_status = signed.';

-- 2. Audit-log per nedlasting. Hver vellykket download-zip-call
-- inserter én rad per bilde inkludert. Brukes til (a) summer mot
-- contractedImages, (b) GDPR-forespørsler om "hvilke bilder ble
-- lastet ned og når", (c) photographer-dashboard for å se aktivitet.
--
-- Vi lagrer bare bilde-id, ikke selve fila. Re-signing av URL
-- skjer per nedlasting fra R2, så ingen blob-data her.
CREATE TABLE IF NOT EXISTS gallery_download_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL,
  image_id UUID NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_ip VARCHAR(45),                       -- IPv4/v6 for evt audit
  user_agent TEXT,
  download_method VARCHAR(32) DEFAULT 'zip',   -- zip | single | print_order
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  -- For per-tenant cleanup (GDPR Art. 17). Settes ved insert fra
  -- gallery.photographer_id så vi slipper join på nedlastings-tid.
  photographer_id VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS gallery_download_audit_gallery_idx
  ON gallery_download_audit (gallery_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS gallery_download_audit_photographer_idx
  ON gallery_download_audit (photographer_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS gallery_download_audit_image_idx
  ON gallery_download_audit (gallery_id, image_id);
-- Unique-constraint: samme klient-mail + samme bilde i samme galleri
-- skal kun telles ÉN gang mot kontrakt-limiten. Re-download av samme
-- bilde av samme klient skal IKKE bruke opp et nytt "slot".
CREATE UNIQUE INDEX IF NOT EXISTS gallery_download_audit_unique_image
  ON gallery_download_audit (gallery_id, client_email, image_id);

COMMENT ON TABLE gallery_download_audit IS
  'Audit-log for klient-downloads. Brukes til enforcement mot contractedImages og GDPR-rapportering.';
COMMENT ON INDEX gallery_download_audit_unique_image IS
  'Re-download av samme bilde til samme klient bruker IKKE opp en ny slot mot contracted_images.';
