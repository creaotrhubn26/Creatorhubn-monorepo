---
name: docs-search
description: Find authoritative manuals, official documentation, SDK/API references, service guides, standards, support articles, PDFs, and archived documentation while matching exact product model, revision, region, and version.
---

# Documentation Search

## Mission

Locate the correct authoritative documentation, not merely the most visible search result.

Use this skill for:

- user manuals
- reference manuals
- service manuals
- workshop manuals
- administrator guides
- installation guides
- maintenance guides
- quick-start guides
- troubleshooting guides
- API references
- SDK references
- CLI references
- plugin/extension documentation
- standards specifications
- firmware documentation
- product support articles
- archived/historical documentation
- technical whitepapers
- compatibility documentation

Follow `../shared/SOURCE_POLICY.md`.

## Step 1 — Identify the Documentation Target

Resolve:

- vendor
- product family
- exact product/model
- generation
- model code
- hardware revision
- software/firmware version
- region
- language
- edition/SKU
- document type
- desired historical date/version

For hardware, a marketing name is often insufficient.

Examples of identifiers:

- serial/model code
- Rev A / Rev B
- MK II
- Gen 1 / Gen 2
- regional SKU
- chassis code
- firmware branch
- manual document number

## Step 2 — Choose Search Strategy

### Exact document search

Use combinations of:

- exact product name
- exact model code
- vendor domain
- document type
- filetype:pdf
- exact version
- exact document ID

Example pattern:

`site:vendor.example "Model XYZ-200" "service manual" filetype:pdf`

### Developer documentation search

Search:

- vendor developer domain
- exact SDK/API version
- exact namespace/package
- exact API symbol if known
- version selector or archive

### Support article search

Search exact:

- error code
- error message
- product/model
- software version
- platform

### Historical documentation search

Look for:

1. vendor version selector
2. archived documentation section
3. tagged repository documentation
4. official downloadable historical PDFs
5. web archive only when first-party historical sources are no longer available

## Step 3 — Verify the Document

Before presenting a manual/reference, inspect:

- title
- vendor
- product/model
- revision
- publication date
- document ID
- firmware/software applicability
- region
- language
- edition

Do not return a manual for a visually similar or similarly named product without disclosing the mismatch.

## Step 4 — Extract the Useful Section

For long documentation:

1. inspect title/table of contents
2. identify the relevant chapter/section
3. retrieve only the relevant contiguous section when possible
4. capture diagrams/tables when they are necessary to interpret the instructions
5. preserve warnings, prerequisites, and limitations

## PDF Rules

For PDFs, treat page images as necessary when:

- tables are structurally important
- diagrams contain essential information
- scanned/manual pages have incomplete parsed text
- visual callouts define connectors, buttons, or procedures

Capture:

- document title
- revision
- issue date
- applicable version/model
- relevant page/section

## Manual Match Score

When multiple candidate manuals exist, assess:

- exact model match
- revision match
- firmware/software match
- region match
- date match
- first-party status

Suggested classification:

- **Exact** — same model/revision/version
- **Compatible** — vendor explicitly states it applies
- **Adjacent** — similar product but applicability not proven
- **Wrong scope** — different model/revision/region

Do not present an Adjacent manual as Exact.

## API/SDK Documentation Discovery

When locating developer docs, identify separately:

- host application version
- SDK version
- API version
- runtime version
- plugin manifest version
- operating system requirements

Do not collapse these into one "version."

## Standards

For standards-driven features, locate the responsible standards body or official specification.

Examples:

- IETF
- W3C
- Khronos
- SMPTE
- ISO
- IEC
- HL7
- 1EdTech
- PCI SSC

Prefer the normative specification when implementation detail depends on exact protocol behavior.

## Terminology Expansion

Search aliases when exact search fails:

- previous product name
- renamed API
- acronym expansion
- legacy terminology
- internal model identifier
- regional naming
- translated document title

Record the mapping.

## Output

### Documentation Found
Name and document type.

### Applies To
Exact product/model/version/revision/region.

### Why This Is the Correct Source
Short evidence-based match explanation.

### Relevant Sections
The chapters/pages/symbols relevant to the question.

### Caveats
Version gaps, regional differences, archived status, or uncertainty.

### Source Authority
Tier and confidence.

If multiple candidates remain plausible, rank them and explain the mismatch dimensions instead of pretending one is exact.

## Escalation

Route to `../version-intelligence/SKILL.md` when:

- multiple document revisions must be mapped to releases
- a feature's introduction/removal date matters
- compatibility changed over time
- a firmware/software timeline must be reconstructed

Route to `../api-validator/SKILL.md` when:

- the user needs proof that a specific symbol exists
- a signature, permission, stability level, or exact API behavior must be verified
