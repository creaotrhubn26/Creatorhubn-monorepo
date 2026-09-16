-- Fysiske trekk casting-byråer spør om, og de tre påkrevde bildene.
--
-- talents hadde height_cm, hair_color, eye_color og ethnicity som fritekst.
-- Byråene ber i tillegg om figur, jeans-mål, klesstørrelse, skostørrelse,
-- hode/hals/bryst/livv/hofte i cm, tatoveringer, eget utstyr — og en
-- MÅLEDATO, uten hvilken målene er verdiløse etter et år.
--
-- physical_attributes er JSONB fordi ingen av feltene filtreres på i
-- byrå-søket; de leses når profilen først er åpnet. Nøklene valideres
-- server-side mot frontend/shared/talent-physical-vocabulary.ts.
--
-- 🔑 ethnicity_consent er egen kolonne, ikke et felt i JSONB-en:
-- opplysninger om etnisk opprinnelse er en særlig kategori etter GDPR
-- art. 9 og krever eksplisitt samtykke, uavhengig av det generelle
-- demographics-scopet som dekker høyde og skostørrelse. Uten TRUE her
-- maskeres ethnicity bort selv for partnere som har demographics.

ALTER TABLE talents ADD COLUMN IF NOT EXISTS physical_attributes JSONB DEFAULT '{}'::jsonb;

-- De tre påkrevde bildene, typet: {face_front, face_profile, full_body_front}
-- → URL. Ligger de i headshot_alt_urls (en anonym liste) vet vi ikke hvilket
-- bilde som er hvilket, og byrået kan ikke se om settet er komplett.
ALTER TABLE talents ADD COLUMN IF NOT EXISTS casting_photos JSONB DEFAULT '{}'::jsonb;

-- Eksplisitt samtykke til å dele etnisk opprinnelse. NULL/FALSE = ikke delt.
ALTER TABLE talents ADD COLUMN IF NOT EXISTS ethnicity_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS ethnicity_consent_at TIMESTAMPTZ;
