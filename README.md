# ThriftPlug STB - Inventory Management System

A comprehensive web-based inventory management system designed specifically for ThriftPlug STB, a jacket resale business. This system provides real-time collaboration between co-founders with advanced features for tracking jackets, sales, customers, events, and analytics.

## 🚀 Features

### 🔐 User Authentication & Roles
- Secure Firebase Authentication for co-founders (Amier Apollis & Ian Jonker)
- Role-based access control (admin access for co-founders)
- Automatic user authorization validation

### 📦 Inventory Management
- Add jackets with auto-generated unique product IDs
- Track comprehensive jacket details:
  - Brand, Size, Color
  - Purchase price, Selling price
  - Date acquired, Current status (Available/Sold/Reserved)
- Advanced filtering and search capabilities
- Automatic low-stock alerts (configurable threshold)
- QR code generation for each jacket

### 💰 Sales Tracking
- Record sales with complete details:
  - Product ID, Customer name, Seller identification
  - Sale price, Automatic profit calculation
  - Date and time tracking
- Seller performance tracking (Amier vs Ian)
- Auto-complete for product IDs and customer names
- Automatic inventory status updates upon sale
- Customer purchase history integration

### 👥 Customer Database
- Store customer information:
  - Name, Phone number, Social media handles
  - Purchase history and statistics
  - Total purchases and spending analytics
- Customer search and filtering
- Detailed customer profiles with purchase history

### 📅 Events Module
- Calendar view for pop-up markets and sales events
- Event planning and tracking:
  - Date, Time, Location, Description
  - Event-specific sales performance
  - Revenue and profit tracking per event
- Upcoming events dashboard

### 📊 Analytics & Dashboard
- Real-time dashboard with key metrics:
  - Current stock levels
  - Total sales and profit
  - Low-stock warnings
  - Recent activities feed
- Advanced analytics:
  - Sales vs profit trends
  - Seller performance comparison
  - Brand performance analysis
  - Size distribution charts
  - Monthly/yearly reports

### 📱 QR Code Integration
- Auto-generate QR codes for each jacket
- Mobile-friendly QR scanner for quick sales
- Scan-to-sell functionality with instant processing
- Downloadable QR codes for physical labeling

### 📁 Import & Export
- CSV import for bulk jacket additions
- Data validation and error reporting
- Export capabilities:
  - Inventory data
  - Sales records
  - Customer information
- Drag-and-drop file upload interface

### 🔔 Real-time Notifications
- Live notifications for:
  - New inventory additions
  - Sales recordings
  - Low stock alerts
  - Upcoming events
- Notification history and management

## 🛠 Technology Stack

- **Frontend**: HTML5, CSS3 (Grid/Flexbox), Vanilla JavaScript (ES6+)
- **Backend**: Firebase Authentication, Firebase Firestore
- **Charts**: Chart.js for data visualization
- **QR Codes**: QRCode.js for generation, jsQR for scanning
- **CSV Processing**: PapaParse for import/export
- **Real-time**: Firebase real-time listeners
- **Responsive Design**: Mobile-first approach

## 📋 Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase project with Authentication and Firestore enabled
- Basic HTTP server for local development

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd thriftplug-stb-inventory
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication and Firestore Database
3. Get your Firebase configuration object
4. Update `js/config.js` with your Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### 4. Configure User Access

Update the authorized users in `js/config.js`:

```javascript
const APP_CONFIG = {
    AUTHORIZED_USERS: [
        'amier.apollis@thriftplugstb.com',
        'ian.jonker@thriftplugstb.com'
        // Add more authorized emails as needed
    ],
    SELLERS: [
        'Amier Apollis',
        'Ian Jonker'
        // Update seller names as needed
    ],
    // ... other config options
};
```

### 5. Firebase Security Rules

Set up Firestore security rules to protect your data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their data
    match /{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.token.email in [
          'amier.apollis@thriftplugstb.com',
          'ian.jonker@thriftplugstb.com'
        ];
    }
  }
}
```

### 6. Create User Accounts

Create user accounts in Firebase Authentication for:
- amier.apollis@thriftplugstb.com
- ian.jonker@thriftplugstb.com

### 7. Start Development Server

```bash
npm run dev
```

Or for production:

```bash
npm start
```

The application will be available at `http://localhost:8080`

## 📱 Usage Guide

### Getting Started
1. Open the application in your web browser
2. Sign in with your authorized email and password
3. You'll be redirected to the main dashboard

### Adding Inventory
1. Navigate to the Inventory section
2. Click "Add Jacket"
3. Fill in all required details
4. The system will auto-generate a product ID and QR code

### Recording Sales
1. Go to the Sales section
2. Click "Record Sale"
3. Enter the product ID (auto-complete will show jacket details)
4. Enter customer name (auto-complete will suggest existing customers)
5. Select seller and confirm sale price
6. The system will automatically update inventory status

### Using QR Scanner
1. Navigate to the QR Scanner section
2. Click "Start Scanner" and allow camera access
3. Point camera at a jacket's QR code
4. The system will automatically open a quick-sale dialog
5. Complete the sale details and confirm

### Managing Customers
1. Access the Customers section
2. Add new customers or view existing ones
3. Click on any customer to view detailed purchase history

### Event Planning
1. Go to the Events section
2. View the calendar and upcoming events
3. Add new events with details
4. Track sales performance per event

### Analytics & Reports
1. Visit the Analytics section
2. View various charts and metrics
3. Adjust time periods for different analyses
4. Export data for external reporting

### Import/Export Data
1. Navigate to Import/Export section
2. For imports: drag-and-drop or select CSV files
3. For exports: choose data type and download CSV files

## 🔧 Configuration Options

Edit `js/config.js` to customize:

- `LOW_STOCK_THRESHOLD`: Set minimum stock level for alerts (default: 10)
- `AUTHORIZED_USERS`: Add/remove authorized email addresses
- `SELLERS`: Update seller names
- `CURRENCY`: Change currency symbol (default: 'R' for Rand)
- `PRODUCT_ID_PREFIX`: Customize product ID prefix (default: 'TP')

## 📊 Data Structure

### Jackets (Inventory)
```javascript
{
  productId: "TP-ABC123-XYZ",
  brand: "Nike",
  size: "L",
  color: "Black",
  purchasePrice: 150.00,
  sellingPrice: 300.00,
  dateAcquired: Date,
  status: "Available", // Available, Sold, Reserved
  qrCode: "data:image/png;base64...",
  createdAt: Timestamp,
  createdBy: "user@email.com"
}
```

### Sales
```javascript
{
  saleId: "SALE-ABC123-XYZ",
  productId: "TP-ABC123-XYZ",
  customerId: "CUST-ABC123-XYZ",
  customerName: "John Doe",
  seller: "Amier Apollis",
  salePrice: 300.00,
  purchasePrice: 150.00,
  profit: 150.00,
  saleDate: Timestamp,
  eventId: "EVENT-ABC123-XYZ" // Optional
}
```

### Customers
```javascript
{
  customerId: "CUST-ABC123-XYZ",
  name: "John Doe",
  phone: "+27123456789",
  socialMedia: "@johndoe",
  totalPurchases: 5,
  totalSpent: 1500.00,
  lastPurchase: Timestamp,
  purchaseHistory: ["SALE-1", "SALE-2"]
}
```

## 🔒 Security Features

- Firebase Authentication for secure access
- Role-based authorization (only authorized users can access)
- Real-time security rules in Firestore
- Input validation and sanitization
- XSS protection through HTML escaping
- Activity logging for audit trails

## 📱 Mobile Responsiveness

The system is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- Different screen orientations

## 🆘 Troubleshooting

### Common Issues

**Login Issues:**
- Ensure your email is in the AUTHORIZED_USERS list
- Check Firebase Authentication is properly configured
- Verify internet connection

**Data Not Loading:**
- Check Firebase configuration in config.js
- Ensure Firestore security rules allow access
- Check browser console for errors

**QR Scanner Not Working:**
- Allow camera permissions in browser
- Ensure HTTPS connection (required for camera access)
- Try different browsers if issues persist

**Import/Export Issues:**
- Ensure CSV format matches expected structure
- Check file size limits (max 5MB)
- Verify all required fields are present

## 🤝 Support

For technical support or feature requests:
1. Check the troubleshooting section above
2. Review Firebase console for any configuration issues
3. Check browser developer console for error messages

## 📄 License

This project is licensed under the MIT License - see the package.json file for details.

## 🏗 Development

### Project Structure
```
thriftplug-stb-inventory/
├── index.html              # Main application HTML
├── package.json            # Dependencies and scripts
├── styles/
│   └── main.css            # Complete application styling
├── js/
│   ├── config.js           # Firebase config and app constants
│   ├── auth.js             # Authentication management
│   ├── database.js         # Database operations
│   ├── inventory.js        # Inventory management
│   ├── sales.js            # Sales tracking
│   ├── customers.js        # Customer management
│   ├── events.js           # Events management
│   ├── analytics.js        # Analytics and charts
│   ├── qr-scanner.js       # QR code scanning
│   ├── import-export.js    # CSV import/export
│   ├── notifications.js    # Notification system
│   └── main.js             # Main app controller
└── README.md               # This file
```

### Key Features Implementation
- **Modular Architecture**: Each feature is in its own JavaScript module
- **Real-time Updates**: Firebase listeners for live data synchronization
- **Event-Driven**: Global event system for inter-module communication
- **Responsive Design**: Mobile-first CSS with modern layouts
- **Progressive Enhancement**: Works without JavaScript for basic functionality

---

**Built with ❤️ for ThriftPlug STB by Amier Apollis & Ian Jonker**
