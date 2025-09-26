@echo off
REM Automated Release Script for SwiftBill-POS (Windows)
REM Usage: scripts\release.bat <version>
REM Example: scripts\release.bat 1.0.4

setlocal enabledelayedexpansion

REM Colors (using standard Windows console)
set "GREEN=echo."
set "RED=echo."
set "YELLOW=echo."
set "BLUE=echo."

REM Check if version is provided
if "%1"=="" (
    echo [ERROR] Usage: scripts\release.bat ^<version^>
    echo [ERROR] Example: scripts\release.bat 1.0.4
    echo.
    echo Available shortcuts:
    echo   npm run release-patch  (for bug fixes: 1.0.3 → 1.0.4^)
    echo   npm run release-minor  (for features: 1.0.3 → 1.1.0^)
    echo   npm run release-major  (for major changes: 1.0.3 → 2.0.0^)
    exit /b 1
)

set VERSION=%1
set TAG=v%VERSION%

echo.
echo ╔══════════════════════════════════════╗
echo ║      SWIFTBILL-POS RELEASE TOOL      ║
echo ║     Restaurant Billing Software      ║
echo ╚══════════════════════════════════════╝
echo.

echo [INFO] Starting release process for version %VERSION%

REM Check if working directory is clean
git status --porcelain > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not available or not in a git repository
    exit /b 1
)

for /f %%i in ('git status --porcelain') do (
    echo [ERROR] Working directory is not clean. Please commit or stash changes.
    git status --short
    exit /b 1
)

REM Check if tag already exists
git tag -l | findstr /c:"%TAG%" > nul
if not errorlevel 1 (
    echo [ERROR] Tag %TAG% already exists!
    echo [INFO] Existing tags:
    git tag -l | more
    exit /b 1
)

echo [STEP] Pulling latest changes from origin...
git pull origin main
if errorlevel 1 (
    echo [ERROR] Failed to pull latest changes
    exit /b 1
)

echo [STEP] Updating package.json version to %VERSION%...
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '%VERSION%'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n'); console.log('✓ Updated package.json version to %VERSION%');"
if errorlevel 1 (
    echo [ERROR] Failed to update package.json
    exit /b 1
)

echo [STEP] Verifying build environment...
node --version
npm --version

echo [STEP] Building application locally for verification...
npm run build-win
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)

REM Check if build artifacts exist
if not exist "dist\latest.yml" (
    echo [ERROR] Build failed - latest.yml not found
    dir dist\ /a
    exit /b 1
)

echo [INFO] Build verification successful!

echo [STEP] Committing version changes...
git add package.json
if exist "package-lock.json" git add package-lock.json
git commit -m "chore: bump version to %VERSION%"
if errorlevel 1 (
    echo [ERROR] Failed to commit changes
    exit /b 1
)

echo [STEP] Creating and pushing tag %TAG%...
git tag -a %TAG% -m "Release %TAG%"
if errorlevel 1 (
    echo [ERROR] Failed to create tag
    exit /b 1
)

echo [STEP] Pushing changes to GitHub...
git push origin main
if errorlevel 1 (
    echo [ERROR] Failed to push main branch
    exit /b 1
)

git push origin %TAG%
if errorlevel 1 (
    echo [ERROR] Failed to push tag
    exit /b 1
)

echo.
echo [INFO] 🎉 Release process initiated successfully!
echo.
echo [INFO] GitHub Actions will now:
echo [INFO]   ✓ Build the application on Windows runner
echo [INFO]   ✓ Create GitHub release with proper assets
echo [INFO]   ✓ Upload installer, portable, and latest.yml
echo [INFO]   ✓ Enable auto-updater for existing users
echo.
echo [INFO] 📊 Monitor progress:
echo [INFO]   Actions: https://github.com/NinjaBeameR/SwiftBill-POS/actions
echo [INFO]   Release: https://github.com/NinjaBeameR/SwiftBill-POS/releases/tag/%TAG%
echo.
echo [INFO] 🔔 Existing POS users will be notified automatically!
echo [INFO] ✅ Automated release process complete!

echo [STEP] Cleaning up local build files...
if exist "dist" (
    rmdir /s /q "dist"
    echo [INFO] ✓ Cleaned local build artifacts
)

endlocal
