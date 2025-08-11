// Enhanced Printing System - Centralized print management
// This module handles all printing operations with improved reliability and formatting

const { ipcRenderer } = require('electron');

class PrintingSystem {
    constructor() {
        this.initialized = false;
        this.printSettings = {
            paperWidth: 80, // mm
            baseFontSize: 14, // px - increased from previous small sizes
            lineHeight: 1.3,
            margin: 3, // mm
            thermalOptimized: true,
            colorMode: 'blackonly', // Force black only for thermal printers
            copies: {
                kot: 1,
                bill: 1
            }
        };
        this.init();
    }

    init() {
        console.log('🖨️ Initializing Enhanced Printing System...');
        this.initialized = true;
    }

    // Enhanced bill content generation with larger fonts
    generateBillContent(orderData, restaurantInfo) {
        const now = new Date();
        const locationText = orderData.billingMode === 'table' 
            ? `Table ${orderData.currentLocation}` 
            : `Counter ${orderData.currentLocation}`;
        
        // Calculate totals with service charge
        const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const serviceCharge = (subtotal * (orderData.serviceFeePercentage || 0)) / 100;
        const total = subtotal + serviceCharge;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bill - ${locationText}</title>
                <meta charset="UTF-8">
                <style>
                    /* ENHANCED PRINT SYSTEM - LARGER FONTS FOR CLEAR PRINTING */
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body { 
                            margin: 0 !important; 
                            padding: 4mm !important; 
                        }
                        body, table { 
                            font-size: 16px; /* LARGE: Significantly increased base font */
                        }
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                        }
                        /* THERMAL PRINT OPTIMIZATION: Force solid black for all elements */
                        * {
                            color: #000000 !important;
                            border-color: #000000 !important;
                        }
                        /* HIGH-DPI OPTIMIZATION: Enhanced for 200+ DPI thermal printers */
                        @media print and (min-resolution: 200dpi) {
                            body, table { font-size: 18px; }
                            .restaurant-name { font-size: 22px; }
                            .bill-title { font-size: 20px; }
                            .grand-total { font-size: 20px; }
                        }
                    }
                    body { 
                        font-family: 'Courier New', monospace !important; /* THERMAL: Reliable thermal font */
                        font-size: 16px; /* LARGE: Increased base size for readability */
                        font-weight: bold !important; 
                        margin: 0; 
                        padding: 4mm;
                        width: 320px; /* ENHANCED: Wider for thermal printers */
                        max-width: 320px;
                        background: white !important;
                        color: #000000 !important; 
                        line-height: 1.4; /* ENHANCED: Better spacing */
                        -webkit-font-smoothing: none !important; 
                        font-smoothing: none !important; 
                        text-rendering: optimizeLegibility !important; 
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px solid #000; 
                        padding-bottom: 8px; 
                        margin-bottom: 10px; 
                        box-sizing: border-box; 
                    }
                    .restaurant-name { 
                        font-weight: bold !important; 
                        font-size: 20px; /* LARGE: Increased restaurant name visibility */
                        margin-bottom: 4px; 
                        color: #000000 !important; 
                        font-family: 'Courier New', monospace !important; 
                        letter-spacing: 0.5px; 
                    }
                    .restaurant-details { 
                        font-size: 14px; /* LARGE: Increased address/contact readability */
                        margin: 2px 0; 
                        font-weight: bold !important; 
                        color: #000000 !important; 
                        line-height: 1.4; 
                        word-wrap: break-word;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .bill-title { 
                        font-weight: bold !important; 
                        font-size: 18px; /* LARGE: Increased bill title visibility */
                        margin: 6px 0; 
                        color: #000000 !important; 
                        border: 3px solid #000000 !important; 
                        padding: 4px;
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                        text-align: center;
                    }
                    .bill-info { 
                        font-size: 14px; /* LARGE: Increased readability */
                        margin: 3px 0; 
                        font-weight: bold !important; 
                        color: #000000 !important; 
                        word-wrap: break-word;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .items { 
                        margin: 10px 0; 
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .item-header { 
                        display: flex; 
                        justify-content: space-between; 
                        border-bottom: 3px solid #000000 !important; 
                        padding: 3px 0;
                        font-weight: bold !important; 
                        font-size: 14px; /* LARGE: Increased header readability */
                        color: #000000 !important; 
                        margin-bottom: 3px;
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 2px 0;
                        font-size: 14px; /* LARGE: Increased item row readability */
                        padding: 2px 0;
                        border-bottom: 1px solid #000000 !important; 
                        font-weight: bold !important; 
                        min-height: 18px; /* ENHANCED: Adjusted for increased font size */
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .item-name { 
                        flex: 1; 
                        color: #000000 !important; 
                        font-weight: bold !important; 
                        padding-right: 3px;
                        font-family: 'Courier New', monospace !important; 
                        word-wrap: break-word;
                        max-width: 40mm;
                        overflow-wrap: break-word;
                        box-sizing: border-box;
                    }
                    .item-qty { 
                        width: 15mm;
                        text-align: center; 
                        color: #000000 !important; 
                        font-weight: bold !important; 
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .item-rate { 
                        width: 18mm;
                        text-align: right; 
                        color: #000000 !important; 
                        font-weight: bold !important; 
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .item-total { 
                        width: 20mm;
                        text-align: right; 
                        color: #000000 !important; 
                        font-weight: bold !important; 
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .totals { 
                        border-top: 3px solid #000000 !important; 
                        margin-top: 10px; 
                        padding-top: 6px; 
                        box-sizing: border-box;
                    }
                    .total-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 3px 0; 
                        font-weight: bold !important; 
                        font-size: 14px; /* LARGE: Increased total row readability */
                        box-sizing: border-box;
                        word-wrap: break-word;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .grand-total { 
                        font-size: 18px; /* LARGE: Increased grand total visibility */
                        border: 2px solid #000000 !important; 
                        padding: 4px; 
                        margin: 6px 0;
                        box-sizing: border-box;
                        word-wrap: break-word;
                        font-family: 'Courier New', monospace !important; 
                    }
                    .footer { 
                        border-top: 3px solid #000000 !important; 
                        margin-top: 10px; 
                        padding-top: 6px; 
                        text-align: center; 
                        font-size: 12px; /* LARGE: Increased footer readability */
                        font-weight: bold !important; 
                        color: #000000 !important; 
                        box-sizing: border-box;
                        word-wrap: break-word;
                        font-family: 'Courier New', monospace !important; 
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="restaurant-name">${restaurantInfo.name}</div>
                    <div class="restaurant-details">${restaurantInfo.address}</div>
                    <div class="restaurant-details">Contact: ${restaurantInfo.contact}</div>
                    <div class="restaurant-details">GSTIN: ${restaurantInfo.gstin}</div>
                </div>

                <div class="bill-title">TAX INVOICE</div>

                <div class="bill-info">
                    Bill No: ${Date.now()}<br>
                    ${locationText}<br>
                    Date: ${now.toLocaleDateString()}<br>
                    Time: ${now.toLocaleTimeString()}
                </div>

                <div class="items">
                    <div class="item-header">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Rate</span>
                        <span>Amount</span>
                    </div>
                    ${orderData.items.map((item, index) => {
                        const itemSubtotal = item.price * item.quantity;
                        return `
                        <div class="item-row">
                            <span class="item-name">${index + 1}. ${item.name}</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-rate">₹${item.price.toFixed(2)}</span>
                            <span class="item-total">₹${itemSubtotal.toFixed(2)}</span>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>₹${subtotal.toFixed(2)}</span>
                    </div>
                    ${serviceCharge > 0 ? `
                    <div class="total-row">
                        <span>Service Charge (${orderData.serviceFeePercentage}%):</span>
                        <span>₹${serviceCharge.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>TOTAL:</span>
                        <span>₹${total.toFixed(2)}</span>
                    </div>
                </div>

                <div class="footer">
                    <div>Thank you for visiting!</div>
                    <div>Please visit again</div>
                    <div>Powered by SwiftBill POS</div>
                </div>
            </body>
            </html>
        `;
    }

    // Enhanced KOT content generation
    generateKOTContent(orderData) {
        const now = new Date();
        const locationText = orderData.billingMode === 'table' 
            ? `Table ${orderData.currentLocation}` 
            : `Counter ${orderData.currentLocation}`;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>KOT - ${locationText}</title>
                <meta charset="UTF-8">
                <style>
                    @media print {
                        @page { size: 80mm auto; margin: 0; }
                        body { margin: 0 !important; padding: 3mm !important; }
                    }
                    body { 
                        font-family: 'Courier New', monospace; 
                        font-size: 16px; 
                        font-weight: bold;
                        color: #000000;
                        width: 300px;
                        line-height: 1.4;
                    }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 8px; }
                    .kot-title { font-size: 18px; font-weight: bold; margin: 5px 0; }
                    .kot-info { font-size: 14px; margin: 2px 0; }
                    .item-row { margin: 3px 0; padding: 2px 0; border-bottom: 1px solid #000; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="kot-title">KITCHEN ORDER TICKET</div>
                    <div class="kot-info">${locationText}</div>
                    <div class="kot-info">Time: ${now.toLocaleTimeString()}</div>
                </div>
                ${orderData.items.map(item => `
                    <div class="item-row">
                        <strong>${item.quantity}x ${item.name}</strong>
                    </div>
                `).join('')}
                <div style="margin-top: 10px; text-align: center; border-top: 2px solid #000; padding-top: 5px;">
                    <strong>Total Items: ${orderData.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                </div>
            </body>
            </html>
        `;
    }

    // Enhanced silent print method for bills
    async printBill(orderData, restaurantInfo) {
        try {
            console.log('🧾 Enhanced Printing System: Starting bill print...');
            
            const billContent = this.generateBillContent(orderData, restaurantInfo);
            
            // Try silent print first
            const silentResult = await Promise.race([
                ipcRenderer.invoke('silent-print-bill', billContent),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Silent print timeout')), 8000)
                )
            ]);
            
            if (silentResult && silentResult.success) {
                console.log('🧾 ✅ Bill printed successfully via silent print');
                return { success: true, method: 'silent' };
            }
            
            console.log('🧾 Silent print failed, trying popup method...');
            
            // Fallback to popup window
            const printWindow = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(billContent);
                printWindow.document.close();
                
                await new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            console.log('🧾 ✅ Bill popup print initiated');
                            setTimeout(() => {
                                try {
                                    printWindow.close();
                                } catch (e) {
                                    console.log('🧾 Window closed by user');
                                }
                            }, 2000);
                            resolve();
                        } catch (printError) {
                            console.error('🧾 Popup print error:', printError);
                            printWindow.close();
                            resolve();
                        }
                    }, 800);
                });
                
                return { success: true, method: 'popup' };
            }
            
            throw new Error('All print methods failed');
            
        } catch (error) {
            console.error('🧾 ❌ Enhanced print system error:', error);
            return { success: false, error: error.message };
        }
    }

    // Enhanced silent print method for KOTs
    async printKOT(orderData) {
        try {
            console.log('🍽️ Enhanced Printing System: Starting KOT print...');
            
            const kotContent = this.generateKOTContent(orderData);
            
            // Try silent print first
            const silentResult = await Promise.race([
                ipcRenderer.invoke('silent-print-kot', kotContent),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Silent print timeout')), 8000)
                )
            ]);
            
            if (silentResult && silentResult.success) {
                console.log('🍽️ ✅ KOT printed successfully via silent print');
                return { success: true, method: 'silent' };
            }
            
            console.log('🍽️ Silent print failed, trying popup method...');
            
            // Fallback to popup window
            const printWindow = window.open('', '_blank', 'width=400,height=500,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(kotContent);
                printWindow.document.close();
                
                await new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            console.log('🍽️ ✅ KOT popup print initiated');
                            setTimeout(() => {
                                try {
                                    printWindow.close();
                                } catch (e) {
                                    console.log('🍽️ Window closed by user');
                                }
                            }, 2000);
                            resolve();
                        } catch (printError) {
                            console.error('🍽️ Popup print error:', printError);
                            printWindow.close();
                            resolve();
                        }
                    }, 800);
                });
                
                return { success: true, method: 'popup' };
            }
            
            throw new Error('All print methods failed');
            
        } catch (error) {
            console.error('🍽️ ❌ Enhanced KOT print system error:', error);
            return { success: false, error: error.message };
        }
    }

    // Test print functionality
    async testPrint() {
        const testOrder = {
            billingMode: 'table',
            currentLocation: 1,
            serviceFeePercentage: 0,
            items: [
                { name: 'Test Masala Dosa', quantity: 1, price: 80 },
                { name: 'Test Coffee', quantity: 2, price: 20 }
            ]
        };

        const testRestaurant = {
            name: "UDUPI KRISHNAM VEG",
            contact: "+91 12345 67890",
            address: "Test Address, Test City - 560100",
            gstin: "Test GSTIN"
        };

        console.log('🧪 Testing Enhanced Printing System...');
        
        const kotResult = await this.printKOT(testOrder);
        console.log('🧪 KOT Test Result:', kotResult);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const billResult = await this.printBill(testOrder, testRestaurant);
        console.log('🧪 Bill Test Result:', billResult);

        return { kot: kotResult, bill: billResult };
    }

    // Get print settings
    getSettings() {
        return { ...this.printSettings };
    }

    // Update print settings
    updateSettings(newSettings) {
        this.printSettings = { ...this.printSettings, ...newSettings };
        console.log('🖨️ Print settings updated:', this.printSettings);
    }
}

module.exports = PrintingSystem;
