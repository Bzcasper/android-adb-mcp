# Claude Code + Android ADB MCP Example

This directory contains a reference implementation showing how to integrate the Android ADB MCP server with Claude Code for real-world device automation.

## Setup

1. **Install the MCP server:**
   ```bash
   npm install -g android-adb-mcp
   ```

2. **Configure Claude Code:**
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

3. **Connect your Android device:**
   - USB: Enable USB debugging in Developer Options
   - Wireless: Run `adb tcpip 5555` on device, then `adb connect <ip>:5555`

## Usage Examples

### Take a Screenshot and Analyze

```
User: What app is currently open on my phone?

Claude: [calls adb_screenshot()]
        [analyzes the returned image]

        Your phone is showing the eBay app on the listing creation screen.
        The title field is empty. Would you like me to fill it in?
```

### Complete Workflow: Create a Listing

```
User: Create a listing for the gold ring we analyzed

Claude: [calls adb_tap to focus title field]
        [calls adb_type with the listing title]
        [calls adb_screenshot to verify]
        Done — title entered. Moving to the description field.
```

### Launch and Control Apps

```
User: Open the camera app and take a picture

Claude: [calls adb_launch_app with package "com.android.camera"]
        [calls adb_key with KEYCODE_CAMERA]
        [calls adb_screenshot to verify]
```

### File Transfer

```
User: Pull the latest screenshot to my desktop

Claude: [calls adb_screenshot]
        [calls adb_pull to transfer file]
```

## Environment Variables

```bash
# ADB connection settings
ANDROID_ADB_HOST=localhost
ANDROID_ADB_PORT=5037

# Allowed shell commands (comma-separated)
ANDROID_ADB_ALLOWED_COMMANDS="ls,cat,echo,pwd,pm,am,dumpsys,getprop,input,screencap,screenrecord,logcat,ps,top,find"
```

## Complete Automation Example

This shows a full jewelry resale workflow:

1. **Analyze** current screen with vision model
2. **Generate** listing content for multiple platforms
3. **Automate** app interactions to create listings
4. **Verify** each step with screenshots

```bash
# Terminal 1: Start the MCP server
android-adb-mcp &

# Terminal 2: Start Claude Code
claude
```

Then in Claude Code:

```
> Analyze my phone screen and describe what you see

> Generate a listing for the item, including title, description, and price

> Create the listing on eBay using the app

> Take a screenshot to verify it was posted correctly
```

## Troubleshooting

- **No devices found:** Run `adb devices` to verify connection
- **Permission denied:** Ensure USB debugging is enabled on device
- **Connection refused:** Check if ADB server is running with `adb kill-server && adb start-server`
