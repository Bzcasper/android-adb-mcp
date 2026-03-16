#!/usr/bin/env node
/**
 * android-adb-mcp v0.1.0
 * MCP server giving AI agents (Claude Code, Goose) control over
 * Android devices via ADB — screen capture, UI automation,
 * app launch, file transfer, and allowlisted shell execution.
 *
 * Author:  Bobby Casper <robertmcasper@gmail.com>
 * License: Apache-2.0
 * Updated: 2026-03-15
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync, exec, spawnSync } from "child_process";
import { promisify } from "util";
import { writeFileSync, readFileSync, unlinkSync } from "fs";

const execAsync = promisify(exec);

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_COMMANDS = [
  "ls", "cat", "echo", "pwd", "whoami", "date",
  "pm", "am", "dumpsys", "getprop", "setprop",
  "input", "screencap", "screenrecord", "monkey",
  "logcat", "ps", "top", "df", "du", "find",
];

const CONFIG = {
  adbHost: process.env["ANDROID_ADB_HOST"] ?? "localhost",
  adbPort: process.env["ANDROID_ADB_PORT"] ?? "5037",
  allowedShellCommands: process.env["ANDROID_ADB_ALLOWED_COMMANDS"]
    ? process.env["ANDROID_ADB_ALLOWED_COMMANDS"].split(",").map((c: string) => c.trim())
    : DEFAULT_ALLOWED_COMMANDS,
};

// ─── ADB Helpers ──────────────────────────────────────────────────────────────

function adb(args: string): string {
  const cmd = `adb -H ${CONFIG.adbHost} -P ${CONFIG.adbPort} ${args}`;
  return execSync(cmd, { encoding: "utf8", timeout: 30000 });
}

async function adbAsync(args: string): Promise<string> {
  const cmd = `adb -H ${CONFIG.adbHost} -P ${CONFIG.adbPort} ${args}`;
  const { stdout } = await execAsync(cmd, { timeout: 60000 });
  return stdout;
}

/**
 * Capture screenshot via spawnSync so binary stdout goes directly
 * to a buffer — avoids shell redirect limitations of execSync.
 */
function captureScreenshot(deviceSerial: string): string {
  const tmp = `/tmp/adb_screenshot_${Date.now()}.png`;
  const adbArgs = [
    "-H", CONFIG.adbHost,
    "-P", CONFIG.adbPort,
    ...(deviceSerial ? ["-s", deviceSerial] : []),
    "exec-out", "screencap", "-p",
  ];

  const result = spawnSync("adb", adbArgs, {
    encoding: "buffer",
    timeout: 15000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "unknown error";
    throw new Error(`screencap failed (exit ${result.status ?? "?"}): ${stderr}`);
  }

  writeFileSync(tmp, result.stdout);
  const b64 = readFileSync(tmp).toString("base64");
  try { unlinkSync(tmp); } catch { /* ignore cleanup errors */ }
  return b64;
}

function isCommandAllowed(command: string): boolean {
  const base = command.trim().split(/\s+/)[0] ?? "";
  return CONFIG.allowedShellCommands.includes(base);
}

function getArgs(raw: unknown): Record<string, unknown> {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "android-adb-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "adb_devices",
      description: "List all connected Android devices and their status",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "adb_screenshot",
      description: "Capture a screenshot from the Android device. Returns a base64-encoded PNG image.",
      inputSchema: {
        type: "object",
        properties: {
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: [],
      },
    },
    {
      name: "adb_tap",
      description: "Tap a screen coordinate on the Android device",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "number", description: "X coordinate in pixels" },
          y: { type: "number", description: "Y coordinate in pixels" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["x", "y"],
      },
    },
    {
      name: "adb_swipe",
      description: "Perform a swipe gesture on the Android device screen",
      inputSchema: {
        type: "object",
        properties: {
          x1: { type: "number", description: "Start X" },
          y1: { type: "number", description: "Start Y" },
          x2: { type: "number", description: "End X" },
          y2: { type: "number", description: "End Y" },
          duration: { type: "number", description: "Duration in ms (default 300)" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["x1", "y1", "x2", "y2"],
      },
    },
    {
      name: "adb_type",
      description: "Type text into the focused input field on the Android device",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to type" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["text"],
      },
    },
    {
      name: "adb_key",
      description: "Send a keyevent to the Android device (e.g. KEYCODE_BACK, KEYCODE_HOME, KEYCODE_ENTER)",
      inputSchema: {
        type: "object",
        properties: {
          keycode: { type: "string", description: "Keycode name or integer" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["keycode"],
      },
    },
    {
      name: "adb_launch_app",
      description: "Launch an Android app by package name. Optionally specify an activity for deep launch.",
      inputSchema: {
        type: "object",
        properties: {
          package: { type: "string", description: "Package name (e.g. com.ebay.mobile)" },
          activity: { type: "string", description: "Activity class (optional)" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["package"],
      },
    },
    {
      name: "adb_shell",
      description: "Run an allowlisted shell command on the Android device. Non-allowlisted commands are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command (must start with an allowlisted base command)" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["command"],
      },
    },
    {
      name: "adb_pull",
      description: "Pull a file or directory from the Android device to the host",
      inputSchema: {
        type: "object",
        properties: {
          remote: { type: "string", description: "Path on the Android device" },
          local: { type: "string", description: "Destination path on the host" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["remote", "local"],
      },
    },
    {
      name: "adb_push",
      description: "Push a file or directory from the host to the Android device",
      inputSchema: {
        type: "object",
        properties: {
          local: { type: "string", description: "Source path on the host" },
          remote: { type: "string", description: "Destination path on the Android device" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: ["local", "remote"],
      },
    },
    {
      name: "adb_list_packages",
      description: "List installed app packages on the Android device",
      inputSchema: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Optional substring filter (e.g. 'ebay')" },
          device: { type: "string", description: "Device serial (optional)" },
        },
        required: [],
      },
    },
  ],
}));

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name } = request.params;
  const args = getArgs(request.params.arguments);
  const serial = typeof args["device"] === "string" ? args["device"].trim() : "";
  const ds = serial ? `-s ${serial}` : "";

  try {
    switch (name) {

      case "adb_devices": {
        const output = adb("devices -l");
        return { content: [{ type: "text", text: output }] };
      }

      case "adb_screenshot": {
        const b64 = captureScreenshot(serial);
        return {
          content: [
            { type: "text", text: "Screenshot captured." },
            { type: "image", data: b64, mimeType: "image/png" },
          ],
        };
      }

      case "adb_tap": {
        const x = Number(args["x"]);
        const y = Number(args["y"]);
        if (isNaN(x) || isNaN(y)) throw new Error("x and y must be numbers");
        adb(`${ds} shell input tap ${x} ${y}`);
        return { content: [{ type: "text", text: `Tapped (${x}, ${y})` }] };
      }

      case "adb_swipe": {
        const x1 = Number(args["x1"]);
        const y1 = Number(args["y1"]);
        const x2 = Number(args["x2"]);
        const y2 = Number(args["y2"]);
        const duration = args["duration"] !== undefined ? Number(args["duration"]) : 300;
        if ([x1, y1, x2, y2].some(isNaN)) throw new Error("x1, y1, x2, y2 must be numbers");
        adb(`${ds} shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
        return { content: [{ type: "text", text: `Swiped (${x1},${y1}) → (${x2},${y2}) ${duration}ms` }] };
      }

      case "adb_type": {
        const text = String(args["text"] ?? "");
        if (!text) throw new Error("text must be a non-empty string");
        // ADB input text: spaces must be encoded as %s
        const escaped = text.replace(/ /g, "%s");
        adb(`${ds} shell input text "${escaped}"`);
        return { content: [{ type: "text", text: `Typed: ${text}` }] };
      }

      case "adb_key": {
        const keycode = String(args["keycode"] ?? "").trim();
        if (!keycode) throw new Error("keycode is required");
        adb(`${ds} shell input keyevent ${keycode}`);
        return { content: [{ type: "text", text: `Sent keyevent: ${keycode}` }] };
      }

      case "adb_launch_app": {
        const pkg = String(args["package"] ?? "").trim();
        if (!pkg) throw new Error("package name is required");
        const activity = typeof args["activity"] === "string" ? args["activity"].trim() : "";
        if (activity) {
          adb(`${ds} shell am start -n ${pkg}/${activity}`);
        } else {
          adb(`${ds} shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
        }
        return { content: [{ type: "text", text: `Launched ${pkg}${activity ? `/${activity}` : ""}` }] };
      }

      case "adb_shell": {
        const command = String(args["command"] ?? "").trim();
        if (!command) throw new Error("command is required");
        if (!isCommandAllowed(command)) {
          const base = command.split(/\s+/)[0] ?? command;
          return {
            content: [{
              type: "text",
              text: [
                `Command not allowed: "${base}"`,
                `Allowed: ${CONFIG.allowedShellCommands.join(", ")}`,
                `To extend, set ANDROID_ADB_ALLOWED_COMMANDS env var (comma-separated).`,
              ].join("\n"),
            }],
            isError: true,
          };
        }
        const output = adb(`${ds} shell ${command}`);
        return { content: [{ type: "text", text: output }] };
      }

      case "adb_pull": {
        const remote = String(args["remote"] ?? "").trim();
        const local = String(args["local"] ?? "").trim();
        if (!remote || !local) throw new Error("remote and local paths are required");
        const output = await adbAsync(`${ds} pull "${remote}" "${local}"`);
        return { content: [{ type: "text", text: output || `Pulled ${remote} → ${local}` }] };
      }

      case "adb_push": {
        const local = String(args["local"] ?? "").trim();
        const remote = String(args["remote"] ?? "").trim();
        if (!local || !remote) throw new Error("local and remote paths are required");
        const output = await adbAsync(`${ds} push "${local}" "${remote}"`);
        return { content: [{ type: "text", text: output || `Pushed ${local} → ${remote}` }] };
      }

      case "adb_list_packages": {
        const filter = typeof args["filter"] === "string" ? args["filter"].trim() : "";
        const shellCmd = filter
          ? `pm list packages | grep "${filter}"`
          : "pm list packages";
        const output = adb(`${ds} shell ${shellCmd}`);
        return { content: [{ type: "text", text: output }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `ADB error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `android-adb-mcp v0.1.0 running on stdio\n` +
    `ADB: ${CONFIG.adbHost}:${CONFIG.adbPort}\n` +
    `Allowed shell commands: ${CONFIG.allowedShellCommands.join(", ")}\n`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${msg}\n`);
  process.exit(1);
});
