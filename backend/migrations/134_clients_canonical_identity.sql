-- Slice 9X.8.A — kanonisere klient-identitet
--
-- Hvorfor: clients-tabellen har eksistert lenge men har ingen FK-er
-- som peker til den; klient-data fragmenteres over 9+ tabeller via
-- (photographer_id, client_email)-string-match. Per-klient CRM
-- (Slice 9X.8.B) trenger én canonical klient-id å aggregere mot.
--
-- Skop: kun 3 tabeller (photographer_client_galleries, print_orders,
-- contracts) i denne migrasjonen — de som CRM-MVP joiner direkte.
-- client_communications/feedbacks/onboarding utsettes til en senere
-- migrasjon når deres email-mapping er avklart.
--
-- Idempotent. Trygg å kjøre flere ganger.
-- DDL er separert fra backfill slik at strukturelle endringer kan
-- rolles ut først og data-backfill kjøres når den er verifisert.

-- =====================================================
-- DEL 1 — utvid clients-tabellen til multi-tenant
-- =====================================================

-- photographer_id NULLABLE først; settes NOT NULL i en senere
-- migrasjon når backfill er verifisert.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photographer_id VARCHAR(64);

-- Relakse first_name/last_name slik at backfill kan opprette rader
-- fra orphaned email-data der vi bare har en enkelt clientName-string
-- (eller ingen navn i det hele tatt).
DO $$ BEGIN
  ALTER TABLE clients ALTER COLUMN first_name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE clients ALTER COLUMN last_name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop globalt-UNIQUE(email); legg til composite UNIQUE per fotograf.
-- To fotografer kan ha samme klient-email som separate rader.
DROP INDEX IF EXISTS clients_email_unique;
CREATE UNIQUE INDEX IF NOT EXISTS clients_photographer_email_unique
  ON clients (photographer_id, email);
CREATE INDEX IF NOT EXISTS clients_photographer_idx
  ON clients (photographer_id);

-- =====================================================
-- DEL 2 — legg til canonical_client_id på source-tabeller
-- =====================================================
-- Bevisst nytt navn (ikke "client_id") for å unngå kollisjon med
-- eksisterende VARCHAR client_id-felter på flere tabeller.

ALTER TABLE photographer_client_galleries
  ADD COLUMN IF NOT EXISTS canonical_client_id UUID;
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS canonical_client_id UUID;
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS canonical_client_id UUID;

CREATE INDEX IF NOT EXISTS photographer_client_galleries_canonical_idx
  ON photographer_client_galleries (canonical_client_id);
CREATE INDEX IF NOT EXISTS print_orders_canonical_idx
  ON print_orders (canonical_client_id);
CREATE INDEX IF NOT EXISTS contracts_canonical_idx
  ON contracts (canonical_client_id);

-- =====================================================
-- DEL 3 — backfill clients fra source-tabeller
-- =====================================================
-- Innholdet er styrt av ON CONFLICT DO NOTHING, så denne kan kjøres
-- om igjen uten å duplisere. Navne-splitting er best-effort:
-- "Daniel Hansen" → first="Daniel", last="Hansen"; én-ords-navn
-- som "Holycrust" → first="Holycrust", last=''.

INSERT INTO clients (photographer_id, email, first_name, last_name, created_at, updated_at)
SELECT
  sc.photographer_id,
  sc.client_email,
  COALESCE(NULLIF(SPLIT_PART(sc.client_name, ' ', 1), ''), '')                                              AS first_name,
  COALESCE(NULLIF(TRIM(SUBSTRING(sc.client_name FROM POSITION(' ' IN sc.client_name) + 1)), ''), '')        AS last_name,
  NOW(),
  NOW()
FROM (
  SELECT photographer_id, client_email, client_name
    FROM photographer_client_galleries
   WHERE client_email IS NOT NULL AND photographer_id IS NOT NULL
  UNION
  SELECT photographer_id, client_email, client_name
    FROM print_orders
   WHERE client_email IS NOT NULL AND photographer_id IS NOT NULL
  UNION
  SELECT user_id AS photographer_id, client_email, client_name
    FROM contracts
   WHERE client_email IS NOT NULL AND user_id IS NOT NULL
) sc
ON CONFLICT (photographer_id, email) DO NOTHING;

-- =====================================================
-- DEL 4 — backfill canonical_client_id på source-tabeller
-- =====================================================

UPDATE photographer_client_galleries pcg
   SET canonical_client_id = c.id
  FROM clients c
 WHERE c.photographer_id = pcg.photographer_id
   AND c.email           = pcg.client_email
   AND pcg.canonical_client_id IS NULL;

UPDATE print_orders po
   SET canonical_client_id = c.id
  FROM clients c
 WHERE c.photographer_id = po.photographer_id
   AND c.email           = po.client_email
   AND po.canonical_client_id IS NULL;

-- contracts.user_id ↔ clients.photographer_id (samme bruker-ID-rom).
UPDATE contracts ct
   SET canonical_client_id = c.id
  FROM clients c
 WHERE c.photographer_id = ct.user_id
   AND c.email           = ct.client_email
   AND ct.canonical_client_id IS NULL;
