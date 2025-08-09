# Auto-Update System Documentation

## Overview
The SwiftBill-POS system now includes an automatic update feature that checks for new versions from GitHub releases and allows users to update the application seamlessly without interrupting ongoing operations.

## How It Works

### 1. Update Detection
- **Startup Check**: 30 seconds after application startup (non-blocking)
- **Periodic Checks**: Every 6 hours during idle periods
- **Manual Checks**: Users can manually check via the update system
- **Silent Operation**: No notifications if no updates are available

### 2. Update Source
- **GitHub Releases**: Updates are distributed through GitHub releases on the `SwiftBill-POS` repository
- **Semantic Versioning**: Follows semver for version numbering
- **Secure Downloads**: Downloads are verified and signed

### 3. User Experience
- **Non-Intrusive**: Blue notification bar slides down from header when update is available
- **User Control**: Users choose when to download and when to install
- **Background Downloads**: Updates download in background without interrupting work
- **Safe Installation**: Only installs when user confirms, never during active billing

### 4. UI Components

#### Update Notification Bar
- Appears below the main header when update is available
- Shows update version and provides action buttons
- Can be dismissed temporarily ("Later" button)
- Professional blue color scheme matching app design

#### Update Modal
- Detailed information about the update
- Release notes and version information
- Download progress indicator
- Install controls with clear user consent

### 5. Safety Features
- **No Auto-Install**: Never automatically installs updates
- **No Interruption**: Never interrupts ongoing orders or billing
- **Graceful Fallback**: If update system fails, POS continues normally
- **User Consent**: Requires explicit user confirmation for downloads and installation

## Technical Implementation

### Files Added/Modified
- `src/utils/updateManager.js` - Main update logic (main process)
- `src/utils/updateUIManager.js` - UI handling (renderer process)
- `package.json` - Added electron-updater dependency and publish config
- `main.js` - Integrated UpdateManager with IPC handlers
- `renderer.js` - Integrated UpdateUIManager
- `styles/main.css` - Added update UI styles

### Dependencies
- `electron-updater` - Handles GitHub releases integration and auto-updating

### IPC Communication
- `check-for-updates` - Manual update check
- `download-update` - Start update download
- `install-update` - Install downloaded update and restart
- `get-update-status` - Get current update status
- `update-event` - Events from main to renderer (update available, progress, etc.)

## Publishing Updates

### 1. Prepare Release
```bash
# Update version in package.json
npm version patch  # or minor/major

# Build for release (this will create distributable files)
npm run build
```

### 2. Create GitHub Release
```bash
# Publish to GitHub releases (requires GitHub token)
npm run release

# Or create draft release for testing
npm run release-draft
```

### 3. Release Process
1. Update version number in `package.json`
2. Commit changes with version tag
3. Run `npm run release` to build and publish to GitHub
4. The release will be automatically detected by existing app installations

## Configuration

### GitHub Repository Settings
Update the repository information in `package.json` if needed:
```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "NinjaBeameR",
        "repo": "SwiftBill-POS"
      }
    ]
  }
}
```

### Update Frequency
Modify update check intervals in `src/utils/updateManager.js`:
```javascript
this.updateCheckInterval = 6 * 60 * 60 * 1000; // 6 hours
this.initialDelayMs = 30 * 1000; // 30 seconds after startup
```

## Troubleshooting

### Common Issues
1. **Updates not detected**: Check GitHub releases and internet connection
2. **Download fails**: Check firewall and antivirus settings
3. **Install fails**: Ensure app has proper permissions

### Debug Information
Update events are logged to console with prefix `UpdateManager:` or `UpdateUIManager:`

### Disabling Updates
To disable auto-updates, comment out the update manager initialization in `main.js`:
```javascript
// updateManager = new UpdateManager();
// updateManager.setMainWindow(mainWindow);
```

## Security Considerations
- Updates are downloaded only from the configured GitHub repository
- All updates are verified before installation
- No automatic execution of updates without user consent
- Update system runs with minimal privileges

## User Guide
1. When an update is available, a blue notification appears below the header
2. Click "View Details" to see update information
3. Click "Download Now" to download in background (can continue working)
4. When download completes, click "Restart & Install" to apply update
5. Application will restart with the new version installed

The update system is designed to be completely transparent and non-disruptive to daily POS operations while keeping the application up-to-date with the latest features and security improvements.
