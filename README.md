# android-adb-mcp

> MCP server that gives AI agents (Claude Code, Goose) control over Android devices via ADB — screen capture, UI automation, app launch, file transfer, and allowlisted shell execution.

[![npm version](https://badge.fury.io/js/android-adb-mcp.svg)](https://www.npmjs.com/package/android-adb-mcp)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/Bzcasper/android-adb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Bzcasper/android-adb-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/Bzcasper/android-adb-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/Bzcasper/android-adb-mcp/actions/workflows/release.yml)

---

## Demo

<!-- Replace with your actual terminal recording — use https://asciinema.org or a GIF -->
<!-- Example: ![demo](assets/demo.gif) -->

```
$ claude
> Take a screenshot of my phone and tell me what app is open

● adb_screenshot()
  Screenshot captured.
  [image: 1080×2400 PNG]

Your phone is showing the eBay app on the listing creation screen.
The title field is empty. Would you like me to fill it in?

> Yes, type "14K Gold Vintage Ring — Size 7"

● adb_tap(x=540, y=620)
● adb_type(text="14K Gold Vintage Ring — Size 7")
● adb_screenshot()

Done — title entered and verified. Moving to the description field.
```

> **👆 Record this with a real device and drop the GIF in `assets/demo.gif`.**
> One 30-second [asciinema](https://asciinema.org) or [vhs](https://github.com/charmbracelet/vhs) recording converts more users than 1,000 words.

---

## What This Does

Claude Code can write, test, and deploy code. With `android-adb-mcp` it can also:

- 📸 Take a screenshot of a real Android device and analyze what it sees
- 👆 Tap, swipe, and type on the screen
- 🚀 Launch apps by package name
- 📁 Pull/push files between host and device
- 🔒 Run allowlisted shell commands safely

This closes the full mobile development loop — and enables real-world automation workflows that go far beyond the terminal.

---

## Quick Start

```bash
npm install -g android-adb-mcp
```

**Requirements:**
- Node.js 18+
- `adb` in PATH (`brew install android-platform-tools` / `apt install adb`)
- Android device with USB debugging enabled (or ADB over TCP)

**Verify it works:**

```bash
adb devices                # should show your device
android-adb-mcp &          # starts the MCP server on stdio
```

---

## Setup

### Claude Code

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "android": {
      "command": "android-adb-mcp",
      "env": {
        "ANDROID_ADB_HOST": "localhost",
        "ANDROID_ADB_PORT": "5037"
      }
    }
  }
}
```

### Goose

Add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  - type: stdio
    name: android-adb-mcp
    cmd: android-adb-mcp
    description: Android device control via ADB
```

### Amp

Add to `~/.amp/settings.json`:

```json
{
  "mcpServers": {
    "android": {
      "command": "android-adb-mcp"
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `adb_devices` | List connected devices |
| `adb_screenshot` | Capture screen → returns base64 PNG |
| `adb_tap` | Tap screen coordinates |
| `adb_swipe` | Swipe gesture |
| `adb_type` | Type text into focused input |
| `adb_key` | Send keyevent (BACK, HOME, etc.) |
| `adb_launch_app` | Launch app by package name |
| `adb_shell` | Run allowlisted shell command |
| `adb_pull` | Pull file from device to host |
| `adb_push` | Push file from host to device |
| `adb_list_packages` | List installed packages |

---

## Reference Implementation

The canonical use case is a **production jewelry resale automation system** powered by Claude Code where:

```
┌──────────────┐    ADB/TCP     ┌──────────────┐    MCP/stdio    ┌──────────────┐
│  Android     │◄──────────────►│  Ubuntu      │◄───────────────►│  Claude Code │
│  Phone       │                │  Laptop      │                 │  Agent       │
│              │                │              │                 │              │
│  · eBay app  │                │  · adb       │                 │  · Analyze   │
│  · Poshmark  │                │  · MCP       │                 │  · Generate  │
│  · Mercari   │                │    server    │                 │  · Automate  │
└──────────────┘                └──────────────┘                 └──────────────┘
```

1. Android phone running Termux/proot acts as the gateway device
2. ADB is port-forwarded to an Ubuntu laptop
3. Claude Code orchestrates vision analysis (Qwen3-VL-32B via Modal)
4. The agent generates listings for 8 platforms simultaneously
5. The phone interacts with resale apps directly via this MCP server

One person. One phone. One laptop. Fully automated.

→ **[See the full example](examples/claude-code/)**

---

## Security Model

Shell execution uses an **explicit allowlist** — only pre-approved commands can be run. This prevents prompt injection attacks from causing arbitrary code execution on the device.

**Default allowed:** `ls`, `cat`, `echo`, `pwd`, `pm`, `am`, `dumpsys`, `getprop`, `input`, `screencap`, `screenrecord`, `logcat`, `ps`, `top`, `find`

To extend:

```bash
ANDROID_ADB_ALLOWED_COMMANDS="ls,cat,echo,curl,wget" android-adb-mcp
```

---

## ADB over TCP (Wireless)

```bash
# On the Android device (via Termux)
adb tcpip 5555

# On the host
adb connect 192.168.1.x:5555

# Or port-forward from laptop to phone
adb -H localhost -P 5037 devices
```

Set `ANDROID_ADB_HOST` and `ANDROID_ADB_PORT` env vars to match your setup.

---

## Contributing

Issues, PRs, and use case documentation welcome.
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

Built by [Bobby Casper](https://github.com/Bzcasper) · [AIToolPool](https://aitoolpool.com)
