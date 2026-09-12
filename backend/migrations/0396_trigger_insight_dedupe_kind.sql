-- 0396_trigger_insight_dedupe_kind.sql
-- sales-trigger-detektorens dedupe_key utvides med kind
-- (trigger|<source>|<event_id>|<kind>): utlysning → tildeling er to reelle
-- hendelser, og en reklassifisert trigger-rad (TED can-* var feilmappet som
-- tender t.o.m. 17.07.2026) skal gi nytt, korrekt kort i stedet for å
-- kollidere med det gamle. Backfill av eksisterende nøkler så kortene som
-- allerede står der ikke dupliseres av ny kode.

UPDATE insights i
   SET dedupe_key = i.dedupe_key || '|' || t.kind
  FROM trigger_events t
 WHERE i.detector = 'sales-trigger'
   AND i.organization_id = t.organization_id
   AND i.dedupe_key = 'trigger|' || t.source || '|' || t.event_id;
