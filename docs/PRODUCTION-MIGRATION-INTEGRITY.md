# Production migration integrity boundary

The production migration runner is deliberately fail-closed. It requires the
existing canonical `public._migrations_applied` table, verifies its owner and
catalog shape, requires the reviewed legacy baselines, enforces a contiguous
numeric migration prefix, preloads every pending SQL file, and verifies the
exact ledger transition after execution.

The versioned tombstone manifest contains exactly the 24 reviewed filenames
that are present only in the production ledger. The recovered repository file
`0474_contract_signature_delivery.sql` is deliberately not a tombstone: its
SHA-256 was compared with and exactly matches the valid checksum already stored
in the production ledger. It is therefore the canonical applied numeric
frontier. At the audited release boundary the repository has 720 SQL files,
709 repository files plus 24 tombstones account for all 733 production ledger
rows, and `0475` through `0485` are the contiguous 11-file pending suffix.
Runtime validation still treats tombstone/repository name collisions as fatal.

Two durability controls remain separate follow-up work:

1. **Cross-commit atomicity.** Historical migration files may manage their own
   transactions. The runner therefore cannot guarantee that arbitrary migration
   SQL and its ledger INSERT commit atomically. A process or connection failure
   between those operations can leave schema changes without the matching
   ledger row. Releases must retain the production backup/clone preflight and
   stop for manual reconciliation after such a failure; the runner must not
   guess or auto-mark a migration as applied.
2. **Content checksums.** The legacy tracker contains a nullable
   `checksum_sha256` column, but historical rows do not provide a complete,
   trusted checksum baseline. This release validates filenames and ledger state
   only. Backfilling reviewed hashes and rejecting edits to previously applied
   SQL requires a separately reviewed rollout; it must not silently derive
   trust from the current working tree.

These limitations do not weaken the current fail-closed filename, role,
search-path, tracker-shape, or ledger-transition checks. They define the
remaining recovery and immutability work without expanding this release.
