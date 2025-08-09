/**
 * Auto-Update UI Handler for SwiftBill-POS System
 * Brand new implementation for electron-updater integration
 * Handles all update notifications and user interactions
 */

class AutoUpdateUI {
    constructor() {
        this.updateInfo = null;
        this.dismissedUpdates = this.loadDismissedUpdates();
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('AutoUpdateUI: Starting initialization...');
        
        // Create update UI elements
        this.createUpdateElements();
        
        // Set up IPC listeners for auto-update events
        this.setupEventListeners();
        
        // Check current update status on startup
        this.checkCurrentStatus();
        
        // Add debug overlay for testing
        this.addDebugOverlay();
        
        this.isInitialized = true;
        console.log('AutoUpdateUI: Initialized successfully');
    }

    addDebugOverlay() {
        // Create a simple debug indicator
        const debugDiv = document.createElement('div');
        debugDiv.id = 'auto-update-debug';
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #333;
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            min-width: 200px;
        `;
        debugDiv.innerHTML = `
            <strong>AutoUpdate Debug</strong><br>
            Status: Initialized<br>
            <span id="debug-status">Waiting for events...</span>
        `;
        document.body.appendChild(debugDiv);
        console.log('AutoUpdateUI: Debug overlay added');
    }

    updateDebugStatus(message) {
        const statusEl = document.getElementById('debug-status');
        if (statusEl) {
            statusEl.innerHTML = message;
        }
    }

    createUpdateElements() {
        // Create update notification bar
        const notificationBar = document.createElement('div');
        notificationBar.id = 'auto-update-notification';
        notificationBar.className = 'update-notification';
        notificationBar.innerHTML = `
            <div class="update-message">
                <span id="auto-update-message-text">Update available</span>
                <div class="update-actions">
                    <button id="auto-update-details-btn" class="btn btn-sm btn-light">View Details</button>
                    <button id="auto-update-dismiss-btn" class="btn btn-sm btn-secondary">Later</button>
                </div>
            </div>
        `;
        
        // Create update modal
        const modal = document.createElement('div');
        modal.id = 'auto-update-modal';
        modal.className = 'update-modal';
        modal.innerHTML = `
            <div class="update-modal-content">
                <div class="update-modal-header">
                    <h3 id="auto-update-modal-title">Update Available</h3>
                    <button id="auto-update-modal-close" class="btn btn-close">&times;</button>
                </div>
                <div class="update-modal-body">
                    <div id="auto-update-details-content">
                        <p id="auto-update-version-info">A new version is available</p>
                        <div id="auto-update-release-notes"></div>
                        <div id="auto-update-progress-container" style="display: none;">
                            <div class="update-progress">
                                <div id="auto-update-progress-bar" class="update-progress-bar"></div>
                            </div>
                            <div id="auto-update-progress-text">Downloading... 0%</div>
                        </div>
                    </div>
                </div>
                <div class="update-modal-footer">
                    <button id="auto-update-download-btn" class="btn btn-primary">Download Now</button>
                    <button id="auto-update-install-btn" class="btn btn-success" style="display: none;">Restart & Install</button>
                    <button id="auto-update-later-btn" class="btn btn-secondary">Later</button>
                    <button id="auto-update-release-btn" class="btn btn-info" style="display: none;">View Release</button>
                </div>
            </div>
        `;

        // Add elements to DOM
        document.body.appendChild(notificationBar);
        document.body.appendChild(modal);

        // Set up UI event listeners
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Notification bar events
        document.getElementById('auto-update-details-btn').addEventListener('click', () => {
            this.showUpdateModal();
        });

        document.getElementById('auto-update-dismiss-btn').addEventListener('click', () => {
            this.dismissUpdate();
        });

        // Modal events
        document.getElementById('auto-update-modal-close').addEventListener('click', () => {
            this.hideUpdateModal();
        });

        document.getElementById('auto-update-download-btn').addEventListener('click', () => {
            this.downloadUpdate();
        });

        document.getElementById('auto-update-install-btn').addEventListener('click', () => {
            this.installUpdate();
        });

        document.getElementById('auto-update-later-btn').addEventListener('click', () => {
            this.dismissUpdate();
            this.hideUpdateModal();
        });

        document.getElementById('auto-update-release-btn').addEventListener('click', () => {
            this.openReleaseUrl();
        });

        // Close modal on background click
        document.getElementById('auto-update-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auto-update-modal') {
                this.hideUpdateModal();
            }
        });
    }

    setupEventListeners() {
        console.log('AutoUpdateUI: Setting up IPC event listeners');
        
        // Listen for auto-update events from main process
        if (typeof require === 'function') {
            try {
                const { ipcRenderer } = require('electron');
                console.log('AutoUpdateUI: ipcRenderer available, setting up listener');
                
                ipcRenderer.on('auto-update-event', (event, { event: updateEvent, data }) => {
                    console.log('AutoUpdateUI: Received auto-update event');
                    console.log('AutoUpdateUI: Event type:', updateEvent);
                    console.log('AutoUpdateUI: Event data:', JSON.stringify(data, null, 2));
                    
                    this.handleUpdateEvent(updateEvent, data);
                });
                
                console.log('AutoUpdateUI: IPC listener registered successfully');
            } catch (error) {
                console.error('AutoUpdateUI: Failed to set up IPC listener:', error);
            }
        } else {
            console.error('AutoUpdateUI: require() not available - cannot set up IPC listener');
        }
    }

    handleUpdateEvent(event, data) {
        console.log('AutoUpdateUI: Handling update event:', event);
        console.log('AutoUpdateUI: Event data:', JSON.stringify(data, null, 2));
        
        // Update debug overlay
        this.updateDebugStatus(`Event: ${event}<br>Data: ${JSON.stringify(data, null, 1)}`);

        switch (event) {
            case 'checking-for-update':
                console.log('AutoUpdateUI: Update check started');
                this.updateDebugStatus('Checking for updates...');
                this.showCheckingState();
                break;

            case 'update-available':
                console.log('AutoUpdateUI: Update available, showing notification');
                this.updateDebugStatus(`Update available: ${data.version}`);
                this.updateInfo = data;
                this.showUpdateAvailable(data);
                break;

            case 'update-not-available':
                console.log('AutoUpdateUI: No update available');
                this.updateDebugStatus('No update available');
                this.hideNotificationBar();
                break;

            case 'download-progress':
                console.log('AutoUpdateUI: Download progress:', data.percent + '%');
                this.updateDebugStatus(`Downloading: ${data.percent}%`);
                this.updateDownloadProgress(data);
                break;

            case 'update-downloaded':
                console.log('AutoUpdateUI: Update downloaded, ready to install');
                this.updateDebugStatus('Update ready to install!');
                this.showUpdateReady(data);
                break;

            case 'update-error':
                console.error('AutoUpdateUI: Update error:', data.message);
                this.updateDebugStatus(`Error: ${data.message}`);
                this.showUpdateError(data);
                break;

            case 'app-restarting':
                console.log('AutoUpdateUI: App restarting');
                this.updateDebugStatus('Restarting app...');
                this.showRestartMessage();
                break;
                
            default:
                console.warn('AutoUpdateUI: Unknown event:', event);
                this.updateDebugStatus(`Unknown event: ${event}`);
        }
    }

    showUpdateAvailable(info) {
        console.log('AutoUpdateUI: showUpdateAvailable called');
        console.log('AutoUpdateUI: Update info:', JSON.stringify(info, null, 2));
        console.log('AutoUpdateUI: Dismissed updates:', Array.from(this.dismissedUpdates));
        
        // Check if this update was already dismissed
        if (this.dismissedUpdates.has(info.version)) {
            console.log('AutoUpdateUI: Update was previously dismissed, not showing notification');
            return;
        }

        console.log('AutoUpdateUI: Showing update notification');
        const messageText = document.getElementById('auto-update-message-text');
        if (messageText) {
            messageText.textContent = `Update available: ${info.releaseName || info.version}`;
            console.log('AutoUpdateUI: Updated message text');
        } else {
            console.error('AutoUpdateUI: Message text element not found');
        }

        this.showNotificationBar();
        console.log('AutoUpdateUI: Notification bar should be visible');
        
        // Test alert to verify the function is called
        setTimeout(() => {
            console.log('AutoUpdateUI: Showing test alert for update:', info.version);
            if (typeof alert !== 'undefined') {
                alert(`✅ AUTO-UPDATE WORKING!\n\nUpdate Available: ${info.version}\nRelease: ${info.releaseName}\n\nThe auto-update system is detecting updates correctly!`);
            }
        }, 1000);
    }

    showUpdateReady(info) {
        // Update modal if open
        const downloadBtn = document.getElementById('auto-update-download-btn');
        const installBtn = document.getElementById('auto-update-install-btn');
        const progressContainer = document.getElementById('auto-update-progress-container');

        if (downloadBtn) downloadBtn.style.display = 'none';
        if (installBtn) installBtn.style.display = 'inline-block';
        if (progressContainer) progressContainer.style.display = 'none';

        // Update notification bar message
        const messageText = document.getElementById('auto-update-message-text');
        if (messageText) {
            messageText.textContent = 'Update ready to install';
        }
    }

    updateDownloadProgress(progress) {
        const progressBar = document.getElementById('auto-update-progress-bar');
        const progressText = document.getElementById('auto-update-progress-text');
        const progressContainer = document.getElementById('auto-update-progress-container');

        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = `${progress.percent}%`;
        if (progressText) {
            const mbTransferred = (progress.transferred / 1024 / 1024).toFixed(1);
            const mbTotal = (progress.total / 1024 / 1024).toFixed(1);
            progressText.textContent = `Downloading... ${progress.percent}% (${mbTransferred} MB / ${mbTotal} MB)`;
        }
    }

    showCheckingState() {
        // Could show a subtle checking indicator if desired
        console.log('AutoUpdateUI: Checking for updates...');
    }

    showUpdateError(error) {
        console.error('AutoUpdateUI: Update error:', error);
        
        // Only show error if modal is open (user-initiated action)
        const modal = document.getElementById('auto-update-modal');
        const modalBody = document.querySelector('.update-modal-body');
        
        if (modalBody && modal && modal.style.display === 'flex') {
            modalBody.innerHTML = `
                <div class="update-error">
                    <p><strong>Update Error:</strong> ${error.message}</p>
                    <p>Please try again later or check your internet connection.</p>
                </div>
            `;
        }
    }

    showRestartMessage() {
        const modalBody = document.querySelector('.update-modal-body');
        if (modalBody && document.getElementById('auto-update-modal').style.display === 'flex') {
            modalBody.innerHTML = `
                <div class="update-restarting">
                    <p><strong>Restarting Application...</strong></p>
                    <p>The application will restart to apply the update.</p>
                </div>
            `;
        }
    }

    showUpdateModal() {
        const modal = document.getElementById('auto-update-modal');
        if (!modal || !this.updateInfo) return;

        // Populate modal content
        const versionInfo = document.getElementById('auto-update-version-info');
        const releaseNotes = document.getElementById('auto-update-release-notes');
        const releaseBtn = document.getElementById('auto-update-release-btn');

        if (versionInfo) {
            versionInfo.textContent = `Version ${this.updateInfo.version} is now available`;
        }

        if (releaseNotes) {
            let notesContent = '';
            if (this.updateInfo.releaseNotes) {
                notesContent = `
                    <h4>What's New:</h4>
                    <div class="release-notes">${this.updateInfo.releaseNotes}</div>
                `;
            }
            releaseNotes.innerHTML = notesContent;
        }

        // Show release button if URL is available
        if (releaseBtn && this.updateInfo.releaseUrl) {
            releaseBtn.style.display = 'inline-block';
        }

        modal.style.display = 'flex';
    }

    hideUpdateModal() {
        const modal = document.getElementById('auto-update-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showNotificationBar() {
        const notification = document.getElementById('auto-update-notification');
        if (notification) {
            notification.style.display = 'flex';
        }
    }

    hideNotificationBar() {
        const notification = document.getElementById('auto-update-notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    async dismissUpdate() {
        if (!this.updateInfo) return;

        const version = this.updateInfo.version;
        if (version) {
            this.dismissedUpdates.add(version);
            this.saveDismissedUpdates();
            
            // Notify main process
            if (typeof ipcRenderer !== 'undefined') {
                await ipcRenderer.invoke('dismiss-update', version);
            }
            
            console.log('AutoUpdateUI: Update dismissed:', version);
        }

        this.hideNotificationBar();
    }

    async downloadUpdate() {
        if (typeof ipcRenderer !== 'undefined') {
            const result = await ipcRenderer.invoke('download-update');
            if (!result.success && !result.alreadyDownloaded) {
                this.showUpdateError({ message: result.error || 'Download failed' });
            }
        }
    }

    async installUpdate() {
        if (typeof ipcRenderer !== 'undefined') {
            const result = await ipcRenderer.invoke('install-update');
            if (!result.success) {
                this.showUpdateError({ message: result.error || 'Install failed' });
            }
        }
    }

    async openReleaseUrl() {
        if (this.updateInfo && this.updateInfo.releaseUrl) {
            if (typeof ipcRenderer !== 'undefined') {
                await ipcRenderer.invoke('open-release-url', this.updateInfo.releaseUrl);
            }
        }
    }

    async checkCurrentStatus() {
        try {
            if (typeof ipcRenderer !== 'undefined') {
                const status = await ipcRenderer.invoke('get-update-status');
                
                if (status.updateAvailable && status.updateInfo) {
                    // Check if this update was dismissed
                    if (!this.dismissedUpdates.has(status.updateInfo.version)) {
                        this.updateInfo = status.updateInfo;
                        this.showUpdateAvailable(status.updateInfo);
                        
                        if (status.updateDownloaded) {
                            this.showUpdateReady(status.updateInfo);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('AutoUpdateUI: Status check failed:', error);
        }
    }

    // Persistent storage for dismissed updates
    loadDismissedUpdates() {
        try {
            const stored = localStorage.getItem('auto-update-dismissed');
            if (stored) {
                return new Set(JSON.parse(stored));
            }
        } catch (error) {
            console.warn('AutoUpdateUI: Failed to load dismissed updates:', error);
        }
        return new Set();
    }

    saveDismissedUpdates() {
        try {
            localStorage.setItem('auto-update-dismissed', JSON.stringify(Array.from(this.dismissedUpdates)));
        } catch (error) {
            console.error('AutoUpdateUI: Failed to save dismissed updates:', error);
        }
    }

    // Public method for manual update checks
    async manualCheckForUpdates() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('check-for-updates');
            console.log('AutoUpdateUI: Manual check result:', result);
            return result;
        } catch (error) {
            console.error('AutoUpdateUI: Manual check failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Test methods for development
    async testUpdateScenario(scenario) {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('test-update-scenario', scenario);
            console.log('AutoUpdateUI: Test scenario result:', result);
            return result;
        } catch (error) {
            console.error('AutoUpdateUI: Test scenario failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getUpdateStatus() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('get-update-status');
            console.log('AutoUpdateUI: Update status:', result);
            return result;
        } catch (error) {
            console.error('AutoUpdateUI: Failed to get update status:', error);
            return { success: false, error: error.message };
        }
    }

    clearDismissedUpdates() {
        this.dismissedUpdates.clear();
        this.saveDismissedUpdates();
        console.log('AutoUpdateUI: Dismissed updates cleared');
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoUpdateUI;
} else {
    window.AutoUpdateUI = AutoUpdateUI;
}
