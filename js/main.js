// Main Application Controller
class App {
    constructor() {
        this.currentSection = 'dashboard';
        this.managers = {};
        this.charts = {};
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupGlobalEventListeners();
        this.initializeDashboard();
        
        // Listen for authentication events
        AppEvents.on('userAuthenticated', () => {
            this.onUserAuthenticated();
        });
        
        AppEvents.on('userSignedOut', () => {
            this.onUserSignedOut();
        });
    }

    setupNavigation() {
        // Navigation menu
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // Mobile menu toggle (for responsive design)
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        // Add mobile menu button to header if not exists
        const headerLeft = document.querySelector('.header-left');
        if (headerLeft && !document.getElementById('mobile-menu-btn')) {
            const menuBtn = document.createElement('button');
            menuBtn.id = 'mobile-menu-btn';
            menuBtn.className = 'btn btn-icon mobile-menu-btn';
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            menuBtn.style.display = 'none'; // Hidden by default, shown in mobile CSS
            
            menuBtn.addEventListener('click', () => {
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.toggle('show');
            });
            
            headerLeft.insertBefore(menuBtn, headerLeft.firstChild);
        }
    }

    setupGlobalEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Ctrl/Cmd + shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.navigateToSection('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        this.navigateToSection('inventory');
                        break;
                    case '3':
                        e.preventDefault();
                        this.navigateToSection('sales');
                        break;
                    case 'n':
                        e.preventDefault();
                        if (this.currentSection === 'inventory') {
                            document.getElementById('add-jacket-btn')?.click();
                        } else if (this.currentSection === 'sales') {
                            document.getElementById('record-sale-btn')?.click();
                        }
                        break;
                }
            }
        });

        // Click outside to close dropdowns/suggestions
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.customer-suggestions')) {
                const suggestions = document.getElementById('customer-suggestions');
                if (suggestions) {
                    suggestions.remove();
                }
            }
        });

        // Notifications panel
        document.getElementById('notifications-btn')?.addEventListener('click', () => {
            this.toggleNotificationPanel();
        });

        document.getElementById('close-notifications')?.addEventListener('click', () => {
            this.closeNotificationPanel();
        });

        // Dashboard refresh
        document.getElementById('refresh-dashboard')?.addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    navigateToSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Update current section
        this.currentSection = sectionName;
        AppState.currentSection = sectionName;

        // Section-specific initialization
        this.initializeSection(sectionName);

        // Close mobile menu if open
        const sidebar = document.querySelector('.sidebar');
        if (sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    }

    initializeSection(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                this.initializeDashboard();
                break;
            case 'analytics':
                this.initializeAnalytics();
                break;
            case 'qr-scanner':
                this.initializeQRScanner();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'customers':
                this.loadCustomers();
                break;
        }
    }

    async initializeDashboard() {
        try {
            // Load dashboard stats
            const stats = await dbManager.getDashboardStats();
            this.updateDashboardCards(stats);
            
            // Load recent activities
            const activities = await dbManager.getRecentActivities(5);
            this.updateRecentActivities(activities);
            
            // Initialize charts
            this.initializeDashboardCharts();
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            Utils.showToast('Error loading dashboard data.', 'error');
        }
    }

    updateDashboardCards(stats) {
        // Update dashboard cards
        const elements = {
            'total-inventory': stats.totalInventory,
            'total-sales': Utils.formatCurrency(stats.totalSales),
            'total-profit': Utils.formatCurrency(stats.totalProfit),
            'low-stock-count': stats.lowStockCount
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update notification count
        this.updateNotificationCount();
    }

    updateRecentActivities(activities) {
        const container = document.getElementById('recent-activities-list');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<p class="text-center">No recent activities.</p>';
            return;
        }

        container.innerHTML = activities.map(activity => {
            const timestamp = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-${this.getActivityIcon(activity.action)}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">
                            ${this.getActivityTitle(activity)}
                        </div>
                        <div class="activity-time">
                            ${Utils.getTimeAgo(timestamp)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getActivityIcon(action) {
        const icons = {
            'create': 'plus',
            'update': 'edit',
            'delete': 'trash'
        };
        return icons[action] || 'info';
    }

    getActivityTitle(activity) {
        const actionText = {
            'create': 'Added',
            'update': 'Updated',
            'delete': 'Deleted'
        };

        const collectionText = {
            'inventory': 'jacket',
            'sales': 'sale',
            'customers': 'customer',
            'events': 'event'
        };

        return `${actionText[activity.action] || activity.action} ${collectionText[activity.collection] || activity.collection}`;
    }

    async initializeDashboardCharts() {
        try {
            // Sales trend chart
            const salesData = await dbManager.getSalesAnalytics(30);
            this.createSalesChart(salesData);
            
            // Seller performance chart
            const sellerData = await dbManager.getSellerPerformance();
            this.createSellerChart(sellerData);
            
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }

    createSalesChart(salesData) {
        const ctx = document.getElementById('sales-chart');
        if (!ctx) return;

        // Prepare data for last 30 days
        const last30Days = [];
        const salesValues = [];
        const profitValues = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            last30Days.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));
            salesValues.push(salesData[dateStr]?.sales || 0);
            profitValues.push(salesData[dateStr]?.profit || 0);
        }

        if (this.charts.salesChart) {
            this.charts.salesChart.destroy();
        }

        this.charts.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last30Days,
                datasets: [{
                    label: 'Sales',
                    data: salesValues,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Profit',
                    data: profitValues,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R' + value;
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    createSellerChart(sellerData) {
        const ctx = document.getElementById('seller-chart');
        if (!ctx) return;

        const sellers = Object.keys(sellerData);
        const salesValues = sellers.map(seller => sellerData[seller].sales);
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c'];

        if (this.charts.sellerChart) {
            this.charts.sellerChart.destroy();
        }

        this.charts.sellerChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sellers,
                datasets: [{
                    data: salesValues,
                    backgroundColor: colors.slice(0, sellers.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    async initializeAnalytics() {
        try {
            // Load analytics data based on selected period
            const period = document.getElementById('analytics-period')?.value || 30;
            
            const [salesAnalytics, sellerPerformance, brandPerformance] = await Promise.all([
                dbManager.getSalesAnalytics(parseInt(period)),
                dbManager.getSellerPerformance(),
                dbManager.getBrandPerformance()
            ]);
            
            this.createAnalyticsCharts(salesAnalytics, sellerPerformance, brandPerformance);
            this.updateSellerLeaderboard(sellerPerformance);
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            Utils.showToast('Error loading analytics data.', 'error');
        }
    }

    createAnalyticsCharts(salesAnalytics, sellerPerformance, brandPerformance) {
        // Revenue vs Profit chart
        this.createRevenueVsProfitChart(salesAnalytics);
        
        // Brand performance chart
        this.createBrandPerformanceChart(brandPerformance);
        
        // Size distribution chart
        this.createSizeDistributionChart();
    }

    createRevenueVsProfitChart(salesData) {
        const ctx = document.getElementById('revenue-profit-chart');
        if (!ctx) return;

        const dates = Object.keys(salesData).sort();
        const revenue = dates.map(date => salesData[date].sales);
        const profit = dates.map(date => salesData[date].profit);

        if (this.charts.revenueProfitChart) {
            this.charts.revenueProfitChart.destroy();
        }

        this.charts.revenueProfitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString('en-GB')),
                datasets: [{
                    label: 'Revenue',
                    data: revenue,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: '#667eea',
                    borderWidth: 1
                }, {
                    label: 'Profit',
                    data: profit,
                    backgroundColor: 'rgba(40, 167, 69, 0.8)',
                    borderColor: '#28a745',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    createBrandPerformanceChart(brandData) {
        const ctx = document.getElementById('brand-performance-chart');
        if (!ctx) return;

        const brands = Object.keys(brandData);
        const sales = brands.map(brand => brandData[brand].sales);

        if (this.charts.brandChart) {
            this.charts.brandChart.destroy();
        }

        this.charts.brandChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: brands,
                datasets: [{
                    label: 'Sales',
                    data: sales,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    async createSizeDistributionChart() {
        const ctx = document.getElementById('size-distribution-chart');
        if (!ctx) return;

        try {
            const inventory = await dbManager.getAll('inventory');
            const sizeCounts = {};
            
            inventory.forEach(item => {
                sizeCounts[item.size] = (sizeCounts[item.size] || 0) + 1;
            });

            const sizes = Object.keys(sizeCounts);
            const counts = Object.values(sizeCounts);

            if (this.charts.sizeChart) {
                this.charts.sizeChart.destroy();
            }

            this.charts.sizeChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: sizes,
                    datasets: [{
                        data: counts,
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating size distribution chart:', error);
        }
    }

    updateSellerLeaderboard(sellerData) {
        const container = document.getElementById('seller-leaderboard');
        if (!container) return;

        const sellers = Object.entries(sellerData)
            .sort(([,a], [,b]) => b.sales - a.sales)
            .map(([seller, data], index) => ({
                rank: index + 1,
                name: seller,
                ...data
            }));

        container.innerHTML = sellers.map(seller => `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${seller.rank}</span>
                <span class="leaderboard-name">${seller.name}</span>
                <span class="leaderboard-value">${Utils.formatCurrency(seller.sales)}</span>
            </div>
        `).join('');
    }

    initializeQRScanner() {
        // QR Scanner will be handled by qr-scanner.js
        if (window.qrScanner) {
            window.qrScanner.initialize();
        }
    }

    async loadEvents() {
        try {
            const events = await dbManager.getUpcomingEvents();
            this.renderEvents(events);
        } catch (error) {
            console.error('Error loading events:', error);
            Utils.showToast('Error loading events.', 'error');
        }
    }

    renderEvents(events) {
        const container = document.getElementById('upcoming-events');
        if (!container) return;

        if (events.length === 0) {
            container.innerHTML = '<p class="text-center">No upcoming events.</p>';
            return;
        }

        container.innerHTML = events.map(event => {
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            return `
                <div class="event-card">
                    <div class="event-date">${Utils.formatDate(eventDate)}</div>
                    <div class="event-title">${Utils.escapeHtml(event.name)}</div>
                    <div class="event-details">
                        ${event.location ? `<div><i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(event.location)}</div>` : ''}
                        ${event.time ? `<div><i class="fas fa-clock"></i> ${event.time}</div>` : ''}
                        ${event.description ? `<div class="mt-2">${Utils.escapeHtml(event.description)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadCustomers() {
        try {
            const customers = await dbManager.getAll('customers');
            this.renderCustomers(customers);
        } catch (error) {
            console.error('Error loading customers:', error);
            Utils.showToast('Error loading customers.', 'error');
        }
    }

    renderCustomers(customers) {
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;

        if (customers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No customers found.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = customers.map(customer => {
            const lastPurchase = customer.lastPurchase ? 
                (customer.lastPurchase.toDate ? customer.lastPurchase.toDate() : new Date(customer.lastPurchase)) : 
                null;
            
            return `
                <tr>
                    <td>${customer.customerId}</td>
                    <td>${Utils.escapeHtml(customer.name)}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>${customer.socialMedia || 'N/A'}</td>
                    <td>${customer.totalPurchases}</td>
                    <td>${lastPurchase ? Utils.formatDate(lastPurchase) : 'Never'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-view" onclick="app.viewCustomerDetails('${customer.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-edit" onclick="app.editCustomer('${customer.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async viewCustomerDetails(customerId) {
        // TODO: Implement customer details modal
        Utils.showToast('Customer details coming soon!', 'info');
    }

    async editCustomer(customerId) {
        // TODO: Implement customer edit functionality
        Utils.showToast('Edit customer coming soon!', 'info');
    }

    async toggleNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;

        if (panel.classList.contains('show')) {
            this.closeNotificationPanel();
        } else {
            await this.loadNotifications();
            panel.classList.add('show');
        }
    }

    closeNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.remove('show');
        }
    }

    async loadNotifications() {
        try {
            const notifications = await dbManager.getUnreadNotifications();
            this.renderNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<p class="text-center">No new notifications.</p>';
            return;
        }

        container.innerHTML = notifications.map(notification => {
            const timestamp = notification.timestamp?.toDate ? notification.timestamp.toDate() : new Date(notification.timestamp);
            return `
                <div class="notification-item ${notification.read ? '' : 'unread'}" onclick="app.markNotificationAsRead('${notification.id}')">
                    <div class="notification-title">${Utils.escapeHtml(notification.title)}</div>
                    <div class="notification-message">${Utils.escapeHtml(notification.message)}</div>
                    <div class="notification-time">${Utils.getTimeAgo(timestamp)}</div>
                </div>
            `;
        }).join('');
    }

    async markNotificationAsRead(notificationId) {
        try {
            await dbManager.markNotificationAsRead(notificationId);
            this.updateNotificationCount();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async updateNotificationCount() {
        try {
            const notifications = await dbManager.getUnreadNotifications();
            const badge = document.getElementById('notification-count');
            if (badge) {
                badge.textContent = notifications.length;
                badge.style.display = notifications.length > 0 ? 'flex' : 'none';
            }
        } catch (error) {
            console.error('Error updating notification count:', error);
        }
    }

    async refreshDashboard() {
        const btn = document.getElementById('refresh-dashboard');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        }
        
        await this.initializeDashboard();
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
        
        Utils.showToast('Dashboard refreshed!', 'success');
    }

    closeAllModals() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    onUserAuthenticated() {
        // Initialize all managers and load data
        this.initializeDashboard();
        this.updateNotificationCount();
    }

    onUserSignedOut() {
        // Clean up charts and data
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};
        
        // Reset to dashboard
        this.navigateToSection('dashboard');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Add analytics period change listener
document.addEventListener('DOMContentLoaded', () => {
    const periodSelect = document.getElementById('analytics-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            if (window.app && window.app.currentSection === 'analytics') {
                window.app.initializeAnalytics();
            }
        });
    }
});