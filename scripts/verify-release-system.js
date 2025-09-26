/**
 * Release System Verification Script
 * Tests all components of the automated release system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ReleaseSystemVerifier {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
    }

    log(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        switch (type) {
            case 'error':
                this.errors.push(logMessage);
                console.log(`❌ ${logMessage}`);
                break;
            case 'warning':
                this.warnings.push(logMessage);
                console.log(`⚠️  ${logMessage}`);
                break;
            case 'success':
                this.successes.push(logMessage);
                console.log(`✅ ${logMessage}`);
                break;
            default:
                console.log(`ℹ️  ${logMessage}`);
        }
    }

    checkFileExists(filePath, description) {
        if (fs.existsSync(filePath)) {
            this.log('success', `${description} exists: ${filePath}`);
            return true;
        } else {
            this.log('error', `${description} missing: ${filePath}`);
            return false;
        }
    }

    checkCommand(command, description) {
        try {
            execSync(command, { stdio: 'pipe' });
            this.log('success', `${description} available`);
            return true;
        } catch (error) {
            this.log('error', `${description} not available: ${error.message}`);
            return false;
        }
    }

    checkPackageJsonScripts() {
        try {
            const packagePath = path.join(__dirname, '..', 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            const requiredScripts = [
                'release-patch',
                'release-minor',
                'release-major',
                'manual-release',
                'build-win'
            ];

            let allScriptsPresent = true;
            requiredScripts.forEach(script => {
                if (pkg.scripts && pkg.scripts[script]) {
                    this.log('success', `Package.json script '${script}' configured`);
                } else {
                    this.log('error', `Package.json script '${script}' missing`);
                    allScriptsPresent = false;
                }
            });

            return allScriptsPresent;
        } catch (error) {
            this.log('error', `Failed to check package.json: ${error.message}`);
            return false;
        }
    }

    checkGitConfiguration() {
        try {
            const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
            if (gitStatus === '') {
                this.log('success', 'Working directory is clean');
            } else {
                this.log('warning', 'Working directory has uncommitted changes');
            }

            const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
            if (remoteUrl.includes('NinjaBeameR/SwiftBill-POS')) {
                this.log('success', 'Git remote correctly configured');
            } else {
                this.log('warning', `Git remote might be incorrect: ${remoteUrl}`);
            }

            return true;
        } catch (error) {
            this.log('error', `Git configuration check failed: ${error.message}`);
            return false;
        }
    }

    checkElectronBuilder() {
        try {
            const packagePath = path.join(__dirname, '..', 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            if (pkg.devDependencies && pkg.devDependencies['electron-builder']) {
                this.log('success', `Electron Builder installed: ${pkg.devDependencies['electron-builder']}`);
                return true;
            } else {
                this.log('error', 'Electron Builder not found in devDependencies');
                return false;
            }
        } catch (error) {
            this.log('error', `Failed to check Electron Builder: ${error.message}`);
            return false;
        }
    }

    async runVerification() {
        console.log('╔══════════════════════════════════════╗');
        console.log('║  SWIFTBILL-POS RELEASE SYSTEM CHECK ║');
        console.log('║     Restaurant Billing Software     ║');
        console.log('╚══════════════════════════════════════╝');
        console.log();

        console.log('🔍 Verifying release system setup...');
        console.log();

        // Check required files
        console.log('📁 Checking required files...');
        this.checkFileExists('.github/workflows/release.yml', 'GitHub Actions workflow');
        this.checkFileExists('scripts/release.sh', 'Release script (Unix)');
        this.checkFileExists('scripts/release.bat', 'Release script (Windows)');
        this.checkFileExists('scripts/auto-version.js', 'Auto-version script');
        this.checkFileExists('scripts/manual-release.js', 'Manual release script');
        this.checkFileExists('docs/RELEASE-GUIDE.md', 'Release documentation');

        console.log();

        // Check system dependencies
        console.log('🔧 Checking system dependencies...');
        this.checkCommand('node --version', 'Node.js');
        this.checkCommand('npm --version', 'npm');
        this.checkCommand('git --version', 'Git');

        console.log();

        // Check package.json configuration
        console.log('📦 Checking package.json configuration...');
        this.checkPackageJsonScripts();
        this.checkElectronBuilder();

        console.log();

        // Check git configuration
        console.log('📚 Checking git configuration...');
        this.checkGitConfiguration();

        console.log();

        // Check auto-update system files
        console.log('🔄 Checking auto-update system...');
        this.checkFileExists('src/utils/autoUpdateUI.js', 'Auto-update UI handler');
        this.checkFileExists('main.js', 'Main process file');

        console.log();

        // Summary
        console.log('📊 VERIFICATION SUMMARY');
        console.log('═'.repeat(50));
        console.log(`✅ Successes: ${this.successes.length}`);
        console.log(`⚠️  Warnings:  ${this.warnings.length}`);
        console.log(`❌ Errors:    ${this.errors.length}`);
        console.log();

        if (this.errors.length === 0) {
            console.log('🎉 RELEASE SYSTEM READY!');
            console.log();
            console.log('You can now use:');
            console.log('  npm run release-patch  (for bug fixes)');
            console.log('  npm run release-minor  (for features)');
            console.log('  npm run release-major  (for major changes)');
            console.log('  npm run manual-release (for custom versions)');
        } else {
            console.log('❌ SETUP INCOMPLETE');
            console.log();
            console.log('Please fix the following errors:');
            this.errors.forEach(error => console.log(`  • ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log();
            console.log('⚠️  Warnings to consider:');
            this.warnings.forEach(warning => console.log(`  • ${warning}`));
        }

        console.log();
        console.log('📖 For detailed instructions, see: docs/RELEASE-GUIDE.md');
    }
}

// Execute if run directly
if (require.main === module) {
    const verifier = new ReleaseSystemVerifier();
    verifier.runVerification().catch(error => {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    });
}

module.exports = ReleaseSystemVerifier;
