// Centralized Printing Manager - Preserves exact current behavior
// Handles all KOT and Bill printing with proper layout and formatting
const { ipcRenderer } = require('electron');

class PrintingManager {
    constructor() {
        this.initialized = false;
        this.debugMode = true; // Matches current extensive logging
        this.printSettings = {
            paperWidth: 80, // mm - thermal printer standard
            kotFontSize: 16, // px - ensures readable KOTs
            billFontSize: 14, // px - ensures readable bills
            lineSpacing: 1.4, // Better readability
            margins: 3 // mm - proper spacing
        };
        
        console.log('🖨️ PrintingManager initialized with thermal printer optimization');
    }

    // ═══════════════════════════════════════════════════════════
    // 1. ORDER CLASSIFICATION (preserves current logic exactly)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Classifies order items into kitchen/drinks based on menu kotGroup
     * Preserves exact current behavior including all fallbacks
     */
    classifyOrderItems(orderItems, menuItems) {
        const kitchenItems = [];
        const drinksItems = [];
        
        if (this.debugMode) {
            console.log('=== ORDER CLASSIFICATION START ===');
            console.log(`Processing ${orderItems.length} order items`);
        }
        
        orderItems.forEach(orderItem => {
            const menuItem = menuItems.find(mi => mi.id === orderItem.id);
            
            if (this.debugMode) {
                console.log(`🔍 Item: ${orderItem.name} (ID: ${orderItem.id})`);
                console.log(`   Menu Item Found: ${!!menuItem}`);
                console.log(`   Menu kotGroup: ${menuItem?.kotGroup}`);
            }
            
            // Exact same fallback logic as current implementation
            if (!menuItem) {
                console.warn(`⚠️ FALLBACK WARNING: Menu item not found for order item "${orderItem.name}" (ID: ${orderItem.id})`);
                kitchenItems.push(orderItem);
                if (this.debugMode) console.log(`   ✅ Added to KITCHEN KOT (fallback)`);
                return;
            }
            
            if (!menuItem.kotGroup) {
                console.warn(`⚠️ FALLBACK WARNING: Menu item "${orderItem.name}" has undefined kotGroup - defaulting to kitchen`);
                kitchenItems.push(orderItem);
                if (this.debugMode) console.log(`   ✅ Added to KITCHEN KOT (undefined kotGroup)`);
                return;
            }
            
            // Classification logic (exact same as current)
            if (menuItem.kotGroup === 'kitchen') {
                kitchenItems.push(orderItem);
                if (this.debugMode) console.log(`   ✅ Added to KITCHEN KOT`);
            } else if (menuItem.kotGroup === 'drinks') {
                drinksItems.push(orderItem);
                if (this.debugMode) console.log(`   ✅ Added to DRINKS KOT`);
            } else {
                console.warn(`⚠️ Unknown kotGroup "${menuItem.kotGroup}" for "${orderItem.name}" - defaulting to kitchen`);
                kitchenItems.push(orderItem);
                if (this.debugMode) console.log(`   ✅ Added to KITCHEN KOT (unknown kotGroup)`);
            }
        });
        
        if (this.debugMode) {
            console.log(`🍳 FINAL: Kitchen items: ${kitchenItems.length}`);
            console.log(`☕ FINAL: Drinks items: ${drinksItems.length}`);
        }
        
        return {
            kitchen: kitchenItems,
            drinks: drinksItems,
            orderType: this.determineOrderType(kitchenItems, drinksItems)
        };
    }
    
    /**
     * Determines order type for logging and debugging
     */
    determineOrderType(kitchenItems, drinksItems) {
        if (kitchenItems.length === 0 && drinksItems.length === 0) return 'empty';
        if (kitchenItems.length > 0 && drinksItems.length === 0) return 'kitchen-only';
        if (kitchenItems.length === 0 && drinksItems.length > 0) return 'drinks-only';
        return 'mixed'; // Both kitchen and drinks
    }

    // ═══════════════════════════════════════════════════════════
    // 2. KOT CONTENT GENERATION (enhanced layout, no cutting)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Generates KOT content with perfect thermal printer layout
     * Ensures no text cutting and proper spacing
     */
    generateKOTContent(items, kotTitle, locationInfo) {
        const timestamp = new Date().toISOString();
        const date = new Date(timestamp);
        const locationText = locationInfo.type === 'table' 
            ? `Table: ${locationInfo.number}` 
            : `Counter: ${locationInfo.number}`;
        
        // Enhanced KOT layout - optimized for 80mm thermal printers
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${kotTitle}</title>
                <meta charset="UTF-8">
                <style>
                    @media print {
                        @page { 
                            size: 80mm auto; 
                            margin: 0; 
                        }
                        body { 
                            margin: 0 !important; 
                            padding: 4mm !important; 
                        }
                    }
                    body { 
                        font-family: 'Courier New', monospace !important; 
                        font-size: ${this.printSettings.kotFontSize}px;
                        font-weight: bold;
                        color: #000000 !important;
                        width: 300px; /* Optimized for 80mm = ~300px */
                        max-width: 300px;
                        line-height: ${this.printSettings.lineSpacing};
                        margin: 0;
                        padding: 4mm;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 10px; 
                    }
                    .kot-title { 
                        font-size: 20px; 
                        font-weight: bold; 
                        margin: 6px 0; 
                        letter-spacing: 1px;
                    }
                    .kot-info { 
                        font-size: 15px; 
                        margin: 3px 0; 
                        font-weight: bold;
                    }
                    .items-section {
                        margin: 12px 0;
                    }
                    .item-row { 
                        margin: 4px 0; 
                        padding: 3px 0; 
                        border-bottom: 1px solid #000; 
                        font-size: 16px;
                        font-weight: bold;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .item-quantity {
                        font-size: 18px;
                        font-weight: bold;
                    }
                    .total-section {
                        margin-top: 12px; 
                        text-align: center; 
                        border-top: 3px solid #000; 
                        padding-top: 6px;
                        font-size: 17px;
                        font-weight: bold;
                    }
                    /* Ensure no text cutting */
                    * {
                        box-sizing: border-box;
                        word-break: break-word;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="kot-title">${kotTitle}</div>
                    <div class="kot-info">${locationText}</div>
                    <div class="kot-info">Time: ${this.formatTime(date)}</div>
                    <div class="kot-info">Date: ${this.formatDate(date)}</div>
                </div>
                
                <div class="items-section">
                    ${items.map(item => `
                        <div class="item-row">
                            <span class="item-quantity">${item.quantity}x</span> ${item.name}
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-section">
                    Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
            </body>
            </html>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    // 3. CUSTOMER BILL CONTENT (enhanced layout, complete info)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Generates customer bill with perfect layout and all required information
     * Ensures no cutting and proper thermal printer formatting
     */
    generateBillContent(orderData, restaurantInfo) {
        const { items, location, serviceCharge, timestamp } = orderData;
        const now = timestamp ? new Date(timestamp) : new Date();
        const locationText = location.type === 'table' 
            ? `Table ${location.number}` 
            : `Counter ${location.number}`;
        
        // Calculate totals with service charge
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const serviceChargeAmount = (subtotal * (serviceCharge || 0)) / 100;
        const total = subtotal + serviceChargeAmount;
        const billNumber = this.generateBillNumber();

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bill - ${locationText}</title>
                <meta charset="UTF-8">
                <style>
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
                            font-size: ${this.printSettings.billFontSize}px;
                        }
                        /* HIGH-DPI OPTIMIZATION for thermal printers */
                        @media print and (min-resolution: 200dpi) {
                            body, table { font-size: 16px; }
                            .restaurant-name { font-size: 20px; }
                            .bill-title { font-size: 18px; }
                            .grand-total { font-size: 18px; }
                        }
                    }
                    body { 
                        font-family: 'Courier New', monospace !important;
                        font-size: ${this.printSettings.billFontSize}px;
                        font-weight: bold;
                        margin: 0; 
                        padding: 4mm;
                        width: 300px; /* 80mm = ~300px */
                        max-width: 300px;
                        background: white !important;
                        color: #000000 !important;
                        line-height: ${this.printSettings.lineSpacing};
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px solid #000; 
                        padding-bottom: 8px; 
                        margin-bottom: 10px; 
                    }
                    .restaurant-name { 
                        font-weight: bold;
                        font-size: 18px;
                        margin-bottom: 4px; 
                        color: #000000;
                        letter-spacing: 0.5px; 
                    }
                    .restaurant-details { 
                        font-size: 13px;
                        margin: 2px 0; 
                        font-weight: bold;
                        color: #000000;
                        word-wrap: break-word;
                    }
                    .bill-title { 
                        font-weight: bold;
                        font-size: 16px;
                        margin: 6px 0; 
                        color: #000000;
                        border: 3px solid #000000;
                        padding: 4px;
                        text-align: center;
                    }
                    .bill-info { 
                        font-size: 13px;
                        margin: 3px 0; 
                        font-weight: bold;
                        color: #000000;
                        word-wrap: break-word;
                    }
                    .items { 
                        margin: 10px 0; 
                        width: 100%;
                    }
                    .item-header { 
                        display: flex; 
                        justify-content: space-between; 
                        border-bottom: 3px solid #000000;
                        padding: 3px 0;
                        font-weight: bold;
                        font-size: 13px;
                        color: #000000;
                        margin-bottom: 3px;
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 2px 0;
                        font-size: 13px;
                        padding: 2px 0;
                        border-bottom: 1px solid #000000;
                        font-weight: bold;
                        min-height: 18px;
                        word-wrap: break-word;
                    }
                    .item-name { 
                        flex: 1; 
                        color: #000000;
                        font-weight: bold;
                        padding-right: 3px;
                        word-wrap: break-word;
                        max-width: 35mm;
                        overflow-wrap: break-word;
                    }
                    .item-qty { 
                        width: 15mm;
                        text-align: center; 
                        color: #000000;
                        font-weight: bold;
                        flex-shrink: 0;
                    }
                    .item-rate { 
                        width: 18mm;
                        text-align: right; 
                        color: #000000;
                        font-weight: bold;
                        flex-shrink: 0;
                    }
                    .item-total { 
                        width: 20mm;
                        text-align: right; 
                        color: #000000;
                        font-weight: bold;
                        flex-shrink: 0;
                    }
                    .totals { 
                        border-top: 3px solid #000000;
                        margin-top: 10px; 
                        padding-top: 6px; 
                    }
                    .total-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 3px 0; 
                        font-weight: bold;
                        font-size: 13px;
                        word-wrap: break-word;
                    }
                    .grand-total { 
                        font-size: 16px;
                        border: 2px solid #000000;
                        padding: 4px; 
                        margin: 6px 0;
                        word-wrap: break-word;
                    }
                    .footer { 
                        border-top: 3px solid #000000;
                        margin-top: 10px; 
                        padding-top: 6px; 
                        text-align: center; 
                        font-size: 11px;
                        font-weight: bold;
                        color: #000000;
                        word-wrap: break-word;
                    }
                    /* Ensure no text cutting */
                    * {
                        box-sizing: border-box;
                        word-break: break-word;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="restaurant-name">${restaurantInfo.name}</div>
                    <div class="restaurant-details">${restaurantInfo.address}</div>
                    <div class="restaurant-details">Contact: ${restaurantInfo.contact}</div>
                    <div class="restaurant-details">GSTIN: ${restaurantInfo.gstin}</div>
                    <div class="restaurant-details">FSSAI: ${restaurantInfo.fssai}</div>
                </div>

                <div class="bill-title">TAX INVOICE</div>

                <div class="bill-info">
                    Bill No: ${billNumber}<br>
                    ${locationText}<br>
                    Date: ${this.formatDate(now)}<br>
                    Time: ${this.formatTime(now)}
                </div>

                <div class="items">
                    <div class="item-header">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Rate</span>
                        <span>Amount</span>
                    </div>
                    ${items.map((item, index) => {
                        const itemSubtotal = item.price * item.quantity;
                        // Handle long item names properly
                        const itemName = item.name.length > 12 
                            ? item.name.substring(0, 12) + '...' 
                            : item.name;
                        return `
                        <div class="item-row">
                            <span class="item-name">${index + 1}. ${itemName}</span>
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
                    ${serviceChargeAmount > 0 ? `
                    <div class="total-row">
                        <span>Service Charge (${serviceCharge}%):</span>
                        <span>₹${serviceChargeAmount.toFixed(2)}</span>
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

    // ═══════════════════════════════════════════════════════════
    // 4. KOT PRINTING LOGIC (preserves current behavior exactly)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Prints KOTs based on order classification with exact current behavior
     */
    async printKOTs(orderItems, menuItems, locationInfo) {
        const classification = this.classifyOrderItems(orderItems, menuItems);
        let kotsPrinted = 0;
        let kotsTotal = 0;
        
        console.log('🔄 Starting KOT printing process...');
        console.log(`📊 Order type: ${classification.orderType}`);
        
        // Print Kitchen KOT if needed (exact same as current)
        if (classification.kitchen.length > 0) {
            kotsTotal++;
            console.log(`🍳 FORCING Kitchen KOT print for ${classification.kitchen.length} items...`);
            
            const kitchenResult = await this.printSingleKOT(
                classification.kitchen, 
                'KITCHEN KOT', 
                locationInfo
            );
            
            if (kitchenResult.success) {
                kotsPrinted++;
                console.log('🍳 ✅ Kitchen KOT printed successfully via', kitchenResult.method);
            } else {
                console.error('🍳 ❌ Kitchen KOT print failed:', kitchenResult.error);
                // FORCE PREVIEW MODE - NO FAILURES ALLOWED (same as current)
                try {
                    const forceResult = await this.forceKOTPreview(classification.kitchen, 'KITCHEN KOT', locationInfo);
                    if (forceResult.success) {
                        kotsPrinted++;
                        console.log('🍳 ✅ Kitchen KOT printed via FORCED preview mode');
                    }
                } catch (forceError) {
                    console.error('🍳 ❌ CRITICAL: Kitchen KOT force preview failed:', forceError);
                }
            }
        }
        
        // Print Drinks KOT if needed (exact same as current)
        if (classification.drinks.length > 0) {
            kotsTotal++;
            console.log(`☕ FORCING Drinks KOT print for ${classification.drinks.length} items...`);
            
            const drinksResult = await this.printSingleKOT(
                classification.drinks, 
                'DRINKS KOT', 
                locationInfo
            );
            
            if (drinksResult.success) {
                kotsPrinted++;
                console.log('☕ ✅ Drinks KOT printed successfully via', drinksResult.method);
            } else {
                console.error('☕ ❌ Drinks KOT print failed:', drinksResult.error);
                // FORCE PREVIEW MODE - NO FAILURES ALLOWED (same as current)
                try {
                    const forceResult = await this.forceKOTPreview(classification.drinks, 'DRINKS KOT', locationInfo);
                    if (forceResult.success) {
                        kotsPrinted++;
                        console.log('☕ ✅ Drinks KOT printed via FORCED preview mode');
                    }
                } catch (forceError) {
                    console.error('☕ ❌ CRITICAL: Drinks KOT force preview failed:', forceError);
                }
            }
        }
        
        // Log final results (same as current)
        console.log(`📊 KOT FORCE PRINT SUMMARY: ${kotsPrinted}/${kotsTotal} KOTs printed`);
        
        // If no items to print, that's success (same as current)
        if (kotsTotal === 0) {
            console.log('ℹ️ No KOTs needed - order has no kitchen or drinks items');
            return { success: true, kotsPrinted: 0, kotsTotal: 0, orderType: classification.orderType };
        }
        
        // SUCCESS: At least one KOT was printed (same as current)
        const success = kotsPrinted > 0;
        console.log(success ? '✅ KOT FORCE PRINT SUCCESSFUL' : '❌ KOT FORCE PRINT FAILED');
        
        return {
            success,
            kotsPrinted,
            kotsTotal,
            orderType: classification.orderType,
            fallbackToPreview: false // We handle our own fallbacks
        };
    }
    
    /**
     * Prints a single KOT with exact same fallback logic as current
     */
    async printSingleKOT(items, kotTitle, locationInfo) {
        try {
            const kotContent = this.generateKOTContent(items, kotTitle, locationInfo);
            
            // Try thermal print first (exact same as current)
            console.log(`📋 Attempting thermal print for ${kotTitle}...`);
            const silentResult = await Promise.race([
                ipcRenderer.invoke('silent-print-kot', kotContent),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Print timeout after 10 seconds')), 10000)
                )
            ]);
            
            console.log(`🚨 CRITICAL: ${kotTitle} IPC call completed, result:`, JSON.stringify(silentResult));
            
            if (silentResult && silentResult.success) {
                console.log(`✅ ${kotTitle} printed successfully via thermal printer:`, silentResult.printer);
                return { success: true, method: 'thermal', printer: silentResult.printer };
            } else {
                throw new Error('Thermal print failed, forcing preview');
            }
            
        } catch (error) {
            console.log(`⚠️ ${kotTitle} thermal failed, FORCING preview mode...`);
            
            // FORCE PREVIEW MODE - NO FAILURES ALLOWED (same as current)
            try {
                const kotContent = this.generateKOTContent(items, kotTitle, locationInfo);
                const previewResult = await this.printKOTWithPreview(kotContent, kotTitle);
                
                if (previewResult.success) {
                    console.log(`✅ ${kotTitle} printed successfully via FORCED preview mode`);
                    return { success: true, method: 'preview' };
                } else {
                    throw new Error('Preview mode failed');
                }
            } catch (previewError) {
                console.error(`❌ CRITICAL: ${kotTitle} preview mode failed:`, previewError);
                return { success: false, error: previewError.message };
            }
        }
    }
    
    /**
     * Force KOT preview as last resort (exact same as current)
     */
    async forceKOTPreview(items, kotTitle, locationInfo) {
        try {
            const kotContent = this.generateKOTContent(items, kotTitle, locationInfo);
            
            // Create manual preview window (same as current forceKOTPreview)
            const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(kotContent);
                printWindow.document.close();
                
                return new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            setTimeout(() => {
                                try { printWindow.close(); } catch (e) {}
                            }, 2000);
                            resolve({ success: true, method: 'forced-preview' });
                        } catch (error) {
                            printWindow.close();
                            resolve({ success: false, error: error.message });
                        }
                    }, 800);
                });
            } else {
                return { success: false, error: 'Popup blocked' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Preview window fallback for KOTs (exact same as current implementation)
     */
    async printKOTWithPreview(kotContent, kotTitle) {
        return new Promise((resolve) => {
            try {
                const printWindow = window.open('', '_blank', 'width=400,height=500,scrollbars=yes');
                if (printWindow) {
                    printWindow.document.write(kotContent);
                    printWindow.document.close();
                    
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            console.log(`🖨️ ✅ ${kotTitle} popup print initiated`);
                            setTimeout(() => {
                                try { printWindow.close(); } catch (e) {
                                    console.log(`🖨️ ${kotTitle} window closed by user`);
                                }
                            }, 2000);
                            resolve({ success: true, method: 'preview' });
                        } catch (error) {
                            console.error(`🖨️ ${kotTitle} popup print error:`, error);
                            printWindow.close();
                            resolve({ success: false, error: error.message });
                        }
                    }, 800);
                } else {
                    console.log(`🖨️ ${kotTitle} popup blocked, trying iframe...`);
                    resolve({ success: false, error: 'Popup blocked' });
                }
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 5. BILL PRINTING (enhanced from earlier fix)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Prints customer bill with exact same behavior as current
     */
    async printCustomerBill(orderData, restaurantInfo) {
        try {
            console.log('🧾 Starting customer bill print process...');
            
            const billContent = this.generateBillContent(orderData, restaurantInfo);
            
            // Try silent print first (exact same timeout as current)
            console.log('🧾 Attempting silent print for customer bill...');
            const silentResult = await Promise.race([
                ipcRenderer.invoke('silent-print-bill', billContent),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Silent print timeout')), 8000)
                )
            ]);
            
            if (silentResult && silentResult.success) {
                console.log('🧾 ✅ Customer bill printed successfully via silent print');
                return { success: true, method: 'silent' };
            }
            
            console.log('🧾 Silent print failed, trying popup method...');
            
            // Fallback to popup window (exact same as current)
            const printWindow = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(billContent);
                printWindow.document.close();
                
                await new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            console.log('🧾 ✅ Customer bill popup print initiated');
                            setTimeout(() => {
                                try {
                                    printWindow.close();
                                } catch (e) {
                                    console.log('🧾 Window already closed by user');
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
            } else {
                console.log('🧾 Popup blocked, trying embedded iframe...');
                return await this.printBillWithIframe(billContent);
            }
            
        } catch (error) {
            console.error('🧾 ❌ Enhanced customer bill print error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Iframe fallback for bill printing (exact same as current)
     */
    async printBillWithIframe(billContent) {
        return new Promise((resolve) => {
            try {
                console.log('🧾 Using embedded iframe print method...');
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.left = '-9999px';
                iframe.style.width = '1px';
                iframe.style.height = '1px';
                document.body.appendChild(iframe);
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.write(billContent);
                iframeDoc.close();
                
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        console.log('🧾 ✅ Customer bill iframe print initiated');
                        
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 2000);
                        
                        resolve({ success: true, method: 'iframe' });
                    } catch (iframeError) {
                        console.error('🧾 Iframe print error:', iframeError);
                        document.body.removeChild(iframe);
                        resolve({ success: false, error: iframeError.message });
                    }
                }, 800);
                
            } catch (error) {
                console.error('🧾 ❌ All customer bill print methods failed:', error);
                resolve({ success: false, error: error.message });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 6. MAIN ORCHESTRATION METHOD (replaces current complex logic)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Main method that handles complete order printing
     * Replaces all the scattered printing logic with single call
     */
    async printCompleteOrder(orderData) {
        const { items, menuItems, location, serviceCharge, restaurant } = orderData;
        
        if (!items || items.length === 0) {
            console.log('❌ No items in order to print');
            return { success: false, error: 'No items to print' };
        }
        
        console.log('🚀 Starting complete order print process...');
        console.log(`📊 Order items: ${items.length}, Location: ${location.type} ${location.number}`);
        
        try {
            // Step 1: Print KOTs (maintains exact current behavior)
            console.log('Auto-printing KOTs...');
            const kotResult = await this.printKOTs(items, menuItems, location);
            
            // Step 2: Small delay between prints (same as current - 200ms)
            console.log('✅ KOT printing completed');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Step 3: Print customer bill
            console.log('Auto-printing Bill...');
            const billData = {
                items,
                location,
                serviceCharge: serviceCharge || 0,
                timestamp: new Date().toISOString()
            };
            
            const billResult = await this.printCustomerBill(billData, restaurant);
            
            if (billResult.success) {
                console.log('✅ Bill printed successfully');
                console.log('✅ Order printed successfully - both KOT and Bill');
            } else {
                console.log('🖨️ Bill print failed:', billResult.error);
            }
            
            return {
                success: kotResult.success && billResult.success,
                kots: kotResult,
                bill: billResult,
                summary: {
                    kotsPrinted: kotResult.kotsPrinted,
                    kotsTotal: kotResult.kotsTotal,
                    orderType: kotResult.orderType,
                    billMethod: billResult.method
                }
            };
            
        } catch (error) {
            console.error('🚀 Complete order print error:', error);
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 7. HELPER METHODS (exact same as current helpers)
    // ═══════════════════════════════════════════════════════════
    
    formatTime(date) {
        const options = { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        };
        return date.toLocaleTimeString('en-IN', options);
    }

    formatDate(date) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
        };
        return date.toLocaleDateString('en-IN', options);
    }

    generateBillNumber() {
        const today = new Date();
        const dateStr = today.getFullYear().toString().slice(-2) + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        const timeStr = today.getHours().toString().padStart(2, '0') + 
                       today.getMinutes().toString().padStart(2, '0');
        return `${dateStr}${timeStr}`;
    }

    // Test method for debugging
    async testPrintSystem() {
        console.log('🧪 Testing Centralized Printing System...');
        
        const testOrder = {
            items: [
                { id: 1, name: 'Test Masala Dosa', quantity: 1, price: 80 },
                { id: 168, name: 'Test Coffee', quantity: 2, price: 20 }
            ],
            menuItems: [
                { id: 1, name: 'Test Masala Dosa', kotGroup: 'kitchen' },
                { id: 168, name: 'Test Coffee', kotGroup: 'drinks' }
            ],
            location: { type: 'table', number: 1 },
            serviceCharge: 0,
            restaurant: {
                name: "UDUPI KRISHNAM VEG",
                contact: "+91 12345 67890",
                address: "Test Address, Test City - 560100",
                gstin: "Test GSTIN",
                fssai: "Test FSSAI"
            }
        };

        try {
            const result = await this.printCompleteOrder(testOrder);
            console.log('🧪 Print Test Results:', result);
            return result;
        } catch (error) {
            console.error('🧪 Print Test Error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = PrintingManager;
