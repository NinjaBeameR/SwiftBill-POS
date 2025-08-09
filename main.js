const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const UpdateManager = require('./src/utils/updateManager');

let mainWindow;
let updateManager;

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
      contextIsolation: false
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'), // Will fallback gracefully if not found
    title: 'Udupi Restaurant POS'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
        contextIsolation: false
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
        contextIsolation: false
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
  
  // Initialize update manager after window is created
  updateManager = new UpdateManager();
  updateManager.setMainWindow(mainWindow);
  
  // Preload printer cache after a short delay to ensure window is fully ready
  setTimeout(preloadPrinterCache, 2000);
});

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

// Update Manager IPC Handlers
ipcMain.handle('check-for-updates', async () => {
  if (!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }
  return await updateManager.manualCheckForUpdates();
});

ipcMain.handle('download-update', async () => {
  if (!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }
  return await updateManager.downloadUpdate();
});

ipcMain.handle('install-update', async () => {
  if (!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }
  return await updateManager.installUpdateAndRestart();
});

ipcMain.handle('get-update-status', () => {
  if (!updateManager) {
    return { updateAvailable: false, updateDownloaded: false, isChecking: false };
  }
  return updateManager.getUpdateStatus();
});

// Cleanup update manager on app quit
app.on('before-quit', () => {
  if (updateManager) {
    updateManager.destroy();
  }
});
