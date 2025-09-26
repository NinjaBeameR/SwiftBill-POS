// PrintHandler Component - Manages printing functionality
const printerUtils = require('../utils/printerUtils');

class PrintHandler {
    constructor() {
        this.init();
    }

    init() {
        // Initialize print settings and preferences
        this.loadPrintSettings();
    }

    loadPrintSettings() {
        // Load print preferences from storage
        this.printSettings = {
            paperWidth: 80, // mm
            fontSize: 12,
            margin: 5,
            copies: {
                kot: 1,
                bill: 1
            }
        };
    }

    async printKOT(orderData) {
        try {
            console.log('Printing KOT for table:', orderData.tableNumber);
            
            // Generate KOT content
            const kotContent = printerUtils.generateKOTContent(orderData);
            
            // Print KOT
            printerUtils.printKOT(orderData);
            
            // Log the print action
            this.logPrintAction('KOT', orderData.tableNumber);
            
            return { success: true, message: 'KOT printed successfully' };
        } catch (error) {
            console.error('Error printing KOT:', error);
            return { success: false, message: 'Failed to print KOT' };
        }
    }

    async printBill(billData) {
        try {
            console.log('Printing bill for table:', billData.tableNumber);
            
            // Generate bill content
            const billContent = printerUtils.generateBillContent(billData);
            
            // Print bill
            printerUtils.printBill(billData);
            
            // Save bill to storage
            this.saveBillRecord(billData);
            
            // Log the print action
            this.logPrintAction('BILL', billData.tableNumber);
            
            return { success: true, message: 'Bill printed successfully' };
        } catch (error) {
            console.error('Error printing bill:', error);
            return { success: false, message: 'Failed to print bill' };
        }
    }

    saveBillRecord(billData) {
        try {
            // Load existing orders
            const fs = require('fs');
            const path = require('path');
            const ordersPath = path.join(__dirname, '../storage/orders.json');
            
            let ordersData = { orders: [], lastBillNumber: 1000 };
            
            if (fs.existsSync(ordersPath)) {
                ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
            }
            
            // Add new bill record
            const billRecord = {
                ...billData,
                billNumber: billData.billNumber || Date.now(),
                printedAt: new Date().toISOString()
            };
            
            ordersData.orders.push(billRecord);
            ordersData.lastBillNumber = billRecord.billNumber;
            
            // Save back to file
            fs.writeFileSync(ordersPath, JSON.stringify(ordersData, null, 2));
            
        } catch (error) {
            console.error('Error saving bill record:', error);
        }
    }

    logPrintAction(type, tableNumber) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${type} printed for Table ${tableNumber}`);
    }

    // Test print functionality
    testPrint() {
        const testData = {
            tableNumber: 1,
            items: [
                { name: 'Test Item', quantity: 1, price: 50 }
            ],
            subtotal: 50,
            tax: 2.5,
            total: 52.5,
            timestamp: new Date().toISOString()
        };

        console.log('Testing print functionality...');
        this.printKOT(testData);
        this.printBill(testData);
    }
}

module.exports = PrintHandler;
