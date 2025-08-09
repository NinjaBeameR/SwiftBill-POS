const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Auto-update state management
let updateState = {
  isChecking: false,
  updateAvailable: false,
  updateDownloaded: false,
  updateInfo: null,
  downloadProgress: 0,
  dismissedVersions: new Set() // Track dismissed update versions
};

// Ensure data directories exist in production
const ensureDataDirectories = () => {
  const userDataPath = app.getPath('userData');
  const appDataPath = path.join(userDataPath, 'storage');
  
  // Create storage directory if it doesn't exist
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
    
    // Copy default data files from app resources
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
    const defaultStoragePath = path.join(__dirname, 'src', 'storage');
    
    // Copy menu.json if it doesn't exist in user data
    const defaultMenuPath = path.join(defaultStoragePath, 'menu.json');
    const userMenuPath = path.join(appDataPath, 'menu.json');
    
    if (fs.existsSync(defaultMenuPath) && !fs.existsSync(userMenuPath)) {
      fs.copyFileSync(defaultMenuPath, userMenuPath);
      console.log('Copied default menu.json to user data directory');
    }
    
    // Create empty orders.json if it doesn't exist
    const userOrdersPath = path.join(appDataPath, 'orders.json');
    if (!fs.existsSync(userOrdersPath)) {
      fs.writeFileSync(userOrdersPath, '[]', 'utf8');
      console.log('Created empty orders.json in user data directory');
    }
  }
  
  return appDataPath;
};

const createWindow = () => {
  // Ensure data directories exist before creating window
  const dataPath = ensureDataDirectories();
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: true
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'), // Will fallback gracefully if not found
    title: 'SwiftBill-POS'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Set Content Security Policy via session
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\'; object-src \'none\'; base-uri \'self\'; form-action \'self\';']
      }
    });
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development for debugging
    if (!app.isPackaged || process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
      console.log('AutoUpdater: DevTools opened for debugging');
    }
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished initialization
// Moved to preload section above

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Provide data path to renderer process
ipcMain.handle('get-data-path', () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'storage');
});

// IPC handlers for silent printing functionality
ipcMain.handle('silent-print-kot', async (event, kotContent) => {
  try {
    // Create a hidden window for printing KOT
    const printWindow = new BrowserWindow({
      width: 300,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: false
      }
    });

    // Load the KOT content
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(kotContent)}`);
    
    // Wait for content to load then print silently
    await new Promise((resolve, reject) => {
      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          margins: {
            marginType: 'none'
          },
          pageSize: {
            width: 80000, // 80mm in micrometers
            height: 200000 // Auto height
          }
        }, (success, failureReason) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            reject(new Error(failureReason || 'Print failed'));
          }
        });
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Silent KOT print error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('silent-print-bill', async (event, billContent) => {
  try {
    // Create a hidden window for printing Bill
    const printWindow = new BrowserWindow({
      width: 300,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: false
      }
    });

    // Load the bill content
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(billContent)}`);
    
    // Wait for content to load then print silently
    await new Promise((resolve, reject) => {
      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          margins: {
            marginType: 'none'
          },
          pageSize: {
            width: 80000, // 80mm in micrometers
            height: 200000 // Auto height
          }
        }, (success, failureReason) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            reject(new Error(failureReason || 'Print failed'));
          }
        });
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Silent bill print error:', error);
    return { success: false, error: error.message };
  }
});

// Check if default printer is available and get detailed printer info
ipcMain.handle('check-printer-status', async () => {
  try {
    // Ensure mainWindow exists and is ready
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window is not available');
    }

    // Wait for webContents to be ready
    if (!mainWindow.webContents) {
      throw new Error('WebContents is not available');
    }

    // Use the modern async API if available, fallback to sync
    let printers;
    if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
      printers = await mainWindow.webContents.getPrintersAsync();
    } else if (typeof mainWindow.webContents.getPrinters === 'function') {
      printers = mainWindow.webContents.getPrinters();
    } else {
      console.warn('Printer API not available in this Electron version');
      return { 
        available: false, 
        error: 'Printer detection not supported in this Electron version',
        printerCount: 0,
        printers: [],
        fallbackToPreview: true
      };
    }

    const defaultPrinter = printers.find(printer => printer.isDefault);
    
    console.log('Available printers:', printers.map(p => ({ name: p.name, isDefault: p.isDefault, status: p.status })));
    
    // Enhanced printer availability check - consider more status codes as available
    const hasAvailablePrinter = printers.some(printer => 
      printer.status === 0 || // PRINTER_STATUS_IDLE
      printer.status === 1 || // PRINTER_STATUS_PRINTING  
      printer.status === 2 || // PRINTER_STATUS_PROCESSING
      printer.status === 3    // PRINTER_STATUS_PAUSED (still usable)
    );
    
    // If no available printer based on status, but we have printers, assume at least one is available
    const finalAvailability = hasAvailablePrinter || (printers.length > 0);
    
    return {
      available: finalAvailability,
      defaultPrinter: defaultPrinter ? defaultPrinter.name : (printers.length > 0 ? printers[0].name : null),
      printerCount: printers.length,
      printers: printers.map(p => ({
        name: p.name,
        isDefault: p.isDefault,
        status: p.status,
        description: p.description
      })),
      fallbackToPreview: !finalAvailability
    };
  } catch (error) {
    console.error('Printer check error:', error);
    return { 
      available: false, 
      error: error.message,
      printerCount: 0,
      printers: [],
      fallbackToPreview: true
    };
  }
});

// Cache printer for instant printing (avoids repeated detection delays)
let cachedPrinter = null;
let printerCacheTime = 0;
const PRINTER_CACHE_DURATION = 60000; // Cache for 1 minute

// SPEED OPTIMIZATION: Preload printer cache on app startup
const preloadPrinterCache = async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
      return;
    }

    console.log('🚀 Preloading printer cache for instant printing...');
    
    const printers = mainWindow.webContents.getPrinters ? 
      mainWindow.webContents.getPrinters() : 
      await mainWindow.webContents.getPrintersAsync();
    
    if (printers && printers.length > 0) {
      const defaultPrinter = printers.find(p => p.isDefault);
      const thermalPrinter = printers.find(p => {
        const name = p.name.toLowerCase();
        return name.includes('thermal') || name.includes('pos') || name.includes('plus') || name.includes('u)');
      });
      
      cachedPrinter = defaultPrinter || thermalPrinter || printers[0];
      printerCacheTime = Date.now();
      
      console.log(`✅ Printer cached for instant printing: ${cachedPrinter.name}`);
    }
  } catch (error) {
    console.log('⚠️ Printer preload failed (will cache on first print):', error.message);
  }
};

// Call preload after window is ready
app.whenReady().then(() => {
  createWindow();
  
  // Initialize auto-update system after window is created
  initializeAutoUpdater();
  
  // Preload printer cache after a short delay to ensure window is fully ready
  setTimeout(preloadPrinterCache, 2000);
});

// ===========================
// AUTO-UPDATE SYSTEM - BRAND NEW IMPLEMENTATION
// ===========================

function initializeAutoUpdater() {
  // Configure autoUpdater for GitHub releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'NinjaBeameR',
    repo: 'SwiftBill-POS'
  });

  // Configure update behavior
  autoUpdater.autoDownload = false; // Manual control over download
  autoUpdater.autoInstallOnAppQuit = false; // Manual control over install
  autoUpdater.allowPrerelease = false;

  // Force dev update config for development testing
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    console.log('AutoUpdater: Enabling dev update config for testing');
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.allowDowngrade = true;
  }

  console.log('AutoUpdater: Configured for GitHub releases');
  console.log('AutoUpdater: App version:', app.getVersion());
  console.log('AutoUpdater: App packaged:', app.isPackaged);
  console.log('AutoUpdater: Environment:', process.env.NODE_ENV || 'production');

  // Set up all autoUpdater event listeners
  setupAutoUpdaterListeners();

  // Start checking for updates automatically (3 seconds after app start)
  setTimeout(() => {
    console.log('AutoUpdater: Starting automatic update check...');
    checkForUpdatesAutomatically();
  }, 3000);
}

function setupAutoUpdaterListeners() {
  // Event: Starting to check for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('AutoUpdater: Checking for updates...');
    console.log('AutoUpdater: Feed URL configured:', autoUpdater.getFeedURL());
    updateState.isChecking = true;
    notifyRenderer('checking-for-update');
  });

  // Event: Update is available
  autoUpdater.on('update-available', (info) => {
    console.log('AutoUpdater: Update available!');
    console.log('AutoUpdater: Current version:', app.getVersion());
    console.log('AutoUpdater: Available version:', info.version);
    console.log('AutoUpdater: Update info:', JSON.stringify(info, null, 2));
    
    updateState.isChecking = false;
    updateState.updateAvailable = true;
    updateState.updateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseName: info.releaseName || `Version ${info.version}`,
      releaseNotes: info.releaseNotes || 'Bug fixes and improvements',
      releaseUrl: `https://github.com/NinjaBeameR/SwiftBill-POS/releases/tag/v${info.version}`
    };

    console.log('AutoUpdater: Checking if version was dismissed:', info.version);
    console.log('AutoUpdater: Dismissed versions:', Array.from(updateState.dismissedVersions));

    // Only show notification if this version hasn't been dismissed
    if (!updateState.dismissedVersions.has(info.version)) {
      console.log('AutoUpdater: Showing update notification for version:', info.version);
      notifyRenderer('update-available', updateState.updateInfo);
      
      // Start downloading silently
      setTimeout(() => {
        console.log('AutoUpdater: Starting silent download...');
        downloadUpdateSilently();
      }, 2000);
    } else {
      console.log('AutoUpdater: Update was previously dismissed, not showing notification');
    }
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info) => {
    console.log('AutoUpdater: No updates available');
    console.log('AutoUpdater: Current version is latest:', app.getVersion());
    if (info) {
      console.log('AutoUpdater: Latest release info:', JSON.stringify(info, null, 2));
    }
    updateState.isChecking = false;
    updateState.updateAvailable = false;
    updateState.updateInfo = null;
    notifyRenderer('update-not-available');
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    updateState.downloadProgress = Math.round(progressObj.percent);
    console.log(`AutoUpdater: Download progress: ${updateState.downloadProgress}%`);
    
    notifyRenderer('download-progress', {
      percent: updateState.downloadProgress,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  // Event: Update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info) => {
    console.log('AutoUpdater: Update downloaded successfully');
    updateState.updateDownloaded = true;
    updateState.downloadProgress = 100;
    
    notifyRenderer('update-downloaded', {
      version: info.version,
      releaseName: info.releaseName || `Version ${info.version}`
    });
  });

  // Event: Error occurred
  autoUpdater.on('error', (error) => {
    console.error('AutoUpdater: Update error occurred');
    console.error('AutoUpdater: Error message:', error.message);
    console.error('AutoUpdater: Error stack:', error.stack);
    console.error('AutoUpdater: Error details:', {
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    });
    
    updateState.isChecking = false;
    
    // Detailed error analysis
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('AutoUpdater: Network error - check internet connection');
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('AutoUpdater: GitHub API rate limit or access denied');
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      console.error('AutoUpdater: Repository or release not found');
    } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
      console.error('AutoUpdater: SSL/Certificate error');
    }
    
    // Only show error if user initiated the check, not for background checks
    if (updateState.userInitiated) {
      console.log('AutoUpdater: Notifying renderer of error (user-initiated check)');
      notifyRenderer('update-error', {
        message: error.message || 'Update check failed'
      });
    } else {
      console.log('AutoUpdater: Background check failed, not showing error to user');
    }
    updateState.userInitiated = false;
  });
}

function checkForUpdatesAutomatically() {
  if (updateState.isChecking) {
    console.log('AutoUpdater: Update check already in progress, skipping...');
    return;
  }
  
  try {
    console.log('AutoUpdater: Starting automatic update check');
    console.log('AutoUpdater: Current app version:', app.getVersion());
    console.log('AutoUpdater: Update feed URL:', 'https://api.github.com/repos/NinjaBeameR/SwiftBill-POS/releases/latest');
    
    updateState.userInitiated = false; // This is an automatic check
    
    // Force update check even in development
    if (!app.isPackaged) {
      console.log('AutoUpdater: Development mode - attempting update check anyway...');
    }
    
    autoUpdater.checkForUpdates();
    console.log('AutoUpdater: Update check initiated successfully');
  } catch (error) {
    console.error('AutoUpdater: Failed to check for updates:', error);
    console.error('AutoUpdater: Error details:', {
      message: error.message,
      stack: error.stack,
      isPackaged: app.isPackaged,
      version: app.getVersion()
    });
  }
}

function downloadUpdateSilently() {
  if (updateState.updateDownloaded || !updateState.updateAvailable) return;
  
  try {
    console.log('AutoUpdater: Starting silent download...');
    autoUpdater.downloadUpdate().catch(error => {
      console.error('AutoUpdater: Download promise rejected:', error);
      // Handle the error but don't let it become unhandled
    });
  } catch (error) {
    console.error('AutoUpdater: Failed to download update:', error);
  }
}

function notifyRenderer(event, data = {}) {
  console.log('AutoUpdater: Notifying renderer process');
  console.log('AutoUpdater: Event:', event);
  console.log('AutoUpdater: Data:', JSON.stringify(data, null, 2));
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('AutoUpdater: Main window available, sending IPC message');
    mainWindow.webContents.send('auto-update-event', { event, data });
    console.log('AutoUpdater: IPC message sent successfully');
  } else {
    console.error('AutoUpdater: Main window not available for notification');
    console.error('AutoUpdater: Window state:', {
      exists: !!mainWindow,
      destroyed: mainWindow ? mainWindow.isDestroyed() : 'N/A'
    });
  }
}

// Auto-detect printer and enable true one-click silent printing
ipcMain.handle('auto-silent-print', async (event, content, printType = 'bill') => {
  try {
    // Ensure mainWindow exists and is ready
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window is not available');
    }

    if (!mainWindow.webContents) {
      throw new Error('WebContents is not available');
    }

    let targetPrinter = null;
    const currentTime = Date.now();

    // SPEED OPTIMIZATION: Use cached printer if available and recent
    if (cachedPrinter && (currentTime - printerCacheTime) < PRINTER_CACHE_DURATION) {
      targetPrinter = cachedPrinter;
      console.log(`⚡ Using cached printer for instant print: ${targetPrinter.name}`);
    } else {
      // Only do printer detection when cache is expired
      console.log('🔍 Refreshing printer cache...');
      
      // Use faster synchronous API when available
      let printers;
      if (typeof mainWindow.webContents.getPrinters === 'function') {
        printers = mainWindow.webContents.getPrinters();
      } else if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
        printers = await mainWindow.webContents.getPrintersAsync();
      } else {
        console.warn('Printer API not available - using preview mode');
        return { 
          success: false, 
          error: 'No printer detected. Using print preview mode.',
          fallbackToPreview: true,
          usePreviewMode: true
        };
      }
      
      if (!printers || printers.length === 0) {
        console.log('No printers found on system - using preview mode');
        return { 
          success: false, 
          error: 'No printer found. Please connect a printer or use print preview.',
          fallbackToPreview: true,
          usePreviewMode: true
        };
      }

      // SPEED OPTIMIZATION: Simplified printer selection - prefer default, then thermal, then first available
      const defaultPrinter = printers.find(printer => printer.isDefault);
      if (defaultPrinter) {
        targetPrinter = defaultPrinter;
      } else {
        // Quick thermal printer detection by name patterns (reduced complexity)
        const thermalPrinter = printers.find(printer => {
          const name = printer.name.toLowerCase();
          return name.includes('thermal') || name.includes('pos') || name.includes('receipt') ||
                 name.includes('tm-') || name.includes('rp-') || name.includes('plus') || name.includes('u)');
        });
        targetPrinter = thermalPrinter || printers[0];
      }

      if (!targetPrinter) {
        throw new Error('No printer found. Please check connection.');
      }

      // Cache the selected printer for future instant use
      cachedPrinter = targetPrinter;
      printerCacheTime = currentTime;
      console.log(`📌 Cached printer: ${targetPrinter.name} for instant future prints`);
    }

    console.log(`⚡ Instant printing ${printType} to: ${targetPrinter.name}`);

    // SPEED OPTIMIZATION: Skip connectivity tests - proceed directly to print

    // SPEED OPTIMIZATION: Create optimized print window instantly (minimal config)
    const printWindow = new BrowserWindow({
      width: 288, // 80mm = ~288px at 96 DPI
      height: 1200, // Extended height for longer bills  
      show: false, // Always hidden for silent printing
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        offscreen: true, // Better for background printing
        backgroundThrottling: false // Prevent throttling for instant response
      }
    });

    return new Promise(async (resolve, reject) => {
      let timeoutId;
      let isCompleted = false;

      // Cleanup function
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
      };

      // Completion handler
      const complete = (success, result = null, error = null) => {
        if (isCompleted) return;
        isCompleted = true;
        cleanup();
        
        if (success) {
          resolve(result);
        } else {
          reject(error);
        }
      };

      // SIZING OPTIMIZATION: Fixed 80mm width with extended height for thermal printers
      const printerName = targetPrinter.name.toLowerCase();
      let paperWidth = 288000; // Default to 80mm (288000 micrometers)
      
      // Quick 58mm detection (keep for compatibility)
      if (printerName.includes('58') || printerName.includes('tm-t20') || printerName.includes('rp58')) {
        paperWidth = 204000; // 58mm width
        console.log('⚡ 58mm printer detected - 204000 micrometers width');
      } else {
        console.log('⚡ 80mm printer - using 288000 micrometers width');
      }

      // OPTIMIZED print settings for instant thermal printing with proper sizing
      const printOptions = {
        silent: true, // Never show dialog
        printBackground: true, // Include all styling
        deviceName: targetPrinter.name.trim(), // Exact printer name
        margins: {
          marginType: 'none' // Zero margins for thermal paper
        },
        pageSize: {
          width: paperWidth, // Correct width based on printer
          height: 800000 // SIZING FIX: Extended height (800000 micrometers = ~285mm) for long bills
        },
        scaleFactor: 100, // No scaling
        dpi: {
          horizontal: 203, // Standard thermal DPI
          vertical: 203
        },
        copies: 1,
        landscape: false,
        color: false, // Thermal printers are B&W
        headerFooter: false,
        shouldPrintBackgrounds: true,
        preferCSSPageSize: false, // Use our pageSize for better control
        printSelectionOnly: false
      };

      console.log(`⚡ Instant print configured: ${targetPrinter.name} | ${printOptions.pageSize.width} x ${printOptions.pageSize.height} micrometers`);

      // SPEED OPTIMIZATION: Minimal delay for instant response
      printWindow.webContents.once('did-finish-load', () => {
        // INSTANT PRINT: Reduced delay to absolute minimum (100ms for rendering)
        setTimeout(() => {
          if (isCompleted) return;
          
          try {
            printWindow.webContents.print(printOptions, (success, failureReason) => {
              if (success) {
                console.log(`⚡✅ ${printType} printed instantly to ${targetPrinter.name}`);
                complete(true, { 
                  success: true, 
                  printer: targetPrinter.name,
                  message: `Instant print to ${targetPrinter.name}`,
                  cached: cachedPrinter === targetPrinter
                });
              } else {
                const errorMsg = failureReason || 'Print operation failed';
                console.error(`❌ Instant print failed:`, errorMsg);
                
                // MINIMAL fallback - basic error logging
                console.log('🔄 Silent print failed, logging error...');
                complete(false, null, new Error(`Instant print failed: ${errorMsg}`));
              }
            });
          } catch (printError) {
            console.error('❌ Print execution error:', printError.message);
            complete(false, null, new Error(`Print execution failed: ${printError.message}`));
          }
        }, 100); // SPEED FIX: Minimal 100ms delay instead of 800ms
      });

      // Handle load failures with quick response
      printWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('❌ Print content load failed:', errorCode, errorDescription);
        complete(false, null, new Error(`Failed to load print content: ${errorDescription}`));
      });

      // SPEED OPTIMIZATION: Reduced timeout for faster feedback
      timeoutId = setTimeout(() => {
        console.log(`⚡ Print operation timed out after 5 seconds for ${printType}`);
        complete(false, null, new Error('Print timed out - printer may be busy'));
      }, 5000); // Reduced from 10s to 5s for faster feedback

      // INSTANT LOADING: Load content immediately
      try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
      } catch (loadError) {
        console.error('❌ URL load error:', loadError);
        complete(false, null, new Error(`Failed to load print content: ${loadError.message}`));
      }
    });

  } catch (error) {
    console.error(`⚡❌ Instant print ${printType} error:`, error);
    
    // SPEED OPTIMIZATION: Quick error classification for instant feedback
    let userMessage = 'Print failed - please try again';
    if (error.message.includes('No printer found')) {
      userMessage = 'No printer found - check connection';
    } else if (error.message.includes('timed out')) {
      userMessage = 'Print timed out - printer may be busy';
    }
    
    return { 
      success: false, 
      error: userMessage,
      fallbackToPreview: true,
      originalError: error.message,
      instantPrint: true // Flag to indicate this was an instant print attempt
    };
  }
});

// Enhanced silent printing with better error handling and printer selection (kept for compatibility)
ipcMain.handle('enhanced-silent-print', async (event, content, printType = 'bill') => {
  // Redirect to new auto-silent-print for better reliability
  return await ipcMain.invoke('auto-silent-print', event, content, printType);
});

// Get list of available printers (separate handler for better error isolation)
ipcMain.handle('get-printers', async () => {
  try {
    // Ensure mainWindow exists and is ready
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window is not available');
    }

    if (!mainWindow.webContents) {
      throw new Error('WebContents is not available');
    }

    // Use the modern async API if available, fallback to sync
    let printers;
    if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
      printers = await mainWindow.webContents.getPrintersAsync();
    } else if (typeof mainWindow.webContents.getPrinters === 'function') {
      printers = mainWindow.webContents.getPrinters();
    } else {
      throw new Error('Printer detection not supported in this Electron version');
    }
    
    console.log('Retrieved printer list:', printers.length, 'printers found');
    
    return {
      success: true,
      printers: printers.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status,
        isDefault: p.isDefault || false,
        options: p.options || {}
      }))
    };
  } catch (error) {
    console.error('Get printers error:', error);
    return { 
      success: false, 
      error: error.message,
      printers: []
    };
  }
});

// Test printer connection and capabilities
ipcMain.handle('test-printer-connection', async (event, printerName) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window is not available');
    }

    // Use the modern async API if available, fallback to sync
    let printers;
    if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
      printers = await mainWindow.webContents.getPrintersAsync();
    } else if (typeof mainWindow.webContents.getPrinters === 'function') {
      printers = mainWindow.webContents.getPrinters();
    } else {
      throw new Error('Printer detection not supported in this Electron version');
    }

    const targetPrinter = printers.find(p => p.name === printerName);
    
    if (!targetPrinter) {
      throw new Error(`Printer "${printerName}" not found`);
    }

    // Check if printer is in a usable state
    const isUsable = targetPrinter.status === 0 || 
                    targetPrinter.status === 1 || 
                    targetPrinter.status === 2;

    return {
      success: true,
      printer: {
        name: targetPrinter.name,
        status: targetPrinter.status,
        isUsable: isUsable,
        isDefault: targetPrinter.isDefault
      }
    };
  } catch (error) {
    console.error('Test printer connection error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Note: Print functionality now handled directly in renderer process using window.print()
// This provides better compatibility with thermal printers and system print drivers

// ===========================
// AUTO-UPDATE IPC HANDLERS
// ===========================

// Manual check for updates (user-initiated)
ipcMain.handle('check-for-updates', async () => {
  if (updateState.isChecking) {
    return { success: false, error: 'Update check already in progress' };
  }
  
  try {
    updateState.userInitiated = true; // This is a user-initiated check
    autoUpdater.checkForUpdates();
    return { success: true, message: 'Checking for updates...' };
  } catch (error) {
    console.error('AutoUpdater: Manual check failed:', error);
    return { success: false, error: error.message };
  }
});

// Download update (user-initiated)
ipcMain.handle('download-update', async () => {
  if (!updateState.updateAvailable) {
    return { success: false, error: 'No update available to download' };
  }
  
  if (updateState.updateDownloaded) {
    return { success: true, message: 'Update already downloaded', alreadyDownloaded: true };
  }
  
  try {
    autoUpdater.downloadUpdate();
    return { success: true, message: 'Download started...' };
  } catch (error) {
    console.error('AutoUpdater: Download failed:', error);
    return { success: false, error: error.message };
  }
});

// Install update and restart app
ipcMain.handle('install-update', async () => {
  if (!updateState.updateDownloaded) {
    return { success: false, error: 'No update downloaded to install' };
  }
  
  try {
    // Notify renderer that restart is happening
    notifyRenderer('app-restarting');
    
    // Small delay to ensure message is sent
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 1000);
    
    return { success: true, message: 'Restarting to install update...' };
  } catch (error) {
    console.error('AutoUpdater: Install failed:', error);
    return { success: false, error: error.message };
  }
});

// Get current update status
ipcMain.handle('get-update-status', () => {
  return {
    isChecking: updateState.isChecking,
    updateAvailable: updateState.updateAvailable,
    updateDownloaded: updateState.updateDownloaded,
    updateInfo: updateState.updateInfo,
    downloadProgress: updateState.downloadProgress
  };
});

// Dismiss update notification (user clicked "Later")
ipcMain.handle('dismiss-update', (event, version) => {
  if (version) {
    updateState.dismissedVersions.add(version);
    console.log('AutoUpdater: Update dismissed:', version);
    return { success: true };
  }
  return { success: false, error: 'No version specified' };
});

// Open release URL in external browser
ipcMain.handle('open-release-url', async (event, url) => {
  if (!url) return { success: false, error: 'No URL provided' };
  
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('AutoUpdater: Failed to open URL:', error);
    return { success: false, error: error.message };
  }
});

// Test handler for development (simulate update scenarios)
ipcMain.handle('test-update-scenario', (event, scenario) => {
  try {
    if (scenario === 'update-available') {
      const mockInfo = {
        version: '1.0.3',
        releaseDate: new Date().toISOString(),
        releaseName: 'Test Version 1.0.3',
        releaseNotes: 'This is a test update for development purposes.',
        releaseUrl: 'https://github.com/NinjaBeameR/SwiftBill-POS/releases/tag/v1.0.3'
      };
      
      updateState.updateAvailable = true;
      updateState.updateInfo = mockInfo;
      notifyRenderer('update-available', mockInfo);
      
    } else if (scenario === 'no-update') {
      updateState.updateAvailable = false;
      updateState.updateInfo = null;
      notifyRenderer('update-not-available');
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
