/**
 * Update Manager for SwiftBill-POS System
 * Handles automatic updates from GitHub releases
 * Non-intrusive design that never interrupts POS operations
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog, BrowserWindow } = require('electron');
const path = require('path');

class UpdateManager {
    constructor() {
        this.mainWindow = null;
        this.updateAvailable = false;
        this.updateDownloaded = false;
        this.downloadProgress = 0;
        this.isCheckingForUpdate = false;
        this.lastUpdateCheck = 0;
        this.updateInfo = null;
        this.updateCheckInterval = 6 * 60 * 60 * 1000; // 6 hours
        this.initialDelayMs = 30 * 1000; // 30 seconds after startup
        
        // Configure autoUpdater
        this.configureAutoUpdater();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    configureAutoUpdater() {
        // Configure GitHub releases as update source
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'NinjaBeameR',
            repo: 'SwiftBill-POS'
        });

        // Only check for updates, don't auto-download
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;
        
        // Allow prereleases if in development
        autoUpdater.allowPrerelease = false;
        
        // Disable automatic update checks on startup
        autoUpdater.checkForUpdatesAndNotify = false;

        console.log('UpdateManager: Configured for GitHub releases');
    }

    setupEventListeners() {
        // Update available
        autoUpdater.on('update-available', (info) => {
            console.log('UpdateManager: Update available:', info.version);
            this.updateAvailable = true;
            this.updateInfo = {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseName: info.releaseName || `Version ${info.version}`,
                releaseNotes: info.releaseNotes || 'Bug fixes and improvements'
            };
            this.notifyRenderer('update-available', this.updateInfo);
        });

        // No update available
        autoUpdater.on('update-not-available', (info) => {
            console.log('UpdateManager: No update available');
            this.updateAvailable = false;
            this.updateInfo = null;
            this.isCheckingForUpdate = false;
            this.notifyRenderer('update-not-available');
        });

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            this.downloadProgress = Math.round(progressObj.percent);
            console.log(`UpdateManager: Download progress: ${this.downloadProgress}%`);
            this.notifyRenderer('download-progress', {
                percent: this.downloadProgress,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond
            });
        });

        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            console.log('UpdateManager: Update downloaded and ready');
            this.updateDownloaded = true;
            this.notifyRenderer('update-downloaded', {
                version: info.version,
                releaseName: info.releaseName || `Version ${info.version}`
            });
        });

        // Error handling
        autoUpdater.on('error', (error) => {
            console.error('UpdateManager: Error occurred:', error);
            this.isCheckingForUpdate = false;
            
            // Only notify renderer of actual errors, not "no updates available"
            const errorMessage = error.message || 'Update check failed';
            const isNoUpdateError = errorMessage.toLowerCase().includes('no update') || 
                                  errorMessage.toLowerCase().includes('update not available') ||
                                  errorMessage.toLowerCase().includes('no releases found');
            
            if (!isNoUpdateError) {
                this.notifyRenderer('update-error', {
                    message: errorMessage
                });
            } else {
                // This is just "no updates available", handle silently
                console.log('UpdateManager: No updates available (silent)');
            }
        });
    }

    setMainWindow(window) {
        this.mainWindow = window;
        
        // Note: Automatic update checking is disabled to prevent intrusive notifications
        // Users can manually check for updates through the menu if needed
        console.log('UpdateManager: Ready for manual update checks');
    }

    async checkForUpdatesIfIdle() {
        // Don't check if already checking or if checked recently
        const now = Date.now();
        if (this.isCheckingForUpdate || (now - this.lastUpdateCheck) < (2 * 60 * 60 * 1000)) {
            return;
        }

        // Don't check if app is not ready or window is not available
        if (!app.isReady() || !this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        try {
            this.isCheckingForUpdate = true;
            this.lastUpdateCheck = now;
            
            console.log('UpdateManager: Checking for updates...');
            const result = await autoUpdater.checkForUpdates();
            
            // If checkForUpdates completes without triggering update-available or error events,
            // it likely means no updates are available
            setTimeout(() => {
                if (this.isCheckingForUpdate) {
                    console.log('UpdateManager: Update check completed - no updates available');
                    this.isCheckingForUpdate = false;
                }
            }, 5000);
            
        } catch (error) {
            console.error('UpdateManager: Failed to check for updates:', error);
            this.isCheckingForUpdate = false;
            
            // Handle common "no updates" scenarios silently
            const errorMessage = error.message || '';
            const isNoUpdateScenario = errorMessage.toLowerCase().includes('no update') || 
                                     errorMessage.toLowerCase().includes('update not available') ||
                                     errorMessage.toLowerCase().includes('no releases found') ||
                                     errorMessage.toLowerCase().includes('404') ||
                                     errorMessage.toLowerCase().includes('not found');
            
            if (!isNoUpdateScenario) {
                console.warn('UpdateManager: Actual update error:', errorMessage);
            }
        }
    }

    // Manual update check (called from renderer)
    async manualCheckForUpdates() {
        if (this.isCheckingForUpdate) {
            return { checking: true };
        }

        try {
            this.isCheckingForUpdate = true;
            this.lastUpdateCheck = Date.now();
            
            console.log('UpdateManager: Manual update check initiated');
            const result = await autoUpdater.checkForUpdates();
            return { success: true, result };
        } catch (error) {
            console.error('UpdateManager: Manual update check failed:', error);
            this.isCheckingForUpdate = false;
            return { success: false, error: error.message };
        }
    }

    // Download update (called from renderer)
    async downloadUpdate() {
        if (!this.updateAvailable) {
            return { success: false, error: 'No update available' };
        }

        if (this.updateDownloaded) {
            return { success: true, alreadyDownloaded: true };
        }

        try {
            console.log('UpdateManager: Starting update download');
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            console.error('UpdateManager: Download failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Install update and restart (called from renderer)
    async installUpdateAndRestart() {
        if (!this.updateDownloaded) {
            return { success: false, error: 'No update downloaded' };
        }

        try {
            console.log('UpdateManager: Installing update and restarting');
            
            // Notify renderer that restart is imminent
            this.notifyRenderer('app-restarting');
            
            // Small delay to allow UI to show restart message
            setTimeout(() => {
                autoUpdater.quitAndInstall(false, true);
            }, 1000);
            
            return { success: true };
        } catch (error) {
            console.error('UpdateManager: Install failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Get current update status
    getUpdateStatus() {
        return {
            updateAvailable: this.updateAvailable,
            updateDownloaded: this.updateDownloaded,
            downloadProgress: this.downloadProgress,
            isChecking: this.isCheckingForUpdate,
            lastCheck: this.lastUpdateCheck,
            updateInfo: this.updateInfo
        };
    }

    // Test method to simulate update scenarios (for development/testing only)
    simulateUpdateScenario(scenario) {
        if (scenario === 'update-available') {
            const mockUpdateInfo = {
                version: '1.0.3',
                releaseDate: new Date().toISOString(),
                releaseName: 'Version 1.0.3',
                releaseNotes: 'Test update for debugging purposes'
            };
            
            this.updateAvailable = true;
            this.updateInfo = mockUpdateInfo;
            this.notifyRenderer('update-available', mockUpdateInfo);
            console.log('UpdateManager: Simulated update-available event');
        } else if (scenario === 'no-update') {
            this.updateAvailable = false;
            this.updateInfo = null;
            this.notifyRenderer('update-not-available');
            console.log('UpdateManager: Simulated update-not-available event');
        }
    }

    // Notify renderer process of update events
    notifyRenderer(event, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update-event', { event, data });
        }
    }

    // Cleanup
    destroy() {
        // Remove all listeners
        autoUpdater.removeAllListeners();
        this.mainWindow = null;
    }
}

module.exports = UpdateManager;
