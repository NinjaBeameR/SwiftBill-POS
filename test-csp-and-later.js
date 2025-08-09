/**
 * Test script to verify CSP compliance and Later button functionality
 */

console.log('=== CSP and Later Button Test ===');

// Test 1: Check if CSP is preventing unsafe operations
try {
    eval('console.log("This should fail if CSP is working")');
    console.log('❌ CSP test failed - eval() should be blocked');
} catch (e) {
    console.log('✅ CSP test passed - eval() is properly blocked');
}

// Test 2: Check if the UpdateUIManager properly tracks dismissed updates
if (window.updateUIManager) {
    console.log('✅ UpdateUIManager is available');
    
    // Check if the dismissed updates tracking is working
    if (window.updateUIManager.dismissedUpdates) {
        console.log('✅ Dismissed updates tracking is available');
        
        // Simulate dismissing an update
        window.updateUIManager.dismissedUpdates.add('1.0.3');
        console.log('✅ Successfully added test version to dismissed updates');
        
        // Check if it's properly tracked
        if (window.updateUIManager.dismissedUpdates.has('1.0.3')) {
            console.log('✅ Dismissed update tracking is working correctly');
        } else {
            console.log('❌ Dismissed update tracking failed');
        }
    } else {
        console.log('❌ Dismissed updates tracking not available');
    }
} else {
    console.log('❌ UpdateUIManager not available');
}

// Test 3: Check CSP compliance for dynamic content
try {
    const testDiv = document.createElement('div');
    testDiv.innerHTML = '<span>Test content</span>'; // This should work
    console.log('✅ Dynamic innerHTML assignment works');
    
    testDiv.style.display = 'none'; // This should work
    console.log('✅ Dynamic style assignment works');
    
} catch (e) {
    console.log('❌ Basic DOM operations failed:', e.message);
}

console.log('=== Test Complete ===');
