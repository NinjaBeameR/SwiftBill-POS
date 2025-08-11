/**
 * Lightweight Update Notification Manager for SwiftBill-POS
 * Checks for newer versions and shows non-intrusive toast notifications
 */

class UpdateNotificationManager {
    constructor() {
        this.currentVersion = '1.0.16'; // Will be dynamically read from package.json
        this.lastCheckTime = localStorage.getItem('last-update-check');
        this.dismissedVersion = localStorage.getItem('dismissed-update-version');
        this.checkInterval = 24 * 60 * 60 * 1000; // Check once per day
        this.githubRepo = 'NinjaBeameR/SwiftBill-POS';
        this.toastContainer = null;
        
        this.initializeToastContainer();
    }

    /**
     * Initialize the toast notification container
     */
    initializeToastContainer() {
        // Create toast container if it doesn't exist
        this.toastContainer = document.getElementById('toast-container');
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toast-container';
            this.toastContainer.className = 'toast-container';
            document.body.appendChild(this.toastContainer);
        }
    }

    /**
     * Check if we should perform an update check
     */
    shouldCheckForUpdates() {
        const now = Date.now();
        const lastCheck = parseInt(this.lastCheckTime) || 0;
        return (now - lastCheck) > this.checkInterval;
    }

    /**
     * Get current app version from package.json or electron app
     */
    async getCurrentVersion() {
        try {
            // In Electron, we can get version from app info
            if (window.require) {
                const { app } = window.require('@electron/remote');
                this.currentVersion = app.getVersion();
            }
            return this.currentVersion;
        } catch (error) {
            console.log('UpdateManager: Using fallback version');
            return this.currentVersion;
        }
    }

    /**
     * Fetch latest release from GitHub
     */
    async fetchLatestVersion() {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.githubRepo}/releases/latest`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'SwiftBill-POS-UpdateChecker'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const release = await response.json();
            
            return {
                version: release.tag_name.replace(/^v/, ''), // Remove 'v' prefix if present
                releaseUrl: release.html_url,
                publishedAt: release.published_at,
                description: release.body || 'No description available'
            };
        } catch (error) {
            console.log('UpdateManager: Could not fetch latest version:', error.message);
            return null;
        }
    }

    /**
     * Compare version strings (semver-like comparison)
     */
    isNewerVersion(currentVersion, latestVersion) {
        const current = currentVersion.split('.').map(num => parseInt(num, 10));
        const latest = latestVersion.split('.').map(num => parseInt(num, 10));

        for (let i = 0; i < Math.max(current.length, latest.length); i++) {
            const currentPart = current[i] || 0;
            const latestPart = latest[i] || 0;

            if (latestPart > currentPart) return true;
            if (latestPart < currentPart) return false;
        }

        return false;
    }

    /**
     * Show update available toast notification
     */
    showUpdateToast(latestVersionInfo) {
        // Check if user already dismissed this version
        if (this.dismissedVersion === latestVersionInfo.version) {
            console.log('UpdateManager: User already dismissed this version');
            return;
        }

        const toast = this.createToast({
            type: 'update',
            title: '🎉 Update Available!',
            message: `Version ${latestVersionInfo.version} is now available`,
            version: latestVersionInfo.version,
            releaseUrl: latestVersionInfo.releaseUrl,
            persistent: true
        });

        this.showToast(toast);
    }

    /**
     * Create a toast notification element
     */
    createToast({ type = 'info', title, message, version = null, releaseUrl = null, persistent = false }) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-header">
                    <span class="toast-title">${title}</span>
                    <button class="toast-close" aria-label="Close notification">&times;</button>
                </div>
                <div class="toast-body">
                    <p class="toast-message">${message}</p>
                    ${releaseUrl ? `
                        <div class="toast-actions">
                            <button class="toast-btn toast-btn-primary" data-action="view-release">
                                View Release
                            </button>
                            <button class="toast-btn toast-btn-secondary" data-action="dismiss">
                                Dismiss
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add event listeners
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismissToast(toast));

        if (releaseUrl) {
            const viewBtn = toast.querySelector('[data-action="view-release"]');
            const dismissBtn = toast.querySelector('[data-action="dismiss"]');

            viewBtn.addEventListener('click', () => {
                window.require('electron').shell.openExternal(releaseUrl);
                this.dismissToast(toast);
            });

            dismissBtn.addEventListener('click', () => {
                if (version) {
                    localStorage.setItem('dismissed-update-version', version);
                }
                this.dismissToast(toast);
            });
        }

        // Auto-dismiss non-persistent toasts
        if (!persistent) {
            setTimeout(() => this.dismissToast(toast), 8000);
        }

        return toast;
    }

    /**
     * Show a toast notification
     */
    showToast(toast) {
        this.toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 100);

        // Limit number of visible toasts
        const toasts = this.toastContainer.querySelectorAll('.toast');
        if (toasts.length > 3) {
            this.dismissToast(toasts[0]);
        }
    }

    /**
     * Dismiss a toast notification
     */
    dismissToast(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Show a simple info toast
     */
    showInfoToast(title, message) {
        const toast = this.createToast({
            type: 'info',
            title,
            message,
            persistent: false
        });
        this.showToast(toast);
    }

    /**
     * Main method to check for updates and show notification
     */
    async checkForUpdates(forceCheck = false) {
        try {
            // Check if we should perform update check
            if (!forceCheck && !this.shouldCheckForUpdates()) {
                console.log('UpdateManager: Skipping check - too soon since last check');
                return { checked: false, reason: 'too_soon' };
            }

            console.log('UpdateManager: Checking for updates...');
            
            // Update last check time
            localStorage.setItem('last-update-check', Date.now().toString());

            // Get current and latest versions
            const currentVersion = await this.getCurrentVersion();
            const latestVersionInfo = await this.fetchLatestVersion();

            if (!latestVersionInfo) {
                return { checked: true, updateAvailable: false, error: 'Could not fetch version info' };
            }

            console.log(`UpdateManager: Current: ${currentVersion}, Latest: ${latestVersionInfo.version}`);

            // Check if update is available
            const updateAvailable = this.isNewerVersion(currentVersion, latestVersionInfo.version);

            if (updateAvailable) {
                console.log('UpdateManager: Update available!');
                this.showUpdateToast(latestVersionInfo);
                return { 
                    checked: true, 
                    updateAvailable: true, 
                    currentVersion, 
                    latestVersion: latestVersionInfo.version,
                    releaseUrl: latestVersionInfo.releaseUrl
                };
            } else {
                console.log('UpdateManager: App is up to date');
                return { 
                    checked: true, 
                    updateAvailable: false, 
                    currentVersion, 
                    latestVersion: latestVersionInfo.version 
                };
            }

        } catch (error) {
            console.error('UpdateManager: Error checking for updates:', error);
            return { checked: true, updateAvailable: false, error: error.message };
        }
    }

    /**
     * Manual update check triggered by user
     */
    async manualCheck() {
        this.showInfoToast('🔄 Checking for Updates', 'Checking for the latest version...');
        
        const result = await this.checkForUpdates(true);
        
        if (result.error) {
            this.showInfoToast('❌ Check Failed', 'Could not check for updates. Please check your internet connection.');
        } else if (!result.updateAvailable) {
            this.showInfoToast('✅ Up to Date', `You're running the latest version (${result.currentVersion})`);
        }
        // If update is available, showUpdateToast was already called
        
        return result;
    }

    /**
     * Initialize automatic update checking
     */
    startPeriodicChecks() {
        // Initial check after app startup (delayed to not interfere with startup)
        setTimeout(() => {
            this.checkForUpdates();
        }, 30000); // 30 seconds after startup

        // Set up periodic checking every 4 hours while app is running
        setInterval(() => {
            this.checkForUpdates();
        }, 4 * 60 * 60 * 1000);
    }
}

// Export for use in renderer
window.UpdateNotificationManager = UpdateNotificationManager;
