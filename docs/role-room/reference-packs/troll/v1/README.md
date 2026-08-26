# TROLL production reference pack v1

These are original fictional visual-development assets for Storyboard Room's
production-aware Prompt Engine. They were generated with Codex's built-in
`image_gen` tool on 2026-08-26; no CLI image generator was used.

Runtime assets live in
`backend/assets/storyboard-reference-packs/troll/v1/` and are served only
through project-authenticated Role Room routes. Database rows begin as
`draft`. A producer/director must explicitly approve and lock an asset before
it can be inherited by a compiled prompt or sent to an image provider.

## Assets and design briefs

- `nora-character-wardrobe-draft-v1.png` — original fictional Norwegian
  paleontologist in her mid-thirties; consistent multi-view identity, practical
  olive field jacket, dark field clothes, boots, gloves, notebook and rugged
  paleontology case; production reference sheet; no actor likeness and no text.
- `troll-creature-scale-draft-v1.png` — original 40-metre ancient Nordic
  mountain troll; intelligent and mournful rather than monstrous; stable
  granite, root, birch, lichen and frost anatomy; human, car and trees establish
  scale; production reference views; no text.
- `dovrefjell-location-draft-v1.png` — one fixed Dovrefjell geography across
  dusk, night and dawn; same ridge saddle, road, scree, tree line and snow;
  monochrome production storyboard, confident graphite construction lines,
  selective cross-hatching and minimal tonal rendering.
- `scene-8-storyboard-sequence-draft-v1.png` — three consecutive Scene 8
  shots using the troll and Dovrefjell references: 24 mm extreme wide reveal,
  18 mm low-angle scale shot with car/person, and 85 mm emotional close-up;
  consistent creature, geography, screen direction and graphite/hatch style.

## Acceptance rules

- Human review is mandatory; generation never auto-approves a reference.
- Only `approved` project-owned rows are hydrated into Prompt Engine context.
- Provider calls revalidate project ownership and approval immediately before
  reading image bytes.
- Built-in image IDs use an explicit allow-list. Database values are never
  treated as arbitrary paths or remote URLs.
- Re-installing the pack preserves review status and never deletes TROLL data.
