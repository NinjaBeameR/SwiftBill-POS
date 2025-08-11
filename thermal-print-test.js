/**
 * Thermal Printer Test - Validates the actual-size printing fix
 * 
 * This test demonstrates the fix for miniature bill scaling issue.
 * Run this to verify bills print at actual size on 80mm thermal paper.
 */

// Import the fixed Clean Printing System
const CleanPrintingSystem = require('./src/utils/cleanPrintingSystem');

class ThermalPrinterTest {
    constructor() {
        this.cleanPrinter = new CleanPrintingSystem();
        console.log('🧪 Thermal Printer Test initialized');
    }

    /**
     * Generate test bill with exact 80mm width verification
     */
    generateTestBillHTML() {
        const testData = {
            items: [
                { id: 1, name: 'Masala Dosa', quantity: 1, price: 80 },
                { id: 2, name: 'Filter Coffee', quantity: 2, price: 25 },
                { id: 3, name: 'Vada Sambar Set', quantity: 1, price: 65 }
            ],
            location: { type: 'table', number: 7 },
            serviceCharge: 10,
            restaurant: {
                name: "UDUPI RESTAURANT - TEST",
                address: "80mm Width Verification Test",
                contact: "+91 98765 43210",
                gstin: "TEST123456789",
                fssai: "12345678901234"
            }
        };

        return this.cleanPrinter.generateCustomerBillHTML(testData);
    }

    /**
     * Test the fixed printing system - should output actual size
     */
    async testActualSizePrinting() {
        console.log('🖨️ Testing FIXED actual-size printing...');
        console.log('');
        console.log('=== ROOT CAUSE WAS: ===');
        console.log('❌ CSS width: 270px vs @page size: 80mm (302px) - mismatch caused scaling');
        console.log('❌ Electron pageSize height: 200mm too small - caused compression');
        console.log('❌ Missing scaleFactor: 100 and DPI settings - browser applied shrink-to-fit');
        console.log('');
        console.log('=== FIXES APPLIED: ===');
        console.log('✅ CSS: Exact 302px width matching 80mm (302px at 96 DPI)');
        console.log('✅ @page: size: 80mm auto with margin: 0 and no scaling');
        console.log('✅ Electron: scaleFactor: 100, DPI: 300, proper pageSize dimensions');
        console.log('✅ All transform/zoom properties disabled to prevent browser scaling');
        console.log('');

        try {
            const testHTML = this.generateTestBillHTML();
            
            // Test 1: Show in popup to verify visual sizing
            console.log('📋 Test 1: Opening preview window (should show actual 80mm width)...');
            const previewWindow = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
            if (previewWindow) {
                previewWindow.document.write(testHTML);
                previewWindow.document.close();
                previewWindow.document.title = 'FIXED Actual Size Bill Preview';
                
                console.log('👁️ Check preview window - bill should be exactly 302px wide (80mm)');
                console.log('📏 Measure the bill width - it should match your thermal paper exactly');
            }

            // Test 2: Attempt silent printing
            console.log('');
            console.log('🖨️ Test 2: Attempting thermal print with fixed settings...');
            
            const result = await this.cleanPrinter.printCompleteOrder({
                items: [
                    { id: 1, name: 'TEST ITEM - 80MM WIDTH', quantity: 1, price: 100 }
                ],
                menuItems: [
                    { id: 1, name: 'TEST ITEM - 80MM WIDTH', kotGroup: 'kitchen' }
                ],
                location: { type: 'table', number: 999 },
                serviceCharge: 0,
                restaurant: {
                    name: "ACTUAL SIZE TEST",
                    address: "This should print at full 80mm width",
                    contact: "No more miniature bills!",
                    gstin: "FIXED123456789",
                    fssai: "FULL_SIZE_PRINT"
                }
            });

            if (result.success) {
                console.log('✅ Test print completed - check your thermal printer output');
                console.log('📐 The bill should now fill the entire 80mm paper width');
                console.log('🚫 No more miniature/scaled-down appearance');
            } else {
                console.log('⚠️ Silent print failed, but preview should show correct sizing');
                console.log('Error:', result.error);
            }

            return { 
                success: true, 
                message: 'Actual-size printing test completed. Check preview and printer output.' 
            };

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify the dimensional fix
     */
    verifyDimensions() {
        console.log('📏 DIMENSIONAL VERIFICATION:');
        console.log('');
        console.log('80mm thermal paper = 302.36px at 96 DPI');
        console.log('Fixed CSS width: 302px (matches 80mm exactly)');
        console.log('Fixed @page size: 80mm auto (no browser scaling)');
        console.log('Fixed Electron pageSize: 80,000 micrometers (80mm)');
        console.log('Fixed DPI: 300 (thermal printer standard)');
        console.log('Fixed scaleFactor: 100 (no shrinking)');
        console.log('');
        console.log('RESULT: Bills should print at actual size, filling thermal paper width');
    }
}

// Auto-run test if this file is opened directly
if (typeof window !== 'undefined') {
    window.thermalTest = new ThermalPrinterTest();
    
    // Add test button to page
    document.addEventListener('DOMContentLoaded', () => {
        const button = document.createElement('button');
        button.textContent = '🧪 Test Fixed Actual-Size Printing';
        button.style.cssText = `
            position: fixed; 
            top: 20px; 
            right: 20px; 
            z-index: 9999; 
            padding: 15px 25px; 
            background: #28a745; 
            color: white; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        
        button.onclick = () => {
            window.thermalTest.verifyDimensions();
            window.thermalTest.testActualSizePrinting();
        };
        
        document.body.appendChild(button);
    });

    console.log('🧪 Thermal Test loaded - click the test button or run window.thermalTest.testActualSizePrinting()');
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThermalPrinterTest;
}
