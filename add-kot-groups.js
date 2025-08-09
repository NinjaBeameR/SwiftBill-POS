// Script to add kotGroup field to menu items
const fs = require('fs');
const path = require('path');

// Category to kotGroup mapping
const kotGroupMapping = {
    'Rice': 'kitchen',
    'Dosa Special': 'kitchen', 
    'Indian Curry': 'kitchen',
    'Meals/Roti Curry': 'kitchen',
    'Noodles': 'kitchen',
    'Roti': 'kitchen',
    'Soups': 'kitchen',
    'Starters': 'kitchen',
    'Breakfast': 'kitchen',
    'Juice/Milkshake': 'kitchen',
    'Tea/Coffee': 'drinks'
};

try {
    // Read the current menu file
    const menuPath = path.join(__dirname, 'src', 'storage', 'menu.json');
    const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
    
    // Update each item with kotGroup
    menuData.items = menuData.items.map(item => ({
        ...item,
        kotGroup: kotGroupMapping[item.category] || 'kitchen' // Default to kitchen if category not found
    }));
    
    // Write back to file
    fs.writeFileSync(menuPath, JSON.stringify(menuData, null, 2), 'utf8');
    
    console.log('✅ Successfully added kotGroup field to all menu items');
    console.log('Kitchen items:', menuData.items.filter(item => item.kotGroup === 'kitchen').length);
    console.log('Drinks items:', menuData.items.filter(item => item.kotGroup === 'drinks').length);
    
} catch (error) {
    console.error('❌ Error updating menu:', error);
}
