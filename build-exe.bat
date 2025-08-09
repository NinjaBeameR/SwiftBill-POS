@echo off
echo ================================================
echo     SwiftBill-POS - Windows Executable Builder
echo ================================================
echo.
echo This script will create a Windows .exe file that:
echo - Runs without installing Node.js or Electron
echo - Preserves all your menu and orders data
echo - Maintains all printing functionality
echo - Keeps keyboard shortcuts working
echo - Detects printers automatically
echo.
echo Building executable files...
echo.

REM Clean previous builds
if exist dist rmdir /s /q dist
if exist node_modules\.cache rmdir /s /q node_modules\.cache

REM Install dependencies if needed
echo [1/3] Checking dependencies...
call npm install

REM Build portable executable (single file that runs anywhere)
echo [2/3] Creating portable .exe file...
call npm run build-portable

REM Build installer (for easy installation on restaurant computers)
echo [3/3] Creating installer...
call npm run build-installer

echo.
echo ================================================
echo Build Complete!
echo ================================================
echo.
echo Files created in 'dist' folder:
echo.
echo 1. PORTABLE VERSION (recommended):
echo    - SwiftBill-POS-Portable-1.0.0.exe
echo    - Single file that runs anywhere
echo    - No installation needed
echo    - Just copy and run!
echo.
echo 2. INSTALLER VERSION:
echo    - SwiftSetup.exe  
echo    - Creates desktop shortcuts
echo    - Proper Windows installation
echo.
echo Data Storage:
echo - Menu and orders are preserved in the app
echo - Each restaurant can have their own data
echo - Everything works exactly like before
echo.
echo Printer Support:
echo - Automatically detects connected printers
echo - Thermal printer optimization included
echo - Clear, readable fonts maintained
echo.
echo Ready to deploy to restaurant!
echo.
pause
