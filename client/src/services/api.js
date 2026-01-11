import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Add Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response Interceptor: Extract Data
api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        const message = error.response?.data?.error || error.message || 'An error occurred';
        const newError = new Error(message);
        newError.originalError = error;
        return Promise.reject(newError);
    }
);

// --- Auth ---
export const login = (data) => api.post('/auth/login', data);
export const verifyDevicePin = (data) => api.post('/auth/device-pin', data);
export const createDeviceAccess = (data) => api.post('/device-access/create', data);

// --- Dashboard ---
export const getDashboardStats = () => api.get('/dashboard/stats');

// --- Devices ---
export const getAllDevices = () => api.get('/devices');
export const createDevice = (data) => api.post('/devices', data);
export const updateDevice = (id, data) => api.put(`/devices/${id}`, data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);
export const syncDevices = () => api.post('/devices/sync');

// --- Contracts ---
export const getAllContracts = () => api.get('/contracts/all');
export const getDevicesWithContracts = () => api.get('/contracts/devices');
export const createContract = (data) => api.post('/contracts/create', data);
export const updateContract = (id, data) => api.put(`/contracts/${id}/update`, data);
export const updateContractStatus = (id, status) => api.put(`/contracts/${id}/status`, { status });
export const getContractStats = (deviceId) => api.get(`/contracts/${deviceId}/stats`);
export const getActiveContract = (deviceId) => api.get(`/contracts/${deviceId}`);

// --- Invoices ---
export const getAllInvoices = (params) => api.get('/invoices/all', { params });
export const getInvoicesByDevice = (deviceId) => api.get(`/invoices/${deviceId}`);
export const getUnpaidInvoices = (deviceId) => api.get(`/invoices/${deviceId}/unpaid`);
export const createInvoice = (data) => api.post('/invoices/create', data);

// --- Payments ---
export const createPaymentIntent = (data) => api.post('/payments/create-intent', data);
export const createBatchPaymentIntent = (data) => api.post('/payments/create-batch-intent', data);
export const getAllPayments = (params) => api.get('/payments/all', { params });
export const getPaymentStatus = (reference) => api.get(`/payments/status/${reference}`);
export const getPaymentHistory = (deviceId, params) => api.get(`/payments/history/${deviceId}`, { params });
export const verifyTransaction = (reference) => api.post(`/payments/verify/${reference}`);

// --- SSE ---
export const createSSEConnection = (clientId) => {
    return new EventSource(`${window.location.origin}${API_URL}/sse/subscribe?clientId=${clientId}`);
};

export default api;
