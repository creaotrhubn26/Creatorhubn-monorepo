-- 0085_whatsapp_group_strategy.sql
-- To-modus produksjonsteam-WhatsApp-gruppe:
--   1) workspace: én sentral gruppe for hele bedriften, alle crew på alle
--      prosjekt inviteres dit. Default for de fleste — én lenke å vedlikeholde.
--   2) per_project: hver prosjekt har sin egen gruppe (som i dag).
--      Brukes når team-leder vil holde produksjon adskilt per prosjekt.
--
-- Per-prosjekt-rad i casting_project_whatsapp_group OVERSTYRER alltid org-
-- default-en — så brukeren kan kjøre "workspace by default, men prosjekt X
-- har egen gruppe".

ALTER TABLE role_room_org_whatsapp_config
  ADD COLUMN IF NOT EXISTS group_strategy           VARCHAR(32) NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS default_group_invite_link TEXT,
  ADD COLUMN IF NOT EXISTS default_group_name        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS default_group_admin_email VARCHAR(255);

ALTER TABLE role_room_org_whatsapp_config
  ADD CONSTRAINT role_room_org_whatsapp_config_strategy_check
    CHECK (group_strategy IN ('workspace', 'per_project'));

COMMENT ON COLUMN role_room_org_whatsapp_config.group_strategy IS
  'workspace = én sentral gruppe (default_group_invite_link) for hele bedriften. per_project = hver prosjekt har egen gruppe i casting_project_whatsapp_group.';

COMMENT ON COLUMN role_room_org_whatsapp_config.default_group_invite_link IS
  'chat.whatsapp.com-lenken til den sentrale produksjonsteam-gruppen. Brukes når group_strategy=workspace OG prosjektet ikke har en egen casting_project_whatsapp_group-rad.';
