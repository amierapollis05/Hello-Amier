// Customer Management Module
class CustomerManager {
    constructor() {
        this.currentCustomers = [];
        this.filteredCustomers = [];
        this.currentFilters = {
            search: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.loadCustomers();
    }

    setupEventListeners() {
        // Add customer button
        document.getElementById('add-customer-btn')?.addEventListener('click', () => {
            this.showAddCustomerModal();
        });

        // Add customer form
        document.getElementById('add-customer-form')?.addEventListener('submit', (e) => {
            this.handleAddCustomer(e);
        });

        // Search
        document.getElementById('customers-search')?.addEventListener('input', 
            Utils.debounce((e) => this.handleSearch(e.target.value), 300)
        );

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });
    }

    setupRealtimeListener() {
        // Listen for real-time customer updates
        this.unsubscribe = dbManager.listen('customers', (customers) => {
            this.currentCustomers = customers;
            this.applyFilters();
            AppEvents.emit('customersUpdated', customers);
        });
    }

    async loadCustomers() {
        try {
            Utils.showLoading();
            this.currentCustomers = await dbManager.getAll('customers');
            this.applyFilters();
            Utils.hideLoading();
        } catch (error) {
            console.error('Error loading customers:', error);
            Utils.showToast('Error loading customers. Please refresh the page.', 'error');
            Utils.hideLoading();
        }
    }

    showAddCustomerModal() {
        const modal = document.getElementById('add-customer-modal');
        const form = document.getElementById('add-customer-form');
        
        // Reset form
        form.reset();
        
        // Show modal
        modal.classList.add('show');
        
        // Focus on name input
        setTimeout(() => {
            document.getElementById('customer-name').focus();
        }, 100);
    }

    async handleAddCustomer(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const customerData = {
            name: formData.get('name') || document.getElementById('customer-name').value,
            phone: formData.get('phone') || document.getElementById('customer-phone').value,
            socialMedia: formData.get('socialMedia') || document.getElementById('customer-social').value
        };

        // Validate required fields
        if (!customerData.name || customerData.name.trim() === '') {
            Utils.showToast('Please enter customer name.', 'error');
            return;
        }

        // Clean up data
        customerData.name = customerData.name.trim();
        customerData.phone = customerData.phone?.trim() || '';
        customerData.socialMedia = customerData.socialMedia?.trim() || '';

        try {
            Utils.showLoading();
            
            // Check for duplicate customer
            const existingCustomers = await dbManager.searchCustomers(customerData.name);
            const duplicate = existingCustomers.find(c => 
                c.name.toLowerCase() === customerData.name.toLowerCase()
            );
            
            if (duplicate) {
                Utils.hideLoading();
                Utils.showToast('A customer with this name already exists.', 'error');
                return;
            }

            const customerId = await dbManager.addCustomer(customerData);
            
            Utils.hideLoading();
            Utils.showToast('Customer added successfully!', 'success');
            
            // Close modal
            this.closeModal(document.getElementById('add-customer-modal'));
            
        } catch (error) {
            console.error('Error adding customer:', error);
            Utils.hideLoading();
            Utils.showToast('Error adding customer. Please try again.', 'error');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
    }

    handleSearch(searchTerm) {
        this.currentFilters.search = searchTerm.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.currentCustomers];

        // Apply search filter
        if (this.currentFilters.search) {
            filtered = filtered.filter(customer => 
                customer.name.toLowerCase().includes(this.currentFilters.search) ||
                customer.phone.includes(this.currentFilters.search) ||
                customer.socialMedia.toLowerCase().includes(this.currentFilters.search) ||
                customer.customerId.toLowerCase().includes(this.currentFilters.search)
            );
        }

        this.filteredCustomers = filtered;
        this.renderCustomersTable();
    }

    renderCustomersTable() {
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;

        if (this.filteredCustomers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        ${this.currentCustomers.length === 0 ? 'No customers found.' : 'No customers match the current search.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredCustomers.map(customer => {
            const lastPurchase = customer.lastPurchase ? 
                (customer.lastPurchase.toDate ? customer.lastPurchase.toDate() : new Date(customer.lastPurchase)) : 
                null;
            
            return `
                <tr>
                    <td><strong>${customer.customerId}</strong></td>
                    <td>${Utils.escapeHtml(customer.name)}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>${customer.socialMedia || 'N/A'}</td>
                    <td>
                        <span class="badge badge-info">${customer.totalPurchases}</span>
                        ${customer.totalSpent > 0 ? `<br><small>${Utils.formatCurrency(customer.totalSpent)}</small>` : ''}
                    </td>
                    <td>${lastPurchase ? Utils.formatDate(lastPurchase) : 'Never'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-view" onclick="customerManager.viewCustomerDetails('${customer.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-edit" onclick="customerManager.editCustomer('${customer.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-delete" onclick="customerManager.deleteCustomer('${customer.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async viewCustomerDetails(customerId) {
        try {
            const customer = await dbManager.read('customers', customerId);
            if (!customer) {
                Utils.showToast('Customer not found.', 'error');
                return;
            }

            // Get customer's purchase history
            const purchases = await this.getCustomerPurchases(customerId);
            
            this.showCustomerDetailsModal(customer, purchases);
        } catch (error) {
            console.error('Error loading customer details:', error);
            Utils.showToast('Error loading customer details.', 'error');
        }
    }

    async getCustomerPurchases(customerId) {
        try {
            const sales = await dbManager.query('sales', [
                { field: 'customerId', operator: '==', value: customerId }
            ], 'saleDate', 'desc');
            return sales;
        } catch (error) {
            console.error('Error getting customer purchases:', error);
            return [];
        }
    }

    showCustomerDetailsModal(customer, purchases) {
        const lastPurchase = customer.lastPurchase ? 
            (customer.lastPurchase.toDate ? customer.lastPurchase.toDate() : new Date(customer.lastPurchase)) : 
            null;
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Customer Details - ${Utils.escapeHtml(customer.name)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="customer-details-grid">
                        <div class="detail-section">
                            <h4>Customer Information</h4>
                            <div class="detail-item">
                                <strong>Customer ID:</strong> ${customer.customerId}
                            </div>
                            <div class="detail-item">
                                <strong>Name:</strong> ${Utils.escapeHtml(customer.name)}
                            </div>
                            <div class="detail-item">
                                <strong>Phone:</strong> ${customer.phone || 'Not provided'}
                            </div>
                            <div class="detail-item">
                                <strong>Social Media:</strong> ${customer.socialMedia || 'Not provided'}
                            </div>
                            <div class="detail-item">
                                <strong>Member Since:</strong> ${Utils.formatDate(customer.createdAt?.toDate ? customer.createdAt.toDate() : customer.createdAt)}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Purchase Summary</h4>
                            <div class="detail-item">
                                <strong>Total Purchases:</strong> ${customer.totalPurchases}
                            </div>
                            <div class="detail-item">
                                <strong>Total Spent:</strong> ${Utils.formatCurrency(customer.totalSpent)}
                            </div>
                            <div class="detail-item">
                                <strong>Average Purchase:</strong> ${customer.totalPurchases > 0 ? Utils.formatCurrency(customer.totalSpent / customer.totalPurchases) : 'N/A'}
                            </div>
                            <div class="detail-item">
                                <strong>Last Purchase:</strong> ${lastPurchase ? Utils.formatDate(lastPurchase) : 'Never'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="purchase-history">
                        <h4>Purchase History</h4>
                        ${purchases.length > 0 ? `
                            <div class="purchase-list">
                                ${purchases.slice(0, 10).map(purchase => {
                                    const purchaseDate = purchase.saleDate?.toDate ? purchase.saleDate.toDate() : new Date(purchase.saleDate);
                                    return `
                                        <div class="purchase-item">
                                            <div class="purchase-info">
                                                <strong>${purchase.productId}</strong>
                                                <span class="purchase-date">${Utils.formatDate(purchaseDate)}</span>
                                            </div>
                                            <div class="purchase-details">
                                                <span>Seller: ${purchase.seller}</span>
                                                <span class="purchase-price">${Utils.formatCurrency(purchase.salePrice)}</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                                ${purchases.length > 10 ? `<div class="purchase-item more-items">... and ${purchases.length - 10} more purchases</div>` : ''}
                            </div>
                        ` : '<p class="text-center">No purchases yet.</p>'}
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async editCustomer(customerId) {
        try {
            const customer = await dbManager.read('customers', customerId);
            if (!customer) {
                Utils.showToast('Customer not found.', 'error');
                return;
            }

            this.showEditCustomerModal(customer);
        } catch (error) {
            console.error('Error loading customer for edit:', error);
            Utils.showToast('Error loading customer details.', 'error');
        }
    }

    showEditCustomerModal(customer) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Edit Customer</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <form id="edit-customer-form">
                        <div class="form-group">
                            <label for="edit-customer-name">Name *</label>
                            <input type="text" id="edit-customer-name" value="${Utils.escapeHtml(customer.name)}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-customer-phone">Phone Number</label>
                            <input type="tel" id="edit-customer-phone" value="${customer.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit-customer-social">Social Media Handle</label>
                            <input type="text" id="edit-customer-social" value="${customer.socialMedia || ''}" placeholder="@username">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                            <button type="submit" class="btn btn-primary">Update Customer</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on name input
        setTimeout(() => {
            document.getElementById('edit-customer-name').focus();
        }, 100);
        
        // Handle form submission
        const form = modal.querySelector('#edit-customer-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditCustomer(customer.id, modal);
        });
        
        // Handle modal close
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async handleEditCustomer(customerId, modal) {
        try {
            const customerData = {
                name: document.getElementById('edit-customer-name').value.trim(),
                phone: document.getElementById('edit-customer-phone').value.trim(),
                socialMedia: document.getElementById('edit-customer-social').value.trim()
            };

            // Validate required fields
            if (!customerData.name) {
                Utils.showToast('Please enter customer name.', 'error');
                return;
            }

            Utils.showLoading();
            
            await dbManager.update('customers', customerId, customerData);
            
            Utils.hideLoading();
            Utils.showToast('Customer updated successfully!', 'success');
            
            // Close modal
            document.body.removeChild(modal);
            
        } catch (error) {
            console.error('Error updating customer:', error);
            Utils.hideLoading();
            Utils.showToast('Error updating customer. Please try again.', 'error');
        }
    }

    async deleteCustomer(customerId) {
        if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            try {
                Utils.showLoading();
                
                // Check if customer has purchases
                const purchases = await this.getCustomerPurchases(customerId);
                if (purchases.length > 0) {
                    Utils.hideLoading();
                    const confirmDelete = confirm(`This customer has ${purchases.length} purchase(s). Deleting will not affect the sales records. Are you sure you want to continue?`);
                    if (!confirmDelete) return;
                    Utils.showLoading();
                }
                
                await dbManager.delete('customers', customerId);
                
                Utils.hideLoading();
                Utils.showToast('Customer deleted successfully!', 'success');
                
            } catch (error) {
                console.error('Error deleting customer:', error);
                Utils.hideLoading();
                Utils.showToast('Error deleting customer.', 'error');
            }
        }
    }

    // Get customer statistics
    getCustomerStats() {
        const totalCustomers = this.currentCustomers.length;
        const activeCustomers = this.currentCustomers.filter(c => c.totalPurchases > 0).length;
        const totalSpent = this.currentCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        const averageSpent = totalCustomers > 0 ? totalSpent / totalCustomers : 0;
        
        return {
            total: totalCustomers,
            active: activeCustomers,
            inactive: totalCustomers - activeCustomers,
            totalSpent,
            averageSpent
        };
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

// Add Customer specific styles
const customerStyles = `
    .badge {
        display: inline-block;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        text-align: center;
        white-space: nowrap;
        vertical-align: baseline;
    }
    
    .badge-info {
        background-color: #17a2b8;
        color: white;
    }
    
    .customer-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
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
    
    .purchase-history {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    
    .purchase-history h4 {
        margin-bottom: 15px;
        color: #667eea;
        border-bottom: 2px solid #e1e5e9;
        padding-bottom: 5px;
    }
    
    .purchase-list {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .purchase-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin-bottom: 8px;
        background: white;
        border-radius: 5px;
        border-left: 3px solid #667eea;
    }
    
    .purchase-item:last-child {
        margin-bottom: 0;
    }
    
    .purchase-item.more-items {
        background: #e9ecef;
        color: #6c757d;
        font-style: italic;
        justify-content: center;
        border-left-color: #6c757d;
    }
    
    .purchase-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    
    .purchase-date {
        font-size: 12px;
        color: #666;
    }
    
    .purchase-details {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        font-size: 12px;
    }
    
    .purchase-price {
        font-weight: 600;
        color: #28a745;
    }
    
    @media (max-width: 768px) {
        .customer-details-grid {
            grid-template-columns: 1fr;
        }
        
        .purchase-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }
        
        .purchase-details {
            align-items: flex-start;
        }
    }
`;

// Add styles to document
const customerStyleSheet = document.createElement('style');
customerStyleSheet.textContent = customerStyles;
document.head.appendChild(customerStyleSheet);

// Initialize customer manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.customerManager = new CustomerManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.customerManager) {
        window.customerManager = new CustomerManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.customerManager) {
        window.customerManager.destroy();
        window.customerManager = null;
    }
});