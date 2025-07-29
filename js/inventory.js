// Inventory Management Module
class InventoryManager {
    constructor() {
        this.currentInventory = [];
        this.filteredInventory = [];
        this.currentFilters = {
            search: '',
            brand: '',
            size: '',
            status: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.loadInventory();
    }

    setupEventListeners() {
        // Add jacket button
        document.getElementById('add-jacket-btn')?.addEventListener('click', () => {
            this.showAddJacketModal();
        });

        // Add jacket form
        document.getElementById('add-jacket-form')?.addEventListener('submit', (e) => {
            this.handleAddJacket(e);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Search and filters
        document.getElementById('inventory-search')?.addEventListener('input', 
            Utils.debounce((e) => this.handleSearch(e.target.value), 300)
        );

        document.getElementById('brand-filter')?.addEventListener('change', (e) => {
            this.handleBrandFilter(e.target.value);
        });

        document.getElementById('size-filter')?.addEventListener('change', (e) => {
            this.handleSizeFilter(e.target.value);
        });

        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.handleStatusFilter(e.target.value);
        });

        // Bulk import
        document.getElementById('bulk-import-btn')?.addEventListener('click', () => {
            this.showBulkImportModal();
        });
    }

    setupRealtimeListener() {
        // Listen for real-time inventory updates
        this.unsubscribe = dbManager.listen('inventory', (inventory) => {
            this.currentInventory = inventory;
            this.applyFilters();
            this.updateBrandFilter();
            AppEvents.emit('inventoryUpdated', inventory);
        });
    }

    async loadInventory() {
        try {
            Utils.showLoading();
            this.currentInventory = await dbManager.getAll('inventory');
            this.applyFilters();
            this.updateBrandFilter();
            Utils.hideLoading();
        } catch (error) {
            console.error('Error loading inventory:', error);
            Utils.showToast('Error loading inventory. Please refresh the page.', 'error');
            Utils.hideLoading();
        }
    }

    showAddJacketModal() {
        const modal = document.getElementById('add-jacket-modal');
        const form = document.getElementById('add-jacket-form');
        
        // Reset form
        form.reset();
        
        // Set default date to today
        document.getElementById('jacket-date-acquired').value = Utils.formatDateForInput(new Date());
        
        // Show modal
        modal.classList.add('show');
    }

    async handleAddJacket(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const jacketData = {
            brand: formData.get('brand') || document.getElementById('jacket-brand').value,
            size: formData.get('size') || document.getElementById('jacket-size').value,
            color: formData.get('color') || document.getElementById('jacket-color').value,
            purchasePrice: formData.get('purchasePrice') || document.getElementById('jacket-purchase-price').value,
            sellingPrice: formData.get('sellingPrice') || document.getElementById('jacket-selling-price').value,
            dateAcquired: formData.get('dateAcquired') || document.getElementById('jacket-date-acquired').value
        };

        // Validate required fields
        if (!jacketData.brand || !jacketData.size || !jacketData.color || 
            !jacketData.purchasePrice || !jacketData.sellingPrice || !jacketData.dateAcquired) {
            Utils.showToast('Please fill in all required fields.', 'error');
            return;
        }

        // Validate prices
        if (parseFloat(jacketData.purchasePrice) <= 0 || parseFloat(jacketData.sellingPrice) <= 0) {
            Utils.showToast('Prices must be greater than 0.', 'error');
            return;
        }

        try {
            Utils.showLoading();
            const jacketId = await dbManager.addJacket(jacketData);
            
            Utils.hideLoading();
            Utils.showToast('Jacket added successfully!', 'success');
            
            // Close modal
            this.closeModal(document.getElementById('add-jacket-modal'));
            
            // Create notification for low stock if needed
            await this.checkLowStock();
            
        } catch (error) {
            console.error('Error adding jacket:', error);
            Utils.hideLoading();
            Utils.showToast('Error adding jacket. Please try again.', 'error');
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

    handleBrandFilter(brand) {
        this.currentFilters.brand = brand;
        this.applyFilters();
    }

    handleSizeFilter(size) {
        this.currentFilters.size = size;
        this.applyFilters();
    }

    handleStatusFilter(status) {
        this.currentFilters.status = status;
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.currentInventory];

        // Apply search filter
        if (this.currentFilters.search) {
            filtered = filtered.filter(item => 
                item.productId.toLowerCase().includes(this.currentFilters.search) ||
                item.brand.toLowerCase().includes(this.currentFilters.search) ||
                item.color.toLowerCase().includes(this.currentFilters.search)
            );
        }

        // Apply brand filter
        if (this.currentFilters.brand) {
            filtered = filtered.filter(item => item.brand === this.currentFilters.brand);
        }

        // Apply size filter
        if (this.currentFilters.size) {
            filtered = filtered.filter(item => item.size === this.currentFilters.size);
        }

        // Apply status filter
        if (this.currentFilters.status) {
            filtered = filtered.filter(item => item.status === this.currentFilters.status);
        }

        this.filteredInventory = filtered;
        this.renderInventoryTable();
    }

    renderInventoryTable() {
        const tbody = document.getElementById('inventory-tbody');
        if (!tbody) return;

        if (this.filteredInventory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        ${this.currentInventory.length === 0 ? 'No jackets in inventory.' : 'No jackets match the current filters.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredInventory.map(jacket => `
            <tr>
                <td><strong>${jacket.productId}</strong></td>
                <td>${Utils.escapeHtml(jacket.brand)}</td>
                <td><span class="size-badge">${jacket.size}</span></td>
                <td>${Utils.escapeHtml(jacket.color)}</td>
                <td>${Utils.formatCurrency(jacket.purchasePrice)}</td>
                <td>${Utils.formatCurrency(jacket.sellingPrice)}</td>
                <td>${Utils.formatDate(jacket.dateAcquired?.toDate ? jacket.dateAcquired.toDate() : jacket.dateAcquired)}</td>
                <td>
                    <span class="status-badge status-${jacket.status.toLowerCase()}">
                        ${jacket.status}
                    </span>
                </td>
                <td>
                    ${jacket.qrCode ? 
                        `<img src="${jacket.qrCode}" alt="QR Code" class="qr-code" onclick="inventoryManager.showQRCode('${jacket.productId}', '${jacket.qrCode}')">` :
                        `<button class="btn btn-sm btn-secondary" onclick="inventoryManager.generateQR('${jacket.id}', '${jacket.productId}')">
                            <i class="fas fa-qrcode"></i>
                        </button>`
                    }
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-edit" onclick="inventoryManager.editJacket('${jacket.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${jacket.status === 'Available' ? 
                            `<button class="btn btn-sm btn-view" onclick="inventoryManager.reserveJacket('${jacket.id}')" title="Reserve">
                                <i class="fas fa-bookmark"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm btn-delete" onclick="inventoryManager.deleteJacket('${jacket.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateBrandFilter() {
        const brandFilter = document.getElementById('brand-filter');
        if (!brandFilter) return;

        // Get unique brands
        const brands = [...new Set(this.currentInventory.map(item => item.brand))].sort();
        
        // Keep current selection
        const currentValue = brandFilter.value;
        
        // Update options
        brandFilter.innerHTML = '<option value="">All Brands</option>' +
            brands.map(brand => `<option value="${Utils.escapeHtml(brand)}">${Utils.escapeHtml(brand)}</option>`).join('');
        
        // Restore selection if it still exists
        if (brands.includes(currentValue)) {
            brandFilter.value = currentValue;
        }
    }

    async editJacket(jacketId) {
        try {
            const jacket = await dbManager.read('inventory', jacketId);
            if (!jacket) {
                Utils.showToast('Jacket not found.', 'error');
                return;
            }

            // Populate edit form (you can create a separate edit modal)
            this.showEditJacketModal(jacket);
        } catch (error) {
            console.error('Error loading jacket for edit:', error);
            Utils.showToast('Error loading jacket details.', 'error');
        }
    }

    showEditJacketModal(jacket) {
        // For now, reuse the add modal with pre-filled data
        const modal = document.getElementById('add-jacket-modal');
        const form = document.getElementById('add-jacket-form');
        
        // Change modal title
        modal.querySelector('.modal-header h3').textContent = 'Edit Jacket';
        
        // Pre-fill form
        document.getElementById('jacket-brand').value = jacket.brand;
        document.getElementById('jacket-size').value = jacket.size;
        document.getElementById('jacket-color').value = jacket.color;
        document.getElementById('jacket-purchase-price').value = jacket.purchasePrice;
        document.getElementById('jacket-selling-price').value = jacket.sellingPrice;
        document.getElementById('jacket-date-acquired').value = Utils.formatDateForInput(
            jacket.dateAcquired?.toDate ? jacket.dateAcquired.toDate() : jacket.dateAcquired
        );
        
        // Store jacket ID for update
        form.dataset.jacketId = jacket.id;
        
        modal.classList.add('show');
    }

    async reserveJacket(jacketId) {
        if (confirm('Reserve this jacket?')) {
            try {
                await dbManager.updateJacketStatus(jacketId, 'Reserved');
                Utils.showToast('Jacket reserved successfully!', 'success');
            } catch (error) {
                console.error('Error reserving jacket:', error);
                Utils.showToast('Error reserving jacket.', 'error');
            }
        }
    }

    async deleteJacket(jacketId) {
        if (confirm('Are you sure you want to delete this jacket? This action cannot be undone.')) {
            try {
                await dbManager.delete('inventory', jacketId);
                Utils.showToast('Jacket deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting jacket:', error);
                Utils.showToast('Error deleting jacket.', 'error');
            }
        }
    }

    async generateQR(jacketId, productId) {
        try {
            Utils.showLoading();
            await dbManager.generateQRCode(jacketId, productId);
            Utils.hideLoading();
            Utils.showToast('QR code generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating QR code:', error);
            Utils.hideLoading();
            Utils.showToast('Error generating QR code.', 'error');
        }
    }

    showQRCode(productId, qrCodeDataURL) {
        // Create and show QR code modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>QR Code - ${productId}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form text-center">
                    <img src="${qrCodeDataURL}" alt="QR Code" style="width: 200px; height: 200px;">
                    <p class="mt-2">Scan this code to mark as sold</p>
                    <button class="btn btn-primary" onclick="inventoryManager.downloadQR('${productId}', '${qrCodeDataURL}')">
                        <i class="fas fa-download"></i> Download
                    </button>
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

    downloadQR(productId, qrCodeDataURL) {
        const link = document.createElement('a');
        link.download = `${productId}_QR.png`;
        link.href = qrCodeDataURL;
        link.click();
    }

    async checkLowStock() {
        try {
            const lowStockBrands = await dbManager.getLowStockBrands();
            
            if (lowStockBrands.length > 0) {
                const message = `Low stock alert: ${lowStockBrands.map(b => `${b.brand} (${b.count})`).join(', ')}`;
                await dbManager.createNotification('Low Stock Alert', message, 'warning');
                Utils.showToast('Low stock alert created!', 'info');
            }
        } catch (error) {
            console.error('Error checking low stock:', error);
        }
    }

    // Get inventory statistics
    getInventoryStats() {
        const available = this.currentInventory.filter(item => item.status === 'Available').length;
        const sold = this.currentInventory.filter(item => item.status === 'Sold').length;
        const reserved = this.currentInventory.filter(item => item.status === 'Reserved').length;
        
        return {
            total: this.currentInventory.length,
            available,
            sold,
            reserved
        };
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

// Initialize inventory manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.inventoryManager) {
        window.inventoryManager = new InventoryManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.inventoryManager) {
        window.inventoryManager.destroy();
        window.inventoryManager = null;
    }
});