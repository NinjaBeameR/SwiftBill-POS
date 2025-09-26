// NewPrintHandler - Modern robust printing system
const PDFGenerator = require('./PDFGenerator');
const ESCPOSGenerator = require('./ESCPOSGenerator');
const PrinterManager = require('./PrinterManager');
const path = require('path');
const fs = require('fs');
const os = require('os');

class NewPrintHandler {
    constructor() {
        this.pdfGenerator = new PDFGenerator();
        this.escposGenerator = new ESCPOSGenerator();
        this.printerManager = new PrinterManager();
        this.printMode = 'PDF'; // 'PDF' or 'ESCPOS'
        this.initialized = false;

        // Load print settings synchronously
        this.loadPrintSettings();
        
        // Initialize asynchronously without blocking
        this.init().catch(error => {
            console.error('Error initializing NewPrintHandler:', error);
        });
    }

    async init() {
        try {
            // Initialize printer manager
            await this.printerManager.detectPrinters();
            this.initialized = true;
            console.log('NewPrintHandler initialized successfully');
        } catch (error) {
            console.error('Error initializing NewPrintHandler:', error);
            this.initialized = false;
        }
    }

    loadPrintSettings() {
        // Default print settings
        this.printSettings = {
            paperWidth: 80, // mm
            fontSize: 10,
            margin: 2,
            printMode: 'PDF', // 'PDF' or 'ESCPOS'
            copies: {
                kot: 1,
                bill: 1
            },
            abbreviations: {
                'Fried': 'frd',
                'Schezwan': 'Szn'
            }
        };

        // Try to load settings from file
        try {
            const userDataPath = path.join(os.homedir(), '.swiftbill-pos');
            const settingsPath = path.join(userDataPath, 'print-settings.json');
            
            // Ensure directory exists
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }
            
            if (fs.existsSync(settingsPath)) {
                const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                this.printSettings = { ...this.printSettings, ...savedSettings };
            }
        } catch (error) {
            console.log('Using default print settings');
        }
    }

    savePrintSettings() {
        try {
            const userDataPath = path.join(os.homedir(), '.swiftbill-pos');
            const settingsPath = path.join(userDataPath, 'print-settings.json');
            
            // Ensure directory exists
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }
            
            fs.writeFileSync(settingsPath, JSON.stringify(this.printSettings, null, 2));
        } catch (error) {
            console.error('Error saving print settings:', error);
        }
    }

    // Smart abbreviation function with your specified abbreviations
    smartAbbreviate(itemName, maxWidth) {
        if (itemName.length <= maxWidth) {
            return itemName;
        }

        let abbreviated = itemName;
        
        // Apply your specific abbreviations
        for (const [full, short] of Object.entries(this.printSettings.abbreviations)) {
            abbreviated = abbreviated.replace(new RegExp(full, 'gi'), short);
            if (abbreviated.length <= maxWidth) {
                return abbreviated;
            }
        }

        // If still too long, remove vowels strategically from the end
        if (abbreviated.length > maxWidth) {
            abbreviated = this.removeVowelsIntelligently(abbreviated, maxWidth);
        }

        // Final fallback - take first maxWidth characters
        return abbreviated.substring(0, maxWidth);
    }

    removeVowelsIntelligently(text, maxWidth) {
        if (text.length <= maxWidth) return text;
        
        // Remove vowels from right to left, but keep first letter
        const vowels = ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U'];
        let result = text;
        
        for (let i = result.length - 1; i > 0 && result.length > maxWidth; i--) {
            if (vowels.includes(result[i])) {
                result = result.slice(0, i) + result.slice(i + 1);
            }
        }
        
        return result.substring(0, maxWidth);
    }

    // Calculate optimal layout for items table
    calculateOptimalLayout(items) {
        const maxItemNameLength = Math.max(...items.map(item => item.name.length));
        
        // Base layout for 8cm thermal paper (approximately 32-35 characters)
        const totalWidth = 35;
        const fixedColumns = 2 + 1 + 3 + 1 + 5 + 1 + 7 + 2; // SL + spaces + QTY + spaces + RATE + spaces + AMOUNT + margins
        const availableForItemName = totalWidth - fixedColumns; // About 15 characters
        
        let itemWidth = Math.min(maxItemNameLength, availableForItemName);
        
        // If all items fit in default width, use it
        if (maxItemNameLength <= availableForItemName) {
            return {
                itemWidth: availableForItemName,
                qtyWidth: 3,
                rateWidth: 5,
                amountWidth: 7,
                totalWidth: totalWidth
            };
        }
        
        // For longer names, expand item column and adjust others
        return {
            itemWidth: Math.min(maxItemNameLength, 20), // Max 20 chars for item
            qtyWidth: 3,
            rateWidth: 5,
            amountWidth: 7,
            totalWidth: Math.max(totalWidth, 2 + 20 + 1 + 3 + 1 + 5 + 1 + 7 + 2)
        };
    }

    // Print KOT using new system
    async printNewKOT(orderData) {
        try {
            if (!this.initialized) {
                console.log('⏳ Printer manager still initializing, using fallback...');
            }
            
            console.log('🖨️ Printing NEW KOT for:', orderData.tableNumber || orderData.locationNumber);
            
            // Handle both array and object formats for items
            const items = Array.isArray(orderData) ? orderData : (orderData.items || []);
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('No items to print in KOT');
            }

            // Ensure data is in correct format
            const printData = Array.isArray(orderData) ? { items: orderData } : orderData;
            
            // Use fallback printing if advanced modules not available
            let printResult;
            
            try {
                const result = await this.printerManager.detectPrinters();
                if (!result.success || result.printers.length === 0) {
                    console.log('⚠️ No printers detected, using fallback method');
                    printResult = await this.fallbackPrintKOT(printData);
                } else {
                    if (this.printSettings.printMode === 'PDF') {
                        // Generate PDF and print
                        const pdfPath = await this.pdfGenerator.generateKOT(printData, this.printSettings);
                        printResult = await this.printerManager.printPDF(pdfPath);
                    } else {
                        // Generate ESC/POS commands and print
                        const escposData = this.escposGenerator.generateKOT(printData, this.printSettings);
                        printResult = await this.printerManager.printESCPOS(escposData);
                    }
                }
            } catch (error) {
                console.log('⚠️ Advanced printing failed, using fallback:', error.message);
                printResult = await this.fallbackPrintKOT(printData);
            }
            
            if (printResult.success) {
                this.logPrintAction('NEW_KOT', orderData.tableNumber || orderData.locationNumber);
                return { success: true, message: 'NEW KOT printed successfully!' };
            } else {
                throw new Error(printResult.message);
            }
            
        } catch (error) {
            console.error('❌ Error printing NEW KOT:', error);
            return { success: false, message: `Failed to print NEW KOT: ${error.message}` };
        }
    }

    // Print Bill using new system
    async printNewBill(billData) {
        try {
            if (!this.initialized) {
                console.log('⏳ Printer manager still initializing, using fallback...');
            }
            
            console.log('🖨️ Printing NEW BILL for:', billData.tableNumber || billData.locationNumber);
            
            // Handle both array and object formats for items
            const items = Array.isArray(billData) ? billData : (billData.items || []);
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('No items to print in Bill');
            }

            // Ensure data is in correct format
            const printData = Array.isArray(billData) ? { items: billData } : billData;

            // Add layout calculation to bill data
            printData.layout = this.calculateOptimalLayout(items);
            
            // Process item names with smart abbreviation
            printData.items = items.map(item => ({
                ...item,
                displayName: this.smartAbbreviate(item.name, printData.layout.itemWidth)
            }));

            let printResult;
            
            try {
                const result = await this.printerManager.detectPrinters();
                if (!result.success || result.printers.length === 0) {
                    console.log('⚠️ No printers detected, using fallback method');
                    printResult = await this.fallbackPrintBill(printData);
                } else {
                    if (this.printSettings.printMode === 'PDF') {
                        // Generate PDF and print
                        const pdfPath = await this.pdfGenerator.generateBill(printData, this.printSettings);
                        printResult = await this.printerManager.printPDF(pdfPath);
                    } else {
                        // Generate ESC/POS commands and print
                        const escposData = this.escposGenerator.generateBill(printData, this.printSettings);
                        printResult = await this.printerManager.printESCPOS(escposData);
                    }
                }
            } catch (error) {
                console.log('⚠️ Advanced printing failed, using fallback:', error.message);
                printResult = await this.fallbackPrintBill(billData);
            }
            
            if (printResult.success) {
                // Save bill record
                await this.saveBillRecord(billData);
                this.logPrintAction('NEW_BILL', billData.tableNumber || billData.locationNumber);
                return { success: true, message: 'NEW Bill printed successfully!' };
            } else {
                throw new Error(printResult.message);
            }
            
        } catch (error) {
            console.error('❌ Error printing NEW BILL:', error);
            return { success: false, message: `Failed to print NEW BILL: ${error.message}` };
        }
    }

    async saveBillRecord(billData) {
        try {
            const userDataPath = path.join(os.homedir(), '.swiftbill-pos');
            const ordersPath = path.join(userDataPath, 'storage', 'orders.json');
            
            let ordersData = { orders: [], lastBillNumber: 1000 };
            
            if (fs.existsSync(ordersPath)) {
                ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
            }
            
            // Add new bill record
            const billRecord = {
                ...billData,
                billNumber: billData.billNumber || (ordersData.lastBillNumber + 1),
                printedAt: new Date().toISOString(),
                printedWith: 'NEW_SYSTEM'
            };
            
            ordersData.orders.push(billRecord);
            ordersData.lastBillNumber = billRecord.billNumber;
            
            // Ensure directory exists
            const storageDir = path.dirname(ordersPath);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            
            // Save back to file
            fs.writeFileSync(ordersPath, JSON.stringify(ordersData, null, 2));
            
        } catch (error) {
            console.error('Error saving NEW bill record:', error);
        }
    }

    logPrintAction(type, location) {
        const timestamp = new Date().toISOString();
        console.log(`📋 [${timestamp}] ${type} printed for Location ${location} using NEW SYSTEM`);
    }

    // Test the new printing system with format preview
    async testNewPrint() {
        const testData = {
            tableNumber: 999,
            locationNumber: 999,
            locationType: 'table',
            items: [
                { name: 'Schezwan Fried Rice Special', quantity: 1, price: 180 },
                { name: 'Veg Fried Noodles', quantity: 2, price: 160 },
                { name: 'Paneer Manchurian Dry', quantity: 1, price: 120 }
            ],
            subtotal: 620,
            serviceFee: 31,
            tax: 32.55,
            total: 683.55,
            timestamp: new Date().toISOString()
        };

        console.log('🧪 Testing NEW print functionality...');
        
        // Test smart abbreviation
        console.log('📝 Testing Smart Abbreviation:');
        testData.items.forEach(item => {
            const abbreviated = this.smartAbbreviate(item.name, 15);
            console.log(`  "${item.name}" → "${abbreviated}"`);
        });
        
        // Test layout calculation
        const layout = this.calculateOptimalLayout(testData.items);
        console.log('📐 Calculated Layout:', layout);
        
        // Add layout and display names to test data
        testData.layout = layout;
        testData.items = testData.items.map(item => ({
            ...item,
            displayName: this.smartAbbreviate(item.name, layout.itemWidth)
        }));
        
        console.log('🧪 Final Test Data:', testData);
        
        const kotResult = await this.printNewKOT(testData);
        console.log('📋 KOT Result:', kotResult);
        
        const billResult = await this.printNewBill(testData);
        console.log('🧾 Bill Result:', billResult);
        
        return { kotResult, billResult, testData };
    }

    // Preview the exact format that will be printed
    previewPrintFormat(orderData) {
        console.log('\n📋 ===== KOT PREVIEW =====');
        const kotPreview = this.generateKOTPreview(orderData);
        console.log(kotPreview);
        
        console.log('\n🧾 ===== BILL PREVIEW =====');
        const billPreview = this.generateBillPreview(orderData);
        console.log(billPreview);
        
        return { kotPreview, billPreview };
    }

    generateKOTPreview(orderData) {
        const { tableNumber, locationNumber, locationType, items, timestamp } = orderData;
        const date = new Date(timestamp);
        const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;
        
        let kotPreview = '';
        kotPreview += '================================\n';
        kotPreview += '          KITCHEN ORDER\n';
        kotPreview += '================================\n';
        kotPreview += `${locationText}\n`;
        kotPreview += `Time: ${this.formatTime(date)}\n`;
        kotPreview += `Date: ${this.formatDate(date)}\n`;
        kotPreview += '--------------------------------\n';
        
        items.forEach(item => {
            kotPreview += `${item.quantity}x ${item.name}\n`;
        });
        
        kotPreview += '--------------------------------\n';
        kotPreview += `Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}\n`;
        kotPreview += '================================\n';
        
        return kotPreview;
    }

    generateBillPreview(billData) {
        const { tableNumber, locationNumber, locationType, items, subtotal, serviceFee, tax, total, timestamp, layout } = billData;
        const date = new Date(timestamp);
        const billNumber = this.generateBillNumber();
        const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;
        
        let billPreview = '';
        
        // Header
        billPreview += '================================\n';
        billPreview += '        Udupi Krishnam Veg\n';
        billPreview += '================================\n';
        billPreview += 'Bengaluru - Chennai Hwy, Konappana\n';
        billPreview += 'Agrahara, Electronic City,\n';
        billPreview += 'Bengaluru, Karnataka, India\n';
        billPreview += 'Bangalore, Karnataka 560100\n';
        billPreview += '     Contact No: 9535089587\n';
        billPreview += '\n';
        billPreview += '       Tax Invoice\n';
        billPreview += '\n';
        billPreview += '    A Unit of SALT AND PEPPER\n';
        billPreview += '--------------------------------\n';
        billPreview += `Bill No: ${billNumber}                PAX: 1\n`;
        billPreview += `${locationText}            Date: ${this.formatDate(date)}\n`;
        billPreview += `Print Time: ${this.formatDate(date)} ${this.formatTime(date)}\n`;
        billPreview += `FSSAI: 21224010001200\n`;
        billPreview += '================================\n';
        
        // Items header
        const headerLine = `SL  ${'ITEM'.padEnd(layout.itemWidth)} QTY ${'RATE'.padStart(layout.rateWidth)}  ${'AMOUNT'.padStart(layout.amountWidth)}`;
        billPreview += headerLine + '\n';
        billPreview += '--------------------------------\n';
        
        // Items
        items.forEach((item, index) => {
            const sl = (index + 1).toString().padStart(2);
            const itemName = item.displayName.padEnd(layout.itemWidth);
            const qty = item.quantity.toString().padStart(3);
            const rate = item.price.toString().padStart(layout.rateWidth);
            const amount = (item.price * item.quantity).toFixed(2).padStart(layout.amountWidth);
            
            const itemLine = `${sl}  ${itemName} ${qty} ${rate}  ${amount}`;
            billPreview += itemLine + '\n';
        });
        
        billPreview += '--------------------------------\n';
        
        // Totals
        if (serviceFee && serviceFee > 0) {
            billPreview += `SUBTOTAL: ${subtotal.toFixed(2).padStart(20)}\n`;
            billPreview += `SERVICE FEE: ${serviceFee.toFixed(2).padStart(17)}\n`;
        }
        if (tax && tax > 0) {
            billPreview += `TAX (5%): ${tax.toFixed(2).padStart(20)}\n`;
        }
        billPreview += '--------------------------------\n';
        billPreview += `TOTAL: ${total.toFixed(2).padStart(23)}\n`;
        billPreview += '================================\n';
        billPreview += '\n';
        billPreview += '        Powered by: NMD\n';
        billPreview += '  *** Thank you, Visit again ***\n';
        billPreview += '================================\n';
        
        return billPreview;
    }

    // Helper methods for preview
    formatTime(date) {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    formatDate(date) {
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    generateBillNumber() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        return `${dateStr}${timeStr}`;
    }

    // Get printer status
    async getPrinterStatus() {
        return await this.printerManager.getStatus();
    }

    // Change print mode
    setPrintMode(mode) {
        if (['PDF', 'ESCPOS'].includes(mode)) {
            this.printSettings.printMode = mode;
            this.savePrintSettings();
            console.log(`🔄 Print mode changed to: ${mode}`);
        }
    }

    // Generate KOT preview content for fallback printing
    generateKOTPreview(orderData) {
        // Handle both array and object with items property
        const items = Array.isArray(orderData) ? orderData : (orderData.items || []);
        let output = '';
        
        // Header (professional spaced)
        output += '\n';
        output += '================================\n';
        output += '                                \n';
        output += '       KITCHEN ORDER            \n';
        output += '                                \n';
        output += '================================\n';
        output += '                                \n';
        output += `Table: ${String(orderData.locationNumber || orderData.tableNumber || 'N/A').padEnd(26)}\n`;
        output += `Time:  ${new Date().toLocaleTimeString().padEnd(26)}\n`;
        output += '                                \n';
        output += '--------------------------------\n';
        output += '                                \n';
        
        // Items (professional spaced format)
        if (items.length > 0) {
            items.forEach(item => {
                const abbrevName = this.smartAbbreviate(item.name, 24);
                output += `${item.quantity.toString().padStart(2)}x  ${abbrevName.padEnd(26)}\n`;
                output += '                                \n';
                if (item.notes) {
                    output += `     Note: ${item.notes}\n`;
                    output += '                                \n';
                }
            });
            output += '--------------------------------\n';
            output += '                                \n';
            output += `Total Items:         ${items.reduce((sum, item) => sum + item.quantity, 0).toString().padStart(10)}\n`;
            output += '                                \n';
        } else {
            output += '      No items in order        \n';
            output += '                                \n';
        }
        
        output += '================================\n';
        output += '                                \n';
        
        return output;
    }

    // Generate Bill preview content for fallback printing (using old professional design)
    generateBillPreview(billData) {
        // Handle both array and object with items property
        const items = Array.isArray(billData) ? billData : (billData.items || []);
        const date = new Date();
        const billNumber = Date.now();
        const locationText = billData.locationType === 'table' ? 
            `Table: ${billData.locationNumber || billData.tableNumber}` : 
            `Counter: ${billData.locationNumber}`;
        
        let output = '';
        
        // Header - STANDARD HOTEL BILL FORMAT
        output += '========================================\n';
        output += '          UDUPI KRISHNAM VEG           \n';
        output += '========================================\n';
        output += 'Bengaluru-Chennai Hwy, Konappana       \n';
        output += 'Electronic City, Karnataka - 560100    \n';
        output += 'Contact No: 9535089587                  \n';
        output += '----------------------------------------\n';
        output += '            Tax Invoice                 \n';
        output += '      A Unit of SALT AND PEPPER        \n';
        output += '----------------------------------------\n';
        output += `Bill: ${String(billNumber).slice(-6)}        PAX: 1\n`;
        output += `${locationText}                        \n`;
        output += `Date: ${date.toLocaleDateString()}  Time: ${date.toLocaleTimeString().slice(0,5)}\n`;
        output += `FSSAI: 21224010001200                 \n`;
        output += '========================================\n';
        
        // Items header - CLEAN PROFESSIONAL FORMAT
        output += 'SL ITEM               QTY RATE AMOUNT\n';
        output += '--------------------------------------\n';
        
        // Items - WITH PROPER SPACING TO MATCH HEADER
        let calculatedTotal = 0;
        if (items.length > 0) {
            items.forEach((item, index) => {
                const sl = (index + 1).toString().padStart(2);           // 2 chars
                const abbrevName = this.smartAbbreviate(item.name, 18);
                const itemName = abbrevName.padEnd(18).substring(0, 18); // 18 chars with more space
                const qty = item.quantity.toString().padStart(3);         // 3 chars
                const rate = item.price.toFixed(0).padStart(4);          // 4 chars  
                const amount = (item.price * item.quantity);
                calculatedTotal += amount;
                
                // STANDARD HOTEL FORMAT: 2 + 1 + 18 + 1 + 3 + 1 + 4 + 1 + 6 = 37 chars
                output += `${sl} ${itemName} ${qty} ${rate} ${amount.toFixed(2).padStart(6)}\n`;
                
                if (item.notes) {
                    output += `  Note: ${item.notes}\n`;
                }
            });
        } else {
            output += '      No items in order\n';
        }
        
        output += '======================================\n';
        
        // Use only available data for totals (no invisible GST)
        const subtotal = billData.subtotal || calculatedTotal;
        const serviceFee = billData.serviceFee || 0;
        const tax = billData.tax || 0;
        const finalTotal = billData.total || subtotal;
        
        // PROFESSIONAL TOTALS SECTION
        if (serviceFee > 0) {
            output += `Subtotal:            ₹${subtotal.toFixed(2).padStart(8)}\n`;
            output += `Service Fee:         ₹${serviceFee.toFixed(2).padStart(8)}\n`;
        }
        if (tax > 0) {
            output += `Tax (5%):            ₹${tax.toFixed(2).padStart(8)}\n`;
        }
        
        output += '--------------------------------------\n';
        output += `TOTAL:               ₹${finalTotal.toFixed(2).padStart(8)}\n`;
        output += '======================================\n';
        output += '     Thank you, Visit again!          \n';
        output += '        Powered by: NMD               \n';

        return output;
    }

    // Completely silent printing - no dialogs
    async fallbackPrintKOT(orderData) {
        return new Promise((resolve) => {
            try {
                console.log('🖨️ Completely Silent KOT printing...');
                
                const kotContent = this.generateKOTPreview(orderData);
                
                // Direct silent printing using NEW mechanism
                this.performDirectSilentPrint(kotContent, 'KOT', resolve);
                
            } catch (error) {
                console.error('Silent KOT print error:', error);
                resolve({ success: false, message: 'KOT print failed: ' + error.message });
            }
        });
    }

    async fallbackPrintBill(billData) {
        return new Promise((resolve) => {
            try {
                console.log('🖨️ Completely Silent Bill printing...');
                
                const billContent = this.generateBillPreview(billData);
                
                // Direct silent printing using NEW mechanism
                this.performDirectSilentPrint(billContent, 'Bill', resolve);
                
            } catch (error) {
                console.error('Silent Bill print error:', error);
                resolve({ success: false, message: 'Bill print failed: ' + error.message });
            }
        });
    }

    // NEW PRINTING MECHANISM - Direct silent printing
    performDirectSilentPrint(content, type, resolve) {
        try {
            console.log(`🖨️ NEW ${type} printing mechanism activated`);
            
            // Create a completely invisible print frame
            const printFrame = document.createElement('iframe');
            printFrame.style.position = 'fixed';
            printFrame.style.top = '-1000px';
            printFrame.style.left = '-1000px';
            printFrame.style.width = '1px';
            printFrame.style.height = '1px';
            printFrame.style.opacity = '0';
            printFrame.style.border = 'none';
            printFrame.style.visibility = 'hidden';
            
            document.body.appendChild(printFrame);
            
            // Set up the print document
            const printDoc = printFrame.contentDocument || printFrame.contentWindow.document;
            
            printDoc.open();
            printDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${type}</title>
                    <style>
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body {
                            font-family: 'Courier New', monospace;
                            font-size: ${type === 'Bill' ? '16px' : '16px'};
                            font-weight: bold;
                            line-height: 1.3;
                            margin: 0;
                            padding: 3mm;
                            white-space: pre-wrap;
                            color: #000;
                            letter-spacing: 0.3px;
                        }
                        @media print {
                            body {
                                margin: 0 !important;
                                padding: 2mm !important;
                                font-size: ${type === 'Bill' ? '16px' : '16px'} !important;
                                line-height: 1.3 !important;
                            }
                        }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `);
            printDoc.close();
            
            // Wait for content to load then print automatically
            printFrame.onload = () => {
                setTimeout(() => {
                    try {
                        printFrame.contentWindow.focus();
                        
                        // Use Electron's silent printing instead of browser print dialog
                        const { ipcRenderer } = require('electron');
                        const ipcHandler = type === 'KOT' ? 'silent-print-kot' : 'silent-print-bill';
                        ipcRenderer.invoke(ipcHandler, content);
                        
                        // Clean up after printing
                        setTimeout(() => {
                            document.body.removeChild(printFrame);
                        }, 1000);
                        
                        resolve({ success: true, message: `NEW ${type} printed successfully!` });
                        
                    } catch (printError) {
                        console.error(`${type} print error:`, printError);
                        document.body.removeChild(printFrame);
                        resolve({ success: false, message: `NEW ${type} print failed: ${printError.message}` });
                    }
                }, 300);
            };
            
        } catch (error) {
            console.error(`NEW ${type} printing error:`, error);
            resolve({ success: false, message: `NEW ${type} printing failed: ${error.message}` });
        }
    }
}

module.exports = NewPrintHandler;