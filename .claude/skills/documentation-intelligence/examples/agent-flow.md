# Example End-to-End Agent Flow

## User asks

> Upgrade our Resolve integration to the latest supported release and fix anything that breaks.

## Flow

### 1. Repository Intelligence

Identify:

- installed/current Resolve integration assumptions
- scripting APIs actually used
- affected files
- critical features
- tests

### 2. Version Intelligence

Find:

- current release
- target release
- every relevant intermediate breaking change
- known issues
- migration guidance

### 3. API Validator

Validate every used API affected by the version change.

### 4. Compatibility Solver

Confirm:

- host version
- Python/runtime
- OS targets
- architecture
- plugin/bridge requirements

### 5. Impact Engine

Filter the vendor changes down to project-relevant impact.

### 6. Migration Engine

Create file-level migration steps, tests, and rollback.

### 7. Evidence Graph

Store:

- source evidence
- API lifecycle facts
- compatibility constraints
- migration decision
- impacted code paths

### 8. Coding Agent

Only now implement the verified migration.

### 9. PR Guardian

Before merge, re-check new external API symbols and target compatibility.
