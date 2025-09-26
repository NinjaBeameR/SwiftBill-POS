// PDFGenerator - Creates professional PDFs using PDFKit
let PDFDocument = null;
try {
    PDFDocument = require('pdfkit');
} catch (error) {
    console.warn('PDFKit not available:', error.message);
}
const fs = require('fs');
const path = require('path');
const os = require('os');

class PDFGenerator {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'swiftbill-pdfs');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // Generate KOT PDF
    async generateKOT(orderData, settings) {
        return new Promise((resolve, reject) => {
            try {
                if (!PDFDocument) {
                    reject(new Error('PDFKit not available - using fallback'));
                    return;
                }
                const { tableNumber, locationNumber, locationType, items, timestamp } = orderData;
                const date = new Date(timestamp);
                const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;
                
                // Create PDF document for thermal printer (80mm width)
                const doc = new PDFDocument({
                    size: [226.77, 'auto'], // 80mm width in points
                    margin: 10
                });

                const fileName = `KOT_${Date.now()}.pdf`;
                const filePath = path.join(this.tempDir, fileName);
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Header
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('KITCHEN ORDER TICKET', { align: 'center' });
                doc.text('='.repeat(32), { align: 'center' });
                
                doc.fontSize(10).font('Helvetica');
                doc.text(locationText, { align: 'left' });
                doc.text(`Time: ${this.formatTime(date)}`, { align: 'left' });
                doc.text(`Date: ${this.formatDate(date)}`, { align: 'left' });
                doc.text('-'.repeat(32), { align: 'center' });

                // Items
                doc.fontSize(10).font('Helvetica-Bold');
                items.forEach(item => {
                    doc.text(`${item.quantity}x ${item.name}`, { align: 'left' });
                });

                // Footer
                doc.text('-'.repeat(32), { align: 'center' });
                doc.text(`Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}`, { align: 'left' });
                doc.text('='.repeat(32), { align: 'center' });

                doc.end();

                stream.on('finish', () => {
                    resolve(filePath);
                });

                stream.on('error', (error) => {
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    // Generate Bill PDF
    async generateBill(billData, settings) {
        return new Promise((resolve, reject) => {
            try {
                if (!PDFDocument) {
                    reject(new Error('PDFKit not available - using fallback'));
                    return;
                }
                const { tableNumber, locationNumber, locationType, items, subtotal, tax, total, timestamp, layout } = billData;
                const date = new Date(timestamp);
                const billNumber = this.generateBillNumber();
                const locationText = locationType === 'table' ? `Table: ${locationNumber || tableNumber}` : `Counter: ${locationNumber}`;

                // Create PDF document for thermal printer
                const doc = new PDFDocument({
                    size: [226.77, 'auto'], // 80mm width in points
                    margin: 8
                });

                const fileName = `BILL_${billNumber}_${Date.now()}.pdf`;
                const filePath = path.join(this.tempDir, fileName);
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Restaurant Header
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Udupi Krishnam Veg', { align: 'center' });
                doc.text('='.repeat(35), { align: 'center' });
                
                doc.fontSize(8).font('Helvetica');
                doc.text('Bengaluru - Chennai Hwy, Konappana', { align: 'center' });
                doc.text('Agrahara, Electronic City,', { align: 'center' });
                doc.text('Bengaluru, Karnataka, India', { align: 'center' });
                doc.text('Bangalore, Karnataka 560100', { align: 'center' });
                doc.text('Contact No: 9535089587', { align: 'center' });
                doc.moveDown();

                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('Tax Invoice', { align: 'center' });
                doc.moveDown();

                doc.fontSize(8).font('Helvetica');
                doc.text('A Unit of SALT AND PEPPER', { align: 'center' });
                doc.text('-'.repeat(35), { align: 'center' });

                // Bill Info
                doc.fontSize(8);
                doc.text(`Bill No: ${billNumber}                PAX: 1`, { align: 'left' });
                doc.text(`${locationText}            Date: ${this.formatDate(date)}`, { align: 'left' });
                doc.text(`Print Time: ${this.formatDate(date)} ${this.formatTime(date)}`, { align: 'left' });
                doc.text('FSSAI: 21224010001200', { align: 'left' });
                doc.text('='.repeat(35), { align: 'center' });

                // Items Table Header
                doc.fontSize(8).font('Helvetica-Bold');
                const headerLine = `SL  ${'ITEM'.padEnd(layout.itemWidth)} QTY ${'RATE'.padStart(layout.rateWidth)}  ${'AMOUNT'.padStart(layout.amountWidth)}`;
                doc.text(headerLine, { align: 'left' });
                doc.text('-'.repeat(35), { align: 'center' });

                // Items
                doc.fontSize(8).font('Helvetica');
                items.forEach((item, index) => {
                    const sl = (index + 1).toString().padStart(2);
                    const itemName = item.displayName.padEnd(layout.itemWidth);
                    const qty = item.quantity.toString().padStart(3);
                    const rate = item.price.toString().padStart(layout.rateWidth);
                    const amount = (item.price * item.quantity).toFixed(2).padStart(layout.amountWidth);
                    
                    const itemLine = `${sl}  ${itemName} ${qty} ${rate}  ${amount}`;
                    doc.text(itemLine, { align: 'left' });
                });

                doc.text('-'.repeat(35), { align: 'center' });

                // Totals
                if (tax && tax > 0) {
                    doc.text(`SUBTOTAL: ${subtotal.toFixed(2).padStart(20)}`, { align: 'right' });
                    doc.text(`TAX: ${tax.toFixed(2).padStart(25)}`, { align: 'right' });
                }
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text(`TOTAL: ${total.toFixed(2).padStart(23)}`, { align: 'right' });
                doc.text('='.repeat(35), { align: 'center' });

                // Footer
                doc.fontSize(8).font('Helvetica');
                doc.moveDown();
                doc.text('Powered by: NMD', { align: 'center' });
                doc.text('*** Thank you, Visit again ***', { align: 'center' });
                doc.text('='.repeat(35), { align: 'center' });

                doc.end();

                stream.on('finish', () => {
                    resolve(filePath);
                });

                stream.on('error', (error) => {
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
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

    // Clean up old PDF files
    cleanupOldFiles() {
        try {
            const files = fs.readdirSync(this.tempDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old PDF: ${file}`);
                }
            });
        } catch (error) {
            console.log('Error cleaning up PDF files:', error);
        }
    }
}

module.exports = PDFGenerator;