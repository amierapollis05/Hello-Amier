// Notifications Module
class NotificationManager {
    constructor() {
        this.currentNotifications = [];
        this.unreadCount = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.loadNotifications();
        this.startPeriodicChecks();
    }

    setupEventListeners() {
        // Notifications button
        document.getElementById('notifications-btn')?.addEventListener('click', () => {
            this.toggleNotificationPanel();
        });

        // Close notifications panel
        document.getElementById('close-notifications')?.addEventListener('click', () => {
            this.closeNotificationPanel();
        });

        // Click outside to close panel
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notification-panel');
            const btn = document.getElementById('notifications-btn');
            
            if (panel && panel.classList.contains('show') && 
                !panel.contains(e.target) && !btn.contains(e.target)) {
                this.closeNotificationPanel();
            }
        });
    }

    setupRealtimeListener() {
        // Listen for real-time notification updates
        this.unsubscribe = dbManager.listen('notifications', (notifications) => {
            this.currentNotifications = notifications;
            this.updateUnreadCount();
            this.renderNotifications();
            AppEvents.emit('notificationsUpdated', notifications);
        });
    }

    async loadNotifications() {
        try {
            this.currentNotifications = await dbManager.getAll('notifications');
            this.updateUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    startPeriodicChecks() {
        // Check for low stock every 30 minutes
        setInterval(() => {
            this.checkLowStock();
        }, 30 * 60 * 1000);

        // Initial check after 10 seconds
        setTimeout(() => {
            this.checkLowStock();
        }, 10000);
    }

    async checkLowStock() {
        try {
            const lowStockBrands = await dbManager.getLowStockBrands();
            
            if (lowStockBrands.length > 0) {
                // Check if we already have a recent low stock notification
                const recentNotifications = await dbManager.query('notifications', [
                    { field: 'type', operator: '==', value: 'low-stock' },
                    { field: 'createdAt', operator: '>', value: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                ]);

                if (recentNotifications.length === 0) {
                    const message = `Low stock alert: ${lowStockBrands.map(b => `${b.brand} (${b.count} left)`).join(', ')}`;
                    await this.createNotification('Low Stock Alert', message, 'low-stock');
                }
            }
        } catch (error) {
            console.error('Error checking low stock:', error);
        }
    }

    async createNotification(title, message, type = 'info', userId = null) {
        try {
            await dbManager.createNotification(title, message, type, userId);
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    }

    async toggleNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;

        if (panel.classList.contains('show')) {
            this.closeNotificationPanel();
        } else {
            panel.classList.add('show');
            // Mark all notifications as read when panel is opened
            await this.markAllAsRead();
        }
    }

    closeNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.remove('show');
        }
    }

    updateUnreadCount() {
        const unreadNotifications = this.currentNotifications.filter(n => !n.read);
        this.unreadCount = unreadNotifications.length;
        
        const badge = document.getElementById('notification-count');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    }

    renderNotifications() {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (this.currentNotifications.length === 0) {
            container.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        // Sort notifications by date (newest first)
        const sortedNotifications = [...this.currentNotifications].sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return dateB - dateA;
        });

        container.innerHTML = sortedNotifications.map(notification => {
            const timestamp = notification.timestamp?.toDate ? notification.timestamp.toDate() : new Date(notification.timestamp);
            const timeAgo = Utils.getTimeAgo(timestamp);
            
            return `
                <div class="notification-item ${notification.read ? '' : 'unread'}" 
                     onclick="notificationManager.markAsRead('${notification.id}')">
                    <div class="notification-icon">
                        <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${Utils.escapeHtml(notification.title)}</div>
                        <div class="notification-message">${Utils.escapeHtml(notification.message)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    ${!notification.read ? '<div class="unread-indicator"></div>' : ''}
                </div>
            `;
        }).join('');
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'times-circle',
            'low-stock': 'exclamation-triangle',
            'sale': 'shopping-cart',
            'inventory': 'boxes',
            'customer': 'user',
            'event': 'calendar'
        };
        return icons[type] || 'bell';
    }

    async markAsRead(notificationId) {
        try {
            await dbManager.markNotificationAsRead(notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const unreadNotifications = this.currentNotifications.filter(n => !n.read);
            
            for (const notification of unreadNotifications) {
                await dbManager.markNotificationAsRead(notification.id);
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    async clearAllNotifications() {
        if (confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
            try {
                for (const notification of this.currentNotifications) {
                    await dbManager.delete('notifications', notification.id);
                }
                Utils.showToast('All notifications cleared!', 'success');
            } catch (error) {
                console.error('Error clearing notifications:', error);
                Utils.showToast('Error clearing notifications.', 'error');
            }
        }
    }

    // System event handlers
    async onInventoryAdded(jacketData) {
        await this.createNotification(
            'New Jacket Added',
            `Added ${jacketData.brand} ${jacketData.size} ${jacketData.color} to inventory`,
            'inventory'
        );
    }

    async onSaleRecorded(saleData) {
        const profit = Utils.calculateProfit(saleData.salePrice, saleData.purchasePrice);
        await this.createNotification(
            'Sale Recorded',
            `${saleData.seller} sold ${saleData.productId} for ${Utils.formatCurrency(saleData.salePrice)} (Profit: ${Utils.formatCurrency(profit)})`,
            'sale'
        );
    }

    async onCustomerAdded(customerData) {
        await this.createNotification(
            'New Customer Added',
            `Added customer: ${customerData.name}`,
            'customer'
        );
    }

    async onEventAdded(eventData) {
        const eventDate = new Date(eventData.date);
        await this.createNotification(
            'New Event Scheduled',
            `${eventData.name} scheduled for ${Utils.formatDate(eventDate)}`,
            'event'
        );
    }

    async onEventUpcoming(eventData) {
        const eventDate = new Date(eventData.date);
        const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 3 && daysUntil > 0) {
            await this.createNotification(
                'Upcoming Event',
                `${eventData.name} is in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
                'event'
            );
        }
    }

    // Get notification statistics
    getNotificationStats() {
        const total = this.currentNotifications.length;
        const unread = this.currentNotifications.filter(n => !n.read).length;
        const byType = {};
        
        this.currentNotifications.forEach(notification => {
            byType[notification.type] = (byType[notification.type] || 0) + 1;
        });
        
        return {
            total,
            unread,
            read: total - unread,
            byType
        };
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

// Add Notifications specific styles
const notificationStyles = `
    .no-notifications {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .no-notifications i {
        font-size: 48px;
        margin-bottom: 15px;
        color: #ccc;
    }
    
    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 15px;
        border-bottom: 1px solid #e1e5e9;
        cursor: pointer;
        transition: background-color 0.2s ease;
        position: relative;
    }
    
    .notification-item:hover {
        background: #f8f9fa;
    }
    
    .notification-item:last-child {
        border-bottom: none;
    }
    
    .notification-item.unread {
        background: #fff;
        border-left: 4px solid #667eea;
    }
    
    .notification-icon {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 2px;
    }
    
    .notification-item .notification-icon {
        background: #e3f2fd;
        color: #1976d2;
    }
    
    .notification-item[onclick*="low-stock"] .notification-icon,
    .notification-item[onclick*="warning"] .notification-icon {
        background: #fff3cd;
        color: #856404;
    }
    
    .notification-item[onclick*="sale"] .notification-icon {
        background: #d4edda;
        color: #155724;
    }
    
    .notification-item[onclick*="error"] .notification-icon {
        background: #f8d7da;
        color: #721c24;
    }
    
    .notification-content {
        flex: 1;
        min-width: 0;
    }
    
    .notification-title {
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
        font-size: 14px;
    }
    
    .notification-message {
        color: #666;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 6px;
        word-wrap: break-word;
    }
    
    .notification-time {
        color: #999;
        font-size: 11px;
    }
    
    .unread-indicator {
        position: absolute;
        top: 50%;
        right: 15px;
        transform: translateY(-50%);
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
    }
    
    .notification-actions {
        display: flex;
        justify-content: center;
        padding: 15px;
        border-top: 1px solid #e1e5e9;
        background: #f8f9fa;
    }
    
    .notification-actions button {
        font-size: 12px;
        padding: 6px 12px;
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
        .notification-panel {
            width: 100%;
            right: -100%;
        }
        
        .notification-panel.show {
            right: 0;
        }
        
        .notification-item {
            padding: 12px;
        }
        
        .notification-icon {
            width: 30px;
            height: 30px;
            font-size: 14px;
        }
        
        .notification-title {
            font-size: 13px;
        }
        
        .notification-message {
            font-size: 12px;
        }
    }
`;

// Add styles to document
const notificationStyleSheet = document.createElement('style');
notificationStyleSheet.textContent = notificationStyles;
document.head.appendChild(notificationStyleSheet);

// Initialize notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.notificationManager) {
        window.notificationManager = new NotificationManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.notificationManager) {
        window.notificationManager.destroy();
        window.notificationManager = null;
    }
});

// Listen for app events to create notifications
AppEvents.on('jacketAdded', (jacketData) => {
    if (window.notificationManager) {
        window.notificationManager.onInventoryAdded(jacketData);
    }
});

AppEvents.on('saleRecorded', (saleData) => {
    if (window.notificationManager) {
        window.notificationManager.onSaleRecorded(saleData);
    }
});

AppEvents.on('customerAdded', (customerData) => {
    if (window.notificationManager) {
        window.notificationManager.onCustomerAdded(customerData);
    }
});

AppEvents.on('eventAdded', (eventData) => {
    if (window.notificationManager) {
        window.notificationManager.onEventAdded(eventData);
    }
});