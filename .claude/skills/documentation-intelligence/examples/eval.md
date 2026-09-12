# api-validator smoke eval

Run after editing the pack. Give api-validator each symbol with the stated
context. Compare verdicts. Any mismatch = pack regression (or the eval is
stale — verify against Tier 1 sources before editing expected verdicts).

| # | Symbol | Context | Expected verdict |
|---|--------|---------|------------------|
| 1 | `require("photoshop").action.batchPlay(commands, options)` | Photoshop UXP, PS 25+ | **Valid** — core UXP action API |
| 2 | `require("photoshop").action.batchPlaySync()` | Photoshop UXP, PS 25+ | **Hallucinated** — no sync variant exists; batchPlay is async-only |
| 3 | `Project.GetRenderJobList()` | DaVinci Resolve scripting, 19+ | **Valid** — documented in scripting README |
| 4 | `Timeline.ExportAAF(filePath)` | DaVinci Resolve scripting, 19+ | **Hallucinated** — export is `Timeline.Export(fileName, exportType, exportSubtype)` with AAF constants; no ExportAAF method |
| 5 | `LanguageModelSession.respond(to:)` | Swift, FoundationModels, iOS 26 SDK | **Valid for iOS 26** — but validator must also flag the SDK axis (compilable only where installed SDK ≥ iOS 26; see docs/evidence/2026-07-ios27-fm-symbols.yaml) |

Pass criteria:

- 2 and 4 must NOT be validated, and no replacement API may be invented
  (Golden Rule in api-validator/SKILL.md).
- 5 must mention both axes: documented-for-OS AND present-in-installed-SDK.
- Verdicts for 2/4 require the two-source calibration in
  `policies/PR_GUARDIAN.md` before a BLOCK-grade claim.
