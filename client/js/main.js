// API Configuration
const API_BASE = window.location.origin + '/api';

// State
let currentDevice = null;
let sseConnection = null;
let currentPaymentReference = null;

// Sample devices (in production, fetch from API)
const devices = [
    { deviceId: 'BIKE001', deviceName: 'Pocketbike #001', deviceType: 'pocketbike', icon: '🏍️' },
    { deviceId: 'BIKE002', deviceName: 'Pocketbike #002', deviceType: 'pocketbike', icon: '🏍️' },
];

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Payments Wompi App Initialized');

    initializeParticles();
    renderDevices();
    setupSSE();
    setupEventListeners();
});

// ========================================
// PARTICLES ANIMATION
// ========================================
function initializeParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 3 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = 'rgba(99, 102, 241, 0.5)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `floatParticle ${Math.random() * 20 + 10}s linear infinite`;
        particle.style.animationDelay = Math.random() * 5 + 's';

        particlesContainer.appendChild(particle);
    }

    // Add CSS animation for particles
    const style = document.createElement('style');
    style.textContent = `
    @keyframes floatParticle {
      0% {
        transform: translate(0, 0);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translate(${Math.random() * 100 - 50}px, -100vh);
        opacity: 0;
      }
    }
  `;
    document.head.appendChild(style);
}

// ========================================
// SERVER-SENT EVENTS (SSE)
// ========================================
function setupSSE() {
    const clientId = `client-${Math.random().toString(36).substr(2, 9)}`;
    const sseUrl = `${API_BASE}/sse/subscribe?clientId=${clientId}`;

    console.log('📡 Connecting to SSE:', sseUrl);

    sseConnection = new EventSource(sseUrl);

    sseConnection.addEventListener('connected', (event) => {
        console.log('✅ SSE Connected:', event.data);
        updateConnectionStatus(true);
    });

    sseConnection.addEventListener('payment-updated', (event) => {
        const data = JSON.parse(event.data);
        console.log('💳 Payment Updated:', data);
        handlePaymentUpdate(data);
    });

    sseConnection.addEventListener('heartbeat', (event) => {
        // console.log('💗 Heartbeat received');
    });

    sseConnection.onerror = (error) => {
        console.error('❌ SSE Error:', error);
        updateConnectionStatus(false);
    };

    sseConnection.onopen = () => {
        console.log('🔓 SSE Connection Opened');
        updateConnectionStatus(true);
    };
}

function updateConnectionStatus(connected) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    if (connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// ========================================
// DEVICE MANAGEMENT
// ========================================
function renderDevices() {
    const deviceGrid = document.getElementById('deviceGrid');

    devices.forEach(device => {
        const card = createDeviceCard(device);
        deviceGrid.appendChild(card);
    });
}

function createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
    <div class="device-card-content">
      <span class="device-icon">${device.icon}</span>
      <div class="device-name">${device.deviceName}</div>
      <div class="device-id">${device.deviceId}</div>
    </div>
  `;

    card.addEventListener('click', () => selectDevice(device, card));

    return card;
}

function selectDevice(device, cardElement) {
    // Deselect previous
    document.querySelectorAll('.device-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Select current
    cardElement.classList.add('selected');
    currentDevice = device;

    // Show payment section
    document.getElementById('paymentSection').style.display = 'block';

    // Load data
    loadDeviceData(device.deviceId);

    showToast('success', 'Device Selected', `Loaded data for ${device.deviceName}`);
}

// ========================================
// DATA LOADING
// ========================================
async function loadDeviceData(deviceId) {
    try {
        // Load unpaid invoices
        await loadUnpaidInvoices(deviceId);

        // Load payment history
        await loadPaymentHistory(deviceId);
    } catch (error) {
        console.error('Error loading device data:', error);
        showToast('error', 'Loading Error', error.message);
    }
}

async function loadUnpaidInvoices(deviceId) {
    try {
        const response = await fetch(`${API_BASE}/payments/unpaid/${deviceId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        const invoices = result.data;
        renderInvoices(invoices);

        // Update pay button
        const btnPay = document.getElementById('btnPay');
        const paymentAmount = document.getElementById('paymentAmount').querySelector('.amount');
        const invoiceCount = document.getElementById('invoiceCount');

        invoiceCount.textContent = invoices.length;

        if (invoices.length > 0) {
            const oldestInvoice = invoices[0];
            paymentAmount.textContent = formatCurrency(oldestInvoice.amount);
            btnPay.disabled = false;

            document.getElementById('paymentInfo').innerHTML = `
        <p class="info-text">📅 Oldest unpaid invoice: ${oldestInvoice.date}</p>
        <p class="info-text">💰 Amount: ${formatCurrency(oldestInvoice.amount)} COP</p>
      `;
        } else {
            paymentAmount.textContent = '0';
            btnPay.disabled = true;

            document.getElementById('paymentInfo').innerHTML = `
        <p class="info-text">✅ All invoices are paid!</p>
      `;
        }
    } catch (error) {
        console.error('Error loading unpaid invoices:', error);
        showToast('error', 'Error', 'Failed to load invoices');
    }
}

async function loadPaymentHistory(deviceId) {
    try {
        const response = await fetch(`${API_BASE}/payments/history/${deviceId}?limit=20`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        renderHistory(result.data);
    } catch (error) {
        console.error('Error loading payment history:', error);
    }
}

// ========================================
// RENDERING
// ========================================
function renderInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (invoices.length === 0) {
        invoicesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No unpaid invoices</div>
      </div>
    `;
        return;
    }

    invoicesList.innerHTML = '';

    invoices.forEach(invoice => {
        const item = createInvoiceItem(invoice);
        invoicesList.appendChild(item);
    });
}

function createInvoiceItem(invoice) {
    const item = document.createElement('div');
    item.className = 'invoice-item';
    item.innerHTML = `
    <div class="invoice-info">
      <div class="invoice-date">📅 ${invoice.date}</div>
      <div class="invoice-id">${invoice.invoiceId}</div>
    </div>
    <div class="invoice-amount">${formatCurrency(invoice.amount)}</div>
    <span class="invoice-status ${invoice.status.toLowerCase()}">${invoice.status}</span>
  `;
    return item;
}

function renderHistory(history) {
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
        historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <div class="empty-state-text">No payment history</div>
      </div>
    `;
        return;
    }

    historyList.innerHTML = '';

    history.forEach(item => {
        const historyItem = createHistoryItem(item);
        historyList.appendChild(historyItem);
    });
}

function createHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';

    const statusIcon = getStatusIcon(item.status);
    const statusText = item.payment ? item.payment.status : item.status;

    div.innerHTML = `
    <div class="history-icon">${statusIcon}</div>
    <div class="history-info">
      <h4>📅 ${item.date}</h4>
      <p>${item.invoiceId}</p>
    </div>
    <div class="history-amount">
      <span class="amount">${formatCurrency(item.amount)}</span>
      <span class="status">${statusText}</span>
    </div>
  `;

    return div;
}

// ========================================
// PAYMENT FLOW
// ========================================
async function createPaymentIntent() {
    if (!currentDevice) {
        showToast('error', 'Error', 'No device selected');
        return;
    }

    try {
        const btnPay = document.getElementById('btnPay');
        btnPay.disabled = true;
        btnPay.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Processing...</span>';

        const response = await fetch(`${API_BASE}/payments/create-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deviceId: currentDevice.deviceId,
                customerEmail: 'customer@example.com',
            }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        const { checkoutUrl, payment, invoice } = result.data;
        currentPaymentReference = payment.paymentReference;

        // Show payment status
        showPaymentStatus('pending', 'Payment Created',
            `Reference: ${payment.paymentReference}`);

        // Open Wompi checkout in new tab
        window.open(checkoutUrl, '_blank');

        showToast('info', 'Payment Initiated', 'Complete payment in the new window');

    } catch (error) {
        console.error('Payment error:', error);
        showToast('error', 'Payment Error', error.message);

        const btnPay = document.getElementById('btnPay');
        btnPay.disabled = false;
        btnPay.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Pay Now</span>';
    }
}

// ========================================
// PAYMENT UPDATES (from SSE)
// ========================================
function handlePaymentUpdate(data) {
    const { paymentStatus, invoiceStatus, paymentReference, invoice, payment } = data;

    console.log('📊 Payment Update:', paymentStatus, invoiceStatus);

    // Update UI based on status
    if (paymentStatus === 'APPROVED') {
        showPaymentStatus('success', '✅ Payment Approved!',
            `Invoice ${invoice.invoiceId} has been paid successfully`);

        showToast('success', 'Payment Approved', 'Your payment was successful!');

        // Reload data
        if (currentDevice) {
            setTimeout(() => {
                loadDeviceData(currentDevice.deviceId);
                hidePaymentStatus();
            }, 3000);
        }
    } else if (paymentStatus === 'DECLINED') {
        showPaymentStatus('error', '❌ Payment Declined',
            'Your payment was declined. Please try again.');

        showToast('error', 'Payment Declined', 'Payment was not successful');

        setTimeout(() => {
            hidePaymentStatus();
            resetPayButton();
        }, 3000);
    } else if (paymentStatus === 'PENDING') {
        showPaymentStatus('pending', '⏳ Payment Pending',
            'Waiting for payment confirmation...');
    }
}

function showPaymentStatus(type, message, details) {
    const paymentStatus = document.getElementById('paymentStatus');
    const statusIcon = document.getElementById('statusIcon');
    const statusMessage = document.getElementById('statusMessage');
    const statusDetails = document.getElementById('statusDetails');

    const icons = {
        pending: '⏳',
        success: '✅',
        error: '❌',
    };

    statusIcon.textContent = icons[type] || '⏳';
    statusMessage.textContent = message;
    statusDetails.textContent = details;

    paymentStatus.style.display = 'block';
}

function hidePaymentStatus() {
    const paymentStatus = document.getElementById('paymentStatus');
    paymentStatus.style.display = 'none';
    resetPayButton();
}

function resetPayButton() {
    const btnPay = document.getElementById('btnPay');
    btnPay.disabled = false;
    btnPay.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Pay Now</span>';
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    document.getElementById('btnPay').addEventListener('click', createPaymentIntent);

    document.getElementById('btnRefresh').addEventListener('click', () => {
        if (currentDevice) {
            loadDeviceData(currentDevice.deviceId);
            showToast('info', 'Refreshed', 'Data reloaded');
        }
    });
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
    };

    toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function formatCurrency(amountInCents) {
    return (amountInCents / 100).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function getStatusIcon(status) {
    const icons = {
        UNPAID: '⏳',
        PENDING: '⏳',
        PAID: '✅',
        APPROVED: '✅',
        DECLINED: '❌',
        ERROR: '❌',
        FAILED: '❌',
    };
    return icons[status] || '❓';
}

// ========================================
// HANDLE PAYMENT CALLBACK (from Wompi redirect)
// ========================================
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');

    if (ref) {
        showToast('info', 'Payment Return', 'Checking payment status...');

        // The webhook should have already updated, but we can verify
        setTimeout(() => {
            if (currentDevice) {
                loadDeviceData(currentDevice.deviceId);
            }
        }, 2000);
    }
});
