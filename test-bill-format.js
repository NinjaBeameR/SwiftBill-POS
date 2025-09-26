// Quick test to verify 32-character bill formatting
const path = require('path');

// Mock bill data
const testBillData = {
    tableNumber: 5,
    locationNumber: 5,
    locationType: 'Table',
    items: [
        { name: 'Chicken Fried Rice', quantity: 2, rate: 180, amount: 360 },
        { name: 'Veg Schezwan Noodles', quantity: 1, rate: 160, amount: 160 },
        { name: 'Paneer Butter Masala', quantity: 1, rate: 200, amount: 200 }
    ],
    subtotal: 720,
    serviceFee: 0,
    tax: 36,
    total: 756,
    timestamp: new Date().toISOString()
};

// Test the NewPrintHandler formatting
async function testBillFormatting() {
    try {
        // Import the NewPrintHandler
        const NewPrintHandlerPath = path.join(__dirname, 'src', 'printing', 'NewPrintHandler.js');
        const NewPrintHandler = require(NewPrintHandlerPath);
        
        const printHandler = new NewPrintHandler();
        
        // Generate the bill text
        const billText = printHandler.generateCustomerBillText(testBillData);
        
        console.log('=== 32-CHARACTER BILL FORMAT TEST ===');
        console.log('Each line should be exactly 32 characters or less:');
        console.log('');
        
        const lines = billText.split('\n');
        lines.forEach((line, index) => {
            const length = line.length;
            const indicator = length <= 32 ? '✓' : '✗';
            console.log(`${indicator} (${length.toString().padStart(2)}): ${line}`);
        });
        
        console.log('');
        console.log('=== TEST COMPLETE ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testBillFormatting();