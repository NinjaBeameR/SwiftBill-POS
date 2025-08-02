// Main renderer process - handles UI logic and component coordination
const { ipcRenderer } = require('electron');

// Wait for DOM to load and then initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize the POS app
    window.posApp = new POSApp();
});

class POSApp {
    constructor() {
        this.currentTable = null;
        this.currentCounter = null;
        this.currentOrder = [];
        this.billingMode = null; // 'table' or 'counter'
        this.currentLocation = null; // table number or counter number
        
        // Search functionality variables
        this.searchDebounceTimer = null;
        this.currentSearchResults = [];
        this.selectedSearchIndex = -1;
        
        this.init();
    }

    init() {
        // Initialize components inline since module loading is complex in renderer
        this.initTableSelector();
        this.initCounterSelector();
        this.initBillingScreen();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize header
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
        
        // Load service selector by default
        this.showServiceSelector();
    }

    initTableSelector() {
        // Inline table selector functionality
        this.totalTables = 14;
        this.activeTables = new Set();
        this.loadActiveTableData();
        this.refreshActiveTables(); // Check all tables for active orders
    }

    initCounterSelector() {
        // Inline counter selector functionality
        this.totalCounters = 6;
        this.activeCounters = new Set();
        this.loadActiveCounterData();
        this.refreshActiveCounters(); // Check all counters for active orders
    }

    initBillingScreen() {
        // Load menu items from JSON file
        this.loadMenuItems();
    }

    async loadMenuItems() {
        try {
            const fs = require('fs');
            const path = require('path');
            const menuPath = path.join(__dirname, 'src', 'storage', 'menu.json');
            const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
            this.menuItems = menuData.items || [];
        } catch (error) {
            console.error('Error loading menu items:', error);
            // Fallback to hardcoded items if loading fails
            this.menuItems = [
                { id: 1, name: 'Masala Dosa', price: 80, category: 'South Indian' },
                { id: 2, name: 'Plain Dosa', price: 60, category: 'South Indian' },
                { id: 3, name: 'Rava Dosa', price: 90, category: 'South Indian' },
                { id: 4, name: 'Set Dosa', price: 70, category: 'South Indian' },
                { id: 5, name: 'Idli Sambar (2 pcs)', price: 50, category: 'South Indian' },
                { id: 6, name: 'Vada Sambar (2 pcs)', price: 60, category: 'South Indian' },
                { id: 7, name: 'Idli Vada Combo', price: 65, category: 'South Indian' },
                { id: 8, name: 'Upma', price: 45, category: 'South Indian' },
                { id: 9, name: 'Poori Bhaji', price: 70, category: 'North Indian' },
                { id: 10, name: 'Chapati (2 pcs)', price: 30, category: 'North Indian' },
                { id: 11, name: 'Dal Rice', price: 85, category: 'North Indian' },
                { id: 12, name: 'Sambar Rice', price: 75, category: 'South Indian' },
                { id: 13, name: 'Curd Rice', price: 55, category: 'South Indian' },
                { id: 14, name: 'Tea', price: 15, category: 'Beverages' },
                { id: 15, name: 'Coffee', price: 20, category: 'Beverages' },
                { id: 16, name: 'Lassi', price: 35, category: 'Beverages' },
                { id: 17, name: 'Fresh Lime Water', price: 25, category: 'Beverages' },
                { id: 18, name: 'Buttermilk', price: 20, category: 'Beverages' }
            ];
        }
    }

    setupEventListeners() {
        // Service type selection
        document.getElementById('table-service-btn').addEventListener('click', () => {
            this.showTableSelector();
        });

        document.getElementById('counter-service-btn').addEventListener('click', () => {
            this.showCounterSelector();
        });

        // Back buttons
        document.getElementById('back-to-service').addEventListener('click', () => {
            this.showServiceSelector();
        });

        document.getElementById('back-to-service-counter').addEventListener('click', () => {
            this.showServiceSelector();
        });

        document.getElementById('back-to-tables').addEventListener('click', () => {
            if (this.billingMode === 'table') {
                this.showTableSelector();
            } else {
                this.showCounterSelector();
            }
        });

        // Print button
        document.getElementById('print-order').addEventListener('click', () => {
            this.printOrder();
        });

        // Search functionality
        this.setupSearchListeners();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'Escape':
                    if (document.getElementById('billing-screen').classList.contains('active')) {
                        if (this.billingMode === 'table') {
                            this.showTableSelector();
                        } else {
                            this.showCounterSelector();
                        }
                    } else if (document.getElementById('table-selector-screen').classList.contains('active') || 
                              document.getElementById('counter-selector-screen').classList.contains('active')) {
                        this.showServiceSelector();
                    }
                    break;
                case 'F1':
                    e.preventDefault();
                    this.printOrder();
                    break;
                case 'F2':
                    e.preventDefault();
                    this.printOrder();
                    break;
                case 'F3':
                    e.preventDefault();
                    // Focus on search if billing screen is active
                    if (document.getElementById('billing-screen').classList.contains('active')) {
                        document.getElementById('menu-search').focus();
                    }
                    break;
                case 'F4':
                    e.preventDefault();
                    // Test print functionality
                    if (document.getElementById('billing-screen').classList.contains('active')) {
                        this.testPrint();
                    }
                    break;
                case '/':
                    // Quick search shortcut
                    if (document.getElementById('billing-screen').classList.contains('active') && 
                        !e.target.matches('input, textarea')) {
                        e.preventDefault();
                        document.getElementById('menu-search').focus();
                    }
                    break;
            }
        });
    }

    setupSearchListeners() {
        const searchInput = document.getElementById('menu-search');
        const searchResults = document.getElementById('search-results');

        // Search input event with debouncing
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Clear previous timer
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            // Debounce search with 300ms delay
            this.searchDebounceTimer = setTimeout(() => {
                this.performSearch(query);
            }, 300);
        });

        // Keyboard navigation in search
        searchInput.addEventListener('keydown', (e) => {
            if (!searchResults.classList.contains('show')) return;

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateSearchResults('down');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateSearchResults('up');
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectHighlightedSearchResult();
                    break;
                case 'Escape':
                    this.hideSearchResults();
                    searchInput.blur();
                    break;
            }
        });

        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSearchResults();
            }
        });

        // Clear search when focusing on search input
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                this.performSearch(searchInput.value.trim());
            }
        });
    }

    performSearch(query) {
        const searchResults = document.getElementById('search-results');
        
        if (!query) {
            this.hideSearchResults();
            return;
        }

        // Filter menu items based on query - only match item name
        this.currentSearchResults = this.menuItems.filter(item => 
            item.name.toLowerCase().includes(query.toLowerCase())
        );

        this.selectedSearchIndex = -1; // Reset selection
        this.renderSearchResults(query);
        
        if (this.currentSearchResults.length > 0) {
            searchResults.classList.add('show');
        } else {
            this.hideSearchResults();
        }
    }

    renderSearchResults(query) {
        const searchResults = document.getElementById('search-results');
        
        if (this.currentSearchResults.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No items found</div>';
            return;
        }

        const resultsHTML = this.currentSearchResults.map((item, index) => {
            // Apply discount for counter billing in search results
            const finalPrice = (this.billingMode === 'counter') ? Math.max(0, item.price - 5) : item.price;
            
            // Highlight matching text
            const highlightedName = this.highlightSearchText(item.name, query);
            const highlightedCategory = this.highlightSearchText(item.category, query);
            
            return `
                <div class="search-result-item" data-index="${index}" data-item-id="${item.id}">
                    <div>
                        <div class="search-result-name">${highlightedName}</div>
                        <div class="search-result-category">${highlightedCategory}</div>
                    </div>
                    <div class="search-result-price">₹${finalPrice}</div>
                </div>
            `;
        }).join('');

        searchResults.innerHTML = resultsHTML;

        // Add click listeners to search results
        searchResults.querySelectorAll('.search-result-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectSearchResult(index);
            });
        });
    }

    highlightSearchText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    navigateSearchResults(direction) {
        const searchResults = document.getElementById('search-results');
        const items = searchResults.querySelectorAll('.search-result-item');
        
        if (items.length === 0) return;

        // Remove current highlight
        if (this.selectedSearchIndex >= 0) {
            items[this.selectedSearchIndex].classList.remove('highlighted');
        }

        // Calculate new index
        if (direction === 'down') {
            this.selectedSearchIndex = (this.selectedSearchIndex + 1) % items.length;
        } else {
            this.selectedSearchIndex = this.selectedSearchIndex <= 0 ? items.length - 1 : this.selectedSearchIndex - 1;
        }

        // Add new highlight
        items[this.selectedSearchIndex].classList.add('highlighted');
        
        // Scroll into view
        items[this.selectedSearchIndex].scrollIntoView({ block: 'nearest' });
    }

    selectHighlightedSearchResult() {
        if (this.selectedSearchIndex >= 0 && this.selectedSearchIndex < this.currentSearchResults.length) {
            this.selectSearchResult(this.selectedSearchIndex);
        }
    }

    selectSearchResult(index) {
        const selectedItem = this.currentSearchResults[index];
        if (selectedItem) {
            // Add item to order using existing logic
            this.addItemToOrder(selectedItem);
            
            // Clear search and hide results
            document.getElementById('menu-search').value = '';
            this.hideSearchResults();
            
            // Optional: Show feedback
            this.showSearchFeedback(selectedItem.name);
        }
    }

    hideSearchResults() {
        const searchResults = document.getElementById('search-results');
        searchResults.classList.remove('show');
        this.currentSearchResults = [];
        this.selectedSearchIndex = -1;
    }

    showSearchFeedback(itemName) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'search-feedback';
        feedback.textContent = `Added "${itemName}" to order`;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(feedback);
        
        // Remove feedback after 2 seconds
        setTimeout(() => {
            feedback.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }

    updateDateTime() {
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'short', day: '2-digit' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-IN', dateOptions);
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-IN', timeOptions);
    }

    onTableSelect(tableNumber) {
        this.currentTable = tableNumber;
        this.currentLocation = tableNumber;
        this.billingMode = 'table';
        this.showBillingScreen();
    }

    onCounterSelect(counterNumber) {
        this.currentCounter = counterNumber;
        this.currentLocation = counterNumber;
        this.billingMode = 'counter';
        this.showBillingScreen();
    }

    showServiceSelector() {
        document.getElementById('service-selector-screen').classList.add('active');
        document.getElementById('table-selector-screen').classList.remove('active');
        document.getElementById('counter-selector-screen').classList.remove('active');
        document.getElementById('billing-screen').classList.remove('active');
        this.resetCurrentState();
    }

    showTableSelector() {
        document.getElementById('service-selector-screen').classList.remove('active');
        document.getElementById('table-selector-screen').classList.add('active');
        document.getElementById('counter-selector-screen').classList.remove('active');
        document.getElementById('billing-screen').classList.remove('active');
        this.resetCurrentState();
        this.renderTables();
    }

    showCounterSelector() {
        document.getElementById('service-selector-screen').classList.remove('active');
        document.getElementById('table-selector-screen').classList.remove('active');
        document.getElementById('counter-selector-screen').classList.add('active');
        document.getElementById('billing-screen').classList.remove('active');
        this.resetCurrentState();
        this.renderCounters();
    }

    resetCurrentState() {
        this.currentTable = null;
        this.currentCounter = null;
        this.currentLocation = null;
        this.billingMode = null;
    }

    async showBillingScreen() {
        document.getElementById('service-selector-screen').classList.remove('active');
        document.getElementById('table-selector-screen').classList.remove('active');
        document.getElementById('counter-selector-screen').classList.remove('active');
        document.getElementById('billing-screen').classList.add('active');
        
        // Update header based on billing mode
        if (this.billingMode === 'table') {
            document.getElementById('current-location').textContent = `Table ${this.currentLocation}`;
            document.getElementById('billing-mode-text').textContent = 'Table Service';
            document.getElementById('back-to-tables').textContent = '← Back to Tables';
        } else {
            document.getElementById('current-location').textContent = `Counter ${this.currentLocation}`;
            document.getElementById('billing-mode-text').textContent = 'Counter Billing';
            document.getElementById('back-to-tables').textContent = '← Back to Counters';
        }
        
        // Ensure menu items are loaded
        if (!this.menuItems || this.menuItems.length === 0) {
            await this.loadMenuItems();
        }
        
        // Load order and render menu/order
        this.loadCurrentOrder();
        this.renderMenu();
        this.renderOrder();
        this.updateTotals();
        
        // Clear any existing search
        document.getElementById('menu-search').value = '';
        this.hideSearchResults();
    }

    renderCounters() {
        const countersGrid = document.getElementById('counters-grid');
        countersGrid.innerHTML = '';

        for (let i = 1; i <= this.totalCounters; i++) {
            const counterDiv = document.createElement('div');
            counterDiv.className = 'counter-card';
            counterDiv.dataset.counterNumber = i;
            
            // Check if counter has orders and get order details
            const counterOrder = this.getCounterOrderInfo(i);
            const hasOrders = counterOrder.itemCount > 0;
            
            if (hasOrders) {
                counterDiv.classList.add('active');
            }

            counterDiv.innerHTML = `
                <div class="counter-number">Counter ${i}</div>
                <div class="counter-status">
                    ${hasOrders ? 
                        `<span class="status-occupied">• Active Order</span>
                         <div class="order-summary">
                             <small>${counterOrder.itemCount} items • ₹${counterOrder.total.toFixed(2)}</small>
                         </div>` : 
                        '<span class="status-available">Available</span>'
                    }
                </div>
            `;

            counterDiv.addEventListener('click', () => {
                counterDiv.classList.add('selected');
                setTimeout(() => this.onCounterSelect(i), 150);
            });

            countersGrid.appendChild(counterDiv);
        }
    }

    getCounterOrderInfo(counterNumber) {
        try {
            const savedOrder = localStorage.getItem(`counter_${counterNumber}_order`);
            const orderItems = savedOrder ? JSON.parse(savedOrder) : [];
            
            const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            return { itemCount, subtotal: total, tax: 0, total };
        } catch (error) {
            console.error('Error getting counter order info:', error);
            return { itemCount: 0, subtotal: 0, tax: 0, total: 0 };
        }
    }

    renderTables() {
        const tablesGrid = document.getElementById('tables-grid');
        tablesGrid.innerHTML = '';

        for (let i = 1; i <= this.totalTables; i++) {
            const tableDiv = document.createElement('div');
            tableDiv.className = 'table-card';
            tableDiv.dataset.tableNumber = i;
            
            // Check if table has orders and get order details
            const tableOrder = this.getTableOrderInfo(i);
            const hasOrders = tableOrder.itemCount > 0;
            
            if (hasOrders) {
                tableDiv.classList.add('active');
            }

            tableDiv.innerHTML = `
                <div class="table-number">Table ${i}</div>
                <div class="table-status">
                    ${hasOrders ? 
                        `<span class="status-occupied">• Active Bill</span>
                         <div class="order-summary">
                             <small>${tableOrder.itemCount} items • ₹${tableOrder.total.toFixed(2)}</small>
                         </div>` : 
                        '<span class="status-available">Available</span>'
                    }
                </div>
            `;

            tableDiv.addEventListener('click', () => {
                tableDiv.classList.add('selected');
                setTimeout(() => this.onTableSelect(i), 150);
            });

            tablesGrid.appendChild(tableDiv);
        }
    }

    getTableOrderInfo(tableNumber) {
        try {
            const savedOrder = localStorage.getItem(`table_${tableNumber}_order`);
            const orderItems = savedOrder ? JSON.parse(savedOrder) : [];
            
            const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            return { itemCount, subtotal: total, tax: 0, total };
        } catch (error) {
            console.error('Error getting table order info:', error);
            return { itemCount: 0, subtotal: 0, tax: 0, total: 0 };
        }
    }

    renderMenu() {
        const menuGrid = document.getElementById('menu-grid');
        menuGrid.innerHTML = '';

        this.menuItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'menu-item';
            
            // Calculate discounted price for counter billing
            const isCounterMode = this.billingMode === 'counter';
            const discountedPrice = isCounterMode ? Math.max(0, item.price - 5) : item.price;
            
            itemDiv.innerHTML = `
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-price">
                    ₹${discountedPrice}
                </div>
                <div class="menu-item-category">${item.category}</div>
            `;

            itemDiv.addEventListener('click', () => this.addItemToOrder(item));
            menuGrid.appendChild(itemDiv);
        });
    }

    addItemToOrder(item) {
        // Apply discount for counter billing when adding item
        const finalPrice = (this.billingMode === 'counter') ? Math.max(0, item.price - 5) : item.price;
        
        const existingItem = this.currentOrder.find(orderItem => orderItem.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.currentOrder.push({ 
                ...item, 
                price: finalPrice, // Store the final price (with discount if applicable)
                originalPrice: item.price, // Keep original price for reference
                quantity: 1 
            });
        }

        // Mark location as active
        if (this.billingMode === 'table') {
            this.activeTables.add(this.currentTable);
            this.saveActiveTableData();
        } else {
            this.activeCounters.add(this.currentCounter);
            this.saveActiveCounterData();
        }
        
        this.saveCurrentOrder();
        this.renderOrder();
        this.updateTotals();
    }

    renderOrder() {
        const orderItemsContainer = document.getElementById('order-items');
        orderItemsContainer.innerHTML = '';

        if (this.currentOrder.length === 0) {
            orderItemsContainer.innerHTML = '<div class="no-items">No items in order</div>';
            return;
        }

        this.currentOrder.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'order-item';
            
            itemDiv.innerHTML = `
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-controls">
                    <button class="qty-btn minus" onclick="posApp.updateItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="qty-btn plus" onclick="posApp.updateItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
                <div class="order-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
                <button class="remove-btn" onclick="posApp.removeItemFromOrder(${item.id})">×</button>
            `;

            orderItemsContainer.appendChild(itemDiv);
        });
    }

    updateItemQuantity(itemId, newQuantity) {
        const item = this.currentOrder.find(orderItem => orderItem.id === itemId);
        if (item) {
            if (newQuantity <= 0) {
                this.removeItemFromOrder(itemId);
            } else {
                item.quantity = newQuantity;
                this.saveCurrentOrder();
                this.renderOrder();
                this.updateTotals();
            }
        }
    }

    removeItemFromOrder(itemId) {
        const itemIndex = this.currentOrder.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
            this.currentOrder.splice(itemIndex, 1);
            this.saveCurrentOrder();
            this.renderOrder();
            this.updateTotals();
            
            if (this.currentOrder.length === 0) {
                if (this.billingMode === 'table') {
                    this.activeTables.delete(this.currentTable);
                    this.saveActiveTableData();
                } else {
                    this.activeCounters.delete(this.currentCounter);
                    this.saveActiveCounterData();
                }
            }
        }
    }

    updateTotals() {
        const subtotal = this.getSubtotal();
        const total = this.getTotal();

        document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `₹0.00`;
        document.getElementById('total').textContent = `₹${total.toFixed(2)}`;
    }

    getSubtotal() {
        return this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getTax() {
        return 0; // No tax applied
    }

    getTotal() {
        return this.getSubtotal(); // Total equals subtotal (no tax)
    }

    loadCurrentOrder() {
        try {
            const storageKey = this.billingMode === 'table' ? 
                `table_${this.currentLocation}_order` : 
                `counter_${this.currentLocation}_order`;
            const savedOrder = localStorage.getItem(storageKey);
            this.currentOrder = savedOrder ? JSON.parse(savedOrder) : [];
        } catch (error) {
            console.error('Error loading current order:', error);
            this.currentOrder = [];
        }
    }

    saveCurrentOrder() {
        if (this.currentLocation && this.billingMode) {
            try {
                const storageKey = this.billingMode === 'table' ? 
                    `table_${this.currentLocation}_order` : 
                    `counter_${this.currentLocation}_order`;
                localStorage.setItem(storageKey, JSON.stringify(this.currentOrder));
            } catch (error) {
                console.error('Error saving current order:', error);
            }
        }
    }

    refreshActiveTables() {
        this.activeTables.clear();
        for (let i = 1; i <= this.totalTables; i++) {
            const tableInfo = this.getTableOrderInfo(i);
            if (tableInfo.itemCount > 0) {
                this.activeTables.add(i);
            }
        }
        this.saveActiveTableData();
    }

    refreshActiveCounters() {
        this.activeCounters.clear();
        for (let i = 1; i <= this.totalCounters; i++) {
            const counterInfo = this.getCounterOrderInfo(i);
            if (counterInfo.itemCount > 0) {
                this.activeCounters.add(i);
            }
        }
        this.saveActiveCounterData();
    }

    loadActiveTableData() {
        try {
            const savedActiveTables = localStorage.getItem('activeTables');
            if (savedActiveTables) {
                this.activeTables = new Set(JSON.parse(savedActiveTables));
            }
        } catch (error) {
            console.error('Error loading active table data:', error);
        }
    }

    saveActiveTableData() {
        try {
            localStorage.setItem('activeTables', JSON.stringify(Array.from(this.activeTables)));
        } catch (error) {
            console.error('Error saving active table data:', error);
        }
    }

    loadActiveCounterData() {
        try {
            const savedActiveCounters = localStorage.getItem('activeCounters');
            if (savedActiveCounters) {
                this.activeCounters = new Set(JSON.parse(savedActiveCounters));
            }
        } catch (error) {
            console.error('Error loading active counter data:', error);
        }
    }

    saveActiveCounterData() {
        try {
            localStorage.setItem('activeCounters', JSON.stringify(Array.from(this.activeCounters)));
        } catch (error) {
            console.error('Error saving active counter data:', error);
        }
    }

    async printOrder() {
        if (this.currentOrder.length === 0) {
            alert('No items in order to print');
            return;
        }

        try {
            // Show user-friendly printing feedback
            const printButton = document.getElementById('print-order');
            const originalText = printButton.textContent;
            printButton.textContent = '🖨 Auto-printing...';
            printButton.disabled = true;

            console.log('Starting auto-silent print...');

            // Use new auto-silent print for one-click printing
            await this.printOrderAutoSilent();
            
            // Success feedback
            printButton.textContent = '✅ Printed!';
            setTimeout(() => {
                printButton.textContent = originalText;
                printButton.disabled = false;
            }, 2000);
            
            console.log('Order printed successfully (Auto-Silent Mode)');
            
            // Clear order after successful print
            this.currentOrder = [];
            
            if (this.billingMode === 'table') {
                this.activeTables.delete(this.currentTable);
                this.saveActiveTableData();
            } else {
                this.activeCounters.delete(this.currentCounter);
                this.saveActiveCounterData();
            }
            
            this.saveCurrentOrder();
            this.renderOrder();
            this.updateTotals();
            
        } catch (error) {
            console.error('Error printing order:', error);
            
            // Reset button state
            const printButton = document.getElementById('print-order');
            printButton.textContent = '🖨 Print';
            printButton.disabled = false;
            
            // Show user-friendly error message
            const errorMsg = error.message || 'Print operation failed';
            
            if (errorMsg.includes('No printer found')) {
                alert('❌ No printer found. Please check connection.\n\nTroubleshooting:\n• Check printer power and USB/network connection\n• Verify printer drivers are installed\n• Make sure printer paper is loaded\n• Try restarting the printer\n\nWould you like to use print preview instead?');
                
                const usePreview = confirm('Use print preview mode instead of silent printing?');
                if (usePreview) {
                    this.printOrderWithPreview();
                }
            } else {
                alert(`❌ Print failed: ${errorMsg}\n\nPlease check your printer connection and try again.`);
            }
        }
    }

    // Debug method to test auto-silent printing without order
    async debugAutoSilentPrint() {
        console.log('🔧 DEBUG: Testing auto-silent print functionality...');
        
        try {
            const testBillContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Debug Test Bill</title>
                    <meta charset="UTF-8">
                    <style>
                        @media print {
                            @page { size: 80mm auto; margin: 0; }
                            body { margin: 0 !important; padding: 2mm !important; }
                            body, table { font-size: 16px; }
                        }
                        body { 
                            font-family: 'Courier New', monospace; 
                            font-size: 16px; 
                            font-weight: 900;
                            padding: 5mm;
                            color: #000000 !important;
                            width: 76mm;
                        }
                        .header { text-align: center; border: 2px solid #000; padding: 10px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>DEBUG AUTO-SILENT TEST</h2>
                        <p>Udupi POS System</p>
                        <p>Time: ${new Date().toLocaleString('en-IN')}</p>
                    </div>
                    <p><strong>Auto-Detection:</strong> ✓ ACTIVE</p>
                    <p><strong>Silent Mode:</strong> ✓ NO DIALOGS</p>
                    <p><strong>Enhanced Fonts:</strong> ✓ 16px BASE</p>
                    <p><strong>Printer Auto-Select:</strong> ✓ SMART SELECTION</p>
                    <div style="border-top: 2px solid #000; margin-top: 10px; padding-top: 8px; text-align: center;">
                        <strong>*** DEBUG TEST SUCCESSFUL ***</strong>
                    </div>
                </body>
                </html>
            `;

            const result = await ipcRenderer.invoke('auto-silent-print', testBillContent, 'Debug');
            
            if (result.success) {
                console.log(`✅ DEBUG: Auto-silent print successful to ${result.printer}`);
                return { success: true, printer: result.printer };
            } else {
                console.error(`❌ DEBUG: Auto-silent print failed: ${result.error}`);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('🔧 DEBUG: Auto-silent test error:', error);
            return { success: false, error: error.message };
        }
    }

    // New auto-silent print method for one-click printing
    async printOrderAutoSilent() {
        try {
            // Generate print content with enhanced fonts
            const kotContent = this.generateKOTContent();
            const billContent = this.generateBillContent();
            
            // Print KOT using auto-silent method
            console.log('Auto-printing KOT...');
            const kotResult = await ipcRenderer.invoke('auto-silent-print', kotContent, 'KOT');
            if (!kotResult.success) {
                throw new Error(`KOT print failed: ${kotResult.error}`);
            }
            console.log('✅ KOT printed successfully to:', kotResult.printer);

            // Small delay between prints to avoid conflicts
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Print Bill using auto-silent method
            console.log('Auto-printing Bill...');
            const billResult = await ipcRenderer.invoke('auto-silent-print', billContent, 'Bill');
            if (!billResult.success) {
                throw new Error(`Bill print failed: ${billResult.error}`);
            }
            console.log('✅ Bill printed successfully to:', billResult.printer);
            
        } catch (error) {
            console.error('Auto-silent printing error:', error);
            throw error; // Re-throw to be handled by printOrder
        }
    }

    // Enhanced silent print method with improved error handling
    async printOrderEnhanced() {
        try {
            // Generate print content
            const kotContent = this.generateKOTContent();
            const billContent = this.generateBillContent();
            
            // Print KOT using enhanced method
            console.log('Printing KOT...');
            const kotResult = await ipcRenderer.invoke('enhanced-silent-print', kotContent, 'KOT');
            if (!kotResult.success) {
                throw new Error(`KOT print failed: ${kotResult.error}`);
            }
            console.log('KOT printed successfully to:', kotResult.printer);

            // Small delay between prints to avoid printer conflicts
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Print Bill using enhanced method
            console.log('Printing Bill...');
            const billResult = await ipcRenderer.invoke('enhanced-silent-print', billContent, 'Bill');
            if (!billResult.success) {
                throw new Error(`Bill print failed: ${billResult.error}`);
            }
            console.log('Bill printed successfully to:', billResult.printer);
            
        } catch (error) {
            console.error('Enhanced printing error:', error);
            throw error; // Re-throw to be handled by printOrder
        }
    }

    // Future feature: Get printer settings and allow user to select printer
    async getPrinterSettings() {
        try {
            // Use the dedicated get-printers handler for better error isolation
            const printerResult = await ipcRenderer.invoke('get-printers');
            
            if (!printerResult.success) {
                console.error('Get printers failed:', printerResult.error);
                return { 
                    available: false, 
                    error: printerResult.error,
                    printers: []
                };
            }

            const printerStatus = await ipcRenderer.invoke('check-printer-status');
            
            return {
                available: printerStatus.available,
                defaultPrinter: printerStatus.defaultPrinter,
                printerCount: printerResult.printers.length,
                printers: printerResult.printers,
                error: printerStatus.error
            };
        } catch (error) {
            console.error('Error getting printer settings:', error);
            return { 
                available: false, 
                error: error.message,
                printers: []
            };
        }
    }

    // Future feature: Show printer selection dialog
    async showPrinterDialog() {
        const printerSettings = await this.getPrinterSettings();
        
        if (!printerSettings.available) {
            alert(`No printers available: ${printerSettings.error || 'Unknown error'}`);
            return null;
        }

        // For now, just log available printers and return default
        console.log('Available printers:', printerSettings.printers);
        
        // TODO: Implement printer selection UI
        return printerSettings.defaultPrinter;
    }

    // Test specific printer connection
    async testPrinterConnection(printerName) {
        try {
            const result = await ipcRenderer.invoke('test-printer-connection', printerName);
            
            if (result.success) {
                console.log('Printer test result:', result.printer);
                return result.printer;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Printer connection test failed:', error);
            throw error;
        }
    }

    // Test print function for troubleshooting
    async testPrint() {
        try {
            console.log('Starting auto-silent test print...');

            const testContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Auto-Silent Test Print</title>
                    <meta charset="UTF-8">
                    <style>
                        @media print {
                            @page {
                                size: 80mm auto;
                                margin: 0;
                            }
                            body { margin: 0 !important; padding: 2mm !important; }
                            body, table { font-size: 16px; } /* Enhanced font size for thermal printing */
                        }
                        body { 
                            font-family: 'Courier New', monospace; 
                            font-size: 16px; /* Increased font size */
                            font-weight: bold;
                            padding: 5mm;
                            color: #000000 !important;
                            width: 76mm;
                            -webkit-font-smoothing: none;
                            font-smoothing: none;
                        }
                        .test-header {
                            text-align: center;
                            border: 2px solid #000;
                            padding: 12px; /* Increased padding */
                            margin-bottom: 12px;
                            font-weight: 900;
                            font-size: 18px; /* Larger header */
                        }
                        .printer-info {
                            border: 1px solid #000;
                            padding: 10px; /* Increased padding */
                            margin: 10px 0;
                            font-size: 14px; /* Increased from 12px */
                        }
                        .test-result {
                            font-size: 15px; /* Larger test text */
                            margin: 8px 0;
                            line-height: 1.4;
                        }
                    </style>
                </head>
                <body>
                    <div class="test-header">
                        <h2>AUTO-SILENT PRINTER TEST</h2>
                        <p>Udupi POS System</p>
                        <p>Date: ${new Date().toLocaleString('en-IN')}</p>
                    </div>
                    <div class="printer-info">
                        <p><strong>Auto-Detection:</strong> ENABLED</p>
                        <p><strong>Silent Printing:</strong> ACTIVE</p>
                        <p><strong>Font Enhancement:</strong> ON</p>
                    </div>
                    <div class="test-result">
                        <p>✓ If you can read this text clearly, your auto-silent printing is working correctly!</p>
                        <p>✓ Text should appear dark and crisp.</p>
                        <p>✓ Borders should be solid lines.</p>
                        <p>✓ No print dialogs should have appeared.</p>
                    </div>
                    <div style="border-top: 2px solid #000; margin-top: 12px; padding-top: 10px; text-align: center;">
                        <p style="font-size: 16px;"><strong>*** AUTO-SILENT TEST COMPLETED ***</strong></p>
                    </div>
                </body>
                </html>
            `;
            
            console.log('Sending auto-silent test print...');
            const result = await ipcRenderer.invoke('auto-silent-print', testContent, 'Test');
            
            if (result.success) {
                alert(`✅ Auto-Silent Test Print Successful!\n\n• Printer: ${result.printer}\n• No dialogs appeared (Silent Mode ✓)\n• Enhanced fonts applied (16px base)\n\nIf you don't see the printout:\n• Check printer power and paper\n• Verify printer driver installation\n• Check USB/network connection\n• Try restarting the printer`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Auto-silent test print error:', error);
            const errorMsg = error.message || 'Unknown error';
            
            if (errorMsg.includes('No printer found')) {
                alert('❌ No printer found. Please check connection.\n\nAuto-silent printing requires at least one connected printer.\n\nTroubleshooting:\n• Check printer power and connections\n• Install printer drivers\n• Restart the POS application\n\nWould you like to try print preview instead?');
                
                const usePreview = confirm('Use print preview mode for testing?');
                if (usePreview) {
                    this.testPrintWithPreview();
                }
            } else {
                alert(`❌ Auto-silent test failed: ${errorMsg}\n\nThe system could not automatically detect and print to your printer.\n\nPlease check your printer setup and try again.`);
            }
        }
    }

    // Fallback test print with preview window
    testPrintWithPreview() {
        const testContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Print Preview</title>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        font-size: 14px; 
                        font-weight: bold;
                        padding: 10mm;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .test-header {
                        text-align: center;
                        border: 2px solid #000;
                        padding: 10px;
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="test-header">
                    <h2>PRINTER TEST</h2>
                    <p>Udupi POS System</p>
                    <p>Date: ${new Date().toLocaleString('en-IN')}</p>
                </div>
                <p>This is a test print in preview mode.</p>
                <p>Use the browser's print dialog to select your printer.</p>
                <p>*** TEST COMPLETED ***</p>
            </body>
            </html>
        `;
        
        const testWindow = window.open('', '_blank', 'width=350,height=500');
        testWindow.document.write(testContent);
        testWindow.document.close();
        
        setTimeout(() => {
            testWindow.print();
        }, 500);
    }

    // Silent print method (legacy - kept for compatibility)
    async printOrderSilent() {
        // Generate print content
        const kotContent = this.generateKOTContent();
        const billContent = this.generateBillContent();
        
        // Print KOT silently
        const kotResult = await ipcRenderer.invoke('silent-print-kot', kotContent);
        if (!kotResult.success) {
            throw new Error(`KOT print failed: ${kotResult.error}`);
        }

        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Print Bill silently  
        const billResult = await ipcRenderer.invoke('silent-print-bill', billContent);
        if (!billResult.success) {
            throw new Error(`Bill print failed: ${billResult.error}`);
        }
    }

    // Fallback method with preview windows (existing functionality)
    async printOrderWithPreview() {
        try {
            // Print KOT first (Kitchen Order Ticket - items and quantities only)
            await this.printKOT();
            
            // Then print Customer Bill (with prices and totals)  
            await this.printCustomerBill();
            
            console.log('Order printed successfully (Preview Mode)');
            
            // Clear order after successful print
            this.currentOrder = [];
            
            if (this.billingMode === 'table') {
                this.activeTables.delete(this.currentTable);
                this.saveActiveTableData();
            } else {
                this.activeCounters.delete(this.currentCounter);
                this.saveActiveCounterData();
            }
            
            this.saveCurrentOrder();
            this.renderOrder();
            this.updateTotals();
            
        } catch (error) {
            console.error('Error printing order with preview:', error);
            alert('Error printing order. Please try again.');
        }
    }

    async printKOT() {
        // Generate KOT HTML content (items and quantities only - no prices)
        const kotContent = this.generateKOTContent();
        
        // Create a new window for printing KOT
        const kotWindow = window.open('', '_blank', 'width=300,height=600');
        kotWindow.document.write(kotContent);
        kotWindow.document.close();
        
        // Wait for content to load then print
        setTimeout(() => {
            kotWindow.print();
            kotWindow.close();
        }, 500);
    }

    async printCustomerBill() {
        // Generate Customer Bill HTML content (full bill with prices)
        const billContent = this.generateBillContent();
        
        // Create a new window for printing Customer Bill
        const billWindow = window.open('', '_blank', 'width=300,height=600');
        billWindow.document.write(billContent);
        billWindow.document.close();
        
        // Wait for content to load then print
        setTimeout(() => {
            billWindow.print();
            billWindow.close();
        }, 1000); // Slight delay after KOT
    }

    generateKOTContent() {
        const now = new Date();
        const locationText = this.billingMode === 'table' ? `Table ${this.currentLocation}` : `Counter ${this.currentLocation}`;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>KOT - ${locationText}</title>
                <meta charset="UTF-8">
                <style>
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body { margin: 0 !important; padding: 2mm !important; }
                        body, table { font-size: 16px; } /* Enhanced font size for thermal printing */
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                    body { 
                        font-family: 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', monospace; 
                        font-size: 16px; /* Increased base font size */
                        font-weight: 900;
                        margin: 0; 
                        padding: 2mm;
                        width: 76mm;
                        background: white !important;
                        color: #000000 !important;
                        line-height: 1.3; /* Better line spacing */
                        -webkit-font-smoothing: none !important;
                        font-smoothing: none !important;
                        text-rendering: optimizeSpeed !important;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 8px; 
                    }
                    .kot-title { 
                        font-weight: 900; 
                        font-size: 18px; /* Increased from 14px */
                        margin-bottom: 3px; 
                        color: #000000 !important;
                        letter-spacing: 1px;
                    }
                    .location { 
                        font-size: 16px; /* Increased from 12px */
                        margin: 2px 0; 
                        font-weight: 800; 
                        color: #000000 !important;
                    }
                    .datetime { 
                        font-size: 14px; /* Increased from 10px */
                        margin: 2px 0; 
                        font-weight: 700;
                        color: #000000 !important;
                    }
                    .items { 
                        margin: 8px 0; 
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 3px 0; /* Increased spacing */
                        padding: 2px 0; /* Increased padding */
                        border-bottom: 1px dotted #333;
                        min-height: 16px; /* Increased height */
                    }
                    .item-name { 
                        flex: 1; 
                        font-size: 15px; /* Increased from 11px */
                        font-weight: 800;
                        color: #000000 !important;
                        padding-right: 4px;
                        word-wrap: break-word;
                    }
                    .item-qty { 
                        width: 25mm; 
                        text-align: right; 
                        font-weight: 900; 
                        font-size: 15px; /* Increased from 11px */
                        color: #000000 !important;
                        flex-shrink: 0;
                    }
                    .footer { 
                        border-top: 2px solid #000; 
                        margin-top: 8px; 
                        padding-top: 4px; 
                        text-align: center; 
                        font-size: 14px; /* Increased from 10px */
                        font-weight: 800;
                    }
                    .total-items { 
                        font-weight: 900; 
                        margin: 6px 0; 
                        text-align: center; 
                        font-size: 16px; /* Increased from 12px */
                        color: #000000 !important;
                        border: 2px solid #000;
                        padding: 4px; /* Increased padding */
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="kot-title">KITCHEN ORDER TICKET</div>
                    <div class="location">${locationText}</div>
                    <div class="datetime">${now.toLocaleString('en-IN')}</div>
                </div>
                
                <div class="items">
                    ${this.currentOrder.map(item => `
                        <div class="item-row">
                            <span class="item-name">${item.name}</span>
                            <span class="item-qty">x${item.quantity}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-items">
                    TOTAL ITEMS: ${this.currentOrder.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
                
                <div class="footer">
                    <div>*** KITCHEN COPY ***</div>
                </div>
            </body>
            </html>
        `;
    }

    generateBillContent() {
        const now = new Date();
        const locationText = this.billingMode === 'table' ? `Table ${this.currentLocation}` : `Counter ${this.currentLocation}`;
        const total = this.getTotal();
        
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
                        body { margin: 0 !important; padding: 2mm !important; }
                        body, table { font-size: 16px; } /* Enhanced font size for thermal printing */
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                    body { 
                        font-family: 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', monospace; 
                        font-size: 16px; /* Increased base font size */
                        font-weight: 900;
                        margin: 0; 
                        padding: 2mm;
                        width: 76mm;
                        background: white !important;
                        color: #000000 !important;
                        line-height: 1.3; /* Better line spacing */
                        -webkit-font-smoothing: none !important;
                        font-smoothing: none !important;
                        text-rendering: optimizeSpeed !important;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 8px; 
                    }
                    .restaurant-name { 
                        font-weight: 900; 
                        font-size: 18px; /* Increased from 14px */
                        margin-bottom: 3px; 
                        color: #000000 !important;
                        letter-spacing: 0.5px;
                    }
                    .restaurant-details { 
                        font-size: 12px; /* Increased from 9px */
                        margin: 1px 0; 
                        font-weight: 700;
                        color: #000000 !important;
                        line-height: 1.2; /* Better spacing */
                    }
                    .bill-title { 
                        font-weight: 900; 
                        font-size: 16px; /* Increased from 13px */
                        margin: 4px 0; 
                        color: #000000 !important;
                        border: 1px solid #000;
                        padding: 3px; /* Increased padding */
                    }
                    .location { 
                        font-size: 15px; /* Increased from 12px */
                        margin: 3px 0; 
                        font-weight: 800; 
                        color: #000000 !important;
                    }
                    .datetime { 
                        font-size: 13px; /* Increased from 10px */
                        margin: 2px 0; 
                        font-weight: 700;
                        color: #000000 !important;
                    }
                    .items { 
                        margin: 8px 0; 
                        width: 100%;
                    }
                    .item-header { 
                        display: flex; 
                        justify-content: space-between; 
                        border-bottom: 2px solid #000; 
                        padding: 3px 0; /* Increased padding */
                        font-weight: 900; 
                        font-size: 13px; /* Increased from 10px */
                        color: #000000 !important;
                        margin-bottom: 2px;
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 2px 0; /* Increased spacing */
                        font-size: 13px; /* Increased from 10px */
                        padding: 2px 0; /* Increased padding */
                        border-bottom: 1px dotted #333;
                        font-weight: 700;
                        min-height: 16px; /* Increased height */
                    }
                    .item-name { 
                        flex: 1; 
                        color: #000000 !important;
                        font-weight: 800;
                        padding-right: 2px;
                        word-wrap: break-word;
                        max-width: 45mm;
                    }
                    .item-qty { 
                        width: 15mm; 
                        text-align: center; 
                        color: #000000 !important;
                        font-weight: 900;
                        flex-shrink: 0;
                    }
                    .item-rate { 
                        width: 18mm; 
                        text-align: right; 
                        color: #000000 !important;
                        font-weight: 800;
                        flex-shrink: 0;
                    }
                    .item-total { 
                        width: 20mm; 
                        text-align: right; 
                        color: #000000 !important;
                        font-weight: 900;
                        flex-shrink: 0;
                    }
                    .totals { 
                        border-top: 2px solid #000; 
                        margin-top: 8px; 
                        padding-top: 4px; 
                    }
                    .total-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 2px 0; 
                        font-weight: 800;
                    }
                    .grand-total { 
                        font-weight: 900; 
                        border: 2px solid #000; 
                        padding: 5px; /* Increased padding */
                        font-size: 16px; /* Increased from 13px */
                        color: #000000 !important;
                        background: white !important;
                        margin: 3px 0;
                    }
                    .footer { 
                        border-top: 2px solid #000; 
                        margin-top: 8px; 
                        padding-top: 4px; 
                        text-align: center; 
                        font-size: 13px; /* Increased from 10px */
                        font-weight: 700;
                        line-height: 1.3; /* Better spacing */
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="restaurant-name">Udupi Krishnam Veg</div>
                    <div class="restaurant-details">Bengaluru - Chennai Hwy, Konappana</div>
                    <div class="restaurant-details">Agrahara, Electronic City,</div>
                    <div class="restaurant-details">Bengaluru, Karnataka, India</div>
                    <div class="restaurant-details">Bangalore, Karnataka Bengaluru</div>
                    <div class="restaurant-details">560100</div>
                    <div class="restaurant-details">Contact No: 9535089587</div>
                    <div class="restaurant-details">Tax Invoice</div>
                    <div class="restaurant-details">A Unit of SALT AND PEPPER</div>
                    <div class="bill-title">CUSTOMER BILL</div>
                    <div class="location">${locationText}   PAX: 1</div>
                    <div class="datetime">${now.toLocaleString('en-IN')}</div>
                    <div class="restaurant-details">FSSAI: 21224010001200</div>
                </div>
                
                <div class="items">
                    <div class="item-header">
                        <span class="item-name">Item</span>
                        <span class="item-qty">Qty</span>
                        <span class="item-rate">Rate</span>
                        <span class="item-total">Amount</span>
                    </div>
                    ${this.currentOrder.map((item, index) => `
                        <div class="item-row">
                            <span class="item-name">${(index + 1)}. ${item.name}</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-rate">₹${item.price.toFixed(2)}</span>
                            <span class="item-total">₹${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="totals">
                    <div class="total-row grand-total">
                        <span>TOTAL:</span>
                        <span>₹${total.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <div>Thank you for dining with us!</div>
                    <div>Powered by: NMD</div>
                    <div>*** Thank you, Visit again ***</div>
                </div>
            </body>
            </html>
        `;
    }
}
