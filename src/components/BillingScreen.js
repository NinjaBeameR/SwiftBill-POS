// BillingScreen Component - Handles order management and menu display
const helpers = require('../utils/helpers');

class BillingScreen {
    constructor(onBackCallback) {
        this.onBack = onBackCallback;
        this.currentTable = null;
        this.currentOrder = [];
        this.menuItems = [];
        
        this.init();
    }

    init() {
        this.loadMenu();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard navigation support
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.handleKeyPress(e);
            }
        });
    }

    async loadMenu() {
        try {
            // Load menu from storage
            const menuData = require('../storage/menu.json');
            this.menuItems = menuData.items;
            this.renderMenu();
        } catch (error) {
            console.error('Error loading menu:', error);
            // Use fallback menu if file doesn't exist
            this.loadFallbackMenu();
        }
    }

    loadFallbackMenu() {
        // Fallback menu items
        this.menuItems = [
            { id: 1, name: 'Masala Dosa', price: 80, category: 'South Indian' },
            { id: 2, name: 'Idli Sambar', price: 50, category: 'South Indian' },
            { id: 3, name: 'Vada Sambar', price: 60, category: 'South Indian' },
            { id: 4, name: 'Rava Dosa', price: 90, category: 'South Indian' },
            { id: 5, name: 'Poori Bhaji', price: 70, category: 'North Indian' },
            { id: 6, name: 'Chapati', price: 15, category: 'North Indian' },
            { id: 7, name: 'Tea', price: 15, category: 'Beverages' },
            { id: 8, name: 'Coffee', price: 20, category: 'Beverages' }
        ];
        this.renderMenu();
    }

    renderMenu() {
        const menuGrid = document.getElementById('menu-grid');
        menuGrid.innerHTML = '';

        this.menuItems.forEach(item => {
            const menuItemElement = this.createMenuItemElement(item);
            menuGrid.appendChild(menuItemElement);
        });
    }

    createMenuItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'menu-item';
        itemDiv.dataset.itemId = item.id;

        itemDiv.innerHTML = `
            <div class="menu-item-name">${item.name}</div>
            <div class="menu-item-price">₹${item.price}</div>
            <div class="menu-item-category">${item.category}</div>
        `;

        itemDiv.addEventListener('click', () => {
            this.addItemToOrder(item);
        });

        return itemDiv;
    }

    addItemToOrder(item) {
        // Check if item already exists in order
        const existingItem = this.currentOrder.find(orderItem => orderItem.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.currentOrder.push({
                ...item,
                quantity: 1
            });
        }

        this.renderOrder();
        this.updateTotals();
    }

    removeItemFromOrder(itemId) {
        const itemIndex = this.currentOrder.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
            this.currentOrder.splice(itemIndex, 1);
            this.renderOrder();
            this.updateTotals();
        }
    }

    updateItemQuantity(itemId, newQuantity) {
        const item = this.currentOrder.find(orderItem => orderItem.id === itemId);
        if (item) {
            if (newQuantity <= 0) {
                this.removeItemFromOrder(itemId);
            } else {
                item.quantity = newQuantity;
                this.renderOrder();
                this.updateTotals();
            }
        }
    }

    renderOrder() {
        const orderItemsContainer = document.getElementById('order-items');
        orderItemsContainer.innerHTML = '';

        if (this.currentOrder.length === 0) {
            orderItemsContainer.innerHTML = '<div class="no-items">No items in order</div>';
            return;
        }

        this.currentOrder.forEach(item => {
            const orderItemElement = this.createOrderItemElement(item);
            orderItemsContainer.appendChild(orderItemElement);
        });
    }

    createOrderItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        itemDiv.dataset.itemId = item.id;

        itemDiv.innerHTML = `
            <div class="order-item-name">${item.name}</div>
            <div class="order-item-controls">
                <button class="qty-btn minus" onclick="posApp.billingScreen.updateItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="qty-btn plus" onclick="posApp.billingScreen.updateItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <div class="order-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
            <button class="remove-btn" onclick="posApp.billingScreen.removeItemFromOrder(${item.id})">×</button>
        `;

        return itemDiv;
    }

    updateTotals() {
        const subtotal = this.getSubtotal();
        const tax = this.getTax();
        const total = this.getTotal();

        document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `₹${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `₹${total.toFixed(2)}`;
    }

    getSubtotal() {
        return this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getTax() {
        return this.getSubtotal() * 0.05; // 5% tax
    }

    getTotal() {
        return this.getSubtotal() + this.getTax();
    }

    loadTable(tableNumber) {
        this.currentTable = tableNumber;
        // Load any existing order for this table
        this.loadTableOrder(tableNumber);
    }

    loadTableOrder(tableNumber) {
        try {
            const savedOrders = localStorage.getItem(`table_${tableNumber}_order`);
            if (savedOrders) {
                this.currentOrder = JSON.parse(savedOrders);
                this.renderOrder();
                this.updateTotals();
            } else {
                this.currentOrder = [];
                this.renderOrder();
                this.updateTotals();
            }
        } catch (error) {
            console.error('Error loading table order:', error);
            this.currentOrder = [];
        }
    }

    saveTableOrder() {
        if (this.currentTable) {
            try {
                localStorage.setItem(`table_${this.currentTable}_order`, JSON.stringify(this.currentOrder));
            } catch (error) {
                console.error('Error saving table order:', error);
            }
        }
    }

    clearOrder() {
        this.currentOrder = [];
        this.renderOrder();
        this.updateTotals();
        
        // Remove saved order data
        if (this.currentTable) {
            localStorage.removeItem(`table_${this.currentTable}_order`);
        }
    }

    generateKOTContent(orderData) {
        const { tableNumber, items, timestamp, kotType } = orderData;
        const date = new Date(timestamp);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>KOT - ${kotType.toUpperCase()}</title>
                <meta charset="UTF-8">
                <style>
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body { 
                            margin: 0 !important; 
                            padding: 2mm !important; 
                        }
                        body, table { 
                            font-size: 12px;
                        }
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                            color: #000000 !important;
                            border-color: #000000 !important;
                        }
                    }
                    body { 
                        font-family: 'Courier New', monospace !important;
                        font-size: 12px;
                        font-weight: bold !important;
                        margin: 0; 
                        padding: 2mm;
                        width: 270px;
                        max-width: 270px;
                        background: white !important;
                        color: #000000 !important;
                        line-height: 1.3;
                        -webkit-font-smoothing: none !important;
                        font-smoothing: none !important;
                        text-rendering: geometricPrecision !important;
                        box-sizing: border-box;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        image-rendering: pixelated !important;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 8px; 
                        box-sizing: border-box;
                    }
                    .kot-title { 
                        font-weight: bold !important;
                        font-size: 16px;
                        margin-bottom: 4px; 
                        color: #000000 !important;
                        letter-spacing: 0.5px;
                        word-wrap: break-word;
                    }
                    .table-info { 
                        font-size: 12px;
                        margin: 2px 0; 
                        font-weight: bold !important;
                        color: #000000 !important;
                        line-height: 1.2;
                        word-wrap: break-word;
                    }
                    .items { 
                        margin: 8px 0; 
                        padding: 4px 0; 
                        border-top: 1px solid #000; 
                        border-bottom: 1px solid #000;
                    }
                    .item { 
                        margin: 3px 0; 
                        font-size: 12px; 
                        font-weight: bold !important;
                        color: #000000 !important;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 8px; 
                        font-size: 10px; 
                        font-weight: bold !important;
                        color: #000000 !important;
                    }
                    .separator { 
                        border-top: 1px solid #000; 
                        margin: 4px 0; 
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="kot-title">${kotType.toUpperCase()} ORDER</div>
                    <div class="table-info">Table: ${tableNumber}</div>
                    <div class="table-info">Time: ${date.toLocaleTimeString()}</div>
                    <div class="table-info">Date: ${date.toLocaleDateString()}</div>
                </div>
                
                <div class="items">
                    ${items.map(item => `<div class="item">${item.quantity}x ${item.name}</div>`).join('')}
                </div>
                
                <div class="separator"></div>
                
                <div class="footer">
                    Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
            </body>
            </html>
        `;
    }

    async printOrderAutoSilent() {
        console.log('🚀 printOrderAutoSilent called');
        
        if (this.currentOrder.length === 0) {
            console.log('❌ No items to print');
            return;
        }
        
        try {
            console.log('📋 Starting centralized printing...');
            
            // Use centralized printing manager from the app instance
            if (window.app && window.app.printingManager) {
                const orderData = {
                    items: this.currentOrder.map(item => ({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    menuItems: this.menuItems,
                    location: { 
                        type: 'table', 
                        number: this.currentTable 
                    },
                    serviceCharge: 0,
                    restaurant: {
                        name: 'Udupi Hotel',
                        contact: '123-456-7890',
                        address: 'Restaurant Address',
                        gstin: 'GSTIN123456',
                        fssai: 'FSSAI123456'
                    }
                };
                
                const result = await window.app.printingManager.printKOTs(orderData);
                console.log('📋 Centralized KOT printing result:', result);
                
                if (result.success) {
                    console.log(`✅ Centralized KOT printing successful: ${result.summary.kotsPrinted}/${result.summary.kotsTotal} KOTs printed`);
                } else {
                    console.error('❌ Centralized KOT printing failed');
                }
            } else {
                console.error('❌ Centralized printing manager not available');
            }
        } catch (error) {
            console.error('❌ Error in printOrderAutoSilent:', error);
        }
    }

    handleKeyPress(e) {
        // Keyboard shortcuts for billing screen
        switch(e.key) {
            case 'Escape':
                this.onBack();
                break;
            case 'F1':
                e.preventDefault();
                this.printOrderAutoSilent();
                break;
            case 'F2':
                e.preventDefault();
                window.posApp.printBill();
                break;
        }
    }
}

module.exports = BillingScreen;
