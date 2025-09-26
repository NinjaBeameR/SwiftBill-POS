// PrinterManager - Handles printer detection and communication
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PrinterManager {
    constructor() {
        this.availablePrinters = [];
        this.selectedPrinter = null;
        this.printerType = 'thermal'; // 'thermal' or 'regular'
    }

    // Detect available printers
    async detectPrinters() {
        return new Promise((resolve) => {
            try {
                if (os.platform() === 'win32') {
                    this.detectWindowsPrinters(resolve);
                } else if (os.platform() === 'darwin') {
                    this.detectMacPrinters(resolve);
                } else {
                    this.detectLinuxPrinters(resolve);
                }
            } catch (error) {
                console.error('Error detecting printers:', error);
                resolve({ success: false, printers: [], message: error.message });
            }
        });
    }

    detectWindowsPrinters(callback) {
        // Use PowerShell to get printer list
        const command = 'powershell "Get-Printer | Select-Object Name, DriverName, PortName | ConvertTo-Json"';
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting Windows printers:', error);
                callback({ success: false, printers: [], message: error.message });
                return;
            }

            try {
                const printers = JSON.parse(stdout);
                const printerArray = Array.isArray(printers) ? printers : [printers];
                
                this.availablePrinters = printerArray.map(printer => ({
                    name: printer.Name,
                    driver: printer.DriverName,
                    port: printer.PortName,
                    type: this.detectPrinterType(printer.Name, printer.DriverName)
                }));

                // Auto-select thermal printer if available
                const thermalPrinter = this.availablePrinters.find(p => p.type === 'thermal');
                if (thermalPrinter) {
                    this.selectedPrinter = thermalPrinter;
                } else if (this.availablePrinters.length > 0) {
                    this.selectedPrinter = this.availablePrinters[0];
                }

                console.log('🖨️ Detected printers:', this.availablePrinters);
                callback({ success: true, printers: this.availablePrinters, selected: this.selectedPrinter });
                
            } catch (parseError) {
                console.error('Error parsing printer data:', parseError);
                callback({ success: false, printers: [], message: 'Failed to parse printer data' });
            }
        });
    }

    detectMacPrinters(callback) {
        const command = 'lpstat -p';
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting Mac printers:', error);
                callback({ success: false, printers: [], message: error.message });
                return;
            }

            const printerLines = stdout.split('\n').filter(line => line.startsWith('printer'));
            this.availablePrinters = printerLines.map(line => {
                const name = line.split(' ')[1];
                return {
                    name: name,
                    driver: 'Unknown',
                    port: 'Unknown',
                    type: this.detectPrinterType(name, '')
                };
            });

            const thermalPrinter = this.availablePrinters.find(p => p.type === 'thermal');
            this.selectedPrinter = thermalPrinter || this.availablePrinters[0];

            console.log('🖨️ Detected printers:', this.availablePrinters);
            callback({ success: true, printers: this.availablePrinters, selected: this.selectedPrinter });
        });
    }

    detectLinuxPrinters(callback) {
        const command = 'lpstat -p';
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting Linux printers:', error);
                callback({ success: false, printers: [], message: error.message });
                return;
            }

            const printerLines = stdout.split('\n').filter(line => line.startsWith('printer'));
            this.availablePrinters = printerLines.map(line => {
                const name = line.split(' ')[1];
                return {
                    name: name,
                    driver: 'Unknown',
                    port: 'Unknown',
                    type: this.detectPrinterType(name, '')
                };
            });

            const thermalPrinter = this.availablePrinters.find(p => p.type === 'thermal');
            this.selectedPrinter = thermalPrinter || this.availablePrinters[0];

            console.log('🖨️ Detected printers:', this.availablePrinters);
            callback({ success: true, printers: this.availablePrinters, selected: this.selectedPrinter });
        });
    }

    // Detect if printer is thermal based on name and driver
    detectPrinterType(name, driver) {
        const thermalKeywords = [
            'thermal', 'receipt', 'pos', 'tm-', 'epson', 'star',
            'citizen', 'bixolon', 'xprinter', '80mm', '58mm'
        ];

        const searchText = (name + ' ' + driver).toLowerCase();
        const isThermal = thermalKeywords.some(keyword => searchText.includes(keyword));
        
        return isThermal ? 'thermal' : 'regular';
    }

    // Print PDF using system command
    async printPDF(pdfPath) {
        return new Promise((resolve) => {
            if (!this.selectedPrinter) {
                resolve({ success: false, message: 'No printer selected' });
                return;
            }

            if (!fs.existsSync(pdfPath)) {
                resolve({ success: false, message: 'PDF file not found' });
                return;
            }

            let command;
            
            if (os.platform() === 'win32') {
                // Use PDFtoPrinter utility or SumatraPDF for silent printing on Windows
                command = `powershell -Command "Start-Process -FilePath '${pdfPath}' -Verb Print"`;
                
                // Alternative: Use Adobe Reader or SumatraPDF if available
                // command = `"C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" -print-to "${this.selectedPrinter.name}" "${pdfPath}"`;
                
            } else if (os.platform() === 'darwin') {
                // Use lp command on Mac
                command = `lp -d "${this.selectedPrinter.name}" "${pdfPath}"`;
                
            } else {
                // Use lp command on Linux
                command = `lp -d "${this.selectedPrinter.name}" "${pdfPath}"`;
            }

            console.log('🖨️ Executing print command:', command);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('Print error:', error);
                    resolve({ success: false, message: error.message });
                } else {
                    console.log('✅ PDF printed successfully');
                    resolve({ success: true, message: 'PDF printed successfully' });
                }
            });
        });
    }

    // Print ESC/POS data directly to printer
    async printESCPOS(escposData) {
        return new Promise((resolve) => {
            if (!this.selectedPrinter) {
                resolve({ success: false, message: 'No printer selected' });
                return;
            }

            try {
                // For Windows, try to send raw data to printer
                if (os.platform() === 'win32') {
                    this.printESCPOSWindows(escposData, resolve);
                } else {
                    this.printESCPOSUnix(escposData, resolve);
                }
                
            } catch (error) {
                console.error('ESC/POS print error:', error);
                resolve({ success: false, message: error.message });
            }
        });
    }

    printESCPOSWindows(escposData, callback) {
        // Save ESC/POS data to temporary file
        const tempFile = path.join(os.tmpdir(), `escpos_${Date.now()}.prn`);
        
        fs.writeFile(tempFile, escposData, (writeError) => {
            if (writeError) {
                callback({ success: false, message: writeError.message });
                return;
            }

            // Use copy command to send raw data to printer on Windows
            const command = `copy /b "${tempFile}" "${this.selectedPrinter.port || 'LPT1'}"`;
            
            exec(command, (error, stdout, stderr) => {
                // Clean up temp file
                fs.unlink(tempFile, () => {});
                
                if (error) {
                    console.error('ESC/POS print error:', error);
                    callback({ success: false, message: error.message });
                } else {
                    console.log('✅ ESC/POS data printed successfully');
                    callback({ success: true, message: 'ESC/POS printed successfully' });
                }
            });
        });
    }

    printESCPOSUnix(escposData, callback) {
        // Save ESC/POS data to temporary file
        const tempFile = path.join(os.tmpdir(), `escpos_${Date.now()}.prn`);
        
        fs.writeFile(tempFile, escposData, (writeError) => {
            if (writeError) {
                callback({ success: false, message: writeError.message });
                return;
            }

            // Use lp command to send raw data
            const command = `lp -d "${this.selectedPrinter.name}" -o raw "${tempFile}"`;
            
            exec(command, (error, stdout, stderr) => {
                // Clean up temp file
                fs.unlink(tempFile, () => {});
                
                if (error) {
                    console.error('ESC/POS print error:', error);
                    callback({ success: false, message: error.message });
                } else {
                    console.log('✅ ESC/POS data printed successfully');
                    callback({ success: true, message: 'ESC/POS printed successfully' });
                }
            });
        });
    }

    // Get printer status
    async getStatus() {
        return {
            availablePrinters: this.availablePrinters,
            selectedPrinter: this.selectedPrinter,
            printerCount: this.availablePrinters.length,
            hasThermalPrinter: this.availablePrinters.some(p => p.type === 'thermal')
        };
    }

    // Select a specific printer
    selectPrinter(printerName) {
        const printer = this.availablePrinters.find(p => p.name === printerName);
        if (printer) {
            this.selectedPrinter = printer;
            console.log('🖨️ Selected printer:', printer.name);
            return { success: true, printer: printer };
        } else {
            return { success: false, message: 'Printer not found' };
        }
    }

    // Test printer connectivity
    async testPrint() {
        if (!this.selectedPrinter) {
            return { success: false, message: 'No printer selected' };
        }

        // Create a simple test PDF or ESC/POS data
        const testData = Buffer.from('SwiftBill-POS Test Print\n\nPrinter: ' + this.selectedPrinter.name + '\nTime: ' + new Date().toLocaleString() + '\n\n--- Test Successful ---\n\n\n');
        
        return await this.printESCPOS(testData);
    }
}

module.exports = PrinterManager;