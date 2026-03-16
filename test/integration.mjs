/**
 * Integration test for android-adb-mcp
 * Tests the MCP server without requiring a real Android device
 */

import { spawn } from "child_process";
import { strict as assert } from "assert";

const TIMEOUT = 15_000;
const TEST_DELAY = 1000;

function send(child, obj) {
  const msg = JSON.stringify(obj) + "\n";
  child.stdin.write(msg);
  return msg;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testInitialization() {
  console.log("🧪 Testing MCP server initialization...");

  const child = spawn("node", ["dist/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: new URL("..", import.meta.url).pathname,
  });

  let stdout = "";
  child.stdout.on("data", (c) => { stdout += c.toString(); });

  const timer = setTimeout(() => {
    child.kill();
    throw new Error("Timeout waiting for initialization");
  }, TIMEOUT);

  // Send initialize
  send(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "1.0.0" },
    },
  });

  await wait(TEST_DELAY);

  // Send initialized notification
  send(child, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  await wait(TEST_DELAY);

  // Request tools list
  send(child, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });

  await wait(TEST_DELAY);

  clearTimeout(timer);

  // Parse responses
  const messages = stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Verify initialize response
  const initResp = messages.find((m) => m.id === 1);
  assert.ok(initResp, "Should receive initialize response");
  assert.ok(initResp.result, "Initialize response should have result");
  assert.equal(initResp.result.serverInfo.name, "android-adb-mcp");
  console.log("✓ Server initialized successfully");

  // Verify tools/list response
  const toolsResp = messages.find((m) => m.id === 2);
  assert.ok(toolsResp, "Should receive tools/list response");
  const toolNames = toolsResp.result.tools.map((t) => t.name).sort();
  const expectedTools = [
    "adb_devices", "adb_screenshot", "adb_tap", "adb_swipe",
    "adb_type", "adb_key", "adb_launch_app", "adb_shell",
    "adb_pull", "adb_push", "adb_list_packages",
  ].sort();
  assert.deepStrictEqual(toolNames, expectedTools, "Should expose all expected tools");
  console.log(`✓ All ${expectedTools.length} tools registered`);

  child.kill();
  return true;
}

async function testToolCall() {
  console.log("\n🧪 Testing tool call (adb_devices)...");

  const child = spawn("node", ["dist/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: new URL("..", import.meta.url).pathname,
  });

  let stdout = "";
  child.stdout.on("data", (c) => { stdout += c.toString(); });

  const timer = setTimeout(() => {
    child.kill();
    throw new Error("Timeout waiting for tool call response");
  }, TIMEOUT);

  // Initialize
  send(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "1.0.0" },
    },
  });

  await wait(TEST_DELAY);

  // Send initialized notification
  send(child, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  await wait(TEST_DELAY);

  // Call adb_devices tool
  send(child, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "adb_devices",
      arguments: {},
    },
  });

  await wait(TEST_DELAY);

  clearTimeout(timer);

  // Parse responses
  const messages = stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Verify tool call response
  const toolResp = messages.find((m) => m.id === 3);
  assert.ok(toolResp, "Should receive tool call response");
  assert.ok(toolResp.result, "Tool call should have result");
  console.log("✓ adb_devices tool call successful");
  console.log(`  Result: ${JSON.stringify(toolResp.result).substring(0, 100)}...`);

  child.kill();
  return true;
}

async function runTests() {
  console.log("=== android-adb-mcp Integration Tests ===\n");

  try {
    await testInitialization();
    await testToolCall();

    console.log("\n✅ All integration tests passed!");
    console.log("\nNote: These tests verify the MCP protocol works correctly.");
    console.log("For live device testing:");
    console.log("  1. Connect an Android device via USB");
    console.log("  2. Run: adb devices");
    console.log("  3. Start: android-adb-mcp &");
    console.log("  4. Use with Claude Code or Goose");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests();
