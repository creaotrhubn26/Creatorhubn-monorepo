#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = {
  name: "post-agent-resolve",
  title: "Post Agent for DaVinci Resolve",
  version: "0.2.0",
};
const MAX_BRIDGE_RESPONSE_BYTES = 8 * 1024 * 1024;

const ANALYSIS_SKILLS = [
  "resolve-project-doctor",
  "resolve-timeline-qc",
  "resolve-media-health",
  "resolve-delivery-qc",
];

const WORKFLOW_SKILLS = [
  "resolve-project-organizer",
  "resolve-transcript-editor",
  "resolve-multicam-director",
  "resolve-audio-post",
  "resolve-color-guardian",
  "resolve-review-notes",
  "resolve-batch-render-planner",
  "resolve-v1-clip-renamer",
];

const TOOLS = [
  {
    name: "post_agent_resolve_status",
    description: "Check whether Post Agent, Resolve MCP, and DaVinci Resolve Studio 21.1 are reachable. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "post_agent_list_resolve_skills",
    description: "List the semantic Resolve skills allowed by Post Agent and their read/write requirements. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "post_agent_run_resolve_analysis",
    description: "Run one allowlisted read-only analysis against the active Resolve project. Never modifies Resolve.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skillId"],
      properties: {
        skillId: { type: "string", enum: ANALYSIS_SKILLS },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "post_agent_create_resolve_plan",
    description: "Create a locked, expiring Resolve workflow plan bound to the active project/timeline. This tool does not modify Resolve. Tell the user to review and approve the plan in Post Agent.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skillId"],
      properties: {
        skillId: { type: "string", enum: WORKFLOW_SKILLS },
        input: {
          type: "object",
          description: "Semantic workflow options only. Raw Python, MCP tool names, filesystem paths, URLs, and shell commands are ignored or rejected by Post Agent.",
          additionalProperties: true,
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "post_agent_get_resolve_plan",
    description: "Read a Post Agent Resolve plan by ID. Use it to check whether the user approved, executed, or rolled back the plan.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["planId"],
      properties: { planId: { type: "string", minLength: 8, maxLength: 64 } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "post_agent_get_resolve_intelligence",
    description: "Return Resolve 21.1 What's New data and exact scripting API evidence used to validate Post Agent workflows. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function descriptorCandidates() {
  if (process.env.POST_AGENT_MCP_BRIDGE_FILE) return [process.env.POST_AGENT_MCP_BRIDGE_FILE];
  if (platform() === "darwin") {
    return [join(homedir(), "Library", "Application Support", "no.creatorhubn.roleroom-post-agent", "post-agent-resolve-mcp-bridge.json")];
  }
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return [join(appData, "no.creatorhubn.roleroom-post-agent", "post-agent-resolve-mcp-bridge.json")];
  }
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return [join(dataHome, "no.creatorhubn.roleroom-post-agent", "post-agent-resolve-mcp-bridge.json")];
}

function loadDescriptor() {
  const path = descriptorCandidates().find(existsSync);
  if (!path) throw new Error("Post Agent bridge ble ikke funnet. Start Post Agent og åpne Resolve Skills.");
  const file = statSync(path);
  if (typeof process.getuid === "function" && file.uid !== process.getuid()) {
    throw new Error("Post Agent bridge-filen eies av en annen bruker.");
  }
  if (platform() !== "win32" && (file.mode & 0o077) !== 0) {
    throw new Error("Post Agent bridge-filen har for åpne rettigheter. Start Post Agent på nytt.");
  }
  const descriptor = JSON.parse(readFileSync(path, "utf8"));
  if (descriptor.schemaVersion !== 1 || descriptor.host !== "127.0.0.1") {
    throw new Error("Post Agent bridge-descriptoren er ugyldig.");
  }
  if (!Number.isInteger(descriptor.port) || descriptor.port < 1 || descriptor.port > 65535 || typeof descriptor.token !== "string") {
    throw new Error("Post Agent bridge-descriptoren mangler port eller token.");
  }
  if (Number.isInteger(descriptor.pid)) {
    try { process.kill(descriptor.pid, 0); } catch { throw new Error("Post Agent bridge er utløpt. Start Post Agent på nytt."); }
  }
  return descriptor;
}

function callBridge(method, params = {}) {
  const descriptor = loadDescriptor();
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: descriptor.host, port: descriptor.port });
    let buffer = "";
    const finish = (error, value) => {
      socket.destroy();
      if (error) reject(error); else resolve(value);
    };
    socket.setTimeout(90_000, () => finish(new Error("Post Agent bridge svarte ikke innen 90 sekunder.")));
    socket.on("connect", () => {
      socket.write(`${JSON.stringify({ id: randomUUID(), token: descriptor.token, method, params })}\n`);
    });
    socket.on("data", chunk => {
      buffer += chunk.toString("utf8");
      if (Buffer.byteLength(buffer, "utf8") > MAX_BRIDGE_RESPONSE_BYTES) {
        finish(new Error("Post Agent bridge-responsen er større enn 8 MiB."));
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        if (!response.ok) finish(new Error(response.error || "Post Agent avviste kallet."));
        else finish(null, response.result);
      } catch (error) {
        finish(new Error(`Ugyldig svar fra Post Agent: ${error.message}`));
      }
    });
    socket.on("error", error => finish(new Error(`Kunne ikke kontakte Post Agent: ${error.message}`)));
  });
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  write({ jsonrpc: "2.0", id, result: value });
}

function rpcError(id, code, message) {
  write({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolResult(value, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const structuredContent = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { result: value };
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : { structuredContent, isError: false }) };
}

async function invokeTool(name, args) {
  switch (name) {
    case "post_agent_resolve_status": return callBridge("status");
    case "post_agent_list_resolve_skills": return callBridge("list_skills");
    case "post_agent_run_resolve_analysis": return callBridge("run_analysis", args);
    case "post_agent_create_resolve_plan": return callBridge("create_plan", args);
    case "post_agent_get_resolve_plan": return callBridge("get_plan", args);
    case "post_agent_get_resolve_intelligence": return callBridge("get_intelligence");
    default: throw new Error(`Ukjent Post Agent-verktøy: ${name}`);
  }
}

async function handle(request) {
  const { id = null, method = "", params = {} } = request;
  if (method === "initialize") {
    result(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: "Use Post Agent's read-only Resolve analyses freely. For any change, create a plan and ask the user to review and approve it in the visible Post Agent app. This MCP server intentionally has no tool that applies or rolls back Resolve writes.",
    });
    return;
  }
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return;
  if (method === "ping") { result(id, {}); return; }
  if (method === "tools/list") { result(id, { tools: TOOLS }); return; }
  if (method === "resources/list") { result(id, { resources: [] }); return; }
  if (method === "tools/call") {
    const name = String(params.name || "");
    const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    try {
      result(id, toolResult(await invokeTool(name, args)));
    } catch (error) {
      result(id, toolResult(error.message || String(error), true));
    }
    return;
  }
  rpcError(id, -32601, `Ukjent MCP-metode: ${method}`);
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", line => {
  try {
    const request = JSON.parse(line);
    Promise.resolve(handle(request)).catch(error => rpcError(request.id ?? null, -32603, error.message || String(error)));
  } catch (error) {
    rpcError(null, -32700, `Ugyldig JSON: ${error.message}`);
  }
});
