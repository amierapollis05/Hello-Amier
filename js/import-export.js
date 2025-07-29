// Import/Export Module
class ImportExportManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // CSV file input
        document.getElementById('csv-file-input')?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Upload area click
        document.getElementById('csv-upload-area')?.addEventListener('click', () => {
            document.getElementById('csv-file-input')?.click();
        });

        // Import button
        document.getElementById('import-csv-btn')?.addEventListener('click', () => {
            this.importCSV();
        });

        // Export buttons
        document.getElementById('export-inventory-btn')?.addEventListener('click', () => {
            this.exportInventory();
        });

        document.getElementById('export-sales-btn')?.addEventListener('click', () => {
            this.exportSales();
        });

        document.getElementById('export-customers-btn')?.addEventListener('click', () => {
            this.exportCustomers();
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('csv-upload-area');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    handleFileSelect(file) {
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            Utils.showToast('Please select a CSV file.', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast('File size must be less than 5MB.', 'error');
            return;
        }

        this.selectedFile = file;
        this.updateUploadArea(file);
        this.previewCSV(file);
    }

    updateUploadArea(file) {
        const uploadArea = document.getElementById('csv-upload-area');
        const importBtn = document.getElementById('import-csv-btn');
        
        if (uploadArea) {
            uploadArea.innerHTML = `
                <i class="fas fa-file-csv"></i>
                <p><strong>${file.name}</strong></p>
                <p>Size: ${this.formatFileSize(file.size)}</p>
                <small>Click to select a different file</small>
            `;
        }

        if (importBtn) {
            importBtn.disabled = false;
        }
    }

    async previewCSV(file) {
        try {
            const text = await this.readFileAsText(file);
            const results = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                preview: 5 // Only preview first 5 rows
            });

            this.showCSVPreview(results);
        } catch (error) {
            console.error('Error previewing CSV:', error);
            Utils.showToast('Error reading CSV file.', 'error');
        }
    }

    showCSVPreview(results) {
        // Create preview modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>CSV Preview</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="csv-preview">
                        <p><strong>Columns found:</strong> ${results.meta.fields.join(', ')}</p>
                        <p><strong>Rows (preview):</strong> ${results.data.length} of many</p>
                        
                        <div class="preview-table-container">
                            <table class="preview-table">
                                <thead>
                                    <tr>
                                        ${results.meta.fields.map(field => `<th>${Utils.escapeHtml(field)}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${results.data.map(row => `
                                        <tr>
                                            ${results.meta.fields.map(field => `<td>${Utils.escapeHtml(row[field] || '')}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="expected-format">
                            <h4>Expected CSV Format for Inventory:</h4>
                            <p>brand, size, color, purchasePrice, sellingPrice, dateAcquired</p>
                            <small>Make sure your CSV headers match this format exactly.</small>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
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

    async importCSV() {
        if (!this.selectedFile) {
            Utils.showToast('Please select a CSV file first.', 'error');
            return;
        }

        try {
            Utils.showLoading();
            
            const text = await this.readFileAsText(this.selectedFile);
            const results = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim().toLowerCase()
            });

            if (results.errors.length > 0) {
                console.error('CSV parsing errors:', results.errors);
                Utils.showToast('Error parsing CSV file. Please check the format.', 'error');
                Utils.hideLoading();
                return;
            }

            const data = results.data;
            if (data.length === 0) {
                Utils.showToast('CSV file is empty.', 'error');
                Utils.hideLoading();
                return;
            }

            // Validate and import data
            const importResults = await this.processCSVData(data);
            
            Utils.hideLoading();
            this.showImportResults(importResults);

        } catch (error) {
            console.error('Error importing CSV:', error);
            Utils.hideLoading();
            Utils.showToast('Error importing CSV file.', 'error');
        }
    }

    async processCSVData(data) {
        const results = {
            total: data.length,
            successful: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // +2 for header and 1-based indexing

            try {
                // Validate required fields
                const requiredFields = ['brand', 'size', 'color', 'purchaseprice', 'sellingprice', 'dateacquired'];
                const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
                
                if (missingFields.length > 0) {
                    results.errors.push(`Row ${rowNumber}: Missing fields: ${missingFields.join(', ')}`);
                    results.failed++;
                    continue;
                }

                // Validate data types
                const purchasePrice = parseFloat(row.purchaseprice);
                const sellingPrice = parseFloat(row.sellingprice);
                
                if (isNaN(purchasePrice) || purchasePrice <= 0) {
                    results.errors.push(`Row ${rowNumber}: Invalid purchase price: ${row.purchaseprice}`);
                    results.failed++;
                    continue;
                }

                if (isNaN(sellingPrice) || sellingPrice <= 0) {
                    results.errors.push(`Row ${rowNumber}: Invalid selling price: ${row.sellingprice}`);
                    results.failed++;
                    continue;
                }

                // Validate date
                const dateAcquired = new Date(row.dateacquired);
                if (isNaN(dateAcquired.getTime())) {
                    results.errors.push(`Row ${rowNumber}: Invalid date: ${row.dateacquired}`);
                    results.failed++;
                    continue;
                }

                // Validate size
                if (!APP_CONFIG.JACKET_SIZES.includes(row.size.toUpperCase())) {
                    results.errors.push(`Row ${rowNumber}: Invalid size: ${row.size}. Must be one of: ${APP_CONFIG.JACKET_SIZES.join(', ')}`);
                    results.failed++;
                    continue;
                }

                // Create jacket data
                const jacketData = {
                    brand: row.brand.trim(),
                    size: row.size.trim().toUpperCase(),
                    color: row.color.trim(),
                    purchasePrice: purchasePrice,
                    sellingPrice: sellingPrice,
                    dateAcquired: dateAcquired.toISOString().split('T')[0] // Format as YYYY-MM-DD
                };

                // Add jacket to database
                await dbManager.addJacket(jacketData);
                results.successful++;

            } catch (error) {
                console.error(`Error processing row ${rowNumber}:`, error);
                results.errors.push(`Row ${rowNumber}: ${error.message}`);
                results.failed++;
            }
        }

        return results;
    }

    showImportResults(results) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Import Results</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="import-results">
                        <div class="results-summary">
                            <div class="result-item success">
                                <i class="fas fa-check-circle"></i>
                                <span>Successful: ${results.successful}</span>
                            </div>
                            <div class="result-item error">
                                <i class="fas fa-times-circle"></i>
                                <span>Failed: ${results.failed}</span>
                            </div>
                            <div class="result-item total">
                                <i class="fas fa-list"></i>
                                <span>Total: ${results.total}</span>
                            </div>
                        </div>
                        
                        ${results.errors.length > 0 ? `
                            <div class="error-details">
                                <h4>Errors:</h4>
                                <div class="error-list">
                                    ${results.errors.slice(0, 10).map(error => `<div class="error-item">${Utils.escapeHtml(error)}</div>`).join('')}
                                    ${results.errors.length > 10 ? `<div class="error-item">... and ${results.errors.length - 10} more errors</div>` : ''}
                                </div>
                            </div>
                        ` : ''}
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

        // Reset upload area
        this.resetUploadArea();
        
        // Show toast summary
        if (results.successful > 0) {
            Utils.showToast(`Successfully imported ${results.successful} jackets!`, 'success');
        }
        if (results.failed > 0) {
            Utils.showToast(`${results.failed} rows failed to import. Check details above.`, 'error');
        }
    }

    async exportInventory() {
        try {
            Utils.showLoading();
            
            const inventory = await dbManager.getAll('inventory');
            
            if (inventory.length === 0) {
                Utils.showToast('No inventory data to export.', 'info');
                Utils.hideLoading();
                return;
            }

            // Prepare data for export
            const exportData = inventory.map(item => ({
                'Product ID': item.productId,
                'Brand': item.brand,
                'Size': item.size,
                'Color': item.color,
                'Purchase Price': item.purchasePrice,
                'Selling Price': item.sellingPrice,
                'Date Acquired': Utils.formatDate(item.dateAcquired?.toDate ? item.dateAcquired.toDate() : item.dateAcquired),
                'Status': item.status,
                'Created Date': Utils.formatDate(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt)
            }));

            this.downloadCSV(exportData, 'thriftplug-inventory');
            Utils.hideLoading();
            Utils.showToast('Inventory exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting inventory:', error);
            Utils.hideLoading();
            Utils.showToast('Error exporting inventory.', 'error');
        }
    }

    async exportSales() {
        try {
            Utils.showLoading();
            
            const sales = await dbManager.getAll('sales');
            
            if (sales.length === 0) {
                Utils.showToast('No sales data to export.', 'info');
                Utils.hideLoading();
                return;
            }

            // Prepare data for export
            const exportData = sales.map(sale => ({
                'Sale ID': sale.saleId,
                'Product ID': sale.productId,
                'Customer Name': sale.customerName,
                'Seller': sale.seller,
                'Sale Price': sale.salePrice,
                'Purchase Price': sale.purchasePrice,
                'Profit': sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice),
                'Sale Date': Utils.formatDate(sale.saleDate?.toDate ? sale.saleDate.toDate() : sale.saleDate),
                'Created Date': Utils.formatDate(sale.createdAt?.toDate ? sale.createdAt.toDate() : sale.createdAt)
            }));

            this.downloadCSV(exportData, 'thriftplug-sales');
            Utils.hideLoading();
            Utils.showToast('Sales exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting sales:', error);
            Utils.hideLoading();
            Utils.showToast('Error exporting sales.', 'error');
        }
    }

    async exportCustomers() {
        try {
            Utils.showLoading();
            
            const customers = await dbManager.getAll('customers');
            
            if (customers.length === 0) {
                Utils.showToast('No customer data to export.', 'info');
                Utils.hideLoading();
                return;
            }

            // Prepare data for export
            const exportData = customers.map(customer => ({
                'Customer ID': customer.customerId,
                'Name': customer.name,
                'Phone': customer.phone || '',
                'Social Media': customer.socialMedia || '',
                'Total Purchases': customer.totalPurchases,
                'Total Spent': customer.totalSpent,
                'Last Purchase': customer.lastPurchase ? Utils.formatDate(customer.lastPurchase.toDate ? customer.lastPurchase.toDate() : customer.lastPurchase) : '',
                'Created Date': Utils.formatDate(customer.createdAt?.toDate ? customer.createdAt.toDate() : customer.createdAt)
            }));

            this.downloadCSV(exportData, 'thriftplug-customers');
            Utils.hideLoading();
            Utils.showToast('Customers exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting customers:', error);
            Utils.hideLoading();
            Utils.showToast('Error exporting customers.', 'error');
        }
    }

    downloadCSV(data, filename) {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    resetUploadArea() {
        const uploadArea = document.getElementById('csv-upload-area');
        const importBtn = document.getElementById('import-csv-btn');
        const fileInput = document.getElementById('csv-file-input');
        
        if (uploadArea) {
            uploadArea.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Drag & drop CSV file here or click to browse</p>
            `;
        }

        if (importBtn) {
            importBtn.disabled = true;
        }

        if (fileInput) {
            fileInput.value = '';
        }

        this.selectedFile = null;
    }
}

// Add Import/Export specific styles
const importExportStyles = `
    .preview-table-container {
        max-height: 300px;
        overflow: auto;
        margin: 15px 0;
        border: 1px solid #ddd;
        border-radius: 5px;
    }
    
    .preview-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
    }
    
    .preview-table th,
    .preview-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #ddd;
        white-space: nowrap;
    }
    
    .preview-table th {
        background: #f8f9fa;
        font-weight: 600;
        position: sticky;
        top: 0;
    }
    
    .expected-format {
        background: #e3f2fd;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #2196f3;
        margin-top: 15px;
    }
    
    .expected-format h4 {
        margin-bottom: 10px;
        color: #1976d2;
    }
    
    .import-results {
        text-align: center;
    }
    
    .results-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .result-item {
        padding: 15px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    
    .result-item.success {
        background: #d4edda;
        color: #155724;
    }
    
    .result-item.error {
        background: #f8d7da;
        color: #721c24;
    }
    
    .result-item.total {
        background: #e2e3e5;
        color: #383d41;
    }
    
    .result-item i {
        font-size: 24px;
    }
    
    .error-details {
        text-align: left;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #dc3545;
    }
    
    .error-details h4 {
        margin-bottom: 10px;
        color: #dc3545;
    }
    
    .error-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .error-item {
        padding: 5px 0;
        font-size: 12px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .error-item:last-child {
        border-bottom: none;
    }
    
    @media (max-width: 768px) {
        .results-summary {
            grid-template-columns: 1fr;
        }
        
        .preview-table {
            font-size: 10px;
        }
        
        .preview-table th,
        .preview-table td {
            padding: 4px;
        }
    }
`;

// Add styles to document
const importExportStyleSheet = document.createElement('style');
importExportStyleSheet.textContent = importExportStyles;
document.head.appendChild(importExportStyleSheet);

// Initialize import/export manager
document.addEventListener('DOMContentLoaded', () => {
    window.importExportManager = new ImportExportManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.importExportManager) {
        window.importExportManager = new ImportExportManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.importExportManager) {
        window.importExportManager = null;
    }
});