// Database Management Module
class DatabaseManager {
    constructor() {
        this.collections = {
            inventory: 'inventory',
            sales: 'sales',
            customers: 'customers',
            events: 'events',
            notifications: 'notifications',
            activities: 'activities'
        };
    }

    // Generic CRUD operations
    async create(collection, data) {
        try {
            const docRef = await db.collection(collection).add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: authManager.getCurrentUser()?.email || 'system'
            });
            
            // Log activity
            await this.logActivity('create', collection, docRef.id, data);
            
            return docRef.id;
        } catch (error) {
            console.error(`Error creating ${collection}:`, error);
            throw error;
        }
    }

    async read(collection, id) {
        try {
            const doc = await db.collection(collection).doc(id).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error(`Error reading ${collection}:`, error);
            throw error;
        }
    }

    async update(collection, id, data) {
        try {
            await db.collection(collection).doc(id).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: authManager.getCurrentUser()?.email || 'system'
            });
            
            // Log activity
            await this.logActivity('update', collection, id, data);
            
            return true;
        } catch (error) {
            console.error(`Error updating ${collection}:`, error);
            throw error;
        }
    }

    async delete(collection, id) {
        try {
            const doc = await this.read(collection, id);
            await db.collection(collection).doc(id).delete();
            
            // Log activity
            await this.logActivity('delete', collection, id, doc);
            
            return true;
        } catch (error) {
            console.error(`Error deleting ${collection}:`, error);
            throw error;
        }
    }

    async getAll(collection, orderBy = 'createdAt', direction = 'desc') {
        try {
            const snapshot = await db.collection(collection)
                .orderBy(orderBy, direction)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error getting all ${collection}:`, error);
            throw error;
        }
    }

    async query(collection, filters = [], orderBy = 'createdAt', direction = 'desc', limit = null) {
        try {
            let query = db.collection(collection);
            
            // Apply filters
            filters.forEach(filter => {
                query = query.where(filter.field, filter.operator, filter.value);
            });
            
            // Apply ordering
            query = query.orderBy(orderBy, direction);
            
            // Apply limit
            if (limit) {
                query = query.limit(limit);
            }
            
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error querying ${collection}:`, error);
            throw error;
        }
    }

    // Real-time listeners
    listen(collection, callback, filters = [], orderBy = 'createdAt', direction = 'desc') {
        try {
            let query = db.collection(collection);
            
            // Apply filters
            filters.forEach(filter => {
                query = query.where(filter.field, filter.operator, filter.value);
            });
            
            // Apply ordering
            query = query.orderBy(orderBy, direction);
            
            return query.onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(data);
            });
        } catch (error) {
            console.error(`Error setting up listener for ${collection}:`, error);
            throw error;
        }
    }

    // Inventory specific methods
    async addJacket(jacketData) {
        const jacket = {
            productId: Utils.generateProductId(),
            brand: jacketData.brand,
            size: jacketData.size,
            color: jacketData.color,
            purchasePrice: parseFloat(jacketData.purchasePrice),
            sellingPrice: parseFloat(jacketData.sellingPrice),
            dateAcquired: new Date(jacketData.dateAcquired),
            status: 'Available',
            qrCode: null // Will be generated after creation
        };

        const id = await this.create(this.collections.inventory, jacket);
        
        // Generate QR code
        await this.generateQRCode(id, jacket.productId);
        
        return id;
    }

    async updateJacketStatus(jacketId, status) {
        return await this.update(this.collections.inventory, jacketId, { status });
    }

    async getAvailableJackets() {
        return await this.query(this.collections.inventory, [
            { field: 'status', operator: '==', value: 'Available' }
        ]);
    }

    async getLowStockBrands() {
        const inventory = await this.getAll(this.collections.inventory);
        const availableInventory = inventory.filter(item => item.status === 'Available');
        
        const brandCounts = {};
        availableInventory.forEach(item => {
            brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
        });
        
        return Object.entries(brandCounts)
            .filter(([brand, count]) => count < APP_CONFIG.LOW_STOCK_THRESHOLD)
            .map(([brand, count]) => ({ brand, count }));
    }

    // Sales specific methods
    async recordSale(saleData) {
        const sale = {
            saleId: Utils.generateSaleId(),
            productId: saleData.productId,
            customerId: saleData.customerId,
            customerName: saleData.customerName,
            seller: saleData.seller,
            salePrice: parseFloat(saleData.salePrice),
            purchasePrice: parseFloat(saleData.purchasePrice),
            profit: Utils.calculateProfit(saleData.salePrice, saleData.purchasePrice),
            saleDate: new Date(),
            eventId: saleData.eventId || null
        };

        const saleId = await this.create(this.collections.sales, sale);
        
        // Update jacket status to sold
        const jacketQuery = await this.query(this.collections.inventory, [
            { field: 'productId', operator: '==', value: saleData.productId }
        ]);
        
        if (jacketQuery.length > 0) {
            await this.updateJacketStatus(jacketQuery[0].id, 'Sold');
        }
        
        // Update customer purchase history
        if (saleData.customerId) {
            await this.updateCustomerPurchaseHistory(saleData.customerId, saleId);
        }
        
        return saleId;
    }

    async getSalesByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include entire end date
        
        return await this.query(this.collections.sales, [
            { field: 'saleDate', operator: '>=', value: start },
            { field: 'saleDate', operator: '<=', value: end }
        ]);
    }

    async getSalesBySeller(seller) {
        return await this.query(this.collections.sales, [
            { field: 'seller', operator: '==', value: seller }
        ]);
    }

    // Customer specific methods
    async addCustomer(customerData) {
        const customer = {
            customerId: Utils.generateCustomerId(),
            name: customerData.name,
            phone: customerData.phone || '',
            socialMedia: customerData.socialMedia || '',
            totalPurchases: 0,
            totalSpent: 0,
            lastPurchase: null,
            purchaseHistory: []
        };

        return await this.create(this.collections.customers, customer);
    }

    async updateCustomerPurchaseHistory(customerId, saleId) {
        const customer = await this.read(this.collections.customers, customerId);
        const sale = await this.read(this.collections.sales, saleId);
        
        if (customer && sale) {
            await this.update(this.collections.customers, customerId, {
                totalPurchases: customer.totalPurchases + 1,
                totalSpent: customer.totalSpent + sale.salePrice,
                lastPurchase: sale.saleDate,
                purchaseHistory: firebase.firestore.FieldValue.arrayUnion(saleId)
            });
        }
    }

    async searchCustomers(searchTerm) {
        // Firestore doesn't support full-text search, so we'll get all customers
        // and filter client-side for now
        const customers = await this.getAll(this.collections.customers);
        const term = searchTerm.toLowerCase();
        
        return customers.filter(customer => 
            customer.name.toLowerCase().includes(term) ||
            customer.phone.includes(term) ||
            customer.socialMedia.toLowerCase().includes(term)
        );
    }

    // Events specific methods
    async addEvent(eventData) {
        const event = {
            eventId: Utils.generateEventId(),
            name: eventData.name,
            date: new Date(eventData.date),
            time: eventData.time || '',
            location: eventData.location || '',
            description: eventData.description || '',
            salesCount: 0,
            totalRevenue: 0,
            status: 'Upcoming'
        };

        return await this.create(this.collections.events, event);
    }

    async getUpcomingEvents() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return await this.query(this.collections.events, [
            { field: 'date', operator: '>=', value: today }
        ], 'date', 'asc');
    }

    async updateEventStats(eventId) {
        const sales = await this.query(this.collections.sales, [
            { field: 'eventId', operator: '==', value: eventId }
        ]);
        
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
        
        await this.update(this.collections.events, eventId, {
            salesCount: sales.length,
            totalRevenue: totalRevenue
        });
    }

    // Analytics methods
    async getDashboardStats() {
        const [inventory, sales, customers] = await Promise.all([
            this.getAll(this.collections.inventory),
            this.getAll(this.collections.sales),
            this.getAll(this.collections.customers)
        ]);

        const availableInventory = inventory.filter(item => item.status === 'Available');
        const totalSales = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
        const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
        const lowStockBrands = await this.getLowStockBrands();

        return {
            totalInventory: availableInventory.length,
            totalSales: totalSales,
            totalProfit: totalProfit,
            lowStockCount: lowStockBrands.length,
            totalCustomers: customers.length,
            totalSalesCount: sales.length
        };
    }

    async getSalesAnalytics(days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const sales = await this.getSalesByDateRange(startDate, endDate);
        
        // Group by date
        const salesByDate = {};
        sales.forEach(sale => {
            const date = sale.saleDate.toDate().toISOString().split('T')[0];
            if (!salesByDate[date]) {
                salesByDate[date] = { sales: 0, profit: 0, count: 0 };
            }
            salesByDate[date].sales += sale.salePrice;
            salesByDate[date].profit += sale.profit;
            salesByDate[date].count += 1;
        });
        
        return salesByDate;
    }

    async getSellerPerformance() {
        const sales = await this.getAll(this.collections.sales);
        
        const sellerStats = {};
        sales.forEach(sale => {
            if (!sellerStats[sale.seller]) {
                sellerStats[sale.seller] = { sales: 0, profit: 0, count: 0 };
            }
            sellerStats[sale.seller].sales += sale.salePrice;
            sellerStats[sale.seller].profit += sale.profit;
            sellerStats[sale.seller].count += 1;
        });
        
        return sellerStats;
    }

    async getBrandPerformance() {
        const [inventory, sales] = await Promise.all([
            this.getAll(this.collections.inventory),
            this.getAll(this.collections.sales)
        ]);
        
        const brandStats = {};
        
        // Get brand sales data
        sales.forEach(sale => {
            const jacket = inventory.find(item => item.productId === sale.productId);
            if (jacket) {
                if (!brandStats[jacket.brand]) {
                    brandStats[jacket.brand] = { sales: 0, profit: 0, count: 0, available: 0 };
                }
                brandStats[jacket.brand].sales += sale.salePrice;
                brandStats[jacket.brand].profit += sale.profit;
                brandStats[jacket.brand].count += 1;
            }
        });
        
        // Get available inventory by brand
        inventory.filter(item => item.status === 'Available').forEach(item => {
            if (!brandStats[item.brand]) {
                brandStats[item.brand] = { sales: 0, profit: 0, count: 0, available: 0 };
            }
            brandStats[item.brand].available += 1;
        });
        
        return brandStats;
    }

    // Activity logging
    async logActivity(action, collection, documentId, data) {
        try {
            const activity = {
                action,
                collection,
                documentId,
                data: JSON.stringify(data),
                user: authManager.getCurrentUser()?.email || 'system',
                timestamp: new Date()
            };
            
            await this.create(this.collections.activities, activity);
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    async getRecentActivities(limit = 10) {
        return await this.query(this.collections.activities, [], 'timestamp', 'desc', limit);
    }

    // QR Code generation
    async generateQRCode(jacketId, productId) {
        try {
            const qrCodeDataURL = await QRCode.toDataURL(productId, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            await this.update(this.collections.inventory, jacketId, {
                qrCode: qrCodeDataURL
            });
            
            return qrCodeDataURL;
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    }

    // Notification management
    async createNotification(title, message, type = 'info', userId = null) {
        const notification = {
            title,
            message,
            type,
            userId,
            read: false,
            timestamp: new Date()
        };
        
        return await this.create(this.collections.notifications, notification);
    }

    async getUnreadNotifications(userId = null) {
        const filters = [{ field: 'read', operator: '==', value: false }];
        if (userId) {
            filters.push({ field: 'userId', operator: '==', value: userId });
        }
        
        return await this.query(this.collections.notifications, filters, 'timestamp', 'desc');
    }

    async markNotificationAsRead(notificationId) {
        return await this.update(this.collections.notifications, notificationId, { read: true });
    }
}

// Initialize database manager
const dbManager = new DatabaseManager();

// Export for use in other modules
window.dbManager = dbManager;