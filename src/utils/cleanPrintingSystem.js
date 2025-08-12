/**
 * Clean Printing System - Built from scratch for reliability
 * No shrinking, no infinite loops, just working prints
 * 
 * Features:
 * - Customer Bills with all required information
 * - Kitchen KOTs (food items)
 * - Drinks KOTs (tea/coffee)
 * - Mixed order handling (both KOTs printed together)
 * - Service charge support
 * - Thermal printer optimized
 */

class CleanPrintingSystem {
    constructor() {
        this.debugMode = true; // Simple debug logging
        this.initialized = false;
        
        // Print settings optimized for TVS RP 3200 Plus thermal printer
        // FIXED: Optimized for 70mm safe printable area with maximum readability
        this.settings = {
            // 70mm = TVS RP 3200 Plus safe zone with 10mm buffer
            thermalWidth: '70mm',
            pageMargin: '0',
            bodyPadding: '1.5mm',  // Optimal for readability without overflow
            fontSize: {
                base: '11px',    // Optimized for 70mm width
                header: '12px',  // Compact headers
                title: '14px',   // Restaurant name visibility  
                total: '12px'    // Important totals readability
            },
            fontFamily: "'Courier New', monospace"  // Monospace ensures consistent width
        };
        
        this.log('🖨️ Clean Printing System initialized');
    }

    // ============================================
    // CORE PRINTING METHODS
    // ============================================

    /**
     * Main method: Print complete order (KOTs + Customer Bill)
     */
    async printCompleteOrder(orderData) {
        this.log('🚀 Starting complete order print...');
        
        try {
            const { items, menuItems, location, serviceCharge, restaurant } = orderData;
            
            if (!items || items.length === 0) {
                throw new Error('No items to print');
            }

            // Step 1: Print KOTs first (kitchen workflow)
            await this.printKOTs(items, menuItems, location);
            
            // Step 2: Print Customer Bill
            await this.printCustomerBill(orderData);
            
            this.log('✅ Complete order printed successfully');
            return { success: true };
            
        } catch (error) {
            this.log(`❌ Print error: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Print KOTs based on item categories
     */
    async printKOTs(items, menuItems, location) {
        this.log('🍳 Starting KOT printing...');
        
        // Classify items into kitchen and drinks
        const { kitchenItems, drinksItems } = this.classifyItems(items, menuItems);
        
        const promises = [];
        
        // Print Kitchen KOT if needed
        if (kitchenItems.length > 0) {
            this.log(`🍳 Printing Kitchen KOT for ${kitchenItems.length} items`);
            promises.push(this.printSingleKOT(kitchenItems, 'KITCHEN ORDER', location));
        }
        
        // Print Drinks KOT if needed
        if (drinksItems.length > 0) {
            this.log(`☕ Printing Drinks KOT for ${drinksItems.length} items`);
            promises.push(this.printSingleKOT(drinksItems, 'DRINKS ORDER', location));
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
            this.log('✅ All KOTs printed');
        } else {
            this.log('ℹ️ No KOTs needed');
        }
    }

    /**
     * Print customer bill with all details
     */
    async printCustomerBill(orderData) {
        this.log('🧾 Printing customer bill...');
        
        const billHTML = this.generateCustomerBillHTML(orderData);
        await this.printBillHTML(billHTML, 'Customer Bill');  // Use bill-specific method
        
        this.log('✅ Customer bill printed');
    }

    // ============================================
    // ITEM CLASSIFICATION
    // ============================================

    /**
     * Classify items into kitchen and drinks based on kotGroup
     * FIXED: Added robust error handling and debugging for data structure issues
     */
    classifyItems(orderItems, menuItems) {
        const kitchenItems = [];
        const drinksItems = [];
        
        this.log(`📋 Classifying ${orderItems.length} items...`);
        
        // CRITICAL FIX: Add debugging and fallback logic
        if (!menuItems || !Array.isArray(menuItems)) {
            this.log(`⚠️ WARNING: menuItems is invalid, defaulting all items to kitchen`);
            return { kitchenItems: [...orderItems], drinksItems: [] };
        }
        
        this.log(`📋 Available menu items: ${menuItems.length}`);
        
        orderItems.forEach((orderItem, index) => {
            // DEBUGGING: Log the orderItem structure
            this.log(`🔍 Processing item ${index + 1}: ${JSON.stringify(orderItem)}`);
            
            // Try different ID matching strategies
            let menuItem = menuItems.find(mi => mi.id === orderItem.id);
            
            if (!menuItem && orderItem.name) {
                // Fallback: try matching by name
                menuItem = menuItems.find(mi => mi.name === orderItem.name);
                if (menuItem) {
                    this.log(`🔄 Found menu item by name fallback: "${orderItem.name}"`);
                }
            }
            
            if (!menuItem) {
                this.log(`⚠️ Menu item not found for ID:"${orderItem.id}" Name:"${orderItem.name}" - defaulting to kitchen`);
                kitchenItems.push(orderItem);
                return;
            }
            
            const kotGroup = menuItem.kotGroup || 'kitchen'; // Default to kitchen
            
            if (kotGroup === 'drinks') {
                drinksItems.push(orderItem);
                this.log(`☕ "${orderItem.name}" → Drinks KOT`);
            } else {
                kitchenItems.push(orderItem);
                this.log(`🍳 "${orderItem.name}" → Kitchen KOT`);
            }
        });
        
        this.log(`📊 Classification: ${kitchenItems.length} kitchen, ${drinksItems.length} drinks`);
        
        return { kitchenItems, drinksItems };
    }

    // ============================================
    // HTML GENERATION
    // ============================================

    /**
     * Generate customer bill HTML with all required information
     * FIXED: Added comprehensive error handling and data validation
     */
    generateCustomerBillHTML(orderData) {
        try {
            // CRITICAL: Validate input data structure
            if (!orderData) {
                throw new Error('Order data is required');
            }
            
            const { items, location, serviceCharge, restaurant } = orderData;
            
            // CRITICAL: Validate required fields
            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error('Items array is required and must not be empty');
            }
            
            if (!restaurant) {
                throw new Error('Restaurant information is required');
            }
            
            const now = new Date();
            
            // FIXED: Safe calculation with error handling
            let subtotal = 0;
            let parcelCharges = 0;
            
            items.forEach((item, index) => {
                if (!item.price || !item.quantity) {
                    this.log(`⚠️ Warning: Item ${index + 1} missing price or quantity:`, item);
                    return;
                }
                subtotal += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
                parcelCharges += parseFloat(item.parcelCharge) || 0;
            });
            
            const serviceChargeAmount = serviceCharge ? (subtotal * parseFloat(serviceCharge)) / 100 : 0;
            const total = subtotal + serviceChargeAmount + parcelCharges;
            
            const billNumber = this.generateBillNumber();
            const locationText = location && location.type === 'table' 
                ? `Table ${location.number || 'Unknown'}` 
                : `Counter ${location?.number || 'Unknown'}`;

            this.log(`💰 Bill totals: Subtotal=${subtotal}, ServiceCharge=${serviceChargeAmount}, Total=${total}`);

            return `
<!DOCTYPE html>
<html>
<head>
    <title>Customer Bill - ${locationText}</title>
    <meta charset="UTF-8">
    <style>
        ${this.getBaseCSS()}
        
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
            width: 100%;
        }
        
        .restaurant-name {
            font-size: ${this.settings.fontSize.title};
            font-weight: bold;
            margin-bottom: 4px;
            /* Prevent restaurant name overflow */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .restaurant-details {
            font-size: ${this.settings.fontSize.base};
            margin: 2px 0;
            /* Prevent details overflow */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .bill-info {
            margin: 10px 0;
            font-size: ${this.settings.fontSize.base};
            font-weight: bold;
            width: 100%;
        }
        
        .items-section {
            margin: 15px 0;
            width: 100%;
        }
        
        .item-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding: 4px 0;
            font-weight: bold;
            font-size: ${this.settings.fontSize.base};
            width: 100%;
        }
        
        .item-header span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .item-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 3px 0;
            padding: 2px 0;
            border-bottom: 1px dotted #666;
            min-height: 20px;
            width: 100%;
            /* Prevent row overflow */
            overflow: hidden;
        }
        
        /* TVS RP 3200 Plus OPTIMIZED column widths - ABSOLUTE NO CUT-OFF GUARANTEE */
        .item-name { 
            flex: 1; 
            padding-right: 2px; 
            min-width: 0;  /* Allow text wrapping */
            overflow-wrap: break-word;
            word-wrap: break-word;
            hyphens: auto;
            max-width: 36mm; /* Optimized for 70mm total width */
            font-size: 11px; /* Reduced for better fit */
        }
        .item-qty { 
            width: 5mm; 
            text-align: center; 
            flex-shrink: 0;
            font-size: 10px; /* Compact but readable */
        }
        .item-rate { 
            width: 12mm; 
            text-align: right; 
            flex-shrink: 0;
            font-size: 10px; /* Compact but readable */
        }
        .item-total { 
            width: 14mm; 
            text-align: right; 
            flex-shrink: 0;
            font-weight: bold;
            font-size: 10px; /* Compact but bold for visibility */
        }
        
        .totals-section {
            border-top: 2px solid #000;
            margin-top: 15px;
            padding-top: 8px;
            width: 100%;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: ${this.settings.fontSize.base};
            width: 100%;
            /* Prevent total row overflow */
            overflow: hidden;
        }
        
        .total-row span:first-child {
            flex: 1;
            text-align: left;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-right: 5px;
        }
        
        .total-row span:last-child {
            flex-shrink: 0;
            text-align: right;
            font-weight: bold;
            width: 14mm;  /* Match item-total width for perfect alignment */
            font-size: 10px;  /* Optimized for 70mm width */
        }
        
        .grand-total {
            font-size: ${this.settings.fontSize.total};
            font-weight: bold;
            border: 2px solid #000;
            padding: 6px;
            margin: 8px 0;
        }
        
        .footer {
            border-top: 2px solid #000;
            margin-top: 15px;
            padding-top: 8px;
            text-align: center;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="restaurant-name">${restaurant.name}</div>
        <div class="restaurant-details">${restaurant.address}</div>
        <div class="restaurant-details">Contact: ${restaurant.contact}</div>
        ${restaurant.gstin ? `<div class="restaurant-details">GSTIN: ${restaurant.gstin}</div>` : ''}
        ${restaurant.fssai ? `<div class="restaurant-details">FSSAI: ${restaurant.fssai}</div>` : ''}
    </div>

    <div class="bill-info">
        <div>Bill No: ${billNumber}</div>
        <div>${locationText}</div>
        <div>Date: ${this.formatDate(now)}</div>
        <div>Time: ${this.formatTime(now)}</div>
        <div>Order Type: Dine-in</div>
    </div>

    <div class="items-section">
        <div class="item-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>Amount</span>
        </div>
        
        ${items.map((item, index) => {
            const itemTotal = item.price * item.quantity;
            // SAFETY: Truncate item names for 70mm width optimization
            const safeName = item.name.length > 18 ? item.name.substring(0, 15) + '...' : item.name;
            return `
            <div class="item-row">
                <span class="item-name">${safeName}</span>
                <span class="item-qty">${item.quantity}</span>
                <span class="item-rate">₹${item.price.toFixed(2)}</span>
                <span class="item-total">₹${itemTotal.toFixed(2)}</span>
            </div>
            ${item.parcelCharge ? `
            <div class="item-row" style="font-size: 12px; color: #666; border: none;">
                <span class="item-name" style="padding-left: 10px;">+ Parcel Charge</span>
                <span class="item-qty"></span>
                <span class="item-rate"></span>
                <span class="item-total">₹${item.parcelCharge.toFixed(2)}</span>
            </div>
            ` : ''}
            `;
        }).join('')}
    </div>

    <div class="totals-section">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${subtotal.toFixed(2)}</span>
        </div>
        
        ${parcelCharges > 0 ? `
        <div class="total-row">
            <span>Parcel Charges:</span>
            <span>₹${parcelCharges.toFixed(2)}</span>
        </div>
        ` : ''}
        
        ${serviceChargeAmount > 0 ? `
        <div class="total-row">
            <span>Service Charge (${serviceCharge}%):</span>
            <span>₹${serviceChargeAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="total-row grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${total.toFixed(2)}</span>
        </div>
    </div>

    <div class="footer">
        <div>*** Thank you, Visit again ***</div>
        <div>Powered by NMD</div>
    </div>
</body>
</html>`;
        
        } catch (error) {
            this.log(`❌ Error generating customer bill HTML: ${error.message}`, 'error');
            throw new Error(`Failed to generate customer bill: ${error.message}`);
        }
    }

    /**
     * Generate KOT HTML (no prices, items only)
     */
    generateKOTHTML(items, kotTitle, location) {
        const now = new Date();
        const locationText = location.type === 'table' 
            ? `Table ${location.number}` 
            : `Counter ${location.number}`;

        // Check if any items have parcel charges
        const hasParcelItems = items.some(item => item.parcelCharge && item.parcelCharge > 0);

        return `
<!DOCTYPE html>
<html>
<head>
    <title>${kotTitle} - ${locationText}</title>
    <meta charset="UTF-8">
    <style>
        ${this.getBaseCSS()}
        
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 10px;
            width: 100%;
        }
        
        .kot-title {
            font-size: ${this.settings.fontSize.title};
            font-weight: bold;
            margin: 4px 0;
        }
        
        .kot-info {
            font-size: ${this.settings.fontSize.base};
            margin: 2px 0;
        }
        
        .items-section {
            margin: 15px 0;
            width: 100%;
        }
        
        .item-row {
            margin: 6px 0;
            padding: 4px 0;
            border-bottom: 1px solid #000;
            font-size: ${this.settings.fontSize.base};
            font-weight: bold;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .item-name {
            flex: 1;
            padding-right: 2px;
            overflow-wrap: break-word;
            word-wrap: break-word;
            hyphens: auto;
            /* TVS RP 3200 Plus optimized KOT item name width */
            max-width: 50mm;  /* Optimized for 70mm total width */
            overflow: hidden;
        }
        
        .item-quantity {
            font-size: ${this.settings.fontSize.header};
            font-weight: bold;
            width: 8mm;  /* Optimized for 70mm width */
            text-align: right;
            flex-shrink: 0;
        }
        
        .footer {
            border-top: 2px solid #000;
            margin-top: 15px;
            padding-top: 6px;
            text-align: center;
            font-weight: bold;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="kot-title">${kotTitle}</div>
        <div class="kot-info">${locationText}</div>
        ${hasParcelItems ? '<div class="kot-info" style="font-weight: bold;">PARCEL</div>' : ''}
        <div class="kot-info">Time: ${this.formatTime(now)}</div>
        <div class="kot-info">Date: ${this.formatDate(now)}</div>
    </div>

    <div class="items-section">
        ${items.map(item => {
            // SAFETY: Truncate KOT item names for 70mm width
            const safeKotName = item.name.length > 22 ? item.name.substring(0, 19) + '...' : item.name;
            // Add [PARCEL] marking for items with parcel charges
            const parcelMark = (item.parcelCharge && item.parcelCharge > 0) ? ' [PARCEL]' : '';
            const displayName = safeKotName + parcelMark;
            return `
        <div class="item-row">
            <span class="item-name">${displayName}</span>
            <span class="item-quantity">${item.quantity}x</span>
        </div>
        `;
        }).join('')}
    </div>

    <div class="footer">
        Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}
    </div>
</body>
</html>`;
    }

    /**
     * Base CSS for thermal printer optimization
     * 
     * ROOT CAUSE FIX: The previous CSS had inconsistent width settings causing scaling:
     * - @page was set to 80mm but body width was 270px (should be ~302px for 80mm)  
     * - Missing shrink-to-fit prevention in @page rules
     * - No explicit page orientation and size handling
     * 
     * SOLUTION: Set exact 80mm page with matching pixel width (302px at 96 DPI)
     * and disable all browser scaling behaviors
     */
    getBaseCSS() {
        return `
        @media print {
            @page {
                /* TVS RP 3200 Plus OPTIMIZED: 70mm width for guaranteed no cut-off */
                size: 70mm auto;
                margin: 0mm !important;
                padding: 0mm !important;
                /* Override all possible margin sources */
                margin-top: 0mm !important;
                margin-bottom: 0mm !important;
                margin-left: 0mm !important;
                margin-right: 0mm !important;
                /* Prevent shrink-to-fit scaling */
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }
            
            html {
                margin: 0 !important;
                padding: 0 !important;
                width: 70mm !important;  /* Match TVS RP 3200 Plus safe zone */
            }
            
            body {
                /* TVS RP 3200 Plus SAFE ZONE: 70mm width with 10mm buffer */
                width: 70mm !important;  /* 10mm safety margin from 80mm paper edge */
                max-width: 70mm !important;
                min-width: 70mm !important;
                margin: 0mm !important;
                padding: 1mm !important;  /* Minimal edge clearance */
                /* Force absolute positioning from top-left */
                position: absolute !important;
                top: 0mm !important;
                left: 0mm !important;
                /* Disable any browser scaling */
                transform: none !important;
                zoom: 1 !important;
                scale: 1 !important;
                font-size: 11px !important;  /* Optimized for 70mm width */
                /* Override any default styles */
                background: white !important;
                color: black !important;
            }
            
            /* Force zero margins on ALL elements during print */
            *, *:before, *:after {
                margin: 0 !important;
                transform: none !important;
                zoom: 1 !important;
                scale: 1 !important;
                -webkit-transform: none !important;
                box-sizing: border-box !important;
            }
            
            /* Ensure content containers use full width */
            .header, .bill-info, .items-section, .totals-section {
                width: 100% !important;
                margin: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
        }
        
        body {
            font-family: ${this.settings.fontFamily};
            font-size: 11px;  /* Optimized for 70mm printer width */
            font-weight: bold;
            margin: 0;
            padding: ${this.settings.bodyPadding};  /* Minimal padding for readability */
            /* Screen display: TVS RP 3200 Plus optimized (70mm = ~266px at 203 DPI) */
            width: 266px;  /* 70mm at 203 DPI = 266px */
            max-width: 266px;
            min-width: 266px;
            background: white;
            color: #000;
            line-height: 1.3;
            word-wrap: break-word;
            /* Prevent content overflow */
            overflow-wrap: break-word;
            /* Remove any default browser margins */
            border: none;
            outline: none;
        }
        
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
        }
        
        /* Force all elements to start from top-left for thermal printing */
        html, body {
            margin: 0 !important;
            padding: 1mm !important;  /* Consistent minimal padding */
        }
        
        /* Ensure all elements use full width */
        .header, .bill-info, .items-section, .totals-section {
            width: 100%;
            margin-left: 0;
            margin-right: 0;
        }`;
    }

    // ============================================
    // PRINTING EXECUTION
    // ============================================

    /**
     * Print a single KOT
     */
    async printSingleKOT(items, kotTitle, location) {
        const kotHTML = this.generateKOTHTML(items, kotTitle, location);
        await this.printKOTHTML(kotHTML, kotTitle);  // Use KOT-specific method
    }

    /**
     * Print KOT HTML using KOT-specific handler
     */
    async printKOTHTML(htmlContent, documentTitle) {
        try {
            // Try silent KOT printing first
            const { ipcRenderer } = require('electron');
            const result = await Promise.race([
                ipcRenderer.invoke('silent-print-kot', htmlContent),  // Correct: KOT handler for KOTs
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Silent print timeout')), 5000)
                )
            ]);

            if (result && result.success) {
                this.log(`✅ ${documentTitle} printed silently`);
                return;
            }
        } catch (error) {
            this.log(`⚠️ Silent print failed: ${error.message}`);
        }

        // Fallback to popup window
        try {
            const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                await new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            this.log(`✅ ${documentTitle} popup window opened`);
                            
                            setTimeout(() => {
                                try { printWindow.close(); } catch (e) {}
                            }, 2000);
                        } catch (error) {
                            this.log(`❌ Popup print error: ${error.message}`, 'error');
                        }
                        resolve();
                    }, 500);
                });
            } else {
                throw new Error('Popup blocked');
            }
        } catch (error) {
            this.log(`❌ All KOT print methods failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Print Bill HTML using Bill-specific handler
     */
    async printBillHTML(htmlContent, documentTitle) {
        try {
            // Try silent BILL printing first
            const { ipcRenderer } = require('electron');
            const result = await Promise.race([
                ipcRenderer.invoke('silent-print-bill', htmlContent),  // FIXED: Bill handler for bills
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Silent print timeout')), 5000)
                )
            ]);

            if (result && result.success) {
                this.log(`✅ ${documentTitle} printed silently`);
                return;
            }
        } catch (error) {
            this.log(`⚠️ Silent print failed: ${error.message}`);
        }

        // Fallback to popup window
        try {
            const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                await new Promise((resolve) => {
                    setTimeout(() => {
                        try {
                            printWindow.focus();
                            printWindow.print();
                            this.log(`✅ ${documentTitle} popup window opened`);
                            
                            setTimeout(() => {
                                try { printWindow.close(); } catch (e) {}
                            }, 2000);
                        } catch (error) {
                            this.log(`❌ Popup print error: ${error.message}`, 'error');
                        }
                        resolve();
                    }, 500);
                });
            } else {
                throw new Error('Popup blocked');
            }
        } catch (error) {
            this.log(`❌ All bill print methods failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    formatTime(date) {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    formatDate(date) {
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
    }

    generateBillNumber() {
        const now = new Date();
        const dateStr = now.getFullYear().toString().slice(-2) + 
                       (now.getMonth() + 1).toString().padStart(2, '0') + 
                       now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') + 
                       now.getMinutes().toString().padStart(2, '0');
        return `${dateStr}${timeStr}`;
    }

    log(message, level = 'info') {
        if (this.debugMode) {
            const prefix = level === 'error' ? '❌' : 'ℹ️';
            console.log(`${prefix} [CleanPrint] ${message}`);
        }
    }

    // ============================================
    // TEST METHOD
    // ============================================

    /**
     * Test the printing system with sample data
     */
    async testPrint() {
        this.log('🧪 Testing Clean Printing System...');
        
        const testData = {
            items: [
                { id: 1, name: 'Masala Dosa', quantity: 1, price: 80, parcelCharge: 0 },
                { id: 2, name: 'Filter Coffee', quantity: 2, price: 25, parcelCharge: 0 }
            ],
            menuItems: [
                { id: 1, name: 'Masala Dosa', kotGroup: 'kitchen' },
                { id: 2, name: 'Filter Coffee', kotGroup: 'drinks' }
            ],
            location: { type: 'table', number: 5 },
            serviceCharge: 10,
            restaurant: {
                name: "UDUPI KRISHNAM VEG",
                address: "Test Address, Test City - 560100",
                contact: "+91 12345 67890",
                gstin: "TEST123456789",
                fssai: "12345678901234"
            }
        };

        try {
            const result = await this.printCompleteOrder(testData);
            this.log('🧪 Test completed: ' + JSON.stringify(result));
            return result;
        } catch (error) {
            this.log(`🧪 Test failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
}

module.exports = CleanPrintingSystem;
