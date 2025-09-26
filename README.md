🍽️ SwiftBill POS by NMD
Disclaimer: This is an AI-generated software created by a non-technical person. Expect some robotic/lame bits here and there, and the occasional harmless mistake.

SwiftBill POS is a completely offline Point of Sale system designed for restaurant operations. It runs locally, requires no internet connection, and is tailored for fast, smooth billing with minimal fuss. Built with Electron, it combines thermal printing, menu management, and real-time order handling in a clean, touch-friendly interface.

✨ Features
🏪 Dual Billing Modes
Table Service – Traditional dine-in billing for 14 tables

Counter Billing – Quick service for 6 counters with automatic ₹5 discount per item

🖨️ Professional Thermal Printing
Silent printing with automatic printer detection

KOT (Kitchen Order Ticket) – Sends only items & quantities to the kitchen

Customer Bills – Professional receipts with business details

Optimized for 80mm (8cm) thermal paper

🔍 Smart Search
Real-time menu search with keyboard shortcuts

Arrow key navigation (↑/↓) and Enter to select

Quick search keys: / or F3

Highlights matching results

📱 Clean Offline Interface
Touch-optimized design

Visual table/counter status

Real-time order tracking

Smooth menu management

🛠️ Tech Stack
Electron – Desktop app framework

Vanilla JavaScript – Lightweight & fast

CSS Grid & Flexbox – Responsive layouts

Local Storage – Fully offline data persistence

Node.js – File handling

📁 Project Structure
bash
Copy
Edit
├── main.js                 # Electron main process
├── renderer.js             # UI logic
├── index.html              # App layout
├── package.json            # Config & scripts
├── src/
│   ├── components/         # UI parts
│   ├── storage/            # menu.json, orders.json
│   └── utils/              # Helpers
├── styles/                 # CSS
└── .github/                # Copilot instructions
🚀 Quick Start
Requirements
Node.js v14+

npm or yarn

Installation
bash
Copy
Edit
git clone https://github.com/NinjaBeameR/SwiftBill-POS.git
cd swiftbill-pos-system
npm install
npm start
⌨️ Shortcuts
Key	Action
Escape	Back / Exit screen
F1 / F2	Print order (KOT + Bill)
F3	Focus search bar
/	Quick search
↑ / ↓	Navigate results
Enter	Select highlighted item

🖨️ Print Details
Works with USB, Network, Bluetooth thermal printers

203 DPI resolution for crisp printing

Silent printing with automatic detection

🔧 Development Notes
Modular, clean code style

Error handling in place

camelCase convention

Commented for maintainability (yes, sometimes even the comments sound AI-ish 😄)

📌 Future Ideas
User login

Sales reports

Inventory tracking

Multi-restaurant support

Cloud sync (optional)

Mobile app

📄 License
MIT License – see LICENSE file

Made with ❤️ + 🤖 by NMD — for restaurants that just want billing to work, offline and fast.