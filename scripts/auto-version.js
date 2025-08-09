/**
 * Automated Version Management for Udupi POS
 * Follows semantic versioning with automated release pipeline
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoVersionManager {
    constructor() {
        this.packagePath = path.join(__dirname, '..', 'package.json');
        this.isWindows = process.platform === 'win32';
    }

    /**
     * Get current version from package.json
     * @returns {string} Current version
     */
    getCurrentVersion() {
        const pkg = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        return pkg.version;
    }

    /**
     * Calculate next version based on type
     * @param {string} type - patch, minor, or major
     * @returns {string} Next version
     */
    calculateNextVersion(type) {
        const current = this.getCurrentVersion();
        const [major, minor, patch] = current.split('.').map(Number);

        switch (type) {
            case 'patch':
                return `${major}.${minor}.${patch + 1}`;
            case 'minor':
                return `${major}.${minor + 1}.0`;
            case 'major':
                return `${major + 1}.0.0`;
            default:
                throw new Error(`Invalid version type: ${type}. Use patch, minor, or major.`);
        }
    }

    /**
     * Check if working directory is clean
     * @returns {boolean} True if clean
     */
    isWorkingDirectoryClean() {
        try {
            const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
            return status === '';
        } catch (error) {
            console.error('Error checking git status:', error.message);
            return false;
        }
    }

    /**
     * Check if tag already exists
     * @param {string} version Version to check
     * @returns {boolean} True if tag exists
     */
    tagExists(version) {
        try {
            const tags = execSync('git tag -l', { encoding: 'utf8' });
            return tags.includes(`v${version}`);
        } catch (error) {
            console.error('Error checking git tags:', error.message);
            return false;
        }
    }

    /**
     * Execute release script with proper platform detection
     * @param {string} version Version to release
     */
    executeRelease(version) {
        console.log(`🚀 Initiating automated release for version ${version}...`);
        
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
     * Main release function
     * @param {string} type Version bump type
     */
    async release(type) {
        console.log('╔══════════════════════════════════════╗');
        console.log('║      UDUPI POS AUTO-RELEASE TOOL    ║');
        console.log('║     Restaurant Billing Software     ║');
        console.log('╚══════════════════════════════════════╝');
        console.log();

        // Validate input
        if (!['patch', 'minor', 'major'].includes(type)) {
            console.error('❌ Invalid version type. Use: patch, minor, or major');
            process.exit(1);
        }

        const currentVersion = this.getCurrentVersion();
        const nextVersion = this.calculateNextVersion(type);

        console.log(`📊 Current version: ${currentVersion}`);
        console.log(`🎯 Next version: ${nextVersion} (${type} bump)`);
        console.log();

        // Pre-flight checks
        console.log('🔍 Running pre-flight checks...');

        if (!this.isWorkingDirectoryClean()) {
            console.error('❌ Working directory is not clean. Please commit or stash changes.');
            process.exit(1);
        }
        console.log('✅ Working directory is clean');

        if (this.tagExists(nextVersion)) {
            console.error(`❌ Tag v${nextVersion} already exists!`);
            process.exit(1);
        }
        console.log('✅ Version tag is available');

        // Check if Node.js and npm are available
        try {
            execSync('node --version', { stdio: 'pipe' });
            execSync('npm --version', { stdio: 'pipe' });
            console.log('✅ Node.js and npm are available');
        } catch (error) {
            console.error('❌ Node.js or npm not found');
            process.exit(1);
        }

        // Check if git is available and we're in a repo
        try {
            execSync('git status', { stdio: 'pipe' });
            console.log('✅ Git repository detected');
        } catch (error) {
            console.error('❌ Not in a git repository or git not available');
            process.exit(1);
        }

        console.log();
        console.log('🚀 All checks passed! Proceeding with automated release...');
        console.log();

        // Execute the release
        this.executeRelease(nextVersion);
    }
}

// Execute if run directly
if (require.main === module) {
    const type = process.argv[2];
    
    if (!type) {
        console.log('Udupi POS Automated Release Tool');
        console.log('Usage: node auto-version.js <type>');
        console.log();
        console.log('Version Types:');
        console.log('  patch  - Bug fixes (1.0.3 → 1.0.4)');
        console.log('  minor  - New features (1.0.3 → 1.1.0)');
        console.log('  major  - Breaking changes (1.0.3 → 2.0.0)');
        console.log();
        console.log('Examples:');
        console.log('  npm run release-patch');
        console.log('  npm run release-minor');
        console.log('  npm run release-major');
        process.exit(1);
    }

    const manager = new AutoVersionManager();
    manager.release(type).catch(error => {
        console.error('❌ Release failed:', error.message);
        process.exit(1);
    });
}

module.exports = AutoVersionManager;
