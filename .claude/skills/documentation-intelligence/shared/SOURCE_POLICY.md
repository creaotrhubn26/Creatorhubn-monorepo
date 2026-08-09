# Source and Evidence Policy

This policy applies to all Documentation Intelligence specialist skills.

## Authority Tiers

### Tier 1 — Primary / authoritative

Prefer these whenever available:

1. official product documentation
2. official API or SDK reference
3. official release notes or changelog
4. official migration guide
5. official manual or service documentation
6. official firmware page
7. official security advisory
8. official support knowledge base
9. official Git repository maintained by the vendor/project
10. official standards body specification

### Tier 2 — First-party supporting evidence

Use to clarify or trace implementation:

- official engineering blog
- official examples repository
- maintainer-authored issue or discussion
- official conference presentation
- vendor-maintained package registry metadata
- signed release artifacts and tags
- archived first-party documentation

### Tier 3 — Secondary evidence

Use only as supporting context unless primary sources are unavailable:

- reputable engineering publications
- Stack Overflow
- specialist forums
- GitHub community discussions
- Reddit
- user reports
- third-party compatibility databases

Tier 3 must never silently override Tier 1.

## Source Selection

Prefer the source that is:

1. authoritative
2. exact-version matched
3. exact-model matched
4. exact-region matched
5. most recently updated for the relevant version
6. closest to the responsible engineering/product team

"Newest page" is not automatically "best source" for an older product version.

## Primary-Source Search Ladder

For software:

1. versioned official docs
2. official release notes
3. official API/SDK reference
4. official migration guide
5. official repository release/tag
6. official issue/PR
7. archived official docs
8. secondary evidence

For hardware:

1. exact-model product support page
2. exact-model manual
3. exact-model firmware notes
4. service/installation manual
5. compatibility table
6. safety/regulatory documentation
7. archived official support page
8. secondary evidence

## Evidence Requirements

A load-bearing claim should record:

- exact claim
- source
- source authority tier
- version/model scope
- date
- relevant section or symbol
- confidence
- any ambiguity

Examples of load-bearing claims:

- "API X was introduced in 8.2"
- "Firmware 1.4 fixes overheating"
- "Model A requires driver 6.3 or later"
- "This endpoint is removed in v3"
- "This device is EOL"
- "The project cannot upgrade directly from v2 to v5"

## Contradictions

When first-party sources disagree:

1. confirm whether they apply to different versions, editions, regions, models, or dates
2. prefer exact-version documentation
3. prefer the more recent source only if both describe the same release scope
4. report unresolved conflict explicitly

Never erase conflicting evidence.

## Historical Claims

Use careful wording.

Preferred:

- "Earliest verified version: 4.2"
- "The API is documented in 4.2 and absent from the checked 4.1 reference."
- "The release notes attribute the fix to 7.0.3."

Avoid:

- "This definitely first appeared in 4.2"

unless sufficient prior releases were checked.

## Negative Evidence

Absence from a search result is not proof of nonexistence.

Before declaring that a symbol/manual/feature does not exist:

1. search exact symbol/name
2. search aliases and previous terminology
3. check versioned references
4. check release notes
5. check official repository if applicable
6. check archived official docs where relevant

Then phrase the conclusion according to confidence.

## Search Snippets

Search-engine snippets are discovery aids, not final evidence.

Open the source before relying on the claim.

## Community Evidence

Use community evidence for:

- undocumented behavior
- regressions not yet acknowledged
- real-world compatibility reports
- reproduction details
- workarounds

Label it explicitly as community evidence.

## Security

For security claims prefer:

1. vendor advisory
2. project security advisory
3. CVE record / authoritative vulnerability database
4. CISA or equivalent government advisory
5. reputable security research

Do not inflate severity beyond the authoritative rating and exploit conditions.

## Licensing and Legal Terms

Summarize official licensing material precisely, but do not turn documentation research into unsupported legal advice.

## Confidence Scale

### Verified
Direct, authoritative, scope-matched evidence.

### Strong evidence
Multiple reliable sources or authoritative but partially scope-matched evidence.

### Probable
Inference based on credible but incomplete evidence.

### Unverified
Insufficient evidence.

### Contradicted
Relevant authoritative evidence conflicts with the claim.
