# External API Emission Guard

For production-bound code, an unfamiliar external API symbol may be emitted only when at least one condition is true:

1. the exact symbol already exists in the repository in a validated usage context
2. trusted local type definitions generated/provided by the vendor contain the exact symbol and compatible version context
3. `api-validator` verifies the exact symbol for the project version/environment

If none applies, code generation must stop at a placeholder or request validation rather than inventing an API.

This policy applies to:

- SDK methods
- REST/GraphQL endpoints
- CLI commands and flags
- config/manifest keys
- webhook event names
- cloud service actions
- native APIs
- plugin host APIs
- OAuth scopes/permissions

Do not apply it to ordinary local functions created inside the project.
