const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
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
app.whenReady().then(createWindow);

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

    const printers = await mainWindow.webContents.getPrinters();
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
      }))
    };
  } catch (error) {
    console.error('Printer check error:', error);
    return { 
      available: false, 
      error: error.message,
      printerCount: 0,
      printers: []
    };
  }
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

    // Get all available printers
    const printers = await mainWindow.webContents.getPrinters();
    
    if (!printers || printers.length === 0) {
      throw new Error('No printer found. Please check connection.');
    }

    // Smart printer selection logic:
    // 1. First try to find default printer
    // 2. If no default, find any available printer (any status except error states)
    // 3. Prefer thermal printers if detected by name patterns
    let targetPrinter = null;

    // Look for default printer first
    const defaultPrinter = printers.find(printer => printer.isDefault);
    if (defaultPrinter) {
      targetPrinter = defaultPrinter;
      console.log(`Using default printer: ${defaultPrinter.name}`);
    } else {
      // Find best available printer (any non-error status)
      const availablePrinters = printers.filter(printer => 
        printer.status === 0 || // IDLE
        printer.status === 1 || // PRINTING
        printer.status === 2 || // PROCESSING
        printer.status === 3    // PAUSED (still usable)
      );

      if (availablePrinters.length > 0) {
        // Prefer thermal printers by name patterns
        const thermalPrinter = availablePrinters.find(printer => 
          printer.name.toLowerCase().includes('thermal') ||
          printer.name.toLowerCase().includes('pos') ||
          printer.name.toLowerCase().includes('receipt') ||
          printer.name.toLowerCase().includes('tm-') ||
          printer.name.toLowerCase().includes('rp-')
        );

        targetPrinter = thermalPrinter || availablePrinters[0];
        console.log(`Auto-selected printer: ${targetPrinter.name} (Status: ${targetPrinter.status})`);
      } else {
        // If all printers show error status, try the first one anyway
        targetPrinter = printers[0];
        console.log(`All printers show error status, trying: ${targetPrinter.name}`);
      }
    }

    if (!targetPrinter) {
      throw new Error('No printer found. Please check connection.');
    }

    console.log(`Auto-printing ${printType} to: ${targetPrinter.name}`);

    // Create optimized hidden window for thermal printing
    const printWindow = new BrowserWindow({
      width: 320, // 80mm thermal printer width
      height: 800, // Longer height for full bills
      show: false, // Always hidden for true silent printing
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        offscreen: false // Better for printing
      }
    });

    // Load content with enhanced error handling
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
    
    // Optimized print settings for one-click printing
    const printOptions = {
      silent: true, // Never show print dialog
      printBackground: true, // Include all styling
      deviceName: targetPrinter.name, // Force specific printer
      margins: {
        marginType: 'none' // No margins for thermal paper
      },
      pageSize: {
        width: 80000, // 80mm in micrometers
        height: 0 // Auto-height for variable content
      },
      scaleFactor: 100, // 100% scale
      dpi: {
        horizontal: 203, // Standard thermal DPI
        vertical: 203
      },
      copies: 1,
      landscape: false,
      color: false, // Black and white for thermal
      headerFooter: false,
      shouldPrintBackgrounds: true, // Ensure backgrounds print
      preferCSSPageSize: true // Use CSS page size
    };

    return new Promise((resolve, reject) => {
      // Set up success handler
      printWindow.webContents.once('did-finish-load', () => {
        // Small delay to ensure content is fully rendered
        setTimeout(() => {
          printWindow.webContents.print(printOptions, (success, failureReason) => {
            printWindow.close();
            
            if (success) {
              console.log(`✅ ${printType} printed successfully to ${targetPrinter.name}`);
              resolve({ 
                success: true, 
                printer: targetPrinter.name,
                message: `Printed to ${targetPrinter.name}`
              });
            } else {
              const errorMsg = failureReason || 'Print operation failed';
              console.error(`❌ ${printType} print failed:`, errorMsg);
              reject(new Error(`Print failed: ${errorMsg}. Please check printer connection.`));
            }
          });
        }, 1500); // Optimized delay for reliability
      });

      // Handle load failures
      printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        printWindow.close();
        reject(new Error(`Failed to load print content: ${errorDescription}`));
      });

      // Timeout protection
      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close();
          reject(new Error('Print operation timed out. Please check printer connection.'));
        }
      }, 20000); // 20 second timeout
    });

  } catch (error) {
    console.error(`Auto-print ${printType} error:`, error);
    return { 
      success: false, 
      error: error.message.includes('No printer found') ? 
        'No printer found. Please check connection.' : 
        error.message 
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

    const printers = await mainWindow.webContents.getPrinters();
    
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

    const printers = await mainWindow.webContents.getPrinters();
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
