// Global variables
let selectedFile = null;
let currentProcessingData = null;
const API_BASE_URL = 'http://localhost:3001';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadInitialData();
});

function initializeApp() {
    // Set API URL from settings
    const savedApiUrl = localStorage.getItem('apiUrl');
    if (savedApiUrl) {
        document.getElementById('apiUrl').value = savedApiUrl;
    }
    
    // Load saved settings
    loadSettings();
}

function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // File upload
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Form processing
    document.getElementById('processBtn').addEventListener('click', processForm);
    document.getElementById('clearBtn').addEventListener('click', clearForm);

    // Settings
    document.getElementById('testConnection').addEventListener('click', testConnection);
    document.getElementById('apiUrl').addEventListener('change', saveSettings);
    document.getElementById('autoProcess').addEventListener('change', saveSettings);
    document.getElementById('saveHistory').addEventListener('change', saveSettings);

    // History
    document.getElementById('refreshHistory').addEventListener('click', loadHistory);
    document.getElementById('historyFilter').addEventListener('change', loadHistory);

    // Modal
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
}

function switchTab(tabName) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Load tab-specific data
    if (tabName === 'orders') {
        loadOrders();
    } else if (tabName === 'history') {
        loadHistory();
    }
}

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processSelectedFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processSelectedFile(files[0]);
    }
}

function processSelectedFile(file) {
    console.log('📁 File selected:', file.name, file.size, file.type);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('error', 'Invalid file type', 'Please select an image file (JPEG, PNG, etc.)');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File too large', 'Please select an image smaller than 5MB');
        return;
    }

    selectedFile = file;
    console.log('✅ File stored in selectedFile:', selectedFile ? 'Yes' : 'No');
    
    // Update UI
    const uploadArea = document.getElementById('uploadArea');
    const uploadContent = uploadArea.querySelector('.upload-content');
    
    uploadArea.classList.add('has-file');
    uploadContent.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <h3>File Selected</h3>
        <p>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>
        <button class="browse-btn" onclick="document.getElementById('fileInput').click()">
            Change File
        </button>
    `;
    
    document.getElementById('formOptions').style.display = 'block';
    
    // Auto-process if enabled
    if (document.getElementById('autoProcess').checked) {
        processForm();
    }
}

// Form processing
async function processForm() {
    console.log('🚀 processForm called, selectedFile:', selectedFile ? 'Yes' : 'No');
    
    if (!selectedFile) {
        showToast('error', 'No file selected', 'Please select an image file first');
        return;
    }

    showLoading(true);

    try {
        console.log('📁 Selected file:', selectedFile.name, selectedFile.size, selectedFile.type);
        
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('form_type', 'menu_order');

        console.log('🚀 Sending request to:', `${API_BASE_URL}/api/omr/process`);
        
        const response = await fetch(`${API_BASE_URL}/api/omr/process`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || result.message || `Server error: ${response.status}`);
        }

        if (result.success) {
            currentProcessingData = result.data;
            showResults(result.data);
            showToast('success', 'Processing Complete', 'Form analyzed successfully');
        } else {
            throw new Error(result.message || 'Processing failed');
        }

    } catch (error) {
        console.error('Processing error:', error);
        showToast('error', 'Processing Failed', error.message || 'An error occurred while processing the form');
    } finally {
        showLoading(false);
    }
}

function showResults(data) {
    const modal = document.getElementById('resultsModal');
    const content = document.getElementById('resultsContent');
    
    const confidencePercent = Math.round(data.confidence * 100);
    const markedItems = data.marked_items || [];
    
    content.innerHTML = `
        <div class="result-summary">
            <h4><i class="fas fa-chart-line"></i> Processing Summary</h4>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
            </div>
            <p><strong>Confidence:</strong> ${confidencePercent}%</p>
            <p><strong>Total Marks Detected:</strong> ${data.total_marks_detected}</p>
            <p><strong>Selected Items:</strong> ${markedItems.length}</p>
        </div>
        
        <h4><i class="fas fa-list"></i> Detected Selections</h4>
        <div class="marks-grid">
            ${generateMarksGrid(data.marks)}
        </div>
        
        ${markedItems.length > 0 ? `
            <div class="marked-items">
                <h4><i class="fas fa-check-circle"></i> Selected Menu Items</h4>
                <ul>
                    ${markedItems.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        ` : '<p class="no-selections">No items were selected on this form.</p>'}
    `;
    
    modal.classList.add('active');
}

function generateMarksGrid(marks) {
    const menuItems = ['isda', 'egg', 'water', 'sinigang', 'Chicken', 'pusit', 'gatas', 'beef'];
    
    return menuItems.map(item => {
        const itemMarks = marks.filter(mark => mark.item === item);
        const selectionMark = itemMarks.find(mark => mark.type === 'selection');
        const quantityMark = itemMarks.find(mark => mark.type === 'quantity');
        
        const isSelected = selectionMark && selectionMark.isMarked;
        const hasQuantity = quantityMark && quantityMark.isMarked;
        
        return `
            <div class="mark-item ${isSelected ? 'marked' : ''}">
                <h5>${item}</h5>
                <div class="mark-status ${isSelected ? 'marked' : 'unmarked'}">
                    ${isSelected ? 'Selected' : 'Not Selected'}
                </div>
                ${hasQuantity ? '<div class="quantity-info">Quantity marked</div>' : ''}
            </div>
        `;
    }).join('');
}

function createOrder() {
    if (!currentProcessingData) {
        showToast('error', 'No data', 'No processing data available');
        return;
    }

    const customerName = document.getElementById('customerName').value || 'Anonymous';
    const tableNumber = document.getElementById('tableNumber').value || '1';
    const notes = document.getElementById('notes').value || '';

    createOrderFromData(currentProcessingData, customerName, tableNumber, notes);
}

async function createOrderFromData(data, customerName, tableNumber, notes) {
    showLoading(true);

    try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('customer_name', customerName);
        formData.append('table_number', tableNumber);
        formData.append('notes', notes);

        const response = await fetch(`${API_BASE_URL}/api/omr/process-to-order`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast('success', 'Order Created', `Order ${result.data.order.order_number} created successfully`);
            closeModal();
            clearForm();
            switchTab('orders');
            loadOrders(); // Refresh orders list
        } else {
            throw new Error(result.message || 'Order creation failed');
        }

    } catch (error) {
        console.error('Order creation error:', error);
        showToast('error', 'Order Creation Failed', error.message || 'An error occurred while creating the order');
    } finally {
        showLoading(false);
    }
}

function clearForm() {
    selectedFile = null;
    currentProcessingData = null;
    
    document.getElementById('fileInput').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('tableNumber').value = '';
    document.getElementById('notes').value = '';
    
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.remove('has-file');
    
    uploadArea.querySelector('.upload-content').innerHTML = `
        <i class="fas fa-cloud-upload-alt"></i>
        <h3>Drag & Drop your form image here</h3>
        <p>or click to browse</p>
        <button class="browse-btn" onclick="document.getElementById('fileInput').click()">
            Browse Files
        </button>
    `;
    
    document.getElementById('formOptions').style.display = 'none';
}

// Data loading functions
async function loadInitialData() {
    await Promise.all([
        loadOrders(),
        loadHistory()
    ]);
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders`);
        const result = await response.json();
        
        const ordersGrid = document.getElementById('ordersGrid');
        
        if (result.success && result.data.length > 0) {
            ordersGrid.innerHTML = result.data.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-number">${order.order_number}</span>
                        <span class="order-status ${order.status}">${order.status}</span>
                    </div>
                    <div class="order-details">
                        <p><strong>Customer:</strong> ${order.customer_name || 'Anonymous'}</p>
                        <p><strong>Table:</strong> ${order.table_number || 'N/A'}</p>
                        <p><strong>Total:</strong> $${order.total_amount || '0.00'}</p>
                        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `).join('');
        } else {
            ordersGrid.innerHTML = '<div class="loading">No orders found</div>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersGrid').innerHTML = '<div class="loading">Error loading orders</div>';
    }
}

async function loadHistory() {
    try {
        const filter = document.getElementById('historyFilter').value;
        const response = await fetch(`${API_BASE_URL}/api/omr/history`);
        const result = await response.json();
        
        const historyList = document.getElementById('historyList');
        
        if (result.success && result.data.length > 0) {
            let filteredData = result.data;
            
            if (filter !== 'all') {
                filteredData = result.data.filter(item => item.form_type === filter);
            }
            
            historyList.innerHTML = filteredData.map(item => {
                const data = JSON.parse(item.processed_data);
                const confidence = Math.round(data.confidence * 100);
                const confidenceClass = confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low';
                
                return `
                    <div class="history-item">
                        <div class="history-info">
                            <h4>${item.form_type.replace('_', ' ').toUpperCase()}</h4>
                            <p>Processed on ${new Date(item.created_at).toLocaleString()}</p>
                            <p>Items detected: ${data.marked_items ? data.marked_items.length : 0}</p>
                        </div>
                        <div class="history-confidence confidence-${confidenceClass}">
                            ${confidence}%
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            historyList.innerHTML = '<div class="loading">No processing history found</div>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        document.getElementById('historyList').innerHTML = '<div class="loading">Error loading history</div>';
    }
}

// Settings functions
async function testConnection() {
    const apiUrl = document.getElementById('apiUrl').value;
    
    try {
        const response = await fetch(`${apiUrl}/health`);
        const result = await response.json();
        
        if (result.status === 'OK') {
            showToast('success', 'Connection Successful', 'API is responding correctly');
        } else {
            throw new Error('API returned unexpected response');
        }
    } catch (error) {
        showToast('error', 'Connection Failed', 'Could not connect to the API server');
    }
}

function saveSettings() {
    const settings = {
        apiUrl: document.getElementById('apiUrl').value,
        autoProcess: document.getElementById('autoProcess').checked,
        saveHistory: document.getElementById('saveHistory').checked
    };
    
    localStorage.setItem('apiUrl', settings.apiUrl);
    localStorage.setItem('autoProcess', settings.autoProcess);
    localStorage.setItem('saveHistory', settings.saveHistory);
    
    // Update global API URL
    window.API_BASE_URL = settings.apiUrl;
    
    showToast('success', 'Settings Saved', 'Your preferences have been saved');
}

function loadSettings() {
    const autoProcess = localStorage.getItem('autoProcess') === 'true';
    const saveHistory = localStorage.getItem('saveHistory') === 'true';
    
    document.getElementById('autoProcess').checked = autoProcess;
    document.getElementById('saveHistory').checked = saveHistory;
}

// Modal functions
function closeModal() {
    document.getElementById('resultsModal').classList.remove('active');
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <h4>${title}</h4>
        <p>${message}</p>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// Handle window errors
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast('error', 'Application Error', 'An unexpected error occurred');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('error', 'Network Error', 'A network request failed');
});
