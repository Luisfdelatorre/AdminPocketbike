// Native fetch API wrapper (replaces axios CDN dependency)
const API_URL = window.location.origin;

// Create fetch wrapper with interceptor support
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.requestInterceptors = [];
  }

  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  async request(url, options = {}) {
    // Apply request interceptors
    let config = { ...options, url };
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    const fullUrl = `${this.baseURL}${config.url}`;
    const fetchOptions = {
      method: config.method || 'GET',
      headers: config.headers || {},
      body: config.body
    };

    const response = await fetch(fullUrl, fetchOptions);

    // Mimic axios response structure
    const data = response.ok ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: data || { error: response.statusText }
      };
      throw error;
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  }

  get(url) {
    return this.request(url, { method: 'GET' });
  }

  post(url, data) {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
}

export const api = new ApiClient(API_URL);

// Add interceptor to include token automatically
api.addRequestInterceptor((config) => {
  const token = sessionStorage.getItem('paymentAuthToken');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (deviceIdName, pin) => api.post('/apinode/auth/pin-login', { deviceIdName, pin });

// Payment Data & History
export const getPaymentStatus = () => api.get('/apinode/payments/status');
export const getPaymentHistory = () => api.get('/apinode/payments/history');
export const getInvoiceHistory = () => api.get('/apinode/invoices/history');

// Transactions
export const requestFreeDay = () => api.post('/apinode/payments/use-free-day');
export const requestLoan = () => api.post('/apinode/payments/request-loan');
export const createNequiPayment = (data) => api.post('/apinode/payments/request', data);

// Messages
export const getUIMessages = () => api.get('/apinode/messages/ui');

// EventSource helper for payment streaming
export const createPaymentStream = (reference) => {
  const token = sessionStorage.getItem('paymentAuthToken');
  const url = `/apinode/payments/stream/${reference}?token=${token}`;
  return new EventSource(url);
};

export const getDeviceStatus = () => api.get('/apinode/payments/device-status');
