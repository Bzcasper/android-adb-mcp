# Security Policy

## Supported Versions

Only the latest version of android-adb-mcp is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in android-adb-mcp, please report it privately via email to [robertmcasper@gmail.com](mailto:robertmcasper@gmail.com).

**Please do NOT report security vulnerabilities publicly on GitHub issues.**

### What to Include

- A detailed description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Suggested fix (if any)

### Response Time

We will acknowledge receipt of your report within 48 hours and provide an estimated timeline for a fix.

## Security Features

### Allowlisted Shell Execution
android-adb-mcp uses an explicit allowlist for shell commands to prevent arbitrary code execution. Only pre-approved commands can be run on the connected Android device.

**Default allowed commands:**
- `ls`, `cat`, `echo`, `pwd`, `whoami`, `date`
- `pm`, `am`, `dumpsys`, `getprop`, `setprop`
- `input`, `screencap`, `screenrecord`, `monkey`
- `logcat`, `ps`, `top`, `df`, `du`, `find`

### Environment Variable Configuration
Extend the allowlist via environment variable:
```bash
ANDROID_ADB_ALLOWED_COMMANDS="ls,cat,echo,curl,wget" android-adb-mcp
```

## Best Practices

When using android-adb-mcp:
1. Only connect to trusted Android devices
2. Use ADB over USB for local development (more secure than network)
3. Restrict the allowlist to only necessary commands
4. Regularly update to the latest version
5. Monitor device logs for suspicious activity

## Contact

For security inquiries: [robertmcasper@gmail.com](mailto:robertmcasper@gmail.com)
