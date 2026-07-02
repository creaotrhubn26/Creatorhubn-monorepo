-- 0360_software_expenses_brand_hint.sql
-- For hardware-kvitteringer er «vendor» butikken (Elkjøp) mens PRODUSENTEN (Sony)
-- er det som skal bli utstyrets merke (for firmware-match + visning). brand_hint
-- bærer produsenten AI fant, atskilt fra vendor (selger).

ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS brand_hint varchar;
