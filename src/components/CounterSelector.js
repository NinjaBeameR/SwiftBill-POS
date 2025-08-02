// CounterSelector Component - Handles counter selection for takeaway/counter orders
class CounterSelector {
    constructor(onCounterSelectCallback) {
        this.onCounterSelect = onCounterSelectCallback;
        this.totalCounters = 6; // Default number of counter positions
        this.activeCounters = new Set(); // Counters with active orders
        
        this.init();
    }

    init() {
        this.render();
        this.loadActiveCounterData();
    }

    render() {
        const countersGrid = document.getElementById('counters-grid');
        if (!countersGrid) return;
        
        countersGrid.innerHTML = '';

        for (let i = 1; i <= this.totalCounters; i++) {
            const counterElement = this.createCounterElement(i);
            countersGrid.appendChild(counterElement);
        }
    }

    createCounterElement(counterNumber) {
        const counterDiv = document.createElement('div');
        counterDiv.className = 'counter-card';
        counterDiv.dataset.counterNumber = counterNumber;
        
        // Check if counter has active orders and get order details
        const counterOrder = this.getCounterOrderInfo(counterNumber);
        const hasOrders = counterOrder.itemCount > 0;
        
        if (hasOrders) {
            counterDiv.classList.add('active');
        }

        counterDiv.innerHTML = `
            <div class="counter-number">Counter ${counterNumber}</div>
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

        // Add click event listener
        counterDiv.addEventListener('click', () => {
            this.selectCounter(counterNumber);
        });

        // Add hover effects
        counterDiv.addEventListener('mouseenter', () => {
            counterDiv.classList.add('hover');
        });

        counterDiv.addEventListener('mouseleave', () => {
            counterDiv.classList.remove('hover');
        });

        return counterDiv;
    }

    selectCounter(counterNumber) {
        // Add visual feedback
        const counterElement = document.querySelector(`[data-counter-number="${counterNumber}"]`);
        if (counterElement) {
            counterElement.classList.add('selected');
        }
        
        // Brief delay for visual feedback, then call callback
        setTimeout(() => {
            this.onCounterSelect(counterNumber);
        }, 150);
    }

    getCounterOrderInfo(counterNumber) {
        try {
            const savedOrder = localStorage.getItem(`counter_${counterNumber}_order`);
            const orderItems = savedOrder ? JSON.parse(savedOrder) : [];
            
            const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.05;
            const total = subtotal + tax;
            
            return { itemCount, subtotal, tax, total };
        } catch (error) {
            console.error('Error getting counter order info:', error);
            return { itemCount: 0, subtotal: 0, tax: 0, total: 0 };
        }
    }

    markCounterActive(counterNumber) {
        this.activeCounters.add(counterNumber);
        this.updateCounterStatus(counterNumber);
        this.saveActiveCounterData();
    }

    markCounterInactive(counterNumber) {
        this.activeCounters.delete(counterNumber);
        this.updateCounterStatus(counterNumber);
        this.saveActiveCounterData();
    }

    updateCounterStatus(counterNumber) {
        const counterElement = document.querySelector(`[data-counter-number="${counterNumber}"]`);
        if (counterElement) {
            const statusElement = counterElement.querySelector('.counter-status');
            const orderInfo = this.getCounterOrderInfo(counterNumber);
            
            if (orderInfo.itemCount > 0) {
                counterElement.classList.add('active');
                statusElement.innerHTML = `
                    <span class="status-occupied">• Active Order</span>
                    <div class="order-summary">
                        <small>${orderInfo.itemCount} items • ₹${orderInfo.total.toFixed(2)}</small>
                    </div>
                `;
            } else {
                counterElement.classList.remove('active');
                statusElement.innerHTML = '<span class="status-available">Available</span>';
            }
        }
    }

    loadActiveCounterData() {
        // Check all counters for active orders and update activeCounters set
        this.activeCounters.clear();
        for (let i = 1; i <= this.totalCounters; i++) {
            const counterInfo = this.getCounterOrderInfo(i);
            if (counterInfo.itemCount > 0) {
                this.activeCounters.add(i);
            }
        }
        this.saveActiveCounterData();
    }

    saveActiveCounterData() {
        // Save active counters to local storage
        try {
            const activeCounterArray = Array.from(this.activeCounters);
            localStorage.setItem('activeCounters', JSON.stringify(activeCounterArray));
        } catch (error) {
            console.error('Error saving active counter data:', error);
        }
    }

    refreshCounters() {
        this.loadActiveCounterData();
        this.render();
    }
}

module.exports = CounterSelector;
