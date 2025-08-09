/**
 * Manual Update Check Integration
 * Add this to your POS app if you want a manual "Check for Updates" button
 * This can be integrated into the menu manager or settings screen
 */

class ManualUpdateChecker {
    constructor() {
        this.isChecking = false;
    }

    // Add a "Check for Updates" button to any screen
    addUpdateButtonToElement(parentElement, buttonText = "Check for Updates") {
        const updateButton = document.createElement('button');
        updateButton.id = 'manual-update-check-btn';
        updateButton.className = 'btn btn-secondary';
        updateButton.textContent = buttonText;
        updateButton.style.marginLeft = '10px';
        
        updateButton.addEventListener('click', () => {
            this.performManualCheck();
        });
        
        parentElement.appendChild(updateButton);
        return updateButton;
    }

    async performManualCheck() {
        if (this.isChecking) return;
        
        const button = document.getElementById('manual-update-check-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Checking...';
        }
        
        try {
            this.isChecking = true;
            
            if (window.updateUIManager) {
                const result = await window.updateUIManager.manualCheckForUpdates();
                
                if (result && result.success === false && !result.checking) {
                    // No updates available - show brief success message
                    if (button) {
                        button.textContent = 'Up to date!';
                        setTimeout(() => {
                            button.textContent = 'Check for Updates';
                            button.disabled = false;
                        }, 2000);
                    }
                } else {
                    // Updates found or checking in progress
                    if (button) {
                        button.textContent = 'Check for Updates';
                        button.disabled = false;
                    }
                }
            } else {
                throw new Error('Update manager not available');
            }
        } catch (error) {
            console.error('Manual update check failed:', error);
            if (button) {
                button.textContent = 'Check Failed';
                setTimeout(() => {
                    button.textContent = 'Check for Updates';
                    button.disabled = false;
                }, 2000);
            }
        } finally {
            this.isChecking = false;
        }
    }

    // Integration example for the menu manager screen
    integrateWithMenuManager() {
        // Wait for menu manager to be available
        const checkForMenuManager = () => {
            const menuManagerActions = document.querySelector('.billing-actions');
            if (menuManagerActions && !document.getElementById('manual-update-check-btn')) {
                this.addUpdateButtonToElement(menuManagerActions);
                console.log('Manual update check button added to menu manager');
            } else {
                setTimeout(checkForMenuManager, 1000);
            }
        };
        
        setTimeout(checkForMenuManager, 2000);
    }
}

// Auto-integrate if the POS app is available
if (typeof window !== 'undefined') {
    window.manualUpdateChecker = new ManualUpdateChecker();
    
    // Auto-integrate with menu manager after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.manualUpdateChecker) {
                window.manualUpdateChecker.integrateWithMenuManager();
            }
        }, 3000);
    });
}

// Export for manual integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManualUpdateChecker;
}
