/**
 * Smoke test — spawns the MCP server and sends JSON-RPC
 * initialize + tools/list over stdio to verify the server
 * starts and exposes all expected tools.
 */

import { spawn } from "child_process";
import { strict as assert } from "assert";

const TIMEOUT = 10_000;
const EXPECTED_TOOLS = [
  "adb_devices", "adb_screenshot", "adb_tap", "adb_swipe",
  "adb_type", "adb_key", "adb_launch_app", "adb_shell",
  "adb_pull", "adb_push", "adb_list_packages",
];

function send(child, obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const root = new URL("..", import.meta.url).pathname;
  const child = spawn("node", ["dist/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: root,
  });

  let stdout = "";
  child.stdout.on("data", (c) => { stdout += c.toString(); });

  const timer = setTimeout(() => {
    child.kill();
    console.error("FAIL: Timed out waiting for server response");
    process.exit(1);
  }, TIMEOUT);

  // 1. Initialize
  send(child, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "1.0.0" },
    },
  });
  await wait(1500);

  // 2. Send initialized notification
  send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
  await wait(500);

  // 3. List tools
  send(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  await wait(1500);

  clearTimeout(timer);

  // Parse newline-delimited JSON responses
  const messages = stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  // Validate initialize response
  const initResp = messages.find((m) => m.id === 1);
  assert.ok(initResp, "Should receive initialize response");
  assert.ok(initResp.result, "Initialize response should have result");
  assert.equal(initResp.result.serverInfo.name, "android-adb-mcp");
  console.log("✓ Server initialized successfully");

  // Validate tools/list response
  const toolsResp = messages.find((m) => m.id === 2);
  assert.ok(toolsResp, "Should receive tools/list response");
  const toolNames = toolsResp.result.tools.map((t) => t.name).sort();
  assert.deepStrictEqual(toolNames, [...EXPECTED_TOOLS].sort(),
    "Should expose all expected tools");
  console.log(`✓ All ${EXPECTED_TOOLS.length} tools registered`);

  child.kill();
  console.log("\n✅ Smoke test passed");
}

run().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
