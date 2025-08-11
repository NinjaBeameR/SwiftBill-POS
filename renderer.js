// Main renderer process - handles UI logic and component coordination
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== FEATURE FLAGS =====
const ENABLE_COUNTERS = false; // Set to true to re-enable counter functionality
// 
// To re-enable counters: 
// 1. Change ENABLE_COUNTERS to true
// 2. All counter functionality will be automatically restored
// 3. All existing counter data and orders are preserved
// 4. UI elements will be shown and functional again
// =========================

// Data path management for both development and production
class DataPathManager {
    constructor() {
        this.dataPath = null;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return this.dataPath;
        
        try {
            // Get the correct data path from main process
            this.dataPath = await ipcRenderer.invoke('get-data-path');
            this.initialized = true;
            console.log('Data path initialized:', this.dataPath);
        } catch (error) {
            // Fallback to development path
            this.dataPath = path.join(__dirname, 'src', 'storage');
            this.initialized = true;
            console.log('Using development data path:', this.dataPath);
        }
        
        return this.dataPath;
    }
    
    async getMenuPath() {
        await this.initialize();
        return path.join(this.dataPath, 'menu.json');
    }
    
    async getOrdersPath() {
        await this.initialize();
        return path.join(this.dataPath, 'orders.json');
    }
}

// Global data path manager instance
const dataPathManager = new DataPathManager();

// Wait for DOM to load and then initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer: DOM content loaded, initializing...');
    
    // Initialize the POS app
    console.log('Renderer: Initializing POS app...');
    window.posApp = new POSApp();
    
    // Wait a moment for DOM to be fully ready, then initialize
    setTimeout(() => {
        window.posApp.init();
        console.log('Renderer: POS app fully initialized');
    }, 100);
});

class POSApp {
    constructor() {
        this.currentTable = null;
        this.currentCounter = null;
        this.currentOrder = [];
        this.billingMode = null; // 'table' or 'counter'
        this.currentLocation = null; // table number or counter number
        
        // Service fee functionality
        this.serviceFeePercentage = 0; // Default: no service fee
        
        // Search functionality variables
        this.searchDebounceTimer = null;
        this.currentSearchResults = [];
        this.selectedSearchIndex = -1;
        
        // Download state management
        this.isDownloading = false;
        
        // Initialize version display
        this.initializeVersionDisplay();
        
        // Settings for restaurant info
        this.settings = {
            restaurant: {
                name: "UDUPI KRISHNAM VEG",
                contact: "+91 12345 67890",
                address: "Bengaluru - Chennai Hwy, Konnappana Agrahara, Electronic City, Bengaluru, Karnataka - 560100",
                gstin: "A unit of Salt and Pepper",
                fssai: "12345678901234"
            }
        };
        
        // Don't call init() here - it will be called after DOM is ready
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
        
        // Apply feature flags
        this.applyFeatureFlags();
        
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
        // Initialize counter data even when disabled to preserve existing data
        this.totalCounters = 6;
        this.activeCounters = new Set();
        
        if (ENABLE_COUNTERS) {
            this.loadActiveCounterData();
            this.refreshActiveCounters(); // Check all counters for active orders
        } else {
            // Still load data to preserve existing counter orders but don't refresh UI
            this.loadActiveCounterData();
            console.log('🔒 Counter data loaded but UI disabled by feature flag');
        }
    }

    initBillingScreen() {
        // Load menu items from JSON file
        this.loadMenuItems();
    }

    async loadMenuItems() {
        try {
            const fs = require('fs');
            const menuPath = await dataPathManager.getMenuPath();
            const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
            this.menuItems = menuData.items || [];
            
            // DEBUG: Check if kotGroup fields are present in loaded menu items
            console.log('🔍 MENU DEBUG: Total items loaded:', this.menuItems.length);
            const sampleItems = this.menuItems.slice(0, 5);
            sampleItems.forEach(item => {
                console.log(`🔍 Menu item "${item.name}" (ID: ${item.id}) - kotGroup: "${item.kotGroup}"`);
            });
            
            // Check if any items are missing kotGroup
            const itemsWithoutKotGroup = this.menuItems.filter(item => !item.kotGroup);
            console.log(`⚠️ Items missing kotGroup: ${itemsWithoutKotGroup.length}/${this.menuItems.length}`);
            
            // Load settings from menu data
            if (menuData.settings) {
                this.settings = {
                    ...this.settings,
                    ...menuData.settings
                };
            }
            
            // Load restaurant info
            if (menuData.restaurant) {
                this.settings.restaurant = {
                    ...this.settings.restaurant,
                    ...menuData.restaurant
                };
            }
            
            // Update parcel charge display after loading settings
            this.updateSelectiveParcelChargeDisplay();
            
            // Ensure all items have enabled field (default to true for backward compatibility)
            let needsUpdate = false;
            this.menuItems = this.menuItems.map(item => {
                if (item.enabled === undefined) {
                    needsUpdate = true;
                    return { ...item, enabled: true };
                }
                return item;
            });
            
            // CRITICAL FIX: Ensure all items have kotGroup field
            let kotGroupsAssigned = 0;
            this.menuItems = this.menuItems.map(item => {
                if (!item.kotGroup) {
                    kotGroupsAssigned++;
                    needsUpdate = true;
                    
                    // Assign kotGroup based on category and name
                    let kotGroup = 'kitchen'; // Default to kitchen
                    
                    const itemName = item.name.toLowerCase();
                    const itemCategory = (item.category || '').toLowerCase();
                    
                    // Drinks classification (tea, coffee, beverages)
                    if (itemCategory.includes('tea') || itemCategory.includes('coffee') ||
                        itemCategory.includes('beverage') || itemCategory.includes('drink') ||
                        itemName.includes('tea') || itemName.includes('coffee') ||
                        itemName.includes('boost') || itemName.includes('horlicks') ||
                        itemName.includes('badam') || itemName.includes('kashaya')) {
                        kotGroup = 'drinks';
                    }
                    
                    console.log(`🔧 Auto-assigning kotGroup "${kotGroup}" to "${item.name}" (category: ${item.category})`);
                    
                    return { ...item, kotGroup };
                }
                return item;
            });
            
            if (kotGroupsAssigned > 0) {
                console.log(`✅ Auto-assigned kotGroup to ${kotGroupsAssigned} items`);
            }
            
            // Auto-save if we added enabled fields or applied default settings
            if (needsUpdate) {
                const updatedMenuData = {
                    restaurant: this.settings.restaurant,
                    settings: this.settings,
                    items: this.menuItems
                };
                fs.writeFileSync(menuPath, JSON.stringify(updatedMenuData, null, 2), 'utf8');
                console.log('📝 Menu file updated with kotGroup assignments');
            }
            
        } catch (error) {
            console.error('Error loading menu items:', error);
            // Fallback to hardcoded items if loading fails
            this.menuItems = [
                { id: 1, name: 'Masala Dosa', price: 80, category: 'South Indian', enabled: true },
                { id: 2, name: 'Plain Dosa', price: 60, category: 'South Indian', enabled: true },
                { id: 3, name: 'Rava Dosa', price: 90, category: 'South Indian', enabled: true },
                { id: 4, name: 'Set Dosa', price: 70, category: 'South Indian', enabled: true },
                { id: 5, name: 'Idli Sambar (2 pcs)', price: 50, category: 'South Indian', enabled: true },
                { id: 6, name: 'Vada Sambar (2 pcs)', price: 60, category: 'South Indian', enabled: true },
                { id: 7, name: 'Idli Vada Combo', price: 65, category: 'South Indian', enabled: true },
                { id: 8, name: 'Upma', price: 45, category: 'South Indian', enabled: true },
                { id: 9, name: 'Poori Bhaji', price: 70, category: 'North Indian', enabled: true },
                { id: 10, name: 'Chapati (2 pcs)', price: 30, category: 'North Indian', enabled: true },
                { id: 11, name: 'Dal Rice', price: 85, category: 'North Indian', enabled: true },
                { id: 12, name: 'Sambar Rice', price: 75, category: 'South Indian', enabled: true },
                { id: 13, name: 'Curd Rice', price: 55, category: 'South Indian', enabled: true },
                { id: 14, name: 'Tea', price: 15, category: 'Beverages', enabled: true },
                { id: 15, name: 'Coffee', price: 20, category: 'Beverages', enabled: true },
                { id: 16, name: 'Lassi', price: 35, category: 'Beverages', enabled: true },
                { id: 17, name: 'Fresh Lime Water', price: 25, category: 'Beverages', enabled: true },
                { id: 18, name: 'Buttermilk', price: 20, category: 'Beverages', enabled: true }
            ];
        }
    }

    setupEventListeners() {
        // Update button
        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                this.checkForUpdates();
            });
        } else {
            console.error('Update button not found!');
        }

        // Service type selection
        document.getElementById('table-service-btn').addEventListener('click', () => {
            this.showTableSelector();
        });

        document.getElementById('counter-service-btn').addEventListener('click', () => {
            if (ENABLE_COUNTERS) {
                this.showCounterSelector();
            } else {
                console.log('🔒 Counter service disabled by feature flag');
                alert('Counter service is temporarily disabled. Please use Table Service.');
            }
        });

        // Back buttons
        document.getElementById('back-to-service').addEventListener('click', () => {
            this.showServiceSelector();
        });

        document.getElementById('back-to-service-counter').addEventListener('click', () => {
            if (ENABLE_COUNTERS) {
                this.showServiceSelector();
            } else {
                // If counters are disabled, redirect to table selector instead
                this.showTableSelector();
            }
        });

        document.getElementById('back-to-tables').addEventListener('click', () => {
            if (this.billingMode === 'table') {
                this.showTableSelector();
            } else if (ENABLE_COUNTERS) {
                this.showCounterSelector();
            } else {
                // If counters are disabled, always go to table selector
                this.showTableSelector();
            }
        });

        // Print button
        document.getElementById('print-order').addEventListener('click', () => {
            this.printOrder();
        });

        // Service fee dropdown
        document.getElementById('service-fee-select').addEventListener('change', (e) => {
            this.serviceFeePercentage = parseFloat(e.target.value);
            this.updateTotals();
        });

        // Search functionality
        this.setupSearchListeners();

        // Setup global keyboard shortcuts
        this.setupGlobalKeyboardShortcuts();

        // MenuManager button
        document.getElementById('manage-menu').addEventListener('click', () => {
            this.openMenuManager();
        });

        // MenuManager modal event listeners
        this.setupMenuManagerListeners();
        
        // Update modal event listeners
        this.setupUpdateModalListeners();
    }

    // Global keyboard shortcuts setup
    setupGlobalKeyboardShortcuts() {
        // Remove existing global keydown listener if it exists
        if (this.globalKeydownHandler) {
            document.removeEventListener('keydown', this.globalKeydownHandler);
        }

        // Create the global keydown handler
        this.globalKeydownHandler = (e) => {
            // Don't process shortcuts if we're in an input field (except for specific shortcuts)
            const isInInput = e.target.matches('input, textarea, select');
            const isInMenuManager = document.getElementById('menu-manager-modal').classList.contains('active');
            const isInEditModal = document.getElementById('edit-item-modal').classList.contains('active');

            // Handle Menu Manager specific shortcuts
            if (isInMenuManager) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeMenuManager();
                    return;
                }
            }

            // Handle Edit Modal specific shortcuts
            if (isInEditModal) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeEditItemModal();
                    return;
                }
            }

            // Only process main shortcuts if not in Menu Manager/Edit Modal and billing screen is active
            if (!isInMenuManager && !isInEditModal && document.getElementById('billing-screen').classList.contains('active')) {
                switch(e.key) {
                    case 'Escape':
                        if (this.billingMode === 'table') {
                            this.showTableSelector();
                        } else if (ENABLE_COUNTERS) {
                            this.showCounterSelector();
                        } else {
                            // If counters are disabled, always go to table selector
                            this.showTableSelector();
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
                        // Focus on search
                        this.focusSearchInput();
                        break;
                    case 'F4':
                        e.preventDefault();
                        // Test print functionality
                        this.testPrint();
                        break;
                    case '/':
                        // Quick search shortcut - only if not already in an input
                        if (!isInInput) {
                            e.preventDefault();
                            this.focusSearchInput();
                        }
                        break;
                }
            }

            // Handle other screen navigation
            if (!isInMenuManager && !isInEditModal) {
                if (e.key === 'Escape') {
                    if (document.getElementById('table-selector-screen').classList.contains('active') || 
                        document.getElementById('counter-selector-screen').classList.contains('active')) {
                        this.showServiceSelector();
                    }
                }
            }
        };

        // Add the global keydown listener
        document.addEventListener('keydown', this.globalKeydownHandler);
        console.log('✅ Global keyboard shortcuts setup complete');
    }

    // Helper function to focus search input with proper validation
    focusSearchInput() {
        const searchInput = document.getElementById('menu-search');
        if (searchInput && document.getElementById('billing-screen').classList.contains('active')) {
            // Ensure the search input is enabled and focusable
            searchInput.disabled = false;
            searchInput.removeAttribute('readonly');
            searchInput.focus();
            console.log('🔍 Search input focused via shortcut');
        }
    }

    setupSearchListeners() {
        console.log('POSApp: Setting up search listeners');
        
        const searchInput = document.getElementById('menu-search');
        const searchResults = document.getElementById('search-results');

        if (!searchInput) {
            console.error('POSApp: Search input element not found!');
            return;
        }

        if (!searchResults) {
            console.error('POSApp: Search results element not found!');
            return;
        }

        console.log('POSApp: Search elements found, setting up listeners');
        console.log('POSApp: Current menuItems status:', {
            exists: !!this.menuItems,
            isArray: Array.isArray(this.menuItems),
            length: this.menuItems ? this.menuItems.length : 0
        });

        // Remove existing event listeners to prevent duplicates
        this.removeSearchListeners();

        // Store references to event handlers for later removal
        this.searchInputHandler = (e) => {
            const query = e.target.value.trim();
            console.log('POSApp: Search input event, query:', query);
            console.log('POSApp: Menu items available:', this.menuItems ? this.menuItems.length : 0);
            
            // Clear previous timer
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            // Debounce search with 300ms delay
            this.searchDebounceTimer = setTimeout(() => {
                console.log('POSApp: Executing debounced search for:', query);
                this.performSearch(query);
            }, 300);
        };

        this.searchKeydownHandler = (e) => {
            console.log('POSApp: Search keydown event:', e.key);
            
            if (!searchResults.classList.contains('show')) {
                console.log('POSApp: Search results not visible, ignoring navigation');
                return;
            }

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    console.log('POSApp: Navigate search down');
                    this.navigateSearchResults('down');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    console.log('POSApp: Navigate search up');
                    this.navigateSearchResults('up');
                    break;
                case 'Enter':
                    e.preventDefault();
                    console.log('POSApp: Select highlighted search result');
                    this.selectHighlightedSearchResult();
                    break;
                case 'Escape':
                    console.log('POSApp: Hide search results');
                    this.hideSearchResults();
                    searchInput.blur();
                    break;
            }
        };

        this.searchClickOutsideHandler = (e) => {
            if (!e.target.closest('.search-container')) {
                console.log('POSApp: Click outside search, hiding results');
                this.hideSearchResults();
            }
        };

        this.searchFocusHandler = () => {
            console.log('POSApp: Search input focused');
            if (searchInput.value.trim()) {
                console.log('POSApp: Re-performing search on focus');
                this.performSearch(searchInput.value.trim());
            }
        };

        // Add event listeners
        searchInput.addEventListener('input', this.searchInputHandler);
        searchInput.addEventListener('keydown', this.searchKeydownHandler);
        document.addEventListener('click', this.searchClickOutsideHandler);
        searchInput.addEventListener('focus', this.searchFocusHandler);

        console.log('POSApp: Search listeners setup complete');
    }

    // Remove search event listeners to prevent duplicates
    removeSearchListeners() {
        const searchInput = document.getElementById('menu-search');
        
        if (searchInput && this.searchInputHandler) {
            searchInput.removeEventListener('input', this.searchInputHandler);
            searchInput.removeEventListener('keydown', this.searchKeydownHandler);
            document.removeEventListener('click', this.searchClickOutsideHandler);
            searchInput.removeEventListener('focus', this.searchFocusHandler);
            console.log('POSApp: Previous search listeners removed');
        }
    }

    performSearch(query) {
        console.log('POSApp: performSearch called with query:', query);
        console.log('POSApp: this.menuItems status:', {
            exists: !!this.menuItems,
            isArray: Array.isArray(this.menuItems),
            length: this.menuItems ? this.menuItems.length : 0,
            enabledCount: this.menuItems ? this.menuItems.filter(item => item.enabled !== false).length : 0
        });
        
        const searchResults = document.getElementById('search-results');
        
        if (!query) {
            console.log('POSApp: Empty query, hiding search results');
            this.hideSearchResults();
            return;
        }

        if (!searchResults) {
            console.error('POSApp: Search results element not found in performSearch!');
            return;
        }

        if (!this.menuItems || !Array.isArray(this.menuItems)) {
            console.error('POSApp: Menu items not available for search!');
            console.error('POSApp: menuItems:', this.menuItems);
            return;
        }

        console.log('POSApp: Searching through', this.menuItems.length, 'menu items');

        try {
            // Filter menu items based on query - only match enabled item names
            this.currentSearchResults = this.menuItems.filter(item => {
                if (!item || typeof item.name !== 'string') {
                    console.warn('POSApp: Invalid menu item found:', item);
                    return false;
                }
                
                const isEnabled = item.enabled !== false;
                const nameMatch = item.name.toLowerCase().includes(query.toLowerCase());
                
                return isEnabled && nameMatch;
            });

            console.log('POSApp: Search found', this.currentSearchResults.length, 'results');

            this.selectedSearchIndex = -1; // Reset selection
            this.renderSearchResults(query);
            
            if (this.currentSearchResults.length > 0) {
                console.log('POSApp: Showing search results');
                searchResults.classList.add('show');
            } else {
                console.log('POSApp: No results found, hiding search');
                this.hideSearchResults();
            }
        } catch (error) {
            console.error('POSApp: Error during search:', error);
            console.error('POSApp: Error stack:', error.stack);
            this.hideSearchResults();
        }
    }

    renderSearchResults(query) {
        console.log('POSApp: renderSearchResults called');
        
        const searchResults = document.getElementById('search-results');
        
        if (!searchResults) {
            console.error('POSApp: Search results element not found in renderSearchResults!');
            return;
        }
        
        if (this.currentSearchResults.length === 0) {
            console.log('POSApp: No search results to display');
            searchResults.innerHTML = '<div class="search-no-results">No items found</div>';
            return;
        }

        console.log('POSApp: Rendering', this.currentSearchResults.length, 'search results');

        try {
            const resultsHTML = this.currentSearchResults.map((item, index) => {
                // Apply discount for counter billing in search results
                const finalPrice = (this.billingMode === 'counter') ? Math.max(0, item.price - 5) : item.price;
                
                // Highlight matching text
                const highlightedName = this.highlightSearchText(item.name, query);
                const highlightedCategory = this.highlightSearchText(item.category || '', query);
                
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
            console.log('POSApp: Search results HTML updated');

            // Add click listeners to search results
            const resultItems = searchResults.querySelectorAll('.search-result-item');
            console.log('POSApp: Adding click listeners to', resultItems.length, 'result items');
            
            resultItems.forEach((item, index) => {
                item.addEventListener('click', () => {
                    console.log('POSApp: Search result clicked, index:', index);
                    this.selectSearchResult(index);
                });
            });
            
            console.log('POSApp: Search results rendering complete');
        } catch (error) {
            console.error('POSApp: Error rendering search results:', error);
            console.error('POSApp: Error stack:', error.stack);
            searchResults.innerHTML = '<div class="search-no-results">Error displaying results</div>';
        }
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
        feedback.className = 'search-feedback success';
        feedback.textContent = `Added "${itemName}" to order`;
        
        document.body.appendChild(feedback);
        
        // Remove feedback after 2 seconds
        setTimeout(() => {
            feedback.classList.add('slide-out');
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }

    // Reload menu items from storage to refresh in-memory array
    async reloadMenuItems() {
        try {
            console.log('🔄 Reloading menu items from storage...');
            
            const fs = require('fs');
            const menuPath = await dataPathManager.getMenuPath();
            const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
            
            // Store old count for comparison
            const oldCount = this.menuItems ? this.menuItems.length : 0;
            const oldEnabledCount = this.menuItems ? this.menuItems.filter(item => item.enabled !== false).length : 0;
            
            // Update the in-memory menu items array
            this.menuItems = menuData.items || [];
            
            const newCount = this.menuItems.length;
            const newEnabledCount = this.menuItems.filter(item => item.enabled !== false).length;
            
            console.log(`✅ Menu items reloaded: ${newCount} total (${newEnabledCount} enabled)`);
            console.log(`📊 Changes: Total: ${oldCount} → ${newCount}, Enabled: ${oldEnabledCount} → ${newEnabledCount}`);
            
            // Only refresh search listeners if we're on the billing screen (not in Menu Manager modal)
            if (document.getElementById('billing-screen').classList.contains('active') && 
                !document.getElementById('menu-manager-modal').classList.contains('active')) {
                
                // Reinitialize search listeners to ensure they work with updated data
                this.setupSearchListeners();
                
                // If there's an active search, re-run it with updated data
                const searchInput = document.getElementById('menu-search');
                if (searchInput && searchInput.value.trim()) {
                    const currentQuery = searchInput.value.trim();
                    console.log('🔍 Re-running search with updated menu data:', currentQuery);
                    this.performSearch(currentQuery);
                }
            }
            
            // If we're on the billing screen, update the menu display
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
                console.log('🖼️ Billing screen menu updated');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error reloading menu items:', error);
            return false;
        }
    }
    
    setupMenuManagerListeners() {
        // Close menu manager modal
        document.getElementById('close-menu-manager').addEventListener('click', () => {
            this.closeMenuManager();
        });

        // Close edit item modal
        document.getElementById('close-edit-item').addEventListener('click', () => {
            this.closeEditItemModal();
        });

        // Modal backdrop click to close
        document.getElementById('menu-manager-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('menu-manager-modal')) {
                this.closeMenuManager();
            }
        });

        document.getElementById('edit-item-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('edit-item-modal')) {
                this.closeEditItemModal();
            }
        });

        // Add new item form
        document.getElementById('add-item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewMenuItem();
        });

        // Clear form button
        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearAddItemForm();
        });

        // Edit item form
        document.getElementById('save-edit').addEventListener('click', () => {
            this.saveEditedItem();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.closeEditItemModal();
        });

        // Save menu changes
        document.getElementById('save-menu-changes').addEventListener('click', () => {
            this.saveMenuChanges();
        });

        // Filters and search
        document.getElementById('filter-category').addEventListener('change', () => {
            this.filterMenuItems();
        });

        document.getElementById('filter-status').addEventListener('change', () => {
            this.filterMenuItems();
        });

        document.getElementById('search-items').addEventListener('input', (e) => {
            this.searchMenuItems(e.target.value);
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Settings form handlers
        document.getElementById('save-restaurant-settings').addEventListener('click', () => {
            this.saveRestaurantSettings();
        });

        document.getElementById('reset-restaurant-settings').addEventListener('click', () => {
            this.resetRestaurantSettings();
        });
    }

    setupUpdateModalListeners() {
        // Close modal on background click
        document.getElementById('update-modal').addEventListener('click', (e) => {
            if (e.target.id === 'update-modal') {
                document.getElementById('update-modal').classList.remove('active');
            }
        });
    }

    openMenuManager() {
        // Backup current menu for rollback if needed
        this.menuBackup = JSON.parse(JSON.stringify(this.menuItems));
        
        // Populate categories
        this.populateCategories();
        
        // Populate settings
        this.populateSettings();
        
        // Show modal
        document.getElementById('menu-manager-modal').classList.add('active');
        
        // Switch to menu items tab by default
        this.switchTab('menu-items');
        
        // Load and display menu items
        this.displayMenuItems();
        
        // Update stats
        this.updateMenuStats();
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('item-name').focus();
        }, 300);
    }

    closeMenuManager() {
        document.getElementById('menu-manager-modal').classList.remove('active');
        this.clearAddItemForm();
        this.closeEditItemModal();
        
        // Refresh search functionality when returning to billing screen
        if (document.getElementById('billing-screen').classList.contains('active')) {
            console.log('🔍 Refreshing search functionality after Menu Manager close');
            console.log('📊 Current menuItems at close:', {
                exists: !!this.menuItems,
                length: this.menuItems ? this.menuItems.length : 0,
                enabledCount: this.menuItems ? this.menuItems.filter(item => item.enabled !== false).length : 0
            });
            
            // Force refresh the search system
            this.refreshSearchSystem();
            
            // Ensure search input is properly enabled and focusable
            this.restoreSearchInputState();
        }
    }

    // Restore search input to proper functional state
    restoreSearchInputState() {
        const searchInput = document.getElementById('menu-search');
        if (searchInput) {
            // Ensure search input is enabled and focusable
            searchInput.disabled = false;
            searchInput.removeAttribute('readonly');
            searchInput.removeAttribute('tabindex');
            
            // Restore focus capability
            searchInput.style.pointerEvents = '';
            searchInput.style.opacity = '';
            
            console.log('🔧 Search input state restored:', {
                disabled: searchInput.disabled,
                readonly: searchInput.readOnly,
                tabIndex: searchInput.tabIndex
            });
        }
    }

    // New function to comprehensively refresh the search system
    refreshSearchSystem() {
        console.log('🔄 Refreshing complete search system');
        
        // Remove old listeners
        this.removeSearchListeners();
        
        // Small delay to ensure cleanup is complete
        setTimeout(() => {
            // Re-setup listeners
            this.setupSearchListeners();
            
            // Validate search input state
            const searchInput = document.getElementById('menu-search');
            if (searchInput) {
                console.log('🔍 Search input validation:', {
                    exists: !!searchInput,
                    disabled: searchInput.disabled,
                    readonly: searchInput.readOnly,
                    value: searchInput.value,
                    hasListeners: !!this.searchInputHandler
                });
                
                // If there was an active search, re-run it with current menu data
                if (searchInput.value.trim()) {
                    const currentQuery = searchInput.value.trim();
                    console.log('🔍 Re-executing active search:', currentQuery);
                    this.performSearch(currentQuery);
                }
            }
            
            console.log('✅ Search system refresh complete');
        }, 50);
    }

    populateCategories() {
        // Get unique categories from current menu
        const categories = [...new Set(this.menuItems.map(item => item.category))].sort();
        
        // Populate add item form category dropdown
        const addCategorySelect = document.getElementById('item-category');
        addCategorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            addCategorySelect.appendChild(option);
        });

        // Populate edit item form category dropdown
        const editCategorySelect = document.getElementById('edit-item-category');
        editCategorySelect.innerHTML = '';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            editCategorySelect.appendChild(option);
        });

        // Populate filter dropdown
        const filterCategorySelect = document.getElementById('filter-category');
        filterCategorySelect.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategorySelect.appendChild(option);
        });
    }

    displayMenuItems(filteredItems = null) {
        const itemsToDisplay = filteredItems || this.menuItems;
        const container = document.getElementById('menu-items-list');
        
        if (itemsToDisplay.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <p>No menu items found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = itemsToDisplay.map(item => `
            <div class="menu-item-row ${item.enabled === false ? 'disabled' : ''}" data-item-id="${item.id}">
                <div class="menu-item-name">${this.escapeHtml(item.name)}</div>
                <div class="menu-item-price">₹${item.price.toFixed(2)}</div>
                <div class="menu-item-category">${this.escapeHtml(item.category)}</div>
                <div class="menu-item-status">
                    <span class="${item.enabled !== false ? 'status-enabled' : 'status-disabled'}">
                        ${item.enabled !== false ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                </div>
                <div class="menu-item-actions">
                    <button class="action-btn edit" onclick="posApp.editMenuItem(${item.id})" title="Edit Item">
                        ✏️ Edit
                    </button>
                    <button class="action-btn toggle" onclick="posApp.toggleMenuItem(${item.id})" title="${item.enabled !== false ? 'Disable' : 'Enable'} Item">
                        ${item.enabled !== false ? '❌ Disable' : '✅ Enable'}
                    </button>
                    <button class="action-btn delete" onclick="posApp.deleteMenuItem(${item.id})" title="Delete Item">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    filterMenuItems() {
        const categoryFilter = document.getElementById('filter-category').value;
        const statusFilter = document.getElementById('filter-status').value;
        const searchQuery = document.getElementById('search-items').value.toLowerCase().trim();

        let filteredItems = [...this.menuItems];

        // Apply category filter
        if (categoryFilter !== 'all') {
            filteredItems = filteredItems.filter(item => item.category === categoryFilter);
        }

        // Apply status filter
        if (statusFilter === 'enabled') {
            filteredItems = filteredItems.filter(item => item.enabled !== false);
        } else if (statusFilter === 'disabled') {
            filteredItems = filteredItems.filter(item => item.enabled === false);
        }

        // Apply search filter
        if (searchQuery) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(searchQuery) ||
                item.category.toLowerCase().includes(searchQuery)
            );
        }

        this.displayMenuItems(filteredItems);
        this.updateMenuStats(filteredItems);
    }

    searchMenuItems(query) {
        // Debounce search to improve performance
        clearTimeout(this.menuSearchTimeout);
        this.menuSearchTimeout = setTimeout(() => {
            this.filterMenuItems();
        }, 300);
    }

    updateMenuStats(filteredItems = null) {
        const items = filteredItems || this.menuItems;
        const totalItems = items.length;
        const enabledItems = items.filter(item => item.enabled !== false).length;
        const disabledItems = totalItems - enabledItems;

        document.getElementById('items-count').textContent = `${totalItems} items`;
        document.getElementById('enabled-count').textContent = `${enabledItems} enabled`;
        document.getElementById('disabled-count').textContent = `${disabledItems} disabled`;
    }

    async addNewMenuItem() {
        const form = document.getElementById('add-item-form');
        const formData = new FormData(form);
        
        // Validate form
        const validation = this.validateItemForm(formData);
        if (!validation.valid) {
            this.showFormErrors(validation.errors);
            return;
        }

        try {
            // Create new menu item
            const newItem = {
                id: this.getNextMenuItemId(),
                name: formData.get('name').trim(),
                price: parseFloat(formData.get('price')),
                category: formData.get('category'),
                enabled: formData.get('enabled') === 'true',
                kotGroup: 'kitchen' // Default new items to kitchen group
            };

            // Add to menu items array
            this.menuItems.push(newItem);
            
            // Immediately save changes to storage
            await this.saveMenuChangesToStorage();
            
            // Clear form
            this.clearAddItemForm();
            
            // Refresh display
            this.populateCategories();
            this.displayMenuItems();
            this.updateMenuStats();
            
            // Show success message
            this.showMessage(`✅ "${newItem.name}" added successfully!`, 'success');
            
            // Update billing screen menu if active
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
                // Also refresh search system to ensure it has updated data
                this.refreshSearchSystem();
            }
            
            // Focus back on name field for quick adding
            setTimeout(() => {
                document.getElementById('item-name').focus();
            }, 100);
            
        } catch (error) {
            console.error('Error adding new menu item:', error);
            this.showMessage('❌ Failed to add item. Please try again.', 'error');
        }
    }

    validateItemForm(formData, isEdit = false) {
        const errors = {};
        let valid = true;

        // Validate name
        const name = formData.get('name')?.trim();
        if (!name) {
            errors.name = 'Item name is required';
            valid = false;
        } else if (name.length > 50) {
            errors.name = 'Item name must be 50 characters or less';
            valid = false;
        } else {
            // Check for duplicate names (excluding current item in edit mode)
            const itemId = isEdit ? parseInt(formData.get('id')) : null;
            const duplicateExists = this.menuItems.some(item => 
                item.name.toLowerCase() === name.toLowerCase() && 
                item.id !== itemId
            );
            if (duplicateExists) {
                errors.name = 'An item with this name already exists';
                valid = false;
            }
        }

        // Validate price
        const price = parseFloat(formData.get('price'));
        if (!price || price <= 0) {
            errors.price = 'Price must be a positive number';
            valid = false;
        } else if (price > 9999) {
            errors.price = 'Price cannot exceed ₹9999';
            valid = false;
        }

        // Validate category
        const category = formData.get('category')?.trim();
        if (!category) {
            errors.category = 'Please select a category';
            valid = false;
        }

        return { valid, errors };
    }

    showFormErrors(errors) {
        // Clear previous errors
        document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
            field.classList.remove('error');
        });

        // Show new errors
        Object.keys(errors).forEach(fieldName => {
            const field = document.querySelector(`[name="${fieldName}"]`);
            if (field) {
                field.classList.add('error');
                field.title = errors[fieldName];
            }
        });

        // Show error message
        const errorMessages = Object.values(errors).join(', ');
        this.showMessage(`❌ ${errorMessages}`, 'error');
    }

    clearAddItemForm() {
        const form = document.getElementById('add-item-form');
        form.reset();
        
        // Remove error styling
        document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
            field.classList.remove('error');
            field.removeAttribute('title');
        });

        // Set default values
        document.getElementById('item-enabled').value = 'true';
    }

    getNextMenuItemId() {
        const maxId = Math.max(...this.menuItems.map(item => item.id), 0);
        return maxId + 1;
    }

    editMenuItem(itemId) {
        const item = this.menuItems.find(item => item.id === itemId);
        if (!item) {
            this.showMessage('❌ Item not found', 'error');
            return;
        }

        // Populate edit form
        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('edit-item-name').value = item.name;
        document.getElementById('edit-item-price').value = item.price;
        document.getElementById('edit-item-category').value = item.category;
        document.getElementById('edit-item-enabled').value = item.enabled !== false ? 'true' : 'false';

        // Show edit modal
        document.getElementById('edit-item-modal').classList.add('active');
        
        // Focus on name field
        setTimeout(() => {
            document.getElementById('edit-item-name').focus();
        }, 300);
    }

    async saveEditedItem() {
        const form = document.getElementById('edit-item-form');
        const formData = new FormData(form);
        
        // Validate form
        const validation = this.validateItemForm(formData, true);
        if (!validation.valid) {
            this.showFormErrors(validation.errors);
            return;
        }

        const itemId = parseInt(formData.get('id'));
        const itemIndex = this.menuItems.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            this.showMessage('❌ Item not found', 'error');
            return;
        }

        try {
            // Update menu item
            this.menuItems[itemIndex] = {
                ...this.menuItems[itemIndex],
                name: formData.get('name').trim(),
                price: parseFloat(formData.get('price')),
                category: formData.get('category'),
                enabled: formData.get('enabled') === 'true'
                // kotGroup is preserved from the original item via spread operator
            };

            // Immediately save changes to storage
            await this.saveMenuChangesToStorage();

            // Close edit modal
            this.closeEditItemModal();
            
            // Refresh display
            this.populateCategories();
            this.displayMenuItems();
            this.updateMenuStats();
            
            // Show success message
            this.showMessage(`✅ "${this.menuItems[itemIndex].name}" updated successfully!`, 'success');
            
            // Update billing screen menu if active
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
                // Also refresh search system to ensure it has updated data
                this.refreshSearchSystem();
            }
            
        } catch (error) {
            console.error('Error saving edited item:', error);
            this.showMessage('❌ Failed to save changes. Please try again.', 'error');
        }
    }

    closeEditItemModal() {
        document.getElementById('edit-item-modal').classList.remove('active');
        
        // Clear form and errors
        const form = document.getElementById('edit-item-form');
        form.reset();
        document.querySelectorAll('#edit-item-form .form-group input, #edit-item-form .form-group select').forEach(field => {
            field.classList.remove('error');
            field.removeAttribute('title');
        });
    }

    async toggleMenuItem(itemId) {
        const itemIndex = this.menuItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            this.showMessage('❌ Item not found', 'error');
            return;
        }

        const item = this.menuItems[itemIndex];
        const newStatus = item.enabled === false;
        
        // Confirm action
        const action = newStatus ? 'enable' : 'disable';
        if (!confirm(`Are you sure you want to ${action} "${item.name}"?`)) {
            return;
        }

        try {
            // Update status
            this.menuItems[itemIndex].enabled = newStatus;
            
            // Immediately save changes to storage
            await this.saveMenuChangesToStorage();
            
            // Refresh display
            this.displayMenuItems();
            this.updateMenuStats();
            
            // Show success message
            const statusText = newStatus ? 'enabled' : 'disabled';
            this.showMessage(`✅ "${item.name}" ${statusText} successfully!`, 'success');
            
            // Update billing screen menu if active
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
                // Also refresh search system to ensure it has updated data
                this.refreshSearchSystem();
            }
            
            console.log('🔄 Menu item toggled - refreshing search data source');
            console.log('📊 Current menuItems count:', this.menuItems.length);
            console.log('📊 Enabled items count:', this.menuItems.filter(item => item.enabled !== false).length);
            
        } catch (error) {
            console.error('Error toggling menu item:', error);
            this.showMessage('❌ Failed to save changes. Please try again.', 'error');
            // Revert the change
            this.menuItems[itemIndex].enabled = !newStatus;
            this.displayMenuItems();
            this.updateMenuStats();
        }
    }

    async deleteMenuItem(itemId) {
        const itemIndex = this.menuItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            this.showMessage('❌ Item not found', 'error');
            return;
        }

        const item = this.menuItems[itemIndex];
        
        // Confirm deletion
        if (!confirm(`⚠️ Are you sure you want to permanently delete "${item.name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            // Remove item
            this.menuItems.splice(itemIndex, 1);
            
            // Immediately save changes to storage
            await this.saveMenuChangesToStorage();
            
            // Refresh display
            this.populateCategories();
            this.displayMenuItems();
            this.updateMenuStats();
            
            // Show success message
            this.showMessage(`✅ "${item.name}" deleted successfully!`, 'success');
            
            // Update billing screen menu if active
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
                // Also refresh search system to ensure it has updated data
                this.refreshSearchSystem();
            }
            
        } catch (error) {
            console.error('Error deleting menu item:', error);
            this.showMessage('❌ Failed to delete item. Please try again.', 'error');
            // Note: We can't easily revert the deletion here, so we'll reload from storage
            await this.reloadMenuItems();
        }
    }

    async saveMenuChanges() {
        try {
            // Show saving indicator
            const saveButton = document.getElementById('save-menu-changes');
            const originalText = saveButton.textContent;
            saveButton.textContent = '💾 Saving...';
            saveButton.disabled = true;

            // Use the core save functionality
            await this.saveMenuChangesToStorage();
            
            // Update the main menu display if we're on billing screen
            if (document.getElementById('billing-screen').classList.contains('active')) {
                this.renderMenu();
            }
            
            // Success feedback
            saveButton.textContent = '✅ Saved!';
            this.showMessage('✅ Menu changes saved successfully!', 'success');
            
            // Reset button after delay
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error saving menu changes:', error);
            
            // Error feedback
            const saveButton = document.getElementById('save-menu-changes');
            saveButton.textContent = '❌ Save Failed';
            saveButton.disabled = false;
            
            this.showMessage('❌ Failed to save menu changes. Please try again.', 'error');
            
            // Reset button after delay
            setTimeout(() => {
                saveButton.textContent = '💾 Save Changes';
            }, 3000);
        }
    }

    // Core save functionality - used by both manual save and automatic saves
    async saveMenuChangesToStorage() {
        // Prepare menu data for saving
        const menuData = {
            restaurant: this.settings.restaurant,
            items: this.menuItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                category: item.category,
                enabled: item.enabled !== false, // Default to true if not set
                kotGroup: item.kotGroup || 'kitchen' // Ensure kotGroup is preserved
            }))
        };

        // Save to file
        const fs = require('fs');
        const menuPath = await dataPathManager.getMenuPath();
        
        fs.writeFileSync(menuPath, JSON.stringify(menuData, null, 2), 'utf8');
        console.log('✅ Menu changes saved to storage');
    }

    showMessage(message, type = 'info') {
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message ${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // Remove message after delay
        setTimeout(() => {
            messageDiv.classList.add('slide-out');
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== TABS AND SETTINGS FUNCTIONALITY =====

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    populateSettings() {
        // Populate restaurant settings
        document.getElementById('restaurant-name').value = this.settings.restaurant.name || '';
        document.getElementById('restaurant-contact').value = this.settings.restaurant.contact || '';
        document.getElementById('restaurant-address').value = this.settings.restaurant.address || '';
        document.getElementById('restaurant-gstin').value = this.settings.restaurant.gstin || '';
        document.getElementById('restaurant-fssai').value = this.settings.restaurant.fssai || '';
    }

    saveRestaurantSettings() {
        // Get form values
        const name = document.getElementById('restaurant-name').value.trim();
        const contact = document.getElementById('restaurant-contact').value.trim();
        const address = document.getElementById('restaurant-address').value.trim();
        const gstin = document.getElementById('restaurant-gstin').value.trim();
        const fssai = document.getElementById('restaurant-fssai').value.trim();

        // Validate required fields
        if (!name) {
            this.showMessage('❌ Restaurant name is required', 'error');
            document.getElementById('restaurant-name').focus();
            return;
        }

        // Update settings
        this.settings.restaurant = {
            name,
            contact,
            address,
            gstin,
            fssai
        };

        // Save to file
        this.saveSettingsToFile();
        
        this.showMessage('✅ Restaurant information saved successfully!', 'success');
    }

    resetRestaurantSettings() {
        const defaults = {
            name: "UDUPI KRISHNAM VEG",
            contact: "+91 12345 67890",
            address: "Bengaluru - Chennai Hwy, Konnappana Agrahara, Electronic City, Bengaluru, Karnataka - 560100",
            gstin: "A unit of Salt and Pepper",
            fssai: "12345678901234"
        };

        this.settings.restaurant = { ...defaults };
        this.populateSettings();
        this.showMessage('🔄 Restaurant information reset to defaults', 'success');
    }

    async saveSettingsToFile() {
        try {
            // Prepare menu data with settings
            const menuData = {
                restaurant: this.settings.restaurant,
                items: this.menuItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    enabled: item.enabled !== false
                }))
            };

            // Save to file
            const fs = require('fs');
            const menuPath = await dataPathManager.getMenuPath();
            
            fs.writeFileSync(menuPath, JSON.stringify(menuData, null, 2), 'utf8');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('❌ Failed to save settings. Please try again.', 'error');
        }
    }

    // ===== PARCEL CHARGE FUNCTIONALITY =====

    updateSelectiveParcelChargeDisplay() {
        const parcelItemsCount = this.getParcelItemsCount();
        const totalParcelCharges = this.getTotalParcelCharges();
        
        // Update the parcel charge display area
        const parcelChargeElement = document.getElementById('parcel-charge-amount');
        const parcelSummaryLine = document.getElementById('parcel-summary-line');
        
        if (parcelChargeElement && parcelSummaryLine) {
            if (parcelItemsCount > 0) {
                parcelChargeElement.textContent = `+₹${totalParcelCharges.toFixed(2)} (${parcelItemsCount} items)`;
                parcelSummaryLine.style.display = 'flex';
            } else {
                parcelChargeElement.textContent = '';
                parcelSummaryLine.style.display = 'none';
            }
        }
    }

    // ===== END TABS AND SETTINGS FUNCTIONALITY =====

    // ===== END MENU MANAGER FUNCTIONALITY =====

    updateDateTime() {
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'short', day: '2-digit' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-IN', dateOptions);
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-IN', timeOptions);
    }

    applyFeatureFlags() {
        // Apply counter feature flag
        if (!ENABLE_COUNTERS) {
            console.log('🔒 Counter functionality disabled by feature flag');
            
            // Hide counter service button in UI
            const counterServiceBtn = document.getElementById('counter-service-btn');
            if (counterServiceBtn) {
                counterServiceBtn.style.display = 'none';
                console.log('✅ Counter service button hidden');
            }
            
            // Hide counter selector screen
            const counterSelectorScreen = document.getElementById('counter-selector-screen');
            if (counterSelectorScreen) {
                counterSelectorScreen.style.display = 'none';
                console.log('✅ Counter selector screen hidden');
            }
        } else {
            console.log('✅ Counter functionality enabled');
        }
    }

    onTableSelect(tableNumber) {
        this.currentTable = tableNumber;
        this.currentLocation = tableNumber;
        this.billingMode = 'table';
        this.showBillingScreen();
    }

    onCounterSelect(counterNumber) {
        if (!ENABLE_COUNTERS) {
            console.log('🔒 Counter selection blocked by feature flag');
            alert('Counter service is temporarily disabled. Please use Table Service.');
            this.showTableSelector();
            return;
        }
        
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
        if (!ENABLE_COUNTERS) {
            console.log('🔒 Counter selector blocked by feature flag - redirecting to table selector');
            this.showTableSelector();
            return;
        }
        
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
        } else if (this.billingMode === 'counter' && ENABLE_COUNTERS) {
            document.getElementById('current-location').textContent = `Counter ${this.currentLocation}`;
            document.getElementById('billing-mode-text').textContent = 'Counter Billing';
            document.getElementById('back-to-tables').textContent = '← Back to Counters';
        } else {
            // Fallback to table mode if counters are disabled or invalid billing mode
            console.log('🔒 Invalid billing mode or counters disabled - defaulting to table mode');
            document.getElementById('current-location').textContent = `Table Service`;
            document.getElementById('billing-mode-text').textContent = 'Table Service';
            document.getElementById('back-to-tables').textContent = '← Back to Tables';
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

        // Filter to show only enabled items
        const enabledItems = this.menuItems.filter(item => item.enabled !== false);

        enabledItems.forEach(item => {
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

        // Show message if no enabled items
        if (enabledItems.length === 0) {
            menuGrid.innerHTML = `
                <div class="no-items" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🍽️</div>
                    <p>No menu items available</p>
                    <p style="font-size: 14px; margin-top: 10px;">Use Menu Manager to add items</p>
                </div>
            `;
        }
    }

    addItemToOrder(item) {
        // Apply discount for counter billing when adding item
        const finalPrice = (this.billingMode === 'counter') ? Math.max(0, item.price - 5) : item.price;
        
        const existingItem = this.currentOrder.find(orderItem => orderItem.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            const newOrderItem = { 
                ...item, 
                price: finalPrice, // Store the final price (with discount if applicable)
                originalPrice: item.price, // Keep original price for reference
                quantity: 1,
                parcelCharge: 0, // Individual parcel charge (0, 5, or 10)
                parcelType: null // null, '5', or '10'
            };
            
            // Debug: Check if kotGroup is preserved
            console.log(`➕ Adding item to order: ${item.name}, kotGroup: ${item.kotGroup} -> ${newOrderItem.kotGroup}`);
            
            this.currentOrder.push(newOrderItem);
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
            itemDiv.className = `order-item ${item.parcelType ? 'has-parcel' : ''}`;
            
            const itemBaseTotal = item.price * item.quantity;
            const itemParcelTotal = item.parcelCharge * item.quantity;
            const itemTotalWithParcel = itemBaseTotal + itemParcelTotal;
            
            itemDiv.innerHTML = `
                <div class="order-item-main">
                    <div class="order-item-info">
                        <div class="order-item-name">
                            ${item.name}
                            ${item.parcelType ? `<span class="parcel-label">Parcel ₹${item.parcelCharge}</span>` : ''}
                        </div>
                        <div class="order-item-price-info">
                            <div class="base-price">₹${item.price.toFixed(2)} × ${item.quantity} = ₹${itemBaseTotal.toFixed(2)}</div>
                            ${item.parcelType ? `<div class="parcel-charge">Parcel: ₹${item.parcelCharge.toFixed(2)} × ${item.quantity} = ₹${itemParcelTotal.toFixed(2)}</div>` : ''}
                            <div class="total-price">Total: ₹${itemTotalWithParcel.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="order-item-controls">
                        <button class="qty-btn minus" onclick="posApp.updateItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="qty-btn plus" onclick="posApp.updateItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        <button class="parcel-btn" onclick="posApp.showParcelPopup(${item.id})" title="Set parcel charge">
                            📦
                        </button>
                        <button class="remove-btn" onclick="posApp.removeItemFromOrder(${item.id})" title="Remove item">×</button>
                    </div>
                </div>
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

    // ===== PER-ITEM PARCEL CHARGE FUNCTIONALITY =====

    showParcelPopup(itemId) {
        const item = this.currentOrder.find(orderItem => orderItem.id === itemId);
        if (!item) return;

        // Remove any existing popup
        this.hideParcelPopup();

        // Create popup
        const popup = document.createElement('div');
        popup.id = 'parcel-popup';
        popup.className = 'parcel-popup';
        popup.innerHTML = `
            <div class="parcel-popup-content">
                <div class="parcel-popup-header">
                    <h3>Parcel Charge for ${item.name}</h3>
                    <button class="close-popup" onclick="posApp.hideParcelPopup()">×</button>
                </div>
                <div class="parcel-popup-options">
                    <button class="parcel-option ${item.parcelType === '5' ? 'selected' : ''}" 
                            onclick="posApp.setItemParcel(${item.id}, 5, '5')">
                        Apply ₹5 Parcel
                    </button>
                    <button class="parcel-option ${item.parcelType === '10' ? 'selected' : ''}" 
                            onclick="posApp.setItemParcel(${item.id}, 10, '10')">
                        Apply ₹10 Parcel
                    </button>
                    <button class="parcel-option remove ${!item.parcelType ? 'selected' : ''}" 
                            onclick="posApp.setItemParcel(${item.id}, 0, null)">
                        Remove Parcel
                    </button>
                </div>
            </div>
            <div class="parcel-popup-backdrop" onclick="posApp.hideParcelPopup()"></div>
        `;

        document.body.appendChild(popup);
        
        // Add CSS for popup if not already present
        this.addParcelPopupStyles();
    }

    hideParcelPopup() {
        const popup = document.getElementById('parcel-popup');
        if (popup) {
            popup.remove();
        }
    }

    setItemParcel(itemId, parcelCharge, parcelType) {
        const item = this.currentOrder.find(orderItem => orderItem.id === itemId);
        if (!item) return;

        item.parcelCharge = parcelCharge;
        item.parcelType = parcelType;

        this.hideParcelPopup();
        this.saveCurrentOrder();
        this.renderOrder();
        this.updateTotals();
    }

    addParcelPopupStyles() {
        // Check if styles already exist
        if (document.getElementById('parcel-popup-styles')) return;

        const style = document.createElement('style');
        style.id = 'parcel-popup-styles';
        style.textContent = `
            .parcel-popup {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .parcel-popup-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
            }

            .parcel-popup-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                position: relative;
                z-index: 1;
                min-width: 300px;
                max-width: 400px;
            }

            .parcel-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 20px 10px;
                border-bottom: 1px solid #eee;
            }

            .parcel-popup-header h3 {
                margin: 0;
                font-size: 16px;
                color: #333;
            }

            .close-popup {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .close-popup:hover {
                color: #333;
                background: #f5f5f5;
                border-radius: 50%;
            }

            .parcel-popup-options {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .parcel-option {
                padding: 15px 20px;
                border: 2px solid #ddd;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.2s ease;
                text-align: center;
            }

            .parcel-option:hover {
                border-color: #007bff;
                background: #f8f9ff;
                transform: translateY(-1px);
            }

            .parcel-option.selected {
                border-color: #007bff;
                background: #007bff;
                color: white;
            }

            .parcel-option.remove {
                border-color: #dc3545;
                color: #dc3545;
            }

            .parcel-option.remove:hover {
                border-color: #dc3545;
                background: #fff5f5;
            }

            .parcel-option.remove.selected {
                background: #dc3545;
                color: white;
            }

            .order-item {
                margin-bottom: 10px;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                background: white;
            }

            .order-item.has-parcel {
                border-left: 4px solid #28a745;
            }

            .order-item-main {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .order-item-info {
                flex: 1;
            }

            .order-item-name {
                font-weight: 600;
                margin-bottom: 5px;
            }

            .parcel-label {
                display: inline-block;
                background: #28a745;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                margin-left: 8px;
            }

            .order-item-price-info {
                font-size: 13px;
                color: #666;
            }

            .base-price, .parcel-charge {
                margin-bottom: 2px;
            }

            .total-price {
                font-weight: 600;
                color: #333;
                margin-top: 5px;
            }

            .order-item-controls {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qty-btn {
                width: 30px;
                height: 30px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
            }

            .qty-btn:hover {
                background: #f5f5f5;
            }

            .quantity {
                min-width: 20px;
                text-align: center;
                font-weight: 600;
            }

            .parcel-btn {
                width: 35px;
                height: 35px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }

            .parcel-btn:hover {
                background: #f8f9ff;
                border-color: #007bff;
            }

            .remove-btn {
                width: 30px;
                height: 30px;
                border: 1px solid #dc3545;
                background: white;
                color: #dc3545;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 18px;
            }

            .remove-btn:hover {
                background: #dc3545;
                color: white;
            }
        `;

        document.head.appendChild(style);
    }

    // ===== SELECTIVE PARCEL CHARGE FUNCTIONALITY =====

    getParcelItemsCount() {
        return this.currentOrder.filter(item => item.parcelCharge > 0).length;
    }

    getTotalParcelCharges() {
        return this.currentOrder.reduce((total, item) => {
            return total + (item.parcelCharge || 0) * item.quantity;
        }, 0);
    }

    // ===== END SELECTIVE PARCEL CHARGE FUNCTIONALITY =====

    updateTotals() {
        const subtotal = this.getSubtotal();
        const parcelCharges = this.getTotalParcelCharges();
        const serviceFee = this.getServiceFee();
        const total = this.getTotal();

        document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `₹0.00`;
        document.getElementById('total').textContent = `₹${total.toFixed(2)}`;
        
        // Update service fee display
        this.updateServiceFeeDisplay();
        
        // Update parcel charge display to show selective charges
        this.updateSelectiveParcelChargeDisplay();
    }

    updateServiceFeeDisplay() {
        const serviceFeeAmount = this.getServiceFee();
        const serviceFeeAmountElement = document.getElementById('service-fee-amount');
        const serviceFeeLabelElement = document.getElementById('service-fee-label');
        const serviceFeeLineElement = document.getElementById('service-fee-line');

        if (this.serviceFeePercentage > 0) {
            serviceFeeAmountElement.textContent = `₹${serviceFeeAmount.toFixed(2)}`;
            serviceFeeLabelElement.textContent = `Service Fee (${this.serviceFeePercentage}%):`;
            serviceFeeLineElement.style.display = 'flex';
        } else {
            serviceFeeLineElement.style.display = 'none';
        }
    }

    getSubtotal() {
        return this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getTax() {
        return 0; // No tax applied
    }

    getServiceFee() {
        if (this.serviceFeePercentage === 0) {
            return 0;
        }
        const subtotal = this.getSubtotal();
        return (subtotal * this.serviceFeePercentage) / 100;
    }

    getTotal() {
        return this.getSubtotal() + this.getTotalParcelCharges() + this.getServiceFee(); // Total includes selective parcel charges and service fee
    }

    loadCurrentOrder() {
        try {
            const storageKey = this.billingMode === 'table' ? 
                `table_${this.currentLocation}_order` : 
                `counter_${this.currentLocation}_order`;
                
            const serviceFeeKey = this.billingMode === 'table' ? 
                `table_${this.currentLocation}_serviceFee` : 
                `counter_${this.currentLocation}_serviceFee`;
                
            const savedOrder = localStorage.getItem(storageKey);
            const savedServiceFee = localStorage.getItem(serviceFeeKey);
            
            this.currentOrder = savedOrder ? JSON.parse(savedOrder) : [];
            this.serviceFeePercentage = savedServiceFee ? JSON.parse(savedServiceFee) : 0;
            
            // Update service fee dropdown to reflect loaded value
            const serviceFeeDropdown = document.getElementById('service-fee-dropdown');
            if (serviceFeeDropdown) {
                serviceFeeDropdown.value = this.serviceFeePercentage;
            }
            
            // Ensure backward compatibility - migrate from isParcel to parcelCharge system
            this.currentOrder = this.currentOrder.map(item => ({
                ...item,
                // Migrate old isParcel system to new parcelCharge system
                parcelCharge: item.parcelCharge !== undefined ? item.parcelCharge : 
                             (item.isParcel ? 10 : 0), // Default ₹10 for existing parcel items
                parcelType: item.parcelType !== undefined ? item.parcelType : 
                           (item.isParcel ? '10' : null),
                // Remove old isParcel field
                isParcel: undefined
            }));
        } catch (error) {
            console.error('Error loading current order:', error);
            this.currentOrder = [];
            this.serviceFeePercentage = 0;
        }
    }

    saveCurrentOrder() {
        if (this.currentLocation && this.billingMode) {
            try {
                const storageKey = this.billingMode === 'table' ? 
                    `table_${this.currentLocation}_order` : 
                    `counter_${this.currentLocation}_order`;
                    
                const serviceFeeKey = this.billingMode === 'table' ? 
                    `table_${this.currentLocation}_serviceFee` : 
                    `counter_${this.currentLocation}_serviceFee`;
                    
                localStorage.setItem(storageKey, JSON.stringify(this.currentOrder));
                localStorage.setItem(serviceFeeKey, JSON.stringify(this.serviceFeePercentage));
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
            this.serviceFeePercentage = 0;
            
            // Update UI to reflect cleared service fee
            const serviceFeeDropdown = document.getElementById('service-fee-dropdown');
            if (serviceFeeDropdown) {
                serviceFeeDropdown.value = '0';
            }
            
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
            
            // Enhanced error message handling
            const errorMsg = error.message || 'Print operation failed';
            
            if (errorMsg.includes('No printer found') || 
                errorMsg.includes('No printer detected') || 
                errorMsg.includes('not available')) {
                
                // Show friendly message and automatically use preview mode
                console.log('🖨️ No printer detected - automatically using print preview mode');
                
                printButton.textContent = '🖨 Using Preview Mode...';
                
                try {
                    await this.printOrderWithPreview();
                    
                    // Success feedback
                    printButton.textContent = '✅ Printed via Preview!';
                    setTimeout(() => {
                        const printButton = document.getElementById('print-order');
                        printButton.textContent = '🖨 Print';
                        printButton.disabled = false;
                    }, 2000);
                    
                    // Clear order after successful print
                    this.currentOrder = [];
                    this.serviceFeePercentage = 0;
                    
                    // Update UI to reflect cleared service fee
                    const serviceFeeDropdown = document.getElementById('service-fee-dropdown');
                    if (serviceFeeDropdown) {
                        serviceFeeDropdown.value = '0';
                    }
                    
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
                    
                } catch (previewError) {
                    console.error('Preview printing also failed:', previewError);
                    alert('❌ Unable to print.\n\nBoth direct printing and preview mode failed.\nPlease check your system and try again.');
                    
                    printButton.textContent = '🖨 Print';
                    printButton.disabled = false;
                }
            } else if (errorMsg.includes('timed out')) {
                alert(`⏱️ Print Timeout\n\nThe print operation took too long.\nYour printer may be busy or offline.\n\nPlease check your printer and try again.`);
            } else if (errorMsg.includes('Print failed')) {
                alert(`❌ Print Job Failed\n\nThe printer rejected the print job.\nPlease check:\n• Paper loaded correctly\n• Printer is ready\n• No error lights\n\nThen try again.`);
            } else {
                alert(`❌ Print Error\n\n${errorMsg}\n\nPlease check your printer connection and try again.`);
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
                        <p>SwiftBill-POS System</p>
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

            const result = await ipcRenderer.invoke('silent-print-bill', testBillContent);
            
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

    // Enhanced auto-silent print method with retry logic and better error handling
    async printOrderAutoSilent() {
        const maxRetries = 2;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
            try {
                attempt++;
                console.log(`Print attempt ${attempt}/${maxRetries + 1}`);
                
                // Generate bill content with enhanced fonts
                const billContent = this.generateBillContent();
                
                // Print dual KOTs using auto-silent method
                console.log('Auto-printing KOTs...');
                console.log('🚨 KOT DEBUG: Method called, about to check items');
                console.log('🚨 CRITICAL: About to call autoSilentPrintKOTs method...');
                console.log('🚨 CRITICAL: this.autoSilentPrintKOTs type:', typeof this.autoSilentPrintKOTs);
                
                try {
                    const kotResult = await this.autoSilentPrintKOTs();
                    console.log('KOT print result:', kotResult);
                } catch (kotError) {
                    console.error('🚨 CRITICAL: KOT method failed with error:', kotError);
                    console.error('🚨 CRITICAL: KOT error stack:', kotError.stack);
                }
                
                // Continue with bill printing regardless of KOT result (KOTs handle their own fallbacks)
                // SPEED OPTIMIZATION: Reduced delay between prints for instant printing
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Print Bill using silent print method (corrected IPC call)
                console.log('Auto-printing Bill...');
                console.log('📋 Calling silent-print-bill IPC handler...');
                const billResult = await ipcRenderer.invoke('silent-print-bill', billContent);
                console.log('📋 Bill print result:', billResult);
                
                // Check if bill print was successful
                if (!billResult.success) {
                    console.log('🖨️ Silent print failed - using preview mode for Bill');
                    await this.printCustomerBill(); // Use preview mode
                    console.log('✅ Bill printed successfully using preview mode');
                    return; // Success via preview mode
                }
                
                if (!billResult.success) {
                    console.log('🖨️ Bill print failed:', billResult.error);
                    throw new Error(`Bill print failed: ${billResult.error}`);
                }
                
                console.log('✅ Bill printed successfully');
                console.log('✅ Order printed successfully - both KOT and Bill');
                return; // Success - exit retry loop
                
            } catch (error) {
                console.error(`Print attempt ${attempt} failed:`, error.message);
                
                // If this was the last attempt, throw the error
                if (attempt > maxRetries) {
                    console.error('All print attempts failed:', error);
                    throw error;
                }
                
                // Wait before retrying (exponential backoff)
                const retryDelay = Math.min(2000 * attempt, 5000); // Max 5 second delay
                console.log(`Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    // Enhanced silent print method with improved error handling
    async printOrderEnhanced() {
        try {
            // Generate bill content
            const billContent = this.generateBillContent();
            
            // Print dual KOTs using enhanced method
            console.log('Printing dual KOTs...');
            await this.enhancedSilentPrintKOTs();

            // Small delay between prints to avoid printer conflicts
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Print Bill using silent print method (corrected IPC call)
            console.log('Printing Bill...');
            const billResult = await ipcRenderer.invoke('silent-print-bill', billContent);
            if (!billResult.success) {
                throw new Error(`Bill print failed: ${billResult.error}`);
            }
            console.log('Bill printed successfully');
            
        } catch (error) {
            console.error('Enhanced printing error:', error);
            throw error; // Re-throw to be handled by printOrder
        }
    }

    async enhancedSilentPrintKOTs() {
        // Split items by kotGroup
        const kitchenItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            return menuItem && menuItem.kotGroup === 'kitchen';
        });
        
        const drinksItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            return menuItem && menuItem.kotGroup === 'drinks';
        });

        // Print Kitchen KOT if items exist
        if (kitchenItems.length > 0) {
            const kitchenKotContent = this.generateKOTContent(kitchenItems, 'KITCHEN KOT');
            const kotResult = await ipcRenderer.invoke('enhanced-silent-print', kitchenKotContent, 'Kitchen KOT');
            if (!kotResult.success) {
                throw new Error(`Kitchen KOT print failed: ${kotResult.error}`);
            }
            console.log('Kitchen KOT printed successfully to:', kotResult.printer);
        }
        
        // Print Drinks KOT if items exist  
        if (drinksItems.length > 0) {
            const drinksKotContent = this.generateKOTContent(drinksItems, 'DRINKS KOT');
            const kotResult = await ipcRenderer.invoke('enhanced-silent-print', drinksKotContent, 'Drinks KOT');
            if (!kotResult.success) {
                throw new Error(`Drinks KOT print failed: ${kotResult.error}`);
            }
            console.log('Drinks KOT printed successfully to:', kotResult.printer);
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
                        <p>SwiftBill-POS System</p>
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
            
            console.log('Sending silent test print...');
            const result = await ipcRenderer.invoke('silent-print-bill', testContent);
            
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
                    <p>SwiftBill-POS System</p>
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
            this.serviceFeePercentage = 0;
            
            // Update UI to reflect cleared service fee
            const serviceFeeDropdown = document.getElementById('service-fee-dropdown');
            if (serviceFeeDropdown) {
                serviceFeeDropdown.value = '0';
            }
            
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

    async autoSilentPrintKOTs() {
        // FORCE ENABLE CONSOLE LOGGING FOR KOT DEBUGGING
        const enableDebugLogging = true;
        if (enableDebugLogging) {
            console.log('🔧 DEBUG MODE ENABLED - KOT printing diagnostics active');
        console.log('🚨 CRITICAL DEBUG: autoSilentPrintKOTs method has been called!');
        console.log('🚨 CRITICAL DEBUG: this.currentOrder length:', this.currentOrder.length);
        console.log('🚨 CRITICAL DEBUG: this.menuItems length:', this.menuItems.length);
        }
        
        console.log('🔄 Starting autoSilentPrintKOTs...');
        console.log('📝 Current order items:', this.currentOrder.length);
        
        // Split items by kotGroup
        const kitchenItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            
            // FALLBACK WARNING: Check for undefined kotGroup
            if (!menuItem) {
                console.warn(`⚠️ FALLBACK WARNING: Menu item not found for order item "${item.name}" (ID: ${item.id})`);
                return true; // Default to kitchen if menu item not found
            }
            
            if (!menuItem.kotGroup) {
                console.warn(`⚠️ FALLBACK WARNING: Menu item "${item.name}" has undefined kotGroup - defaulting to kitchen`);
                return true; // Default to kitchen if kotGroup is undefined
            }
            
            const isKitchen = menuItem.kotGroup === 'kitchen';
            console.log(`Item ${item.name} (ID: ${item.id}) - menuItem kotGroup: ${menuItem?.kotGroup} - order item kotGroup: ${item.kotGroup} - isKitchen: ${isKitchen}`);
            return isKitchen;
        });
        
        const drinksItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            
            // Skip fallback for drinks - only include items explicitly marked as drinks
            if (!menuItem || !menuItem.kotGroup) {
                return false;
            }
            
            const isDrinks = menuItem.kotGroup === 'drinks';
            console.log(`Item ${item.name} (ID: ${item.id}) - menuItem kotGroup: ${menuItem?.kotGroup} - order item kotGroup: ${item.kotGroup} - isDrinks: ${isDrinks}`);
            return isDrinks;
        });

        console.log(`🍳 Kitchen items found: ${kitchenItems.length}`);
        console.log(`☕ Drinks items found: ${drinksItems.length}`);

        // CRITICAL FIX: FORCE KOT PRINTING - NO FAILURES ALLOWED
        let kotsPrintedCount = 0;
        let totalKotsNeeded = 0;
        
        // Print Kitchen KOT if items exist
        if (kitchenItems.length > 0) {
            totalKotsNeeded++;
            console.log(`🍳 FORCING Kitchen KOT print for ${kitchenItems.length} items...`);
            
            try {
                // Try thermal print first
                const kitchenKotContent = this.generateKOTContent(kitchenItems, 'KITCHEN KOT');
                console.log('� Attempting thermal print for Kitchen KOT...');
                const kotResult = await ipcRenderer.invoke('silent-print-kot', kitchenKotContent);
                console.log('🚨 CRITICAL: Kitchen KOT IPC call completed, result:', JSON.stringify(kotResult));
                
                if (kotResult.success) {
                    console.log('✅ Kitchen KOT printed successfully via thermal printer:', kotResult.printer);
                    kotsPrintedCount++;
                } else {
                    throw new Error('Thermal print failed, forcing preview');
                }
            } catch (error) {
                // FORCE PREVIEW MODE - NO FAILURES ALLOWED
                console.log('⚠️ Kitchen KOT thermal failed, FORCING preview mode...');
                try {
                    await this.printSingleKOT(kitchenItems, 'KITCHEN KOT');
                    console.log('✅ Kitchen KOT printed successfully via FORCED preview mode');
                    kotsPrintedCount++;
                } catch (previewError) {
                    console.error('❌ CRITICAL: Kitchen KOT preview mode failed:', previewError);
                    // LAST RESORT: Create manual preview window
                    this.forceKOTPreview(kitchenItems, 'KITCHEN KOT');
                    kotsPrintedCount++;
                }
            }
        }
        
        // Print Drinks KOT if items exist
        if (drinksItems.length > 0) {
            totalKotsNeeded++;
            console.log(`☕ FORCING Drinks KOT print for ${drinksItems.length} items...`);
            
            try {
                // Try thermal print first
                const drinksKotContent = this.generateKOTContent(drinksItems, 'DRINKS KOT');
                console.log('� Attempting thermal print for Drinks KOT...');
                const kotResult = await ipcRenderer.invoke('silent-print-kot', drinksKotContent);
                console.log('🚨 CRITICAL: Drinks KOT IPC call completed, result:', JSON.stringify(kotResult));
                
                if (kotResult.success) {
                    console.log('✅ Drinks KOT printed successfully via thermal printer:', kotResult.printer);
                    kotsPrintedCount++;
                } else {
                    throw new Error('Thermal print failed, forcing preview');
                }
            } catch (error) {
                // FORCE PREVIEW MODE - NO FAILURES ALLOWED
                console.log('⚠️ Drinks KOT thermal failed, FORCING preview mode...');
                try {
                    await this.printSingleKOT(drinksItems, 'DRINKS KOT');
                    console.log('✅ Drinks KOT printed successfully via FORCED preview mode');
                    kotsPrintedCount++;
                } catch (previewError) {
                    console.error('❌ CRITICAL: Drinks KOT preview mode failed:', previewError);
                    // LAST RESORT: Create manual preview window
                    this.forceKOTPreview(drinksItems, 'DRINKS KOT');
                    kotsPrintedCount++;
                }
            }
        }

        console.log(`📊 KOT FORCE PRINT SUMMARY: ${kotsPrintedCount}/${totalKotsNeeded} KOTs printed`);
        
        // If no items to print, that's success
        if (totalKotsNeeded === 0) {
            console.log('ℹ️ No KOTs needed - order has no kitchen or drinks items');
            return { success: true, kotsPrinted: 0, kotsTotal: 0 };
        }
        
        // SUCCESS: At least one KOT was printed
        const success = kotsPrintedCount > 0;
        console.log(success ? '✅ KOT FORCE PRINT SUCCESSFUL' : '❌ KOT FORCE PRINT FAILED');
        
        return { 
            success: success,
            kotsPrinted: kotsPrintedCount,
            kotsTotal: totalKotsNeeded,
            fallbackToPreview: false // We handle our own fallbacks
        };
    }
    
    // EMERGENCY FALLBACK: Force KOT preview when all else fails
    forceKOTPreview(items, kotTitle) {
        console.log(`� EMERGENCY: Creating force preview for ${kotTitle}`);
        try {
            const kotContent = this.generateKOTContent(items, kotTitle);
            const emergencyWindow = window.open('', '_blank', 'width=350,height=600,scrollbars=yes');
            
            if (emergencyWindow) {
                emergencyWindow.document.write(kotContent);
                emergencyWindow.document.close();
                
                // Auto-trigger print dialog after a short delay
                setTimeout(() => {
                    try {
                        emergencyWindow.print();
                    } catch (printError) {
                        console.error('Emergency print dialog failed:', printError);
                    }
                }, 1000);
                
                console.log(`✅ EMERGENCY: ${kotTitle} force preview created successfully`);
            } else {
                console.error('❌ EMERGENCY: Could not create emergency preview window');
            }
        } catch (error) {
            console.error('❌ EMERGENCY: Force preview creation failed:', error);
        }

    }

    async printKOT() {
        // Split items by kotGroup
        const kitchenItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            return menuItem && menuItem.kotGroup === 'kitchen';
        });
        
        const drinksItems = this.currentOrder.filter(item => {
            const menuItem = this.menuItems.find(mi => mi.id === item.id);
            return menuItem && menuItem.kotGroup === 'drinks';
        });

        // Print KOTs based on what items are present
        const printPromises = [];
        
        if (kitchenItems.length > 0) {
            printPromises.push(this.printSingleKOT(kitchenItems, 'KITCHEN KOT'));
        }
        
        if (drinksItems.length > 0) {
            printPromises.push(this.printSingleKOT(drinksItems, 'DRINKS KOT'));
        }
        
        // Print both KOTs simultaneously for speed
        await Promise.all(printPromises);
    }

    async printSingleKOT(items, kotTitle) {
        // Generate KOT HTML content for specific items group
        const kotContent = this.generateKOTContent(items, kotTitle);
        
        // Create a new window for printing KOT
        const kotWindow = window.open('', '_blank', 'width=300,height=600');
        kotWindow.document.write(kotContent);
        kotWindow.document.close();
        
        // Wait for content to load then print - FIXED: Don't close window immediately
        return new Promise((resolve) => {
            setTimeout(() => {
                kotWindow.print();
                
                // CRITICAL FIX: Listen for afterprint event before closing window
                kotWindow.addEventListener('afterprint', () => {
                    kotWindow.close();
                    resolve();
                });
                
                // Fallback: Close after 3 seconds if afterprint doesn't fire
                setTimeout(() => {
                    if (!kotWindow.closed) {
                        kotWindow.close();
                    }
                    resolve();
                }, 3000);
            }, 1000); // Increased delay for proper content loading
        });
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

    generateKOTContent(items = this.currentOrder, kotTitle = 'KITCHEN ORDER TICKET') {
        const now = new Date();
        const locationText = this.billingMode === 'table' ? `Table ${this.currentLocation}` : `Counter ${this.currentLocation}`;
        
        // Check if this order contains any parcel items
        const hasParcelItems = items.some(item => (item.parcelCharge || 0) > 0);
        
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
                        body { 
                            margin: 0 !important; 
                            padding: 2mm !important; 
                        }
                        body, table { 
                            font-size: 10px; /* Keep current size */
                        }
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                            /* THERMAL PRINT OPTIMIZATION: Force solid black for all elements */
                            color: #000000 !important;
                            border-color: #000000 !important;
                        }
                    }
                    body { 
                        font-family: Arial, Tahoma, 'Segoe UI', sans-serif !important; /* OPTIMIZED: Clean system fonts for thermal clarity */
                        font-size: 10px;
                        font-weight: bold !important; /* OPTIMIZED: Bold for better thermal print visibility */
                        margin: 0; 
                        padding: 2mm;
                        width: 270px;
                        max-width: 270px;
                        background: white !important;
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        line-height: 1.2;
                        -webkit-font-smoothing: antialiased !important; /* OPTIMIZED: Better text rendering */
                        font-smoothing: antialiased !important;
                        text-rendering: optimizeLegibility !important; /* OPTIMIZED: Better text clarity */
                        box-sizing: border-box;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 8px; 
                        box-sizing: border-box; /* ADDED: Better sizing */
                    }
                    .kot-title { 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        font-size: 12px;
                        margin-bottom: 3px; 
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        letter-spacing: 1px;
                        word-wrap: break-word;
                    }
                    .location { 
                        font-size: 10px;
                        margin: 2px 0; 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        word-wrap: break-word;
                    }
                    .datetime { 
                        font-size: 9px;
                        margin: 2px 0; 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        word-wrap: break-word;
                    }
                    .items { 
                        margin: 8px 0; 
                        box-sizing: border-box;
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 2px 0;
                        padding: 1px 0;
                        border-bottom: 1px solid #000000 !important; /* OPTIMIZED: Solid black instead of dotted */
                        min-height: 12px;
                        box-sizing: border-box;
                    }
                    .item-name { 
                        flex: 1; 
                        font-size: 10px;
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        padding-right: 4px;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        box-sizing: border-box;
                    }
                    .item-qty { 
                        width: 20mm;
                        text-align: right; 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        font-size: 10px;
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        flex-shrink: 0;
                        box-sizing: border-box;
                    }
                    .footer { 
                        border-top: 2px solid #000000 !important; /* OPTIMIZED: Solid black border */
                        margin-top: 8px; 
                        padding-top: 4px; 
                        text-align: center; 
                        font-size: 9px;
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        box-sizing: border-box;
                        word-wrap: break-word;
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                    }
                    .total-items { 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        margin: 6px 0; 
                        text-align: center; 
                        font-size: 11px;
                        color: #000000 !important; /* OPTIMIZED: Solid black */
                        border: 3px solid #000000 !important; /* OPTIMIZED: Thicker solid black border */
                        padding: 3px;
                        box-sizing: border-box;
                        word-wrap: break-word;
                    }
                    .parcel-order-label { 
                        font-weight: bold !important;
                        margin: 8px 0; 
                        text-align: center; 
                        font-size: 12px;
                        color: #000000 !important;
                        border: 4px solid #000000 !important;
                        padding: 6px 4px;
                        box-sizing: border-box;
                        word-wrap: break-word;
                        background: white !important;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="kot-title">${kotTitle}</div>
                    <div class="location">${locationText}</div>
                    <div class="datetime">${now.toLocaleString('en-IN')}</div>
                </div>
                
                ${hasParcelItems ? `
                <div class="parcel-order-label">
                    *** PARCEL ORDER ***
                </div>
                ` : ''}
                
                <div class="items">
                    ${items.map(item => `
                        <div class="item-row">
                            <span class="item-name">${item.name}</span>
                            <span class="item-qty">x${item.quantity}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-items">
                    TOTAL ITEMS: ${items.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
                
                <div class="footer">
                    <div>*** ${kotTitle === 'KITCHEN KOT' ? 'KITCHEN' : 'DRINKS'} COPY ***</div>
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
                        body { 
                            margin: 0 !important; 
                            padding: 2mm !important; 
                        }
                        body, table { 
                            font-size: 11px; /* ENHANCED: +1px for better visibility */
                        }
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                            /* THERMAL PRINT OPTIMIZATION: Force solid black for all elements */
                            color: #000000 !important;
                            border-color: #000000 !important;
                        }
                        /* HIGH-DPI OPTIMIZATION: Enhanced for 200+ DPI thermal printers */
                        @media print and (min-resolution: 200dpi) {
                            body, table { font-size: 12px; }
                            .restaurant-name { font-size: 16px; }
                            .bill-title { font-size: 14px; }
                            .grand-total { font-size: 14px; }
                        }
                    }
                    body { 
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern clean font with fallbacks */
                        font-size: 11px; /* ENHANCED: +1px base size for better readability */
                        font-weight: bold !important; /* THERMAL: Bold for solid thermal dots */
                        margin: 0; 
                        padding: 2mm;
                        width: 270px;
                        max-width: 270px;
                        background: white !important;
                        color: #000000 !important; /* THERMAL: Solid black only */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        -webkit-font-smoothing: none !important; /* THERMAL: Disable anti-aliasing */
                        font-smoothing: none !important; /* THERMAL: Disable smoothing */
                        text-rendering: optimizeLegibility !important; /* ENHANCED: Better text rendering */
                        -webkit-font-feature-settings: "kern" 1, "liga" 0 !important; /* ENHANCED: Optimized kerning */
                        font-feature-settings: "kern" 1, "liga" 0 !important; /* ENHANCED: Optimized kerning */
                        letter-spacing: 0.02em !important; /* ENHANCED: Micro-spacing for clarity */
                        box-sizing: border-box;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        image-rendering: pixelated !important; /* THERMAL: Sharp edges */
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 6px; 
                        margin-bottom: 8px; 
                        box-sizing: border-box; /* ADDED: Better sizing */
                    }
                    .restaurant-name { 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        font-size: 15px; /* ENHANCED: +1px for better restaurant name visibility */
                        margin-bottom: 3px; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        letter-spacing: 0.3px; /* THERMAL: Reduced spacing for clarity */
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                    }
                    .restaurant-details { 
                        font-size: 11px; /* ENHANCED: +1px for better address/contact readability */
                        margin: 1px 0; 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        color: #000000 !important; /* THERMAL: Solid black */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing, increased from 1.1 */
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .bill-title { 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        font-size: 13px; /* ENHANCED: +1px for better bill title visibility */
                        margin: 4px 0; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        border: 2px solid #000000 !important; /* THERMAL: Thicker solid black border */
                        padding: 2px;
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .location { 
                        font-size: 11px; /* ENHANCED: +1px for better location/table info readability */
                        margin: 3px 0; 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        color: #000000 !important; /* THERMAL: Solid black */
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .datetime { 
                        font-size: 11px; /* ENHANCED: +1px for better readability */
                        margin: 2px 0; 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        color: #000000 !important; /* THERMAL: Solid black */
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .items { 
                        margin: 8px 0; 
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .item-header { 
                        display: flex; 
                        justify-content: space-between; 
                        border-bottom: 2px solid #000000 !important; /* THERMAL: Solid black border */
                        padding: 2px 0;
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        font-size: 11px; /* ENHANCED: +1px for better header readability */
                        color: #000000 !important; /* THERMAL: Solid black */
                        margin-bottom: 2px;
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start;
                        margin: 1px 0;
                        font-size: 11px; /* ENHANCED: +1px for better item row readability */
                        padding: 1px 0;
                        border-bottom: 1px solid #000000 !important; /* THERMAL: Solid black instead of dotted */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        min-height: 13px; /* ENHANCED: Adjusted for increased font size */
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .item-name { 
                        flex: 1; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        padding-right: 2px;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                        word-wrap: break-word;
                        max-width: 35mm;
                        overflow-wrap: break-word;
                        box-sizing: border-box;
                    }
                    .item-qty { 
                        width: 12mm;
                        text-align: center; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .item-rate { 
                        width: 15mm;
                        text-align: right; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .item-total { 
                        width: 18mm;
                        text-align: right; 
                        color: #000000 !important; /* THERMAL: Solid black */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        flex-shrink: 0;
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .parcel-charge-row {
                        font-size: 10px; /* ENHANCED: +1px for better parcel charge readability */
                        color: #333333 !important; /* THERMAL: Slightly lighter for sub-items */
                        border-bottom: none !important; /* THERMAL: No border for sub-items */
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .parcel-charge-row .item-name {
                        font-style: italic; /* THERMAL: Italic for parcel charge indication */
                        padding-left: 4px; /* THERMAL: Indent parcel charges */
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .totals { 
                        border-top: 2px solid #000000 !important; /* OPTIMIZED: Solid black border */
                        margin-top: 8px; 
                        padding-top: 4px; 
                        box-sizing: border-box;
                    }
                    .total-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 2px 0; 
                        font-weight: bold !important; /* OPTIMIZED: Bold for thermal clarity */
                        box-sizing: border-box;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        font-size: 11px; /* ENHANCED: +1px for better total row readability */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .grand-total { 
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        border: 3px solid #000000 !important; /* THERMAL: Thicker solid black border */
                        padding: 3px;
                        font-size: 13px; /* ENHANCED: +1px for better grand total visibility */
                        color: #000000 !important; /* THERMAL: Solid black */
                        background: white !important;
                        margin: 3px 0;
                        box-sizing: border-box;
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                    .footer { 
                        border-top: 2px solid #000000 !important; /* THERMAL: Solid black border */
                        margin-top: 8px; 
                        padding-top: 4px; 
                        text-align: center; 
                        font-size: 9px; /* ENHANCED: +1px for better footer readability */
                        font-weight: bold !important; /* THERMAL: Bold for thermal clarity */
                        line-height: 1.3; /* ENHANCED: Improved readability spacing, increased from 1.1 */
                        box-sizing: border-box;
                        word-wrap: break-word;
                        font-family: 'Roboto Mono', 'Courier New', 'Liberation Mono', 'Consolas', monospace !important; /* ENHANCED: Modern font consistency */
                        letter-spacing: 0.02em !important; /* ENHANCED: Subtle spacing for clarity */
                    }
                        color: #000000 !important; /* THERMAL: Solid black */
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
                    ${this.currentOrder.map((item, index) => {
                        const itemSubtotal = item.price * item.quantity;
                        const parcelChargeForItem = (item.parcelCharge || 0) * item.quantity;
                        const itemTotal = itemSubtotal + parcelChargeForItem;
                        
                        return `
                        <div class="item-row">
                            <span class="item-name">${(index + 1)}. ${item.name}${item.parcelCharge > 0 ? ' 📦' : ''}</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-rate">₹${item.price.toFixed(2)}</span>
                            <span class="item-total">₹${itemSubtotal.toFixed(2)}</span>
                        </div>
                        ${item.parcelCharge > 0 ? `
                        <div class="item-row parcel-charge-row">
                            <span class="item-name">  └ Parcel Charge (₹${item.parcelCharge})</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-rate">₹${item.parcelCharge.toFixed(2)}</span>
                            <span class="item-total">₹${parcelChargeForItem.toFixed(2)}</span>
                        </div>` : ''}
                        `;
                    }).join('')}
                </div>
                
                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>₹${this.getSubtotal().toFixed(2)}</span>
                    </div>
                    ${this.getTotalParcelCharges() > 0 ? `
                    <div class="total-row">
                        <span>Parcel Charges (${this.getParcelItemsCount()} items):</span>
                        <span>₹${this.getTotalParcelCharges().toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${this.serviceFeePercentage > 0 ? `
                    <div class="total-row">
                        <span>Service Fee (${this.serviceFeePercentage}%):</span>
                        <span>₹${this.getServiceFee().toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>TOTAL:</span>
                        <span>₹${total.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <div>Powered by: NMD</div>
                    <div>*** Thank you, Visit again ***</div>
                </div>
            </body>
            </html>
        `;
    }

    // Enhanced manual update system
    async downloadLatestVersion() {
        // Prevent multiple simultaneous downloads
        if (this.isDownloading) {
            console.log('Download already in progress, ignoring click');
            return;
        }
        
        const modal = document.getElementById('update-modal');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const downloadStatus = document.getElementById('download-status');
        const downloadSize = document.getElementById('download-size');
        const postDownloadActions = document.getElementById('post-download-actions');
        const cancelBtn = document.getElementById('cancel-download');
        const runInstallerBtn = document.getElementById('run-installer');
        const showInFolderBtn = document.getElementById('show-in-folder');
        
        // Check if modal exists
        if (!modal) {
            console.error('Update modal not found!');
            alert('Error: Update interface not available. Please refresh the page.');
            return;
        }
        
        let downloadedFilePath = null;
        
        try {
            // Set download state
            this.isDownloading = true;
            
            // Show modal using existing pattern
            modal.classList.add('active');
            
            // Reset UI
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            downloadStatus.textContent = 'Preparing download...';
            downloadSize.textContent = '';
            postDownloadActions.style.display = 'none';
            
            // Listen for progress updates
            const progressListener = (event, data) => {
                progressBar.style.width = data.progress + '%';
                progressText.textContent = data.progress + '%';
                downloadStatus.textContent = 'Downloading...';
                
                if (data.totalSize > 0) {
                    const totalMB = (data.totalSize / 1024 / 1024).toFixed(1);
                    const downloadedMB = (data.downloadedSize / 1024 / 1024).toFixed(1);
                    downloadSize.textContent = `${downloadedMB} MB / ${totalMB} MB`;
                }
            };
            
            ipcRenderer.on('download-progress', progressListener);
            
            // Handle cancel button
            const cancelHandler = async () => {
                try {
                    await ipcRenderer.invoke('cancel-download');
                    modal.classList.remove('active');
                    ipcRenderer.removeListener('download-progress', progressListener);
                } catch (error) {
                    console.error('Error cancelling download:', error);
                } finally {
                    // Always reset download state
                    this.isDownloading = false;
                }
            };
            
            cancelBtn.onclick = cancelHandler;
            
            // Start download
            const result = await ipcRenderer.invoke('download-update');
            
            // Remove progress listener
            ipcRenderer.removeListener('download-progress', progressListener);
            
            if (result.success) {
                downloadedFilePath = result.filePath;
                
                // Show completion UI
                downloadStatus.textContent = 'Download completed!';
                progressBar.style.width = '100%';
                progressText.textContent = '100%';
                postDownloadActions.style.display = 'block';
                
                // Handle run installer
                runInstallerBtn.onclick = async () => {
                    const confirmed = confirm(
                        '🚀 Run Installer\n\n' +
                        'The application will close and the installer will start.\n' +
                        'Your data will be preserved during the update.\n\n' +
                        'Continue?'
                    );
                    
                    if (confirmed) {
                        try {
                            const result = await ipcRenderer.invoke('run-installer', downloadedFilePath);
                            
                            if (!result.success) {
                                // Show detailed error message
                                alert(
                                    '❌ Installer Launch Failed\n\n' +
                                    result.error + '\n\n' +
                                    'Troubleshooting tips:\n' +
                                    '• Right-click the installer → "Run as administrator"\n' +
                                    '• Check Windows Defender/antivirus settings\n' +
                                    '• If file is blocked: Right-click → Properties → Unblock\n\n' +
                                    'File location: ' + (result.filePath || 'Unknown')
                                );
                            } else {
                                console.log('Installer launched successfully via:', result.method);
                            }
                        } catch (error) {
                            console.error('Error running installer:', error);
                            alert(
                                '❌ Error\n\n' +
                                'Failed to run installer: ' + error.message + '\n\n' +
                                'Please try running the installer manually from the downloads folder.'
                            );
                        }
                    }
                };
                
                // Handle show in folder
                showInFolderBtn.onclick = async () => {
                    try {
                        await ipcRenderer.invoke('show-in-folder', downloadedFilePath);
                    } catch (error) {
                        console.error('Error showing in folder:', error);
                        alert('❌ Error\n\nCould not open folder. Please check your downloads manually.');
                    }
                };
                
            } else {
                // Download failed
                downloadStatus.textContent = 'Download failed!';
                progressBar.style.width = '0%';
                progressText.textContent = 'Error';
                
                setTimeout(() => {
                    modal.classList.remove('active');
                    // Reset download state
                    this.isDownloading = false;
                    
                    // Fallback to browser download
                    const retry = confirm(
                        '❌ Download Failed\n\n' +
                        'The in-app download failed. Would you like to download manually from the browser instead?'
                    );
                    
                    if (retry) {
                        this.fallbackDownload();
                    }
                }, 2000);
            }
            
        } catch (error) {
            console.error('Download error:', error);
            modal.classList.remove('active');
            
            // Reset download state
            this.isDownloading = false;
            
            // Fallback to browser download
            const retry = confirm(
                '❌ Download Error\n\n' +
                'An error occurred during download. Would you like to download manually from the browser instead?'
            );
            
            if (retry) {
                this.fallbackDownload();
            }
        } finally {
            // Ensure download state is always reset
            this.isDownloading = false;
        }
    }
    
    // Fallback to browser download (original method)
    async fallbackDownload() {
        try {
            const userConfirmed = confirm(
                '📥 Download Latest Version\n\n' +
                'This will open the download page for the latest version of SwiftBill-POS.\n\n' +
                'After downloading:\n' +
                '• Close this application\n' +
                '• Run the installer (SwiftSetup.exe)\n' +
                '• Follow the installation prompts\n\n' +
                'Do you want to continue?'
            );
            
            if (userConfirmed) {
                const result = await ipcRenderer.invoke('open-latest-release');
                
                if (result.success) {
                    alert(
                        '✅ Download Started!\n\n' +
                        'The download page has been opened in your browser.\n\n' +
                        'Instructions:\n' +
                        '1. Download SwiftSetup.exe from the opened page\n' +
                        '2. Close this application\n' +
                        '3. Run the downloaded installer\n' +
                        '4. Your data will be preserved during the update'
                    );
                } else {
                    await ipcRenderer.invoke('open-release-page');
                    alert(
                        '📋 Release Page Opened\n\n' +
                        'The GitHub releases page has been opened.\n' +
                        'Download SwiftSetup.exe and run it to update.'
                    );
                }
            }
        } catch (error) {
            console.error('Failed to open download page:', error);
            alert(
                '❌ Error\n\n' +
                'Could not open the download page.\n' +
                'Please visit: https://github.com/NinjaBeameR/SwiftBill-POS/releases/latest\n' +
                'and download SwiftSetup.exe manually.'
            );
        }
    }

    // Initialize version display
    async initializeVersionDisplay() {
        try {
            const currentVersion = await ipcRenderer.invoke('get-app-version');
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = `v${currentVersion}`;
                console.log(`Version display initialized: v${currentVersion}`);
            } else {
                console.warn('Version display element not found');
            }
        } catch (error) {
            console.error('Failed to get app version:', error);
            // Fallback to hardcoded version if IPC fails
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = 'v1.0.11';
            }
        }
    }

    // Check for updates with version comparison
    async checkForUpdates() {
        try {
            console.log('🔄 Checking for updates...');
            
            // Show loading state on update button
            const updateBtn = document.getElementById('update-btn');
            const originalText = updateBtn.textContent;
            updateBtn.textContent = '⟳';
            updateBtn.disabled = true;

            // Check version
            const versionCheck = await ipcRenderer.invoke('check-version');
            
            console.log('Version check result:', versionCheck);
            
            // Reset button state
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;

            if (versionCheck.error) {
                console.error('Version check error:', versionCheck.error);
                alert(
                    '❌ Version Check Failed\n\n' +
                    'Could not check for updates. Please try again later.\n\n' +
                    'Error: ' + versionCheck.error
                );
                return;
            }

            if (!versionCheck.hasUpdate) {
                // Show "already latest" modal
                console.log(`✅ Already on latest version: v${versionCheck.currentVersion}`);
                this.showAlreadyLatestModal(versionCheck.currentVersion);
            } else {
                // Proceed with existing download flow
                console.log(`🆕 Update available: v${versionCheck.currentVersion} → v${versionCheck.latestVersion}`);
                this.downloadLatestVersion();
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            // Reset button state
            const updateBtn = document.getElementById('update-btn');
            updateBtn.textContent = '⟳';
            updateBtn.disabled = false;
            
            alert(
                '❌ Update Check Failed\n\n' +
                'Could not check for updates. Please try again later.'
            );
        }
    }

    // Show modal when already on latest version
    showAlreadyLatestModal(currentVersion) {
        // Create a simple, non-intrusive modal
        const existingModal = document.getElementById('already-latest-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'already-latest-modal';
        modal.className = 'modal active';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3 style="color: #4CAF50; margin-bottom: 15px;">✅ Up to Date</h3>
                <p style="margin-bottom: 20px; color: #666;">
                    You already have the latest version (v${currentVersion}).
                </p>
                <button id="close-already-latest" class="btn btn-primary" style="width: 100%;">
                    OK
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Auto-close after 3 seconds or on button click
        const closeBtn = document.getElementById('close-already-latest');
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', closeModal);
        
        // Auto-close after 3 seconds
        setTimeout(closeModal, 3000);
    }
}
