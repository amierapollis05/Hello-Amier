// Sales Management Module
class SalesManager {
    constructor() {
        this.currentSales = [];
        this.filteredSales = [];
        this.currentFilters = {
            search: '',
            seller: '',
            dateFrom: '',
            dateTo: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.loadSales();
    }

    setupEventListeners() {
        // Record sale button
        document.getElementById('record-sale-btn')?.addEventListener('click', () => {
            this.showRecordSaleModal();
        });

        // Record sale form
        document.getElementById('record-sale-form')?.addEventListener('submit', (e) => {
            this.handleRecordSale(e);
        });

        // Product ID input - auto-complete functionality
        document.getElementById('sale-product-id')?.addEventListener('input', (e) => {
            this.handleProductIdInput(e.target.value);
        });

        // Customer input - auto-complete functionality
        document.getElementById('sale-customer')?.addEventListener('input', (e) => {
            this.handleCustomerInput(e.target.value);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Search and filters
        document.getElementById('sales-search')?.addEventListener('input', 
            Utils.debounce((e) => this.handleSearch(e.target.value), 300)
        );

        document.getElementById('seller-filter')?.addEventListener('change', (e) => {
            this.handleSellerFilter(e.target.value);
        });

        document.getElementById('date-from-filter')?.addEventListener('change', (e) => {
            this.handleDateFromFilter(e.target.value);
        });

        document.getElementById('date-to-filter')?.addEventListener('change', (e) => {
            this.handleDateToFilter(e.target.value);
        });
    }

    setupRealtimeListener() {
        // Listen for real-time sales updates
        this.unsubscribe = dbManager.listen('sales', (sales) => {
            this.currentSales = sales;
            this.applyFilters();
            AppEvents.emit('salesUpdated', sales);
        });
    }

    async loadSales() {
        try {
            Utils.showLoading();
            this.currentSales = await dbManager.getAll('sales');
            this.applyFilters();
            Utils.hideLoading();
        } catch (error) {
            console.error('Error loading sales:', error);
            Utils.showToast('Error loading sales. Please refresh the page.', 'error');
            Utils.hideLoading();
        }
    }

    showRecordSaleModal() {
        const modal = document.getElementById('record-sale-modal');
        const form = document.getElementById('record-sale-form');
        
        // Reset form
        form.reset();
        
        // Clear any existing product details
        this.clearProductDetails();
        
        // Show modal
        modal.classList.add('show');
    }

    async handleRecordSale(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const saleData = {
            productId: formData.get('productId') || document.getElementById('sale-product-id').value,
            customerName: formData.get('customer') || document.getElementById('sale-customer').value,
            seller: formData.get('seller') || document.getElementById('sale-seller').value,
            salePrice: formData.get('salePrice') || document.getElementById('sale-price').value
        };

        // Validate required fields
        if (!saleData.productId || !saleData.customerName || !saleData.seller || !saleData.salePrice) {
            Utils.showToast('Please fill in all required fields.', 'error');
            return;
        }

        // Validate sale price
        if (parseFloat(saleData.salePrice) <= 0) {
            Utils.showToast('Sale price must be greater than 0.', 'error');
            return;
        }

        try {
            Utils.showLoading();
            
            // Get jacket details to validate and get purchase price
            const jacket = await this.getJacketByProductId(saleData.productId);
            if (!jacket) {
                Utils.showToast('Jacket not found. Please check the Product ID.', 'error');
                Utils.hideLoading();
                return;
            }

            if (jacket.status !== 'Available') {
                Utils.showToast(`This jacket is already ${jacket.status.toLowerCase()}.`, 'error');
                Utils.hideLoading();
                return;
            }

            // Get or create customer
            const customer = await this.getOrCreateCustomer(saleData.customerName);
            
            // Complete sale data
            const completeSaleData = {
                ...saleData,
                customerId: customer.id,
                purchasePrice: jacket.purchasePrice
            };

            const saleId = await dbManager.recordSale(completeSaleData);
            
            Utils.hideLoading();
            Utils.showToast('Sale recorded successfully!', 'success');
            
            // Close modal
            this.closeModal(document.getElementById('record-sale-modal'));
            
            // Show sale confirmation
            this.showSaleConfirmation(saleId, completeSaleData, jacket);
            
        } catch (error) {
            console.error('Error recording sale:', error);
            Utils.hideLoading();
            Utils.showToast('Error recording sale. Please try again.', 'error');
        }
    }

    async getJacketByProductId(productId) {
        try {
            const jackets = await dbManager.query('inventory', [
                { field: 'productId', operator: '==', value: productId }
            ]);
            return jackets.length > 0 ? jackets[0] : null;
        } catch (error) {
            console.error('Error getting jacket:', error);
            return null;
        }
    }

    async getOrCreateCustomer(customerName) {
        try {
            // Search for existing customer
            const customers = await dbManager.searchCustomers(customerName);
            const existingCustomer = customers.find(c => 
                c.name.toLowerCase() === customerName.toLowerCase()
            );
            
            if (existingCustomer) {
                return existingCustomer;
            }
            
            // Create new customer
            const customerId = await dbManager.addCustomer({ name: customerName });
            return await dbManager.read('customers', customerId);
        } catch (error) {
            console.error('Error getting/creating customer:', error);
            throw error;
        }
    }

    async handleProductIdInput(productId) {
        if (productId.length < 3) {
            this.clearProductDetails();
            return;
        }

        try {
            const jacket = await this.getJacketByProductId(productId);
            if (jacket) {
                this.showProductDetails(jacket);
            } else {
                this.clearProductDetails();
            }
        } catch (error) {
            console.error('Error searching product:', error);
        }
    }

    showProductDetails(jacket) {
        // Create or update product details display
        let detailsDiv = document.getElementById('product-details');
        if (!detailsDiv) {
            detailsDiv = document.createElement('div');
            detailsDiv.id = 'product-details';
            detailsDiv.className = 'product-details';
            document.getElementById('sale-product-id').parentNode.appendChild(detailsDiv);
        }

        detailsDiv.innerHTML = `
            <div class="product-info">
                <strong>${jacket.brand}</strong> - ${jacket.size} - ${jacket.color}
                <br>
                <small>Purchase: ${Utils.formatCurrency(jacket.purchasePrice)} | 
                Suggested: ${Utils.formatCurrency(jacket.sellingPrice)} | 
                Status: ${jacket.status}</small>
            </div>
        `;

        // Pre-fill suggested price
        document.getElementById('sale-price').value = jacket.sellingPrice;
    }

    clearProductDetails() {
        const detailsDiv = document.getElementById('product-details');
        if (detailsDiv) {
            detailsDiv.remove();
        }
        document.getElementById('sale-price').value = '';
    }

    async handleCustomerInput(customerName) {
        if (customerName.length < 2) return;

        try {
            const customers = await dbManager.searchCustomers(customerName);
            this.showCustomerSuggestions(customers.slice(0, 5)); // Show top 5 matches
        } catch (error) {
            console.error('Error searching customers:', error);
        }
    }

    showCustomerSuggestions(customers) {
        // Remove existing suggestions
        const existingSuggestions = document.getElementById('customer-suggestions');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }

        if (customers.length === 0) return;

        // Create suggestions dropdown
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'customer-suggestions';
        suggestionsDiv.className = 'customer-suggestions';
        
        suggestionsDiv.innerHTML = customers.map(customer => `
            <div class="suggestion-item" onclick="salesManager.selectCustomer('${customer.name}')">
                <strong>${Utils.escapeHtml(customer.name)}</strong>
                ${customer.phone ? `<br><small>${customer.phone}</small>` : ''}
                ${customer.totalPurchases > 0 ? `<br><small>${customer.totalPurchases} previous purchases</small>` : ''}
            </div>
        `).join('');

        document.getElementById('sale-customer').parentNode.appendChild(suggestionsDiv);
    }

    selectCustomer(customerName) {
        document.getElementById('sale-customer').value = customerName;
        const suggestions = document.getElementById('customer-suggestions');
        if (suggestions) {
            suggestions.remove();
        }
    }

    showSaleConfirmation(saleId, saleData, jacket) {
        const profit = Utils.calculateProfit(saleData.salePrice, saleData.purchasePrice);
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Sale Recorded Successfully!</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="sale-confirmation">
                        <div class="confirmation-item">
                            <strong>Sale ID:</strong> ${saleData.saleId || 'Generated'}
                        </div>
                        <div class="confirmation-item">
                            <strong>Product:</strong> ${jacket.brand} ${jacket.size} ${jacket.color}
                        </div>
                        <div class="confirmation-item">
                            <strong>Customer:</strong> ${saleData.customerName}
                        </div>
                        <div class="confirmation-item">
                            <strong>Seller:</strong> ${saleData.seller}
                        </div>
                        <div class="confirmation-item">
                            <strong>Sale Price:</strong> ${Utils.formatCurrency(saleData.salePrice)}
                        </div>
                        <div class="confirmation-item">
                            <strong>Profit:</strong> 
                            <span class="${profit >= 0 ? 'text-success' : 'text-danger'}">
                                ${Utils.formatCurrency(profit)}
                            </span>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-check"></i> Done
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal event
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
        // Clear any suggestions
        const suggestions = document.getElementById('customer-suggestions');
        if (suggestions) {
            suggestions.remove();
        }
        this.clearProductDetails();
    }

    handleSearch(searchTerm) {
        this.currentFilters.search = searchTerm.toLowerCase();
        this.applyFilters();
    }

    handleSellerFilter(seller) {
        this.currentFilters.seller = seller;
        this.applyFilters();
    }

    handleDateFromFilter(dateFrom) {
        this.currentFilters.dateFrom = dateFrom;
        this.applyFilters();
    }

    handleDateToFilter(dateTo) {
        this.currentFilters.dateTo = dateTo;
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.currentSales];

        // Apply search filter
        if (this.currentFilters.search) {
            filtered = filtered.filter(sale => 
                sale.saleId?.toLowerCase().includes(this.currentFilters.search) ||
                sale.productId.toLowerCase().includes(this.currentFilters.search) ||
                sale.customerName.toLowerCase().includes(this.currentFilters.search) ||
                sale.seller.toLowerCase().includes(this.currentFilters.search)
            );
        }

        // Apply seller filter
        if (this.currentFilters.seller) {
            filtered = filtered.filter(sale => sale.seller === this.currentFilters.seller);
        }

        // Apply date filters
        if (this.currentFilters.dateFrom) {
            const fromDate = new Date(this.currentFilters.dateFrom);
            filtered = filtered.filter(sale => {
                const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
                return saleDate >= fromDate;
            });
        }

        if (this.currentFilters.dateTo) {
            const toDate = new Date(this.currentFilters.dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            filtered = filtered.filter(sale => {
                const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
                return saleDate <= toDate;
            });
        }

        this.filteredSales = filtered;
        this.renderSalesTable();
    }

    renderSalesTable() {
        const tbody = document.getElementById('sales-tbody');
        if (!tbody) return;

        if (this.filteredSales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        ${this.currentSales.length === 0 ? 'No sales recorded yet.' : 'No sales match the current filters.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredSales.map(sale => {
            const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
            const profit = sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice);
            
            return `
                <tr>
                    <td><strong>${sale.saleId || 'N/A'}</strong></td>
                    <td>${sale.productId}</td>
                    <td>${Utils.escapeHtml(sale.customerName)}</td>
                    <td>${Utils.escapeHtml(sale.seller)}</td>
                    <td>${Utils.formatCurrency(sale.salePrice)}</td>
                    <td class="${profit >= 0 ? 'text-success' : 'text-danger'}">
                        ${Utils.formatCurrency(profit)}
                    </td>
                    <td>${Utils.formatDate(saleDate)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-view" onclick="salesManager.viewSaleDetails('${sale.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-edit" onclick="salesManager.editSale('${sale.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-delete" onclick="salesManager.deleteSale('${sale.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async viewSaleDetails(saleId) {
        try {
            const sale = await dbManager.read('sales', saleId);
            if (!sale) {
                Utils.showToast('Sale not found.', 'error');
                return;
            }

            // Get jacket and customer details
            const [jacket, customer] = await Promise.all([
                this.getJacketByProductId(sale.productId),
                dbManager.read('customers', sale.customerId)
            ]);

            this.showSaleDetailsModal(sale, jacket, customer);
        } catch (error) {
            console.error('Error loading sale details:', error);
            Utils.showToast('Error loading sale details.', 'error');
        }
    }

    showSaleDetailsModal(sale, jacket, customer) {
        const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
        const profit = sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice);
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Sale Details - ${sale.saleId}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="sale-details-grid">
                        <div class="detail-section">
                            <h4>Sale Information</h4>
                            <div class="detail-item">
                                <strong>Sale ID:</strong> ${sale.saleId}
                            </div>
                            <div class="detail-item">
                                <strong>Date:</strong> ${Utils.formatDate(saleDate)}
                            </div>
                            <div class="detail-item">
                                <strong>Seller:</strong> ${sale.seller}
                            </div>
                            <div class="detail-item">
                                <strong>Sale Price:</strong> ${Utils.formatCurrency(sale.salePrice)}
                            </div>
                            <div class="detail-item">
                                <strong>Purchase Price:</strong> ${Utils.formatCurrency(sale.purchasePrice)}
                            </div>
                            <div class="detail-item">
                                <strong>Profit:</strong> 
                                <span class="${profit >= 0 ? 'text-success' : 'text-danger'}">
                                    ${Utils.formatCurrency(profit)}
                                </span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Product Information</h4>
                            <div class="detail-item">
                                <strong>Product ID:</strong> ${sale.productId}
                            </div>
                            ${jacket ? `
                                <div class="detail-item">
                                    <strong>Brand:</strong> ${jacket.brand}
                                </div>
                                <div class="detail-item">
                                    <strong>Size:</strong> ${jacket.size}
                                </div>
                                <div class="detail-item">
                                    <strong>Color:</strong> ${jacket.color}
                                </div>
                            ` : '<div class="detail-item">Product details not available</div>'}
                        </div>
                        
                        <div class="detail-section">
                            <h4>Customer Information</h4>
                            <div class="detail-item">
                                <strong>Name:</strong> ${sale.customerName}
                            </div>
                            ${customer ? `
                                <div class="detail-item">
                                    <strong>Phone:</strong> ${customer.phone || 'Not provided'}
                                </div>
                                <div class="detail-item">
                                    <strong>Social Media:</strong> ${customer.socialMedia || 'Not provided'}
                                </div>
                                <div class="detail-item">
                                    <strong>Total Purchases:</strong> ${customer.totalPurchases}
                                </div>
                                <div class="detail-item">
                                    <strong>Total Spent:</strong> ${Utils.formatCurrency(customer.totalSpent)}
                                </div>
                            ` : '<div class="detail-item">Customer details not available</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal event
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async editSale(saleId) {
        Utils.showToast('Edit functionality coming soon!', 'info');
        // TODO: Implement edit sale functionality
    }

    async deleteSale(saleId) {
        if (confirm('Are you sure you want to delete this sale? This action cannot be undone and will affect inventory status.')) {
            try {
                Utils.showLoading();
                
                // Get sale details first
                const sale = await dbManager.read('sales', saleId);
                if (!sale) {
                    Utils.showToast('Sale not found.', 'error');
                    Utils.hideLoading();
                    return;
                }
                
                // Delete the sale
                await dbManager.delete('sales', saleId);
                
                // Update jacket status back to Available
                const jacket = await this.getJacketByProductId(sale.productId);
                if (jacket) {
                    await dbManager.updateJacketStatus(jacket.id, 'Available');
                }
                
                // Update customer purchase history (would need more complex logic)
                // For now, just show success message
                
                Utils.hideLoading();
                Utils.showToast('Sale deleted successfully!', 'success');
                
            } catch (error) {
                console.error('Error deleting sale:', error);
                Utils.hideLoading();
                Utils.showToast('Error deleting sale.', 'error');
            }
        }
    }

    // Get sales statistics
    getSalesStats() {
        const totalSales = this.currentSales.reduce((sum, sale) => sum + sale.salePrice, 0);
        const totalProfit = this.currentSales.reduce((sum, sale) => {
            const profit = sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice);
            return sum + profit;
        }, 0);
        
        return {
            count: this.currentSales.length,
            totalSales,
            totalProfit,
            averageSale: this.currentSales.length > 0 ? totalSales / this.currentSales.length : 0
        };
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

// Add CSS for suggestions and details
const salesStyles = `
    .customer-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
    }
    
    .suggestion-item {
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
    }
    
    .suggestion-item:hover {
        background: #f5f5f5;
    }
    
    .suggestion-item:last-child {
        border-bottom: none;
    }
    
    .product-details {
        margin-top: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
        border-left: 4px solid #667eea;
    }
    
    .product-info {
        font-size: 14px;
    }
    
    .sale-confirmation {
        display: grid;
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .confirmation-item {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
    }
    
    .sale-details-grid {
        display: grid;
        gap: 20px;
    }
    
    .detail-section {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
    }
    
    .detail-section h4 {
        margin-bottom: 15px;
        color: #667eea;
        border-bottom: 2px solid #e1e5e9;
        padding-bottom: 5px;
    }
    
    .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 5px 0;
    }
    
    .detail-item:last-child {
        margin-bottom: 0;
    }
    
    .text-success {
        color: #28a745;
    }
    
    .text-danger {
        color: #dc3545;
    }
`;

// Add styles to document
const salesStyleSheet = document.createElement('style');
salesStyleSheet.textContent = salesStyles;
document.head.appendChild(salesStyleSheet);

// Initialize sales manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.salesManager = new SalesManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.salesManager) {
        window.salesManager = new SalesManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.salesManager) {
        window.salesManager.destroy();
        window.salesManager = null;
    }
});