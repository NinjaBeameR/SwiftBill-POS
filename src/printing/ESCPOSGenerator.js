// ESCPOSGenerator - Creates ESC/POS commands for direct thermal printing
let escpos = null;
try {
    escpos = require('escpos');
} catch (error) {
    console.warn('ESC/POS not available:', error.message);
}

class ESCPOSGenerator {
    constructor() {
        this.encoding = 'GB18030'; // Supports various characters
    }

    // Generate KOT ESC/POS commands
    generateKOT(orderData, settings) {
        try {
            if (!escpos) {
                throw new Error('ESC/POS library not available');
            }
            const { tableNumber, locationNumber, locationType, items, timestamp } = orderData;
            const date = new Date(timestamp);
            const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;

            // Create ESC/POS buffer
            let buffer = Buffer.alloc(0);
            
            // Initialize printer
            buffer = Buffer.concat([buffer, escpos.INIT]);
            
            // Set character encoding
            buffer = Buffer.concat([buffer, escpos.TXT_NORMAL]);
            
            // Header - centered and bold
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_CT]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            buffer = Buffer.concat([buffer, Buffer.from('KITCHEN ORDER TICKET\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            
            // Order details - left aligned
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_LT]);
            buffer = Buffer.concat([buffer, Buffer.from(`${locationText}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from(`Time: ${this.formatTime(date)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from(`Date: ${this.formatDate(date)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('--------------------------------\n', this.encoding)]);
            
            // Items - bold
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            items.forEach(item => {
                buffer = Buffer.concat([buffer, Buffer.from(`${item.quantity}x ${item.name}\n`, this.encoding)]);
            });
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            
            // Footer
            buffer = Buffer.concat([buffer, Buffer.from('--------------------------------\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from(`Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            
            // Feed and cut paper
            buffer = Buffer.concat([buffer, escpos.LF, escpos.LF]);
            buffer = Buffer.concat([buffer, escpos.PAPER_FULL_CUT]);
            
            return buffer;
            
        } catch (error) {
            console.error('Error generating KOT ESC/POS:', error);
            throw error;
        }
    }

    // Generate Bill ESC/POS commands
    generateBill(billData, settings) {
        try {
            if (!escpos) {
                throw new Error('ESC/POS library not available');
            }
            const { tableNumber, locationNumber, locationType, items, subtotal, tax, total, timestamp, layout } = billData;
            const date = new Date(timestamp);
            const billNumber = this.generateBillNumber();
            const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;

            let buffer = Buffer.alloc(0);
            
            // Initialize printer
            buffer = Buffer.concat([buffer, escpos.INIT]);
            buffer = Buffer.concat([buffer, escpos.TXT_NORMAL]);
            
            // Restaurant Header - centered and bold
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_CT]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            buffer = Buffer.concat([buffer, Buffer.from('Udupi Krishnam Veg\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            
            // Restaurant details - centered, smaller font
            buffer = Buffer.concat([buffer, escpos.TXT_SIZE_NORMAL]);
            buffer = Buffer.concat([buffer, Buffer.from('Bengaluru - Chennai Hwy, Konappana\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('Agrahara, Electronic City,\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('Bengaluru, Karnataka, India\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('Bangalore, Karnataka 560100\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('Contact No: 9535089587\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('\n', this.encoding)]);
            
            // Tax Invoice - bold and centered
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            buffer = Buffer.concat([buffer, Buffer.from('Tax Invoice\n', this.encoding)]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            buffer = Buffer.concat([buffer, Buffer.from('\n', this.encoding)]);
            
            buffer = Buffer.concat([buffer, Buffer.from('A Unit of SALT AND PEPPER\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('--------------------------------\n', this.encoding)]);
            
            // Bill info - left aligned
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_LT]);
            buffer = Buffer.concat([buffer, Buffer.from(`Bill No: ${billNumber}                PAX: 1\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from(`${locationText}            Date: ${this.formatDate(date)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from(`Print Time: ${this.formatDate(date)} ${this.formatTime(date)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('FSSAI: 21224010001200\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            
            // Items table header - bold
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            const headerLine = `SL  ${'ITEM'.padEnd(layout.itemWidth)} QTY ${'RATE'.padStart(layout.rateWidth)}  ${'AMOUNT'.padStart(layout.amountWidth)}\n`;
            buffer = Buffer.concat([buffer, Buffer.from(headerLine, this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('--------------------------------\n', this.encoding)]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            
            // Items
            items.forEach((item, index) => {
                const sl = (index + 1).toString().padStart(2);
                const itemName = item.displayName.padEnd(layout.itemWidth);
                const qty = item.quantity.toString().padStart(3);
                const rate = item.price.toString().padStart(layout.rateWidth);
                const amount = (item.price * item.quantity).toFixed(2).padStart(layout.amountWidth);
                
                const itemLine = `${sl}  ${itemName} ${qty} ${rate}  ${amount}\n`;
                buffer = Buffer.concat([buffer, Buffer.from(itemLine, this.encoding)]);
            });
            
            buffer = Buffer.concat([buffer, Buffer.from('--------------------------------\n', this.encoding)]);
            
            // Totals - right aligned
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_RT]);
            if (tax && tax > 0) {
                buffer = Buffer.concat([buffer, Buffer.from(`SUBTOTAL: ${subtotal.toFixed(2)}\n`, this.encoding)]);
                buffer = Buffer.concat([buffer, Buffer.from(`TAX: ${tax.toFixed(2)}\n`, this.encoding)]);
            }
            
            // Total - bold
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_ON]);
            buffer = Buffer.concat([buffer, Buffer.from(`TOTAL: ${total.toFixed(2)}\n`, this.encoding)]);
            buffer = Buffer.concat([buffer, escpos.TXT_BOLD_OFF]);
            
            // Footer separator - centered
            buffer = Buffer.concat([buffer, escpos.TXT_ALIGN_CT]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('\n', this.encoding)]);
            
            // Footer text - centered
            buffer = Buffer.concat([buffer, Buffer.from('Powered by: NMD\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('*** Thank you, Visit again ***\n', this.encoding)]);
            buffer = Buffer.concat([buffer, Buffer.from('================================\n', this.encoding)]);
            
            // Feed and cut paper
            buffer = Buffer.concat([buffer, escpos.LF, escpos.LF]);
            buffer = Buffer.concat([buffer, escpos.PAPER_FULL_CUT]);
            
            return buffer;
            
        } catch (error) {
            console.error('Error generating Bill ESC/POS:', error);
            throw error;
        }
    }

    // Helper methods
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
        // Generate a simple bill number based on timestamp
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        return `${dateStr}${timeStr}`;
    }
}

module.exports = ESCPOSGenerator;