const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

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
// ENHANCED MANUAL UPDATE SYSTEM
// ===========================

// Function to get the correct installer URL and info from GitHub API
async function getInstallerInfo() {
  const arch = process.arch;
  const platform = process.platform;
  
  console.log(`System: ${platform} ${arch}`);
  
  return new Promise((resolve, reject) => {
    // Make API request to GitHub
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/NinjaBeameR/SwiftBill-POS/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'SwiftBill-POS-Updater'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const releaseData = JSON.parse(data);
          
          // Find the SwiftSetup.exe asset
          const installerAsset = releaseData.assets.find(asset => asset.name === 'SwiftSetup.exe');
          
          if (!installerAsset) {
            throw new Error('SwiftSetup.exe not found in release assets');
          }
          
          console.log(`Found installer: ${installerAsset.name}, Size: ${installerAsset.size} bytes`);
          
          resolve({
            url: installerAsset.browser_download_url,
            size: installerAsset.size,
            name: installerAsset.name,
            version: releaseData.tag_name
          });
        } catch (parseError) {
          console.error('Error parsing GitHub API response:', parseError);
          // Fallback to direct URL construction
          resolve({
            url: 'https://github.com/NinjaBeameR/SwiftBill-POS/releases/latest/download/SwiftSetup.exe',
            size: null,
            name: 'SwiftSetup.exe',
            version: 'latest'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error fetching installer info:', error);
      // Fallback to direct URL construction
      resolve({
        url: 'https://github.com/NinjaBeameR/SwiftBill-POS/releases/latest/download/SwiftSetup.exe',
        size: null,
        name: 'SwiftSetup.exe',
        version: 'latest'
      });
    });
    
    req.end();
  });
}

// Store current download state and metadata
let currentDownload = null;

// Get current app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Check for version updates without downloading
ipcMain.handle('check-version', async () => {
  try {
    const currentVersion = app.getVersion();
    const installerInfo = await getInstallerInfo();
    
    // Clean version strings for comparison (remove 'v' prefix if present)
    const cleanCurrentVersion = currentVersion.replace(/^v/, '');
    const cleanLatestVersion = installerInfo.version.replace(/^v/, '');
    
    console.log(`Version check: Current=${cleanCurrentVersion}, Latest=${cleanLatestVersion}`);
    
    return {
      currentVersion: cleanCurrentVersion,
      latestVersion: cleanLatestVersion,
      hasUpdate: cleanCurrentVersion !== cleanLatestVersion,
      installerInfo: installerInfo
    };
  } catch (error) {
    console.error('Error checking version:', error);
    return {
      currentVersion: app.getVersion(),
      latestVersion: 'unknown',
      hasUpdate: false,
      error: error.message
    };
  }
});

// Download update installer directly in app
ipcMain.handle('download-update', async (event) => {
  try {
    const tempDir = path.join(app.getPath('temp'), 'SwiftBill-Updates');
    const timestamp = Date.now();
    const fileName = `SwiftSetup-${timestamp}.exe`;
    const filePath = path.join(tempDir, fileName);
    
    // Get installer info from GitHub API
    const installerInfo = await getInstallerInfo();
    
    console.log('Download URL:', installerInfo.url);
    console.log('Target path:', filePath);
    console.log('Expected size:', installerInfo.size, 'bytes');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Remove existing file if it exists, with better error handling
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.warn('Could not remove existing file:', unlinkError.message);
        // Generate a new unique filename if we can't remove the existing one
        const newFileName = `SwiftSetup-${timestamp}-${Math.random().toString(36).substr(2, 9)}.exe`;
        const newFilePath = path.join(tempDir, newFileName);
        return downloadFile(newFilePath, newFileName, event, installerInfo.url, installerInfo.size);
      }
    }
    
    return downloadFile(filePath, fileName, event, installerInfo.url, installerInfo.size);
    
  } catch (error) {
    console.error('Download failed:', error);
    currentDownload = null;
    return { success: false, error: error.message };
  }
});

// Helper function to handle the actual download
function downloadFile(filePath, fileName, event, installerUrl, expectedSize = null) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let totalSize = expectedSize || 0;
    let downloadedSize = 0;
    
    const request = https.get(installerUrl, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https.get(response.headers.location, handleResponse);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }
      
      handleResponse(response);
    });
      
    function handleResponse(response) {
      // Use expected size if provided, otherwise use content-length
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (!totalSize && contentLength) {
        totalSize = contentLength;
      }
      
      console.log(`Download starting - Expected: ${expectedSize}, Content-Length: ${contentLength}, Using: ${totalSize}`);
      
      response.on('data', (chunk) => {
        if (currentDownload && currentDownload.cancelled) {
          file.destroy();
          fs.unlink(filePath, () => {});
          reject(new Error('Download cancelled'));
          return;
        }
        
        downloadedSize += chunk.length;
        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
        
        // Send progress update
        event.sender.send('download-progress', {
          progress: Math.round(progress),
          downloadedSize,
          totalSize
        });
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        
        // Verify file integrity
        const actualSize = fs.statSync(filePath).size;
        console.log('Download completed. Expected size:', totalSize, 'Actual size:', actualSize);
        
        if (totalSize > 0 && actualSize !== totalSize) {
          console.error('File size mismatch. Download may be corrupt.');
          fs.unlink(filePath, () => {});
          currentDownload = null;
          reject(new Error(`File integrity check failed. Expected ${totalSize} bytes, got ${actualSize} bytes.`));
          return;
        }
        
        // Additional file validation
        if (actualSize < 1024 * 1024) { // Less than 1MB is suspicious for an installer
          console.error('Downloaded file too small to be a valid installer');
          fs.unlink(filePath, () => {});
          currentDownload = null;
          reject(new Error('Downloaded file appears to be invalid (too small)'));
          return;
        }
        
        currentDownload = null;
        resolve({ 
          success: true, 
          filePath, 
          fileName,
          fileSize: actualSize,
          expectedSize: totalSize
        });
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {});
        currentDownload = null;
        reject(err);
      });
    }
    
    request.on('error', (err) => {
      currentDownload = null;
      reject(err);
    });
    
    // Store download info for cancellation
    currentDownload = { request, cancelled: false };
  });
}

// Cancel current download
ipcMain.handle('cancel-download', async () => {
  if (currentDownload) {
    currentDownload.cancelled = true;
    if (currentDownload.request) {
      currentDownload.request.destroy();
    }
    currentDownload = null;
    return { success: true };
  }
  return { success: false };
});

// Run installer and quit app
ipcMain.handle('run-installer', async (event, filePath) => {
  try {
    console.log('Attempting to run installer:', filePath);
    
    // Verify file exists and is accessible
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Installer file not found' };
    }
    
    // Check file size and permissions
    const stats = fs.statSync(filePath);
    console.log('Installer file size:', stats.size, 'bytes');
    
    if (stats.size < 1024 * 1024) { // Less than 1MB
      return { success: false, error: 'Installer file appears to be invalid (too small)' };
    }
    
    // Try to launch installer using shell.openPath first (more reliable)
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        // openPath returned an error string
        console.error('shell.openPath failed:', result);
        throw new Error(result);
      }
      
      console.log('Installer launched successfully via shell.openPath');
      
      // Quit the app after a delay
      setTimeout(() => {
        app.quit();
      }, 1500);
      
      return { success: true, method: 'shell.openPath' };
      
    } catch (shellError) {
      console.log('shell.openPath failed, trying spawn method:', shellError.message);
      
      // Fallback to spawn method with proper Windows handling
      const installerProcess = spawn(filePath, [], { 
        detached: true, 
        stdio: 'ignore',
        shell: false, // Don't use shell to avoid cmd.exe issues
        windowsVerbatimArguments: true // Preserve arguments exactly on Windows
      });
      
      // Unref the process so it doesn't keep the app alive
      installerProcess.unref();
      
      console.log('Installer launched successfully via spawn, PID:', installerProcess.pid);
      
      // Quit the app after a delay
      setTimeout(() => {
        app.quit();
      }, 1500);
      
      return { success: true, method: 'spawn', pid: installerProcess.pid };
    }
    
  } catch (error) {
    console.error('Failed to run installer:', error);
    
    // Provide detailed error information for common Windows issues
    let userFriendlyError = error.message;
    
    if (error.code === 'ENOENT') {
      userFriendlyError = 'Installer file not found. Please try downloading again.';
    } else if (error.code === 'EACCES') {
      userFriendlyError = 'Permission denied. Try running as administrator or check antivirus settings.';
    } else if (error.message.includes('This app can\'t run')) {
      userFriendlyError = 'Windows blocked the installer. Right-click the file → Properties → Unblock, then try again.';
    } else if (error.message.includes('not compatible')) {
      userFriendlyError = 'Architecture mismatch. Please download the correct version for your system.';
    }
    
    return { 
      success: false, 
      error: userFriendlyError,
      originalError: error.message,
      filePath: filePath
    };
  }
});

// Show file in folder
ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to show file in folder:', error);
    return { success: false, error: error.message };
  }
});

// Open latest release URL for manual download (fallback)
ipcMain.handle('open-latest-release', async () => {
  try {
    await shell.openExternal(LATEST_RELEASE_URL);
    return { success: true };
  } catch (error) {
    console.error('Failed to open latest release URL:', error);
    return { success: false, error: error.message };
  }
});

// Open release page in browser (fallback)
ipcMain.handle('open-release-page', async () => {
  try {
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
