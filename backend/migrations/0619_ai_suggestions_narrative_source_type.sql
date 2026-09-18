-- Story Graph (game_studio) Fase 3: KI-forslag på narrative elementer.
-- casting_ai_suggestions.source_type får verdien 'narrative_element' (kilden er
-- narrative_elements.id). CHECK-en fra 149_casting_ai_suggestions.sql utvides;
-- unionene speiles i ai-suggestion-service.ts, ai-suggestion-routes.ts og
-- frontend/client/src/components/role-room/models/casting.ts.

ALTER TABLE casting_ai_suggestions
  DROP CONSTRAINT IF EXISTS casting_ai_suggestions_source_type_valid;

ALTER TABLE casting_ai_suggestions
  ADD CONSTRAINT casting_ai_suggestions_source_type_valid
  CHECK (source_type IN ('scene', 'role', 'manuscript', 'project', 'narrative_element'));
