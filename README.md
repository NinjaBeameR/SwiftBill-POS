# 🍽️ SwiftBill POS by NMD

A professional Point of Sale system built with Electron for restaurant operations, featuring dual billing modes, thermal printing, and comprehensive menu management.

## ✨ Features

### 🏪 **Dual Billing Modes**
- **Table Service** (14 tables) - Traditional dine-in billing
- **Counter Billing** (6 counters) - Quick service with automatic ₹5 discount per item

### 🖨️ **Professional Printing**
- **Silent Printing** - Automatic thermal printer detection
- **KOT (Kitchen Order Ticket)** - Item names and quantities for kitchen
- **Customer Bills** - Professional receipts with business details
- **8cm Thermal Paper** optimized formatting

### 🔍 **Smart Search**
- Real-time menu item search with keyboard navigation
- Arrow key navigation (↑/↓) and Enter to select
- Quick search shortcuts (`/` key or `F3`)
- Highlighted search results

### 📱 **User Interface**
- Clean, responsive design optimized for touch screens
- Visual table/counter status indicators
- Real-time order management
- Professional service selector

## 🛠️ Technology Stack

- **Electron** - Desktop application framework
- **Vanilla JavaScript** - No external UI frameworks for optimal performance
- **CSS Grid & Flexbox** - Responsive layouts
- **Local Storage** - Order persistence
- **Node.js** - File system operations

## 📁 Project Structure

```
├── main.js                 # Electron main process
├── renderer.js             # UI logic and components
├── index.html              # Application layout
├── package.json            # Dependencies and scripts
├── src/
│   ├── components/         # UI components (future modularization)
│   ├── storage/           # Data files
│   │   ├── menu.json      # 193 menu items with categories
│   │   └── orders.json    # Order tracking
│   └── utils/             # Utility functions
├── styles/                # CSS stylesheets
│   ├── main.css          # Main layout styles
│   └── billing.css       # Billing screen styles
└── .github/
    └── copilot-instructions.md  # Development guidelines
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/udupi-pos-system.git
   cd udupi-pos-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

## 📋 Menu Categories

- **Rice** (23 items) - Biriyani, Fried Rice, Specialty Rice
- **Starters** (22 items) - Manchurian, Tikka, 65 varieties
- **Indian Curry** (27 items) - Dal, Vegetable curries
- **Roti** (10 items) - Naan, Kulcha, Parotta
- **Breakfast** (28 items) - South Indian breakfast items
- **Dosa Special** (25 items) - Various dosa preparations
- **Noodles** (13 items) - Different noodle varieties
- **Beverages** (23 items) - Tea, Coffee, Juices, Milkshakes
- **Soups** (4 items) - Hot soup varieties

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Navigate back/exit current screen |
| `F1` / `F2` | Print order (KOT + Bill) |
| `F3` | Focus search bar |
| `F4` | Test printer functionality |
| `/` | Quick search shortcut |
| `↑` / `↓` | Navigate search results |
| `Enter` | Select highlighted item |

## 🖨️ Print Configuration

### Supported Printers
- Thermal receipt printers (80mm width)
- USB, Network, and Bluetooth printers
- Epson TM series
- TVS printers
- Generic POS printers

### Print Settings
- **Silent printing** with automatic printer detection
- **203 DPI** resolution for thermal printers
- **Enhanced fonts** (16px base) for better readability
- **Professional formatting** with proper margins

## 💼 Business Information

The system is configured for:
- **Business Name**: Udupi Krishnam Veg
- **Location**: Electronic City, Bengaluru
- **Contact**: 9535089587
- **FSSAI**: 21224010001200
- **Brand**: A Unit of SALT AND PEPPER

## 🔧 Development

### Code Style Guidelines
- Modular class-based components
- Consistent error handling
- camelCase naming convention
- Comprehensive commenting

### Future Enhancements
- [ ] User authentication system
- [ ] Sales reporting and analytics
- [ ] Inventory management
- [ ] Multiple restaurant support
- [ ] Cloud synchronization
- [ ] Mobile app companion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Create an issue in this repository
- Email: [your-email@example.com]

## 🙏 Acknowledgments

- Built with Electron framework
- Designed for restaurant operations
- Optimized for thermal printing
- Powered by NMD

---

**Made with ❤️ for the restaurant industry**
