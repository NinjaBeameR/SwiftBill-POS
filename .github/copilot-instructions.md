<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Udupi POS System - Copilot Instructions

This is an Electron-based restaurant Point of Sale (POS) system with a modular architecture.

## Project Structure
- `/src/components/` - UI components (TableSelector, BillingScreen, PrintHandler)
- `/src/storage/` - JSON data files (menu.json, orders.json)
- `/src/utils/` - Utility functions (helpers.js, printerUtils.js)
- `/styles/` - CSS stylesheets

## Key Technologies
- Electron for desktop app framework
- Vanilla JavaScript (no external frameworks)
- CSS Grid and Flexbox for responsive layouts
- Local storage and JSON files for data persistence

## Code Style Guidelines
- Use modular class-based components
- Implement consistent error handling
- Follow camelCase naming convention
- Use const/let appropriately
- Include comprehensive comments for complex functions

## POS Features
- Table selection (14 tables by default)
- Menu item management
- Order creation and modification
- KOT (Kitchen Order Ticket) printing
- Customer bill printing with proper formatting
- Local data persistence

## Print Format Requirements
- KOT: Simple item list for kitchen (no prices)
- Bill: Professional format with restaurant details, GSTIN, FSSAI
- Both optimized for 8cm thermal printers

When suggesting code changes:
1. Maintain the modular structure
2. Ensure printer-friendly formatting
3. Handle errors gracefully
4. Update related components when needed
5. Follow the established coding patterns
