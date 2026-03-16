#!/bin/bash
# Setup Genymotion Cloud Android device for testing android-adb-mcp

set -e

echo "🔧 Setting up Genymotion Cloud Android device..."

# Check if API key is provided
if [ -z "$GENYMOTION_API_KEY" ]; then
    echo "❌ Error: GENYMOTION_API_KEY environment variable not set"
    echo "   Get your API key from: https://www.genymotion.com/enterprise/api/"
    echo "   Then run: export GENYMOTION_API_KEY=your_api_key"
    exit 1
fi

# Install Genymotion CLI if not present
if ! command -v genymotion-cli &> /dev/null; then
    echo "📦 Installing Genymotion CLI..."
    # Download and install Genymotion CLI
    wget -q https://dl.genymotion.com/releases/genymotion-cli/genymotion-cli-3.5.2-linux_x64.tar.gz -O /tmp/genymotion-cli.tar.gz
    tar -xzf /tmp/genymotion-cli.tar.gz -C /tmp
    sudo mv /tmp/genymotion-cli /usr/local/bin/
    sudo chmod +x /usr/local/bin/genymotion-cli
fi

# Create a temporary device name
DEVICE_NAME="test-device-$(date +%s)"

echo "🚀 Creating Genymotion Cloud device: $DEVICE_NAME"

# Create device using Genymotion Cloud API
# This uses the Genymotion REST API to provision a device
curl -X POST "https://cloud.genymotion.com/api/v3/device/" \
  -H "Authorization: Bearer $GENYMOTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$DEVICE_NAME\",
    \"image\": \"google_pixel_7\",
    \"region\": \"us_west\"
  }" > /tmp/genymotion-device.json

# Extract device ID
DEVICE_ID=$(cat /tmp/genymotion-device.json | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Device created with ID: $DEVICE_ID"

# Wait for device to be ready
echo "⏳ Waiting for device to be ready..."
sleep 30

# Start the device
curl -X POST "https://cloud.genymotion.com/api/v3/device/$DEVICE_ID/start" \
  -H "Authorization: Bearer $GENYMOTION_API_KEY"

# Wait for device to boot
echo "⏳ Waiting for device to boot..."
sleep 30

# Get device IP
DEVICE_IP=$(curl -s "https://cloud.genymotion.com/api/v3/device/$DEVICE_ID" \
  -H "Authorization: Bearer $GENYMOTION_API_KEY" | grep -o '"ip":"[^"]*' | cut -d'"' -f4)

echo "📱 Device IP: $DEVICE_IP"

# Connect ADB to the device
echo "🔗 Connecting ADB to device..."
adb connect $DEVICE_IP:5555

# Verify connection
echo "✅ Verifying ADB connection..."
adb devices -l

# Test the MCP server
echo "🧪 Testing android-adb-mcp..."
cd /home/trap/projects/android-adb-mcp
npm run build
npm test

echo ""
echo "🎉 Setup complete!"
echo "   Device: $DEVICE_NAME ($DEVICE_IP)"
echo "   ADB connected: adb connect $DEVICE_IP:5555"
echo "   To start MCP server: android-adb-mcp &"
echo "   To use with Claude Code: see README.md"

# Cleanup function (optional)
echo ""
echo "💡 To clean up later:"
echo "   curl -X DELETE \"https://cloud.genymotion.com/api/v3/device/$DEVICE_ID\" \\"
echo "     -H \"Authorization: Bearer \$GENYMOTION_API_KEY\""
