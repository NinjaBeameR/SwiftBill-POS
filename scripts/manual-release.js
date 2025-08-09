/**
 * Manual Release Helper for Udupi POS
 * Provides interactive interface for manual version specification
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ManualReleaseManager {
    constructor() {
        this.packagePath = path.join(__dirname, '..', 'package.json');
        this.isWindows = process.platform === 'win32';
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Get current version from package.json
     */
    getCurrentVersion() {
        const pkg = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        return pkg.version;
    }

    /**
     * Validate version format
     * @param {string} version Version string to validate
     * @returns {boolean} True if valid
     */
    isValidVersion(version) {
        const versionRegex = /^\d+\.\d+\.\d+$/;
        return versionRegex.test(version);
    }

    /**
     * Compare two versions
     * @param {string} current Current version
     * @param {string} next Next version
     * @returns {boolean} True if next is greater than current
     */
    isVersionGreater(current, next) {
        const [currentMajor, currentMinor, currentPatch] = current.split('.').map(Number);
        const [nextMajor, nextMinor, nextPatch] = next.split('.').map(Number);

        if (nextMajor > currentMajor) return true;
        if (nextMajor < currentMajor) return false;
        if (nextMinor > currentMinor) return true;
        if (nextMinor < currentMinor) return false;
        return nextPatch > currentPatch;
    }

    /**
     * Prompt user for input
     * @param {string} question Question to ask
     * @returns {Promise<string>} User input
     */
    question(question) {
        return new Promise((resolve) => {
            this.rl.question(question, resolve);
        });
    }

    /**
     * Execute release with specified version
     * @param {string} version Version to release
     */
    executeRelease(version) {
        console.log(`\n🚀 Initiating manual release for version ${version}...`);
        
        try {
            const scriptPath = this.isWindows 
                ? path.join(__dirname, 'release.bat')
                : path.join(__dirname, 'release.sh');

            // Make script executable on Unix systems
            if (!this.isWindows) {
                try {
                    execSync(`chmod +x "${scriptPath}"`);
                } catch (error) {
                    console.warn('Warning: Could not make script executable:', error.message);
                }
            }

            // Execute the release script
            const command = this.isWindows 
                ? `"${scriptPath}" ${version}`
                : `bash "${scriptPath}" ${version}`;

            console.log(`Executing: ${command}`);
            execSync(command, { stdio: 'inherit' });

        } catch (error) {
            console.error('❌ Release failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Main interactive release function
     */
    async startInteractiveRelease() {
        console.log('╔══════════════════════════════════════╗');
        console.log('║     UDUPI POS MANUAL RELEASE TOOL   ║');
        console.log('║     Restaurant Billing Software     ║');
        console.log('╚══════════════════════════════════════╝');
        console.log();

        const currentVersion = this.getCurrentVersion();
        console.log(`📊 Current version: ${currentVersion}`);
        console.log();

        // Suggest next versions
        const [major, minor, patch] = currentVersion.split('.').map(Number);
        console.log('💡 Suggested versions:');
        console.log(`   Patch (bug fixes): ${major}.${minor}.${patch + 1}`);
        console.log(`   Minor (features):  ${major}.${minor + 1}.0`);
        console.log(`   Major (breaking):  ${major + 1}.0.0`);
        console.log();

        try {
            const newVersion = await this.question('🎯 Enter new version (e.g., 1.0.4): ');
            
            if (!newVersion.trim()) {
                console.log('❌ No version specified. Exiting.');
                this.rl.close();
                return;
            }

            const trimmedVersion = newVersion.trim();

            // Validate version format
            if (!this.isValidVersion(trimmedVersion)) {
                console.log('❌ Invalid version format. Use semantic versioning (e.g., 1.0.4)');
                this.rl.close();
                return;
            }

            // Check if version is greater than current
            if (!this.isVersionGreater(currentVersion, trimmedVersion)) {
                console.log(`❌ New version (${trimmedVersion}) must be greater than current version (${currentVersion})`);
                this.rl.close();
                return;
            }

            // Confirm release
            console.log();
            console.log(`📋 Release Summary:`);
            console.log(`   Current: ${currentVersion}`);
            console.log(`   New:     ${trimmedVersion}`);
            console.log();

            const confirm = await this.question('✅ Proceed with this release? (y/N): ');
            
            if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
                console.log('❌ Release cancelled by user.');
                this.rl.close();
                return;
            }

            this.rl.close();
            
            // Execute the release
            this.executeRelease(trimmedVersion);

        } catch (error) {
            console.error('❌ Error during interactive release:', error.message);
            this.rl.close();
            process.exit(1);
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const manager = new ManualReleaseManager();
    manager.startInteractiveRelease().catch(error => {
        console.error('❌ Manual release failed:', error.message);
        process.exit(1);
    });
}

module.exports = ManualReleaseManager;
