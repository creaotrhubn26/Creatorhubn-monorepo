-- 0359_software_expenses_item_type.sql
-- Skiller programvare fra hardware i kvittering-forslag. Hardware-forslag
-- importeres til user_equipment (med garanti/reklamasjonsfrist) i stedet for å
-- bli en software-kostnad. serial_hint bærer serienummer AI fant i kvitteringen.

ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS item_type   varchar(16) DEFAULT 'software';
ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS serial_hint varchar;

CREATE INDEX IF NOT EXISTS software_expenses_user_itemtype_idx
  ON software_expenses (user_id, item_type);
