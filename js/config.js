// Firebase Configuration
const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "your-api-key-here",
    authDomain: "thriftplug-stb.firebaseapp.com",
    projectId: "thriftplug-stb",
    storageBucket: "thriftplug-stb.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id-here"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// App Constants
const APP_CONFIG = {
    LOW_STOCK_THRESHOLD: 10,
    AUTHORIZED_USERS: [
        'amier.apollis@thriftplugstb.com',
        'ian.jonker@thriftplugstb.com'
    ],
    SELLERS: [
        'Amier Apollis',
        'Ian Jonker'
    ],
    CURRENCY: 'R',
    DATE_FORMAT: 'DD/MM/YYYY',
    JACKET_SIZES: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    PRODUCT_ID_PREFIX: 'TP',
    DEFAULT_NOTIFICATION_TIMEOUT: 5000
};

// Utility Functions
const Utils = {
    // Generate unique product ID
    generateProductId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${APP_CONFIG.PRODUCT_ID_PREFIX}-${timestamp}-${random}`.toUpperCase();
    },

    // Generate unique sale ID
    generateSaleId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `SALE-${timestamp}-${random}`.toUpperCase();
    },

    // Generate unique customer ID
    generateCustomerId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `CUST-${timestamp}-${random}`.toUpperCase();
    },

    // Generate unique event ID
    generateEventId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `EVENT-${timestamp}-${random}`.toUpperCase();
    },

    // Format currency
    formatCurrency(amount) {
        return `${APP_CONFIG.CURRENCY}${parseFloat(amount).toFixed(2)}`;
    },

    // Format date
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-GB');
    },

    // Format date for input
    formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    // Calculate profit
    calculateProfit(salePrice, purchasePrice) {
        return parseFloat(salePrice) - parseFloat(purchasePrice);
    },

    // Validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Check if user is authorized
    isAuthorizedUser(email) {
        return APP_CONFIG.AUTHORIZED_USERS.includes(email);
    },

    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Hide toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, APP_CONFIG.DEFAULT_NOTIFICATION_TIMEOUT);
    },

    // Show loading spinner
    showLoading() {
        document.getElementById('loading-spinner').style.display = 'flex';
    },

    // Hide loading spinner
    hideLoading() {
        document.getElementById('loading-spinner').style.display = 'none';
    },

    // Escape HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Get time ago string
    getTimeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffInSeconds = Math.floor((now - past) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
        return `${Math.floor(diffInSeconds / 31536000)} years ago`;
    }
};

// Global State Management
const AppState = {
    currentUser: null,
    inventory: [],
    sales: [],
    customers: [],
    events: [],
    notifications: [],
    currentSection: 'dashboard',
    filters: {
        inventory: { search: '', brand: '', size: '', status: '' },
        sales: { search: '', seller: '', dateFrom: '', dateTo: '' },
        customers: { search: '' }
    }
};

// Event Emitter for app-wide communication
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }
}

// Global event emitter instance
const AppEvents = new EventEmitter();

// Initialize toast styles
const toastStyles = `
    .toast {
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        min-width: 300px;
    }
    
    .toast.show {
        transform: translateX(0);
    }
    
    .toast-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .toast-success {
        border-left: 4px solid #28a745;
    }
    
    .toast-error {
        border-left: 4px solid #dc3545;
    }
    
    .toast-info {
        border-left: 4px solid #17a2b8;
    }
    
    .toast-success .fas {
        color: #28a745;
    }
    
    .toast-error .fas {
        color: #dc3545;
    }
    
    .toast-info .fas {
        color: #17a2b8;
    }
`;

// Add toast styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);