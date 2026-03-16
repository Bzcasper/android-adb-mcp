# Manual Testing Guide

Since setting up a full Android emulator requires multi-GB downloads, here are alternative ways to test the MCP server.

## Option 1: Test with Physical Device

1. **Enable USB Debugging:**
   - Go to Settings > About Phone > Tap "Build Number" 7 times
   - Go to Settings > Developer Options > Enable USB Debugging

2. **Connect and Test:**
   ```bash
   # Plug in device via USB
   adb devices  # Should show your device

   # Start the MCP server in one terminal
   android-adb-mcp &

   # In another terminal, test with claude or use the test script
   node test/manual-test.mjs
   ```

## Option 2: Use Genymotion Cloud (Recommended)

Genymotion Cloud provides Android devices in the cloud. Setup is automated:

### Automated Setup
```bash
# Using the provided API key (replace with your actual key)
export GENYMOTION_API_KEY="your_api_key_here"
npm run setup:genymotion -- --apiKey "$GENYMOTION_API_KEY"
```

### Manual Setup
1. Get API key from [Genymotion Cloud API](https://www.genymotion.com/enterprise/api/)
2. Set environment variable: `export GENYMOTION_API_KEY="your_key"`
3. Run: `npm run setup:genymotion`
4. The script will:
   - Create a Genymotion Cloud device
   - Start the device
   - Connect ADB to it
   - Test the MCP server

### Other Cloud Services
- [BrowserStack App Live](https://www.browserstack.com/app-automate)
- [AWS Device Farm](https://aws.amazon.com/device-farm/)

## Option 3: Manual MCP Protocol Testing

Create `test/manual-test.mjs` to test the MCP server without Claude Code:

```javascript
import { spawn } from "child_process";

const child = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"]
});

child.stdout.on("data", (data) => {
  console.log("Server:", data.toString());
});

// Send initialize
const initMsg = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "manual-test", version: "1.0.0" }
  }
}) + "\n";

child.stdin.write(initMsg);

setTimeout(() => {
  const toolsMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + "\n";
  child.stdin.write(toolsMsg);
}, 1000);

setTimeout(() => {
  child.kill();
  console.log("Test complete");
}, 3000);
```

## Option 4: Docker Android Emulator

If you have Docker installed, you can use a pre-built Android emulator:

```bash
# Pull and run Android emulator container
docker run -d -p 6080:6080 -p 5554:5554 -p 5555:5555 budtmo/docker-android:emulator-11.0

# Access via VNC at http://localhost:6080
# Connect ADB via: adb connect localhost:5555
```

## Current Status

- ✅ Package published to npm: android-adb-mcp@0.1.0
- ✅ README improved with Claude Code reference
- ✅ Examples folder created with claude-code example
- ✅ Security: key.txt and secrets in .gitignore
- ✅ Tests: Smoke test passes
- ⏸️ Live device test: Requires device connection or emulator setup

## Next Steps

1. Connect a physical Android device via USB
2. Or set up emulator (requires Android SDK installation)
3. Run: `adb devices` to verify connection
4. Test: `android-adb-mcp &` then use Claude Code or manual test script
