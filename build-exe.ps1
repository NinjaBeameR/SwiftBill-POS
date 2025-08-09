# Udupi POS - Windows Executable Builder (PowerShell)
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "     Udupi POS - Windows Executable Builder" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will create a Windows .exe file that:" -ForegroundColor Green
Write-Host "- Runs without installing Node.js or Electron" -ForegroundColor White
Write-Host "- Preserves all your menu and orders data" -ForegroundColor White
Write-Host "- Maintains all printing functionality" -ForegroundColor White
Write-Host "- Keeps keyboard shortcuts working" -ForegroundColor White
Write-Host "- Detects printers automatically" -ForegroundColor White
Write-Host ""

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force }
if (Test-Path "node_modules\.cache") { Remove-Item -Path "node_modules\.cache" -Recurse -Force }

# Install dependencies if needed
Write-Host "[1/3] Checking dependencies..." -ForegroundColor Yellow
npm install

# Build portable executable
Write-Host "[2/3] Creating portable .exe file..." -ForegroundColor Yellow
npm run build-portable

# Build installer
Write-Host "[3/3] Creating installer..." -ForegroundColor Yellow
npm run build-installer

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files created in 'dist' folder:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. PORTABLE VERSION (recommended):" -ForegroundColor Green
Write-Host "   - Udupi-POS-Portable-1.0.0.exe" -ForegroundColor White
Write-Host "   - Single file that runs anywhere" -ForegroundColor Gray
Write-Host "   - No installation needed" -ForegroundColor Gray
Write-Host "   - Just copy and run!" -ForegroundColor Gray
Write-Host ""
Write-Host "2. INSTALLER VERSION:" -ForegroundColor Green
Write-Host "   - Udupi Restaurant POS Setup 1.0.0.exe" -ForegroundColor White
Write-Host "   - Creates desktop shortcuts" -ForegroundColor Gray
Write-Host "   - Proper Windows installation" -ForegroundColor Gray
Write-Host ""
Write-Host "Data Storage:" -ForegroundColor Yellow
Write-Host "- Menu and orders are preserved in the app" -ForegroundColor White
Write-Host "- Each restaurant can have their own data" -ForegroundColor White
Write-Host "- Everything works exactly like before" -ForegroundColor White
Write-Host ""
Write-Host "Printer Support:" -ForegroundColor Yellow
Write-Host "- Automatically detects connected printers" -ForegroundColor White
Write-Host "- Thermal printer optimization included" -ForegroundColor White
Write-Host "- Clear, readable fonts maintained" -ForegroundColor White
Write-Host ""
Write-Host "Ready to deploy to restaurant!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to continue"
