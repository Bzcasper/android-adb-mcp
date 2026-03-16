#!/usr/bin/env node
/**
 * Genymotion Cloud Setup for android-adb-mcp testing
 * Usage: node scripts/setup-genymotion.js --apiKey YOUR_KEY
 */

import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const apiKeyIndex = args.indexOf("--apiKey");
const apiKey = apiKeyIndex !== -1 ? args[apiKeyIndex + 1] : process.env.GENYMOTION_API_KEY;

if (!apiKey) {
  console.error("❌ Error: API key required");
  console.error("   Usage: node scripts/setup-genymotion.js --apiKey YOUR_KEY");
  console.error("   Or set GENYMOTION_API_KEY environment variable");
  process.exit(1);
}

// Store API key in .env file (git-ignored)
const envPath = join(projectRoot, ".env");
const envContent = `GENYMOTION_API_KEY=${apiKey}\n`;
writeFileSync(envPath, envContent);
console.log("✓ API key saved to .env (git-ignored)");

// Device configuration
const deviceConfig = {
  name: `test-device-${Date.now()}`,
  image: "google_pixel_7", // Popular device profile
  region: "us_west",
  apiLevel: 33 // Android 13
};

console.log(`\n🚀 Creating Genymotion Cloud device: ${deviceConfig.name}`);

// Using Genymotion Cloud API
async function setupGenymotion() {
  try {
    // Step 1: Create device
    console.log("1. Creating device...");
    const createResponse = await fetch("https://cloud.genymotion.com/api/v3/device/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: deviceConfig.name,
        image: deviceConfig.image,
        region: deviceConfig.region
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Device creation failed: ${createResponse.status} ${createResponse.statusText}`);
    }

    const deviceData = await createResponse.json();
    const deviceId = deviceData.id;
    console.log(`   ✓ Device created: ${deviceId}`);

    // Step 2: Wait for device to be ready
    console.log("2. Waiting for device to be ready...");
    await sleep(30000);

    // Step 3: Start device
    console.log("3. Starting device...");
    const startResponse = await fetch(
      `https://cloud.genymotion.com/api/v3/device/${deviceId}/start`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      }
    );

    if (!startResponse.ok) {
      throw new Error(`Failed to start device: ${startResponse.status}`);
    }

    // Step 4: Wait for boot
    console.log("4. Waiting for device to boot...");
    await sleep(45000);

    // Step 5: Get device IP
    console.log("5. Getting device IP...");
    const deviceInfoResponse = await fetch(
      `https://cloud.genymotion.com/api/v3/device/${deviceId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      }
    );

    const deviceInfo = await deviceInfoResponse.json();
    const deviceIp = deviceInfo.network?.publicIp || deviceInfo.network?.privateIp;

    if (!deviceIp) {
      throw new Error("Could not get device IP address");
    }

    console.log(`   ✓ Device IP: ${deviceIp}`);

    // Step 6: Connect ADB
    console.log("6. Connecting ADB...");
    const adbConnect = spawn("adb", ["connect", `${deviceIp}:5555`]);
    
    adbConnect.stdout.on("data", (data) => {
      console.log(`   ADB: ${data.toString().trim()}`);
    });

    adbConnect.stderr.on("data", (data) => {
      console.error(`   ADB Error: ${data.toString().trim()}`);
    });

    await new Promise((resolve) => adbConnect.on("close", resolve));

    // Step 7: Verify connection
    console.log("7. Verifying ADB connection...");
    const adbDevices = spawn("adb", ["devices", "-l"]);
    
    adbDevices.stdout.on("data", (data) => {
      console.log(`   ${data.toString().trim()}`);
    });

    await new Promise((resolve) => adbDevices.on("close", resolve));

    // Step 8: Test MCP server
    console.log("8. Testing android-adb-mcp...");
    const build = spawn("npm", ["run", "build"], { cwd: projectRoot });
    build.stdout.on("data", (data) => console.log(`   ${data.toString().trim()}`));
    await new Promise((resolve) => build.on("close", resolve));

    const test = spawn("npm", ["test"], { cwd: projectRoot });
    test.stdout.on("data", (data) => console.log(`   ${data.toString().trim()}`));
    await new Promise((resolve) => test.on("close", resolve));

    console.log("\n🎉 Setup complete!");
    console.log(`   Device: ${deviceConfig.name} (${deviceIp})`);
    console.log(`   ADB: adb connect ${deviceIp}:5555`);
    console.log(`   MCP Server: android-adb-mcp &`);
    console.log(`\n💡 Cleanup command:`);
    console.log(`   curl -X DELETE "https://cloud.genymotion.com/api/v3/device/${deviceId}" \\`);
    console.log(`     -H "Authorization: Bearer ${apiKey}"`);

  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

setupGenymotion();
