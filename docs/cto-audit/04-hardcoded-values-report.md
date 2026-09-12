# 4. Hardcoded Values Report

Full-repo case-insensitive search for: `dental, dentist, tooth, tannhelse,
tannlege, tannlegekostnader, clinic, treatment, patient` (excluding node_modules,
.git, build artifacts). Raw hit count: 90 files / 288 occurrences. Most of that
volume is substring noise, detailed below so it isn't mistaken for real coupling.

**Zero matches inside `backend/server/market-intelligence/` or
`frontend/client/src/components/admin-room/market-intelligence/`.** The module the
request is centered on has no dental/clinic references at all.

## False-positive clusters (not domain-relevant — do not "fix" these)

| Pattern | Cause | Files |
|---|---|---|
| "tooth" | Substring of "Bluetooth" | ~15 camera/BLE files (`gopro-adapter.ts`, `blackmagic-adapter.ts`, `CameraPairingDialog.tsx`, etc.) |
| "dental" | Substring of "accidental(ly)" | ~20 files, defensive-coding comments in capture/gfpgan/OAuth scripts |
| "treatment" | Logo/watermark "treatment" (branding pipeline) or A/B-test "treatment vs. control" | `advancedAnalytics.ts`, `producerProjectPlanning.ts`, `ProducerExportHandoffPanel.tsx`, etc. |
| "clinic(al)" | Color-grading term ("clinical-white" skin tone) | `lut_library.py`, `portrait_retouch.py`, `photo-enhancer-claude-vision.ts` |
| "tooth" | Art/paper-texture term ("charcoal-tooth", "paper tooth") | `stampEngine.ts`, `PencilCanvasPro.tsx` |

## Genuine matches, classified

### (a) Legitimate example/demo data — no action needed
- `backend/scripts/seed-industries.cjs:155` — `Tannhelsetjeneste / Dental practice`
  as one NACE seed row among many (alongside `Veterinærklinikk`, etc.).
- `frontend/client/src/components/role-room/components/producer/DiscoveryPanel.tsx:22`,
  `LeadsPanel.tsx:655-656` — placeholder text `"f.eks. tannlege"` /
  `"tannlegen.no"` in unrelated lead-gen form fields.
- `ipad/LeadMapApp/.../LeadResearchStartView.swift:45`,
  `LeadgridMarketScanFormView.swift:57,65` — SwiftUI placeholder copy.
- `ipad/LeadMapApp/.../SalgssjefCockpit.swift:1325`, `DemoModeManager.swift:75,108`
  — demo-mode sample leads ("Frogner Tannlege", "Stabekk Tannlege"), gated behind a
  demo toggle.
- `backend/server/role-room-agent.ts:2393`, `role-room-agent-nace-profile.ts:8`,
  `role-room-research-validation.ts:217` — "tannlege" used as one example B2C
  business among several (hairdresser/dentist/café) in NACE-disambiguation comments.
- `backend/comprehensive-research-report.json:290` — one bibliography entry title
  mentioning teeth-whitening research, inside an auto-generated citations file.

### (b) Accidental/coincidental naming — cosmetic only
- `frontend/client/src/utils/advancedAnalytics.ts:511-537` — `treatment`/`control`
  variable names are standard A/B-testing statistics terminology, unrelated to
  healthcare. No action needed.

### (c) Domain-specific logic that generalizes cleanly (pattern to reuse, not a bug)
- `backend/server/leadgrid-industry-classify.ts:182,184` — `keywords: ["tannlege"]`
  in a ~10-entry industry keyword table (fotograf, restaurant, tannlege, frisør,
  advokat, ...). This *is* the generic pattern — dental is one row, not a special
  case.
- `backend/server/leadgrid-project-lead-discovery-routes.ts:276-483` — regex
  `tannlege(r)?|tannklinikk(er)?|tannhelse` → Google Places query `"tannklinikk"`
  under a `"Helse"` (health) category, alongside similar mappings for other
  categories. Same verdict: legitimate, generalizable config-in-code.
- `backend/server/nextrole-salary.ts:66` — `{ code: "2261", label: "Tannleger",
  keywords: [...] }` in an occupation/salary lookup table — same pattern, unrelated
  product (career/salary tool).
- `frontend/shared/profession-type-registry.ts` /
  `useProfessionTabs.ts` / `ProfessionTabAdapter.tsx` — `patient-sessions`,
  `patient-notes`, `treatment-plans` (psychologist), `treatment-booking`
  (spa/wellness). Generic health/spa vertical config, **not dental specifically**.
  Flagged in the Domain Coupling Report as the one place worth migrating to
  data-driven config eventually (P2), because unlike the Leadgrid keyword table,
  this one is compiled into the bundle rather than admin-editable.
- `backend/server/index.ts` (~20 matches, lines 36279-40201) — an Academy
  curriculum-generation module with a `"healthcare"` competency profile among
  several profession profiles. Same verdict as above: legitimate multi-profession
  config, unrelated to MI/Leadgrid.

### Real, unrelated feature (not a false positive, not domain coupling either)
- `ipad/CaptureApp/CaptureApp/Core/Capture/TeethWhiteningFilter.swift` — an actual
  Core Image teeth-whitening photo filter. This is a real product feature
  (photography retouching), correctly named, not related to a "dental industry"
  vertical at all.

## Bottom line

There is no file in this repo where dental/tannhelse is load-bearing business logic
that would break if removed or that prevents another industry from working. The
"hardcoded values" risk for the *actual* Market Intelligence module is about the
**absence** of configurability (no widget system, no template engine, no
admin-editable score model) — not the presence of dental-specific code to rip out.
Section `08-proposed-data-model.md` and `10-widget-architecture.md` address that gap.
