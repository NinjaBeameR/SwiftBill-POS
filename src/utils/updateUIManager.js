/**
 * Update UI Manager for Udupi POS System
 * Handles update notifications and user interactions in the renderer process
 * Designed to be non-intrusive and professional
 */

class UpdateUIManager {
    constructor() {
        this.isInitialized = false;
        this.updateInfo = null;
        this.downloadProgress = 0;
        this.isDownloading = false;
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Create update UI elements
        this.createUpdateUI();
        
        // Set up IPC listeners for update events
        this.setupUpdateListeners();
        
        // Check current update status on startup
        this.checkCurrentStatus();
        
        this.isInitialized = true;
        console.log('UpdateUIManager: Initialized');
    }

    createUpdateUI() {
        // Create update notification bar
        const notificationBar = document.createElement('div');
        notificationBar.id = 'update-notification-bar';
        notificationBar.className = 'update-notification';
        notificationBar.innerHTML = `
            <div class="update-message">
                <span id="update-message-text">A new update is available</span>
            </div>
            <div class="update-actions">
                <button id="update-details-btn" class="btn btn-sm btn-light">View Details</button>
                <button id="update-dismiss-btn" class="btn btn-sm btn-secondary">Later</button>
            </div>
        `;
        
        // Create update modal
        const modal = document.createElement('div');
        modal.id = 'update-modal';
        modal.className = 'update-modal';
        modal.innerHTML = `
            <div class="update-modal-content">
                <div class="update-modal-header">
                    <h3 id="update-modal-title">Update Available</h3>
                    <button id="update-modal-close" class="btn btn-close">&times;</button>
                </div>
                <div class="update-modal-body">
                    <div id="update-details-content">
                        <p id="update-version-info">Version 1.0.1 is now available</p>
                        <div id="update-release-notes"></div>
                        <div id="update-progress-container" style="display: none;">
                            <div class="update-progress">
                                <div id="update-progress-bar" class="update-progress-bar"></div>
                            </div>
                            <div id="update-progress-text">Downloading... 0%</div>
                        </div>
                    </div>
                </div>
                <div class="update-modal-footer">
                    <button id="update-download-btn" class="btn btn-primary">Download Now</button>
                    <button id="update-install-btn" class="btn btn-success" style="display: none;">Restart & Install</button>
                    <button id="update-cancel-btn" class="btn btn-secondary">Later</button>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(notificationBar);
        document.body.appendChild(modal);

        // Set up event listeners
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Notification bar events
        document.getElementById('update-details-btn').addEventListener('click', () => {
            this.showUpdateModal();
        });

        document.getElementById('update-dismiss-btn').addEventListener('click', () => {
            this.hideNotificationBar();
        });

        // Modal events
        document.getElementById('update-modal-close').addEventListener('click', () => {
            this.hideUpdateModal();
        });

        document.getElementById('update-download-btn').addEventListener('click', () => {
            this.startDownload();
        });

        document.getElementById('update-install-btn').addEventListener('click', () => {
            this.installUpdate();
        });

        document.getElementById('update-cancel-btn').addEventListener('click', () => {
            this.hideUpdateModal();
        });

        // Close modal on background click
        document.getElementById('update-modal').addEventListener('click', (e) => {
            if (e.target.id === 'update-modal') {
                this.hideUpdateModal();
            }
        });
    }

    setupUpdateListeners() {
        // Listen for update events from main process
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.on('update-event', (event, { event: updateEvent, data }) => {
                this.handleUpdateEvent(updateEvent, data);
            });
        }
    }

    handleUpdateEvent(event, data) {
        console.log(`UpdateUIManager: Received event: ${event}`, data);

        switch (event) {
            case 'update-available':
                this.updateInfo = data;
                this.showUpdateAvailable(data);
                break;

            case 'update-not-available':
                // Silent - no notification needed
                break;

            case 'download-progress':
                this.updateDownloadProgress(data);
                break;

            case 'update-downloaded':
                this.showUpdateReady(data);
                break;

            case 'update-error':
                this.showUpdateError(data);
                break;

            case 'app-restarting':
                this.showRestartMessage();
                break;
        }
    }

    showUpdateAvailable(info) {
        const messageText = document.getElementById('update-message-text');
        if (messageText) {
            messageText.textContent = `Update available: ${info.releaseName || info.version}`;
        }
        
        this.showNotificationBar();
    }

    showUpdateReady(info) {
        // Update modal if open
        const downloadBtn = document.getElementById('update-download-btn');
        const installBtn = document.getElementById('update-install-btn');
        const progressContainer = document.getElementById('update-progress-container');
        
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (installBtn) installBtn.style.display = 'inline-block';
        if (progressContainer) progressContainer.style.display = 'none';

        // Update notification bar message
        const messageText = document.getElementById('update-message-text');
        if (messageText) {
            messageText.textContent = 'Update ready to install';
        }

        this.isDownloading = false;
    }

    updateDownloadProgress(progress) {
        this.downloadProgress = progress.percent;
        
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progress.percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Downloading... ${progress.percent}%`;
        }
    }

    showUpdateError(error) {
        console.error('UpdateUIManager: Update error:', error);
        
        // Only show error dialog if the modal is already open (user initiated action)
        // Don't show error dialogs for background/automatic update checks
        const modal = document.getElementById('update-modal');
        const modalBody = document.querySelector('.update-modal-body');
        
        if (modalBody && modal && modal.style.display !== 'none' && modal.style.display !== '') {
            modalBody.innerHTML = `
                <div class="update-error">
                    <p>Update failed: ${error.message}</p>
                    <p>Please try again later or check your internet connection.</p>
                </div>
            `;
        }
        
        // For background errors, just log them - don't show UI
        this.isDownloading = false;
    }

    showRestartMessage() {
        const modalBody = document.querySelector('.update-modal-body');
        if (modalBody && document.getElementById('update-modal').style.display !== 'none') {
            modalBody.innerHTML = `
                <div class="update-restarting">
                    <p>Restarting application to apply update...</p>
                    <p>Please wait while the application restarts.</p>
                </div>
            `;
        }
    }

    async startDownload() {
        if (this.isDownloading) return;
        
        try {
            this.isDownloading = true;
            
            // Show progress container
            const progressContainer = document.getElementById('update-progress-container');
            const downloadBtn = document.getElementById('update-download-btn');
            
            if (progressContainer) progressContainer.style.display = 'block';
            if (downloadBtn) downloadBtn.style.display = 'none';
            
            // Request download from main process
            if (typeof ipcRenderer !== 'undefined') {
                const result = await ipcRenderer.invoke('download-update');
                if (!result.success && !result.alreadyDownloaded) {
                    this.showUpdateError({ message: result.error || 'Download failed' });
                }
            }
        } catch (error) {
            console.error('UpdateUIManager: Download start failed:', error);
            this.showUpdateError({ message: 'Failed to start download' });
        }
    }

    async installUpdate() {
        try {
            if (typeof ipcRenderer !== 'undefined') {
                const result = await ipcRenderer.invoke('install-update');
                if (!result.success) {
                    this.showUpdateError({ message: result.error || 'Install failed' });
                }
            }
        } catch (error) {
            console.error('UpdateUIManager: Install failed:', error);
            this.showUpdateError({ message: 'Failed to install update' });
        }
    }

    async checkCurrentStatus() {
        try {
            if (typeof ipcRenderer !== 'undefined') {
                const status = await ipcRenderer.invoke('get-update-status');
                
                // Only show UI if there's actually an update available or downloaded
                if (status.updateAvailable && !status.updateDownloaded) {
                    this.showNotificationBar();
                    const messageText = document.getElementById('update-message-text');
                    if (messageText) {
                        messageText.textContent = 'Update available';
                    }
                } else if (status.updateDownloaded) {
                    this.showNotificationBar();
                    const messageText = document.getElementById('update-message-text');
                    if (messageText) {
                        messageText.textContent = 'Update ready to install';
                    }
                }
                // If no updates available, don't show anything - completely silent
            }
        } catch (error) {
            console.error('UpdateUIManager: Status check failed:', error);
            // Don't show any UI for status check errors
        }
    }

    showNotificationBar() {
        const bar = document.getElementById('update-notification-bar');
        if (bar) {
            bar.classList.add('show');
        }
    }

    hideNotificationBar() {
        const bar = document.getElementById('update-notification-bar');
        if (bar) {
            bar.classList.remove('show');
        }
    }

    showUpdateModal() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            // Update modal content with current update info
            if (this.updateInfo) {
                const versionInfo = document.getElementById('update-version-info');
                const releaseNotes = document.getElementById('update-release-notes');
                
                if (versionInfo) {
                    versionInfo.textContent = `Version ${this.updateInfo.version} is now available`;
                }
                
                if (releaseNotes && this.updateInfo.releaseNotes) {
                    releaseNotes.innerHTML = `
                        <h4>What's New:</h4>
                        <div class="release-notes">${this.updateInfo.releaseNotes}</div>
                    `;
                }
            }
            
            modal.style.display = 'flex';
        }
    }

    hideUpdateModal() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Public method to manually check for updates (can be called from main POS app)
    async manualCheckForUpdates() {
        try {
            if (typeof ipcRenderer !== 'undefined') {
                // Show a temporary "checking..." message if modal is open
                const modal = document.getElementById('update-modal');
                const modalBody = document.querySelector('.update-modal-body');
                
                if (modal && modalBody && modal.style.display !== 'none' && modal.style.display !== '') {
                    modalBody.innerHTML = `
                        <div class="update-checking">
                            <p>Checking for updates...</p>
                        </div>
                    `;
                }
                
                const result = await ipcRenderer.invoke('check-for-updates');
                
                // If no update found and modal is open, show appropriate message
                if (result.success === false || result.checking) {
                    if (modal && modalBody && modal.style.display !== 'none' && modal.style.display !== '') {
                        modalBody.innerHTML = `
                            <div class="update-no-updates">
                                <p>You're running the latest version!</p>
                                <p>No updates are currently available.</p>
                            </div>
                        `;
                        
                        // Hide the modal automatically after 2 seconds
                        setTimeout(() => {
                            this.hideUpdateModal();
                        }, 2000);
                    }
                }
                
                return result;
            }
        } catch (error) {
            console.error('UpdateUIManager: Manual check failed:', error);
            
            // Only show error if modal is open (user initiated)
            const modal = document.getElementById('update-modal');
            const modalBody = document.querySelector('.update-modal-body');
            
            if (modal && modalBody && modal.style.display !== 'none' && modal.style.display !== '') {
                modalBody.innerHTML = `
                    <div class="update-error">
                        <p>Failed to check for updates</p>
                        <p>Please check your internet connection and try again.</p>
                    </div>
                `;
            }
            
            return { success: false, error: error.message };
        }
    }

    // Cleanup method
    destroy() {
        // Remove UI elements
        const bar = document.getElementById('update-notification-bar');
        const modal = document.getElementById('update-modal');
        
        if (bar) bar.remove();
        if (modal) modal.remove();
        
        this.isInitialized = false;
    }
}

// Export for use in main renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdateUIManager;
} else {
    window.UpdateUIManager = UpdateUIManager;
}
