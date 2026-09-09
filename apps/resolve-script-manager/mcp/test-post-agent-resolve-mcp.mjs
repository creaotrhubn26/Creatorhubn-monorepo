import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const live = process.argv.includes("--live");
const child = spawn(process.execPath, [new URL("./post-agent-resolve/server/index.js", import.meta.url).pathname], {
  stdio: ["pipe", "pipe", "inherit"],
});
const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
const responses = new Map();

lines.on("line", line => {
  const message = JSON.parse(line);
  if (message.id !== undefined) responses.set(message.id, message);
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(id, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = responses.get(id);
    if (response) return response;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`MCP response ${id} timed out`);
}

try {
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "contract-test", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

  const initialized = await waitFor(1);
  assert.equal(initialized.result.protocolVersion, "2025-06-18");
  const listed = await waitFor(2);
  const names = listed.result.tools.map(tool => tool.name);
  assert.equal(names.length, 6);
  assert(names.includes("post_agent_create_resolve_plan"));
  assert(!names.some(name => /apply|rollback|run_script|unsafe/i.test(name)));
  const createPlan = listed.result.tools.find(tool => tool.name === "post_agent_create_resolve_plan");
  const workflowIds = createPlan.inputSchema.properties.skillId.enum;
  assert(workflowIds.includes("resolve-batch-render-planner"));
  assert(workflowIds.includes("resolve-v1-clip-renamer"));

  if (live) {
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "post_agent_resolve_status", arguments: {} } });
    const status = await waitFor(3, 30_000);
    assert.equal(status.result.isError, false);
    assert.equal(status.result.structuredContent.resolveReachable, true);
  }

  process.stdout.write(`Post Agent Resolve MCP contract OK (${names.length} tools${live ? ", live bridge" : ""})\n`);
} finally {
  child.stdin.end();
  child.kill("SIGTERM");
}
