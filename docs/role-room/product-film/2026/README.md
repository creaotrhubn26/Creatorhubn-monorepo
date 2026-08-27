# The Role Room – Produksjonsteam

Production source for the Role Room product-film project created in the live
Storyboard Room account on 2026-08-27.

## Live project

- Project ID: `the-role-room-product-film-2026`
- Project: `The Role Room – Produksjonsteam`
- Manuscript ID: `the-role-room-product-film-2026-manuscript-v1`
- Manuscript: `Fra idé til sett – Produktfilm v1`
- Runtime: 74 seconds
- Structure: 8 scenes, 19 shots
- Mode: production team
- Canonical host: `https://theroleroom.com`

The production is idempotently stored through the canonical Role Room project
API and the casting manuscript/scene API. The generated artwork is attached to
the first shot and to the project moodboard.

## Narrative structure

1. Fragmented production — email, chat, spreadsheets and conflicting scripts.
2. One room — the team opens a single production hub.
3. Production context — screenplay data becomes scene, character, location,
   wardrobe, prop and camera context in Storyboard Room.
4. Prompt Engine — user intent is compiled with production context before the
   replaceable render model is called.
5. Team sync — casting, crew, equipment and schedule share the same state.
6. Live set — storyboard, shot status, takes, media cards and continuity meet.
7. Client review — comments and approvals stay attached to the right version.
8. Delivery — the graphite animatic match-cuts into the finished film.

## Visual direction

The storyboard was generated with the built-in image generation tool using
this production-oriented prompt set:

> Professional 3-by-3 production storyboard contact sheet for a 74-second
> product film. Follow the same Norwegian producer, DP and storyboard artist
> from fragmented production tools into one connected production system.
> Show the production hub, iPad Storyboard Room, transparent Prompt Inspector,
> team planning, live set, client review, animatic match cut and final iPad
> hero. Monochrome graphite construction lines, Story Pencil plus Story Hatch,
> selective cross-hatching, minimal tonal rendering, clear silhouettes,
> readable blocking, practical cinematography and restrained violet interface
> accents. Exactly nine 16:9 panels with clean gutters; no captions, logos,
> watermarks or polished concept-art finish.

## Source inputs

- `THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md`
- `frontend/client/src/components/role-room/`
- `backend/server/role-room-routes.ts`
- `ipad/StoryboardStudio/`

The repository image is the durable source copy; the production API holds the
in-app data URL used by the first frame and moodboard.
