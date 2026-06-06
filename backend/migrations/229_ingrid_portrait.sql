-- Ingrid Nilsen (Phase 2 demo-talent) manglet portrett — vises som
-- default-ikon i talent-registry og produserer "uferdig"-inntrykk i
-- demo-flyten.
--
-- Setter pravatar-portrett som matcher de 9 andre demo-talents fra
-- migrate 228.

UPDATE talents
   SET headshot_url = 'https://i.pravatar.cc/400?img=49'
 WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
   AND headshot_url IS NULL;
