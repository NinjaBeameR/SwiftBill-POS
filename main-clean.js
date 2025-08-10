const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  
  // Preload printer cache after a short delay to ensure window is fully ready
  setTimeout(preloadPrinterCache, 2000);
});

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

// ===========================
// DATA PATH HELPERS
// ===========================

const getMenuPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'storage', 'menu.json');
};

const getOrdersPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'storage', 'orders.json');
};

// Provide data path to renderer process
ipcMain.handle('get-data-path', () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'storage');
});

// ===========================
// MANUAL UPDATE SYSTEM
// ===========================

// Constant for latest release download URL
const LATEST_RELEASE_URL = 'https://github.com/NinjaBeameR/SwiftBill-POS/releases/latest/download/SwiftSetup.exe';

// Open latest release URL for manual download
ipcMain.handle('open-latest-release', async () => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(LATEST_RELEASE_URL);
    return { success: true };
  } catch (error) {
    console.error('Failed to open latest release URL:', error);
    return { success: false, error: error.message };
  }
});

// Open release page in browser
ipcMain.handle('open-release-page', async () => {
  try {
    const { shell } = require('electron');
    await shell.openExternal('https://github.com/NinjaBeameR/SwiftBill-POS/releases/latest');
    return { success: true };
  } catch (error) {
    console.error('Failed to open release page:', error);
    return { success: false, error: error.message };
  }
});

// ===========================
// MENU MANAGEMENT IPC HANDLERS  
// ===========================

// Get menu data
ipcMain.handle('get-menu', async () => {
  try {
    const menuPath = getMenuPath();
    if (fs.existsSync(menuPath)) {
      const menuData = fs.readFileSync(menuPath, 'utf8');
      return JSON.parse(menuData);
    }
    return { categories: [], items: [] };
  } catch (error) {
    console.error('Error reading menu:', error);
    return { categories: [], items: [] };
  }
});

// Save menu data
ipcMain.handle('save-menu', async (event, menuData) => {
  try {
    const menuPath = getMenuPath();
    fs.writeFileSync(menuPath, JSON.stringify(menuData, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving menu:', error);
    return { success: false, error: error.message };
  }
});

// Get orders data
ipcMain.handle('get-orders', async () => {
  try {
    const ordersPath = getOrdersPath();
    if (fs.existsSync(ordersPath)) {
      const ordersData = fs.readFileSync(ordersPath, 'utf8');
      return JSON.parse(ordersData);
    }
    return { orders: [] };
  } catch (error) {
    console.error('Error reading orders:', error);
    return { orders: [] };
  }
});

// Save orders data
ipcMain.handle('save-orders', async (event, ordersData) => {
  try {
    const ordersPath = getOrdersPath();
    fs.writeFileSync(ordersPath, JSON.stringify(ordersData, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving orders:', error);
    return { success: false, error: error.message };
  }
});

// ===========================
// PRINTING SYSTEM IPC HANDLERS
// ===========================

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
