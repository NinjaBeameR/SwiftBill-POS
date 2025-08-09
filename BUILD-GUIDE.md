# Udupi Restaurant POS - Windows Executable Build Guide

## 🎯 Overview
This guide helps you convert your Udupi Restaurant POS application into a standalone Windows .exe file that can be distributed to restaurants without requiring Node.js or Electron installation.

## 🚀 Quick Build Process

### Option 1: One-Click Build (Recommended)
Simply double-click one of these files:
- **`build-exe.bat`** - For Command Prompt users
- **`build-exe.ps1`** - For PowerShell users

### Option 2: Manual Build
Open terminal in the project folder and run:
```bash
npm install
npm run dist
```

## 📦 What You'll Get

After building, you'll find these files in the `dist` folder:

### 1. Portable Version (Recommended for Restaurants)
- **File**: `Udupi-POS-Portable-1.0.0.exe`
- **Size**: ~150-200 MB
- **Usage**: Single file that runs anywhere
- **Benefits**: 
  - No installation needed
  - Can run from USB drive
  - Perfect for restaurant deployment
  - Just copy and run!

### 2. Installer Version
- **File**: `Udupi Restaurant POS Setup 1.0.0.exe`
- **Size**: ~120-150 MB
- **Usage**: Traditional Windows installer
- **Benefits**:
  - Creates desktop shortcuts
  - Proper Windows installation
  - Start menu integration
  - Automatic updates (if needed)

## 🏪 Restaurant Deployment

### For Single Restaurant
1. Build the portable version
2. Copy `Udupi-POS-Portable-1.0.0.exe` to restaurant computer
3. Run the .exe file - that's it!

### For Multiple Restaurants
1. Each restaurant gets their own copy of the .exe
2. Data is stored separately for each restaurant
3. Menu can be customized per location

## 💾 Data Management

### Menu Data
- **Location**: Stored in Windows user data folder
- **Backup**: Menu is automatically backed up during build
- **Customization**: Each restaurant can modify their menu
- **Safety**: Original menu.json is preserved

### Orders & Billing Data
- **Storage**: Uses browser localStorage (reliable & fast)
- **Persistence**: Data survives app restarts
- **Location**: Stored per Windows user account
- **Backup**: Can be exported if needed

### First Run Setup
When the .exe runs for the first time:
1. Creates data folders automatically
2. Copies default menu from your development version
3. Sets up empty orders database
4. Ready to use immediately!

## 🖨️ Printer Compatibility

### Automatic Detection
- Detects all connected printers
- Prioritizes thermal printers (TVS, Epson, etc.)
- Falls back to regular printers if needed
- No configuration required

### Thermal Printer Optimization
- **Font**: Uses Courier New for perfect thermal printing
- **Size**: Optimized for 80mm and 58mm thermal paper
- **Clarity**: Bold fonts for clear printing
- **Speed**: Instant printing without dialogs

### Supported Printers
- ✅ TVS RP 3200 Plus (your current printer)
- ✅ Epson thermal printers
- ✅ Any Windows-compatible printer
- ✅ Network printers
- ✅ USB thermal printers

## ⚡ Features Preserved

### All Current Functionality
- ✅ Table & Counter billing
- ✅ Menu management
- ✅ Order tracking
- ✅ Keyboard shortcuts
- ✅ Print preview
- ✅ Earnings view
- ✅ Settings management

### Performance
- ✅ Same speed as development version
- ✅ Instant printer detection
- ✅ Fast billing operations
- ✅ Responsive UI

### Security
- ✅ Data stored locally (no internet required)
- ✅ No external dependencies
- ✅ Works offline completely

## 🔧 Customization After Build

### Restaurant Information
The restaurant can modify:
- Restaurant name & address
- Contact details
- GSTIN & FSSAI numbers
- Menu items & prices

### Settings
- Parcel charges
- Tax rates
- Printer preferences
- Display settings

## 📋 System Requirements

### Minimum Requirements
- Windows 7 or later
- 2 GB RAM
- 500 MB disk space
- Any printer (thermal recommended)

### Recommended
- Windows 10 or later
- 4 GB RAM
- Thermal printer (TVS RP 3200 Plus)
- USB or network connection

## 🚨 Troubleshooting

### Build Issues
```bash
# If build fails, try:
npm cache clean --force
npm install
npm run dist
```

### Printer Issues
- Ensure printer is connected and powered on
- Check Windows printer settings
- App will auto-detect most printers

### Data Issues
- Data is stored in: `%APPDATA%/udupi-pos/storage/`
- To reset: Delete the storage folder
- To backup: Copy the storage folder

## 📞 Support

If you encounter any issues:
1. Check this README first
2. Ensure printer is properly connected
3. Try running as administrator if needed
4. Check Windows printer settings

## 🎉 Ready for Restaurant!

Your POS system is now ready for deployment:
- ✅ Standalone executable
- ✅ No installation dependencies
- ✅ Printer auto-detection
- ✅ Data preservation
- ✅ All features working
- ✅ Professional deployment ready

Just copy the .exe file to the restaurant computer and run it!
