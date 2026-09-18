# Post Agent Resolve MCP

`dist/PostAgentResolve.mcpb` er en lokal Claude Desktop-utvidelse som kobler til
den kjørende Post Agent-appen. Den bruker ikke Resolves rå MCP-verktøy direkte.

## Sikkerhetsmodell

- Post Agent binder kun til `127.0.0.1` på en tilfeldig port.
- Appen skriver port og tilfeldig sesjonstoken til en descriptor med modus `0600`.
- MCP-utvidelsen tilbyr seks semantiske verktøy: status, katalog, analyse,
  planopprettelse, planstatus og versjonsintelligens.
- `run_script`, `run_script_unsafe`, vilkårlig Python, filstier, nettverkskall,
  `apply` og `rollback` er ikke verktøy i den eksterne katalogen.
- En AI-opprettet plan må godkjennes i det synlige Post Agent-vinduet.
- Batch Render Planner kan bare legge validerte jobber i kø; MCP-verktøyet kan
  ikke starte rendering.
- V1 Clip Renamer binder hvert før/etter-navn til timeline-item-ID og startframe
  og nekter rollback dersom klippet senere er endret.

## Bygg og test

```sh
./mcp/build-post-agent-resolve-mcpb.sh
unzip -t mcp/dist/PostAgentResolve.mcpb
```

Start Post Agent og Resolve Studio 21.1 før live-test. Installer deretter
`PostAgentResolve.mcpb` i Claude Desktop. ChatGPT kobler ikke direkte til lokal
stdio; den kommende Remote MCP-delen må bruke OpenAI Secure MCP Tunnel under
utvikling og Role Room OAuth/RBAC i produksjon.
