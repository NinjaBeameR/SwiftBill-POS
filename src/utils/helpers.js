// Helper utilities for the POS system

const helpers = {
    // Date and time formatting
    formatDate(date) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
        };
        return date.toLocaleDateString('en-IN', options);
    },

    formatTime(date) {
        const options = { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        };
        return date.toLocaleTimeString('en-IN', options);
    },

    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    // Currency formatting
    formatCurrency(amount) {
        return `₹${parseFloat(amount).toFixed(2)}`;
    },

    // Generate bill number
    generateBillNumber() {
        const today = new Date();
        const dateStr = today.getFullYear().toString().slice(-2) + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        const timeStr = today.getHours().toString().padStart(2, '0') + 
                       today.getMinutes().toString().padStart(2, '0');
        return `${dateStr}${timeStr}`;
    },

    // Local storage helpers
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    },

    loadFromStorage(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Error loading from storage:', error);
            return defaultValue;
        }
    },

    // Validation helpers
    isValidTableNumber(tableNumber) {
        return Number.isInteger(tableNumber) && tableNumber >= 1 && tableNumber <= 20;
    },

    isValidPrice(price) {
        return typeof price === 'number' && price >= 0;
    },

    isValidQuantity(quantity) {
        return Number.isInteger(quantity) && quantity > 0;
    },

    // Order calculation helpers
    calculateOrderSubtotal(orderItems) {
        return orderItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
    },

    calculateTax(subtotal, taxRate = 0.05) {
        return subtotal * taxRate;
    },

    calculateTotal(subtotal, tax) {
        return subtotal + tax;
    },

    // Print formatting helpers
    formatBillLine(description, amount, width = 40) {
        const amountStr = this.formatCurrency(amount);
        const availableSpace = width - amountStr.length;
        const paddedDescription = description.length > availableSpace 
            ? description.substring(0, availableSpace - 3) + '...'
            : description.padEnd(availableSpace);
        return paddedDescription + amountStr;
    },

    formatKOTItem(item) {
        return `${item.quantity}x ${item.name}`;
    },

    // Keyboard shortcut helpers
    getKeyboardShortcuts() {
        return {
            'Escape': 'Back to Tables',
            'F1': 'Print KOT',
            'F2': 'Print Bill',
            'F3': 'Clear Order',
            'Ctrl+S': 'Save Order'
        };
    }
};

module.exports = helpers;
