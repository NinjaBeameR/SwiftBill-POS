// Printer utilities for KOT and Bill printing
const helpers = require('./helpers');

const printerUtils = {
    // Generate KOT (Kitchen Order Ticket) content
    generateKOTContent(orderData) {
        const { tableNumber, locationNumber, locationType, items, timestamp } = orderData;
        const date = new Date(timestamp);
        const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;
        
        let kotContent = '';
        kotContent += '================================\n';
        kotContent += '          KITCHEN ORDER\n';
        kotContent += '================================\n';
        kotContent += `${locationText}\n`;
        kotContent += `Time: ${helpers.formatTime(date)}\n`;
        kotContent += `Date: ${helpers.formatDate(date)}\n`;
        kotContent += '--------------------------------\n';
        
        items.forEach(item => {
            kotContent += `${item.quantity}x ${item.name}\n`;
        });
        
        kotContent += '--------------------------------\n';
        kotContent += `Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}\n`;
        kotContent += '================================\n';
        
        return kotContent;
    },

    // Generate customer bill content
    generateBillContent(billData) {
        const { tableNumber, locationNumber, locationType, items, subtotal, tax, total, timestamp } = billData;
        const date = new Date(timestamp);
        const billNumber = helpers.generateBillNumber();
        const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;
        
        let billContent = '';
        
        // Header
        billContent += '================================\n';
        billContent += '        Udupi Krishnam Veg\n';
        billContent += '================================\n';
        billContent += 'Bengaluru - Chennai Hwy, Konappana\n';
        billContent += 'Agrahara, Electronic City,\n';
        billContent += 'Bengaluru, Karnataka, India\n';
        billContent += 'Bangalore, Karnataka Bengaluru\n';
        billContent += '                560100\n';
        billContent += '     Contact No: 9535089587\n';
        billContent += '\n';
        billContent += '       Tax Invoice\n';
        billContent += '\n';
        billContent += '    A Unit of SALT AND PEPPER\n';
        billContent += '--------------------------------\n';
        billContent += `Bill No: ${billNumber}                PAX: 1\n`;
        billContent += `${locationText}            Date: ${helpers.formatDate(date)}\n`;
        billContent += `Print Time: ${helpers.formatDate(date)} ${helpers.formatTime(date)}\n`;
        billContent += `FSSAI: 21224010001200\n`;
        billContent += '================================\n';
        
        // Items header
        billContent += 'SL  ITEM                QTY RATE  AMOUNT\n';
        billContent += '--------------------------------\n';
        
        // Items
        items.forEach((item, index) => {
            const sl = (index + 1).toString().padStart(2);
            const itemName = item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name.padEnd(15);
            const qty = item.quantity.toString().padStart(3);
            const rate = item.price.toString().padStart(4);
            const amount = (item.price * item.quantity).toFixed(2).padStart(7);
            
            billContent += `${sl}  ${itemName} ${qty} ${rate}  ${amount}\n`;
        });
        
        billContent += '--------------------------------\n';
        
        // Totals
        billContent += '--------------------------------\n';
        billContent += `TOTAL:                 ${total.toFixed(2).padStart(10)}\n`;
        billContent += '================================\n';
        billContent += '\n';
        billContent += '        Powered by: NMD\n';
        billContent += '  *** Thank you, Visit again ***\n';
        billContent += '================================\n';
        
        return billContent;
    },

    // Print KOT using window.print()
    printKOT(orderData) {
        const kotContent = this.generateKOTContent(orderData);
        this.printContent(kotContent, 'KOT');
    },

    // Print bill using window.print()
    printBill(billData) {
        const billContent = this.generateBillContent(billData);
        this.printContent(billContent, 'Bill');
    },

    // Generic print function
    printContent(content, title) {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        line-height: 1.2;
                        margin: 0;
                        padding: 10px;
                        white-space: pre-wrap;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 5px;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
    },

    // Thermal printer specific formatting
    formatForThermalPrinter(content, paperWidth = 32) {
        // Split content into lines and ensure proper width
        const lines = content.split('\n');
        const formattedLines = lines.map(line => {
            if (line.length > paperWidth) {
                return line.substring(0, paperWidth);
            }
            return line;
        });
        
        return formattedLines.join('\n');
    }
};

module.exports = printerUtils;
