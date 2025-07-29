// QR Scanner Module
class QRScanner {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.scanning = false;
        this.stream = null;
        this.animationFrame = null;
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
    }

    setupElements() {
        this.video = document.getElementById('qr-video');
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        // Start scanner button
        document.getElementById('start-scanner')?.addEventListener('click', () => {
            this.startScanner();
        });

        // Stop scanner button
        document.getElementById('stop-scanner')?.addEventListener('click', () => {
            this.stopScanner();
        });

        // Initialize when section becomes active
        AppEvents.on('sectionChanged', (section) => {
            if (section === 'qr-scanner') {
                this.initialize();
            } else {
                this.stopScanner();
            }
        });
    }

    async initialize() {
        try {
            // Check if browser supports getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Camera access is not supported in this browser.');
                return;
            }

            // Check camera permissions
            const permissions = await navigator.permissions.query({ name: 'camera' });
            if (permissions.state === 'denied') {
                this.showError('Camera access is denied. Please enable camera permissions.');
                return;
            }

            this.showStatus('QR Scanner ready. Click "Start Scanner" to begin.');
        } catch (error) {
            console.error('Error initializing QR scanner:', error);
            this.showError('Error initializing camera. Please check permissions.');
        }
    }

    async startScanner() {
        try {
            if (this.scanning) {
                this.showStatus('Scanner is already running.');
                return;
            }

            Utils.showLoading();
            this.showStatus('Starting camera...');

            // Get camera stream
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera if available
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });

            // Set video source
            this.video.srcObject = this.stream;
            this.video.play();

            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = resolve;
            });

            // Set canvas dimensions
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            this.scanning = true;
            this.updateUI();
            this.scanFrame();
            
            Utils.hideLoading();
            this.showStatus('Scanning for QR codes... Point camera at a QR code.');

        } catch (error) {
            console.error('Error starting scanner:', error);
            Utils.hideLoading();
            
            if (error.name === 'NotAllowedError') {
                this.showError('Camera access denied. Please allow camera access and try again.');
            } else if (error.name === 'NotFoundError') {
                this.showError('No camera found. Please connect a camera and try again.');
            } else {
                this.showError('Error accessing camera: ' + error.message);
            }
        }
    }

    stopScanner() {
        if (!this.scanning) return;

        this.scanning = false;
        
        // Stop animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clear video
        if (this.video) {
            this.video.srcObject = null;
        }

        this.updateUI();
        this.showStatus('Scanner stopped.');
    }

    scanFrame() {
        if (!this.scanning) return;

        try {
            // Draw video frame to canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Scan for QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
                this.handleQRCodeDetected(code.data);
                return; // Stop scanning after successful detection
            }

        } catch (error) {
            console.error('Error during QR scanning:', error);
        }

        // Continue scanning
        this.animationFrame = requestAnimationFrame(() => this.scanFrame());
    }

    async handleQRCodeDetected(qrData) {
        try {
            this.stopScanner();
            this.showStatus('QR Code detected! Processing...');
            
            // Assume QR code contains product ID
            const productId = qrData.trim();
            
            // Validate product ID format
            if (!this.isValidProductId(productId)) {
                this.showError(`Invalid QR code format: ${productId}`);
                return;
            }

            // Get jacket details
            const jacket = await this.getJacketByProductId(productId);
            if (!jacket) {
                this.showError(`Jacket not found: ${productId}`);
                return;
            }

            if (jacket.status !== 'Available') {
                this.showError(`Jacket ${productId} is already ${jacket.status.toLowerCase()}.`);
                return;
            }

            // Show quick sale modal
            this.showQuickSaleModal(jacket);

        } catch (error) {
            console.error('Error processing QR code:', error);
            this.showError('Error processing QR code. Please try again.');
        }
    }

    isValidProductId(productId) {
        // Check if it matches the expected format (TP-timestamp-random)
        return /^TP-[A-Z0-9]+-[A-Z0-9]+$/i.test(productId);
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

    showQuickSaleModal(jacket) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Quick Sale - ${jacket.productId}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="product-summary">
                        <h4>Product Details</h4>
                        <div class="product-details-grid">
                            <div class="detail-item">
                                <strong>Brand:</strong> ${jacket.brand}
                            </div>
                            <div class="detail-item">
                                <strong>Size:</strong> ${jacket.size}
                            </div>
                            <div class="detail-item">
                                <strong>Color:</strong> ${jacket.color}
                            </div>
                            <div class="detail-item">
                                <strong>Suggested Price:</strong> ${Utils.formatCurrency(jacket.sellingPrice)}
                            </div>
                        </div>
                    </div>
                    
                    <form id="quick-sale-form">
                        <div class="form-group">
                            <label for="quick-customer-name">Customer Name *</label>
                            <input type="text" id="quick-customer-name" required>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="quick-seller">Seller *</label>
                                <select id="quick-seller" required>
                                    <option value="">Select Seller</option>
                                    <option value="Amier Apollis">Amier Apollis</option>
                                    <option value="Ian Jonker">Ian Jonker</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="quick-sale-price">Sale Price (R) *</label>
                                <input type="number" id="quick-sale-price" step="0.01" value="${jacket.sellingPrice}" required>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-check"></i> Complete Sale
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on customer name input
        setTimeout(() => {
            document.getElementById('quick-customer-name').focus();
        }, 100);
        
        // Handle form submission
        const form = modal.querySelector('#quick-sale-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processQuickSale(jacket, modal);
        });
        
        // Handle modal close
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async processQuickSale(jacket, modal) {
        try {
            const customerName = document.getElementById('quick-customer-name').value.trim();
            const seller = document.getElementById('quick-seller').value;
            const salePrice = document.getElementById('quick-sale-price').value;

            if (!customerName || !seller || !salePrice) {
                Utils.showToast('Please fill in all required fields.', 'error');
                return;
            }

            if (parseFloat(salePrice) <= 0) {
                Utils.showToast('Sale price must be greater than 0.', 'error');
                return;
            }

            Utils.showLoading();

            // Get or create customer
            const customer = await this.getOrCreateCustomer(customerName);
            
            // Record the sale
            const saleData = {
                productId: jacket.productId,
                customerName: customerName,
                customerId: customer.id,
                seller: seller,
                salePrice: parseFloat(salePrice),
                purchasePrice: jacket.purchasePrice
            };

            const saleId = await dbManager.recordSale(saleData);
            
            Utils.hideLoading();
            
            // Close modal
            document.body.removeChild(modal);
            
            // Show success message
            const profit = Utils.calculateProfit(salePrice, jacket.purchasePrice);
            this.showSuccess(`
                <div class="sale-success">
                    <h4><i class="fas fa-check-circle"></i> Sale Completed!</h4>
                    <div class="success-details">
                        <div>Product: ${jacket.brand} ${jacket.size} ${jacket.color}</div>
                        <div>Customer: ${customerName}</div>
                        <div>Sale Price: ${Utils.formatCurrency(salePrice)}</div>
                        <div>Profit: <span class="${profit >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(profit)}</span></div>
                    </div>
                </div>
            `);

            // Auto-hide success message after 5 seconds
            setTimeout(() => {
                this.clearStatus();
            }, 5000);

        } catch (error) {
            console.error('Error processing quick sale:', error);
            Utils.hideLoading();
            Utils.showToast('Error processing sale. Please try again.', 'error');
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

    updateUI() {
        const startBtn = document.getElementById('start-scanner');
        const stopBtn = document.getElementById('stop-scanner');
        
        if (startBtn && stopBtn) {
            if (this.scanning) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                startBtn.style.opacity = '0.5';
                stopBtn.style.opacity = '1';
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                startBtn.style.opacity = '1';
                stopBtn.style.opacity = '0.5';
            }
        }
    }

    showStatus(message) {
        const resultDiv = document.getElementById('scan-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="scan-status">
                    <i class="fas fa-info-circle"></i>
                    <span>${message}</span>
                </div>
            `;
            resultDiv.classList.add('show');
        }
    }

    showError(message) {
        const resultDiv = document.getElementById('scan-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="scan-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
            `;
            resultDiv.classList.add('show');
        }
        Utils.showToast(message, 'error');
    }

    showSuccess(content) {
        const resultDiv = document.getElementById('scan-result');
        if (resultDiv) {
            resultDiv.innerHTML = content;
            resultDiv.classList.add('show');
        }
    }

    clearStatus() {
        const resultDiv = document.getElementById('scan-result');
        if (resultDiv) {
            resultDiv.classList.remove('show');
        }
    }

    // Cleanup
    destroy() {
        this.stopScanner();
    }
}

// Add QR Scanner specific styles
const qrScannerStyles = `
    .scan-status {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #17a2b8;
        font-weight: 500;
    }
    
    .scan-error {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #dc3545;
        font-weight: 500;
    }
    
    .sale-success {
        text-align: center;
        color: #28a745;
    }
    
    .sale-success h4 {
        margin-bottom: 15px;
        font-size: 18px;
    }
    
    .success-details {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #28a745;
    }
    
    .success-details > div {
        margin-bottom: 5px;
        font-size: 14px;
    }
    
    .success-details > div:last-child {
        margin-bottom: 0;
        font-weight: 600;
    }
    
    .product-summary {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border-left: 4px solid #667eea;
    }
    
    .product-summary h4 {
        margin-bottom: 15px;
        color: #667eea;
    }
    
    .product-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }
    
    .product-details-grid .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        font-size: 14px;
    }
    
    @media (max-width: 768px) {
        .product-details-grid {
            grid-template-columns: 1fr;
        }
    }
`;

// Add styles to document
const qrStyleSheet = document.createElement('style');
qrStyleSheet.textContent = qrScannerStyles;
document.head.appendChild(qrStyleSheet);

// Initialize QR scanner
document.addEventListener('DOMContentLoaded', () => {
    window.qrScanner = new QRScanner();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.qrScanner) {
        window.qrScanner = new QRScanner();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.qrScanner) {
        window.qrScanner.destroy();
        window.qrScanner = null;
    }
});