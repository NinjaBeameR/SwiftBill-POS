// TableSelector Component - Handles table selection grid
class TableSelector {
    constructor(onTableSelectCallback) {
        this.onTableSelect = onTableSelectCallback;
        this.totalTables = 14;
        this.activeTables = new Set(); // Tables with active orders
        
        this.init();
    }

    init() {
        this.render();
        this.loadActiveTableData();
    }

    render() {
        const tablesGrid = document.getElementById('tables-grid');
        tablesGrid.innerHTML = '';

        for (let i = 1; i <= this.totalTables; i++) {
            const tableElement = this.createTableElement(i);
            tablesGrid.appendChild(tableElement);
        }
    }

    createTableElement(tableNumber) {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table-card';
        tableDiv.dataset.tableNumber = tableNumber;
        
        // Check if table has active orders
        if (this.activeTables.has(tableNumber)) {
            tableDiv.classList.add('active');
        }

        tableDiv.innerHTML = `
            <div class="table-number">Table ${tableNumber}</div>
            <div class="table-status">${this.activeTables.has(tableNumber) ? 'Occupied' : 'Available'}</div>
        `;

        // Add click event listener
        tableDiv.addEventListener('click', () => {
            this.selectTable(tableNumber);
        });

        // Add hover effects
        tableDiv.addEventListener('mouseenter', () => {
            tableDiv.classList.add('hover');
        });

        tableDiv.addEventListener('mouseleave', () => {
            tableDiv.classList.remove('hover');
        });

        return tableDiv;
    }

    selectTable(tableNumber) {
        // Add visual feedback
        const tableElement = document.querySelector(`[data-table-number="${tableNumber}"]`);
        tableElement.classList.add('selected');
        
        // Brief delay for visual feedback, then call callback
        setTimeout(() => {
            this.onTableSelect(tableNumber);
        }, 150);
    }

    markTableActive(tableNumber) {
        this.activeTables.add(tableNumber);
        this.updateTableStatus(tableNumber);
    }

    markTableInactive(tableNumber) {
        this.activeTables.delete(tableNumber);
        this.updateTableStatus(tableNumber);
    }

    updateTableStatus(tableNumber) {
        const tableElement = document.querySelector(`[data-table-number="${tableNumber}"]`);
        if (tableElement) {
            const statusElement = tableElement.querySelector('.table-status');
            
            if (this.activeTables.has(tableNumber)) {
                tableElement.classList.add('active');
                statusElement.textContent = 'Occupied';
            } else {
                tableElement.classList.remove('active');
                statusElement.textContent = 'Available';
            }
        }
    }

    loadActiveTableData() {
        // Load active tables from local storage or data source
        try {
            const savedActiveTables = localStorage.getItem('activeTables');
            if (savedActiveTables) {
                const activeTableArray = JSON.parse(savedActiveTables);
                this.activeTables = new Set(activeTableArray);
                this.render();
            }
        } catch (error) {
            console.error('Error loading active table data:', error);
        }
    }

    saveActiveTableData() {
        // Save active tables to local storage
        try {
            const activeTableArray = Array.from(this.activeTables);
            localStorage.setItem('activeTables', JSON.stringify(activeTableArray));
        } catch (error) {
            console.error('Error saving active table data:', error);
        }
    }
}

module.exports = TableSelector;
