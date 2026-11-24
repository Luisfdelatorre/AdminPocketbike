import axios from 'axios';
import { validateWsEventEnvelope } from './voiceAssistant/schemaValidator';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
export const switchCompany = (targetCompanyId) => api.post('/auth/switch-company', { targetCompanyId });
export const verifyDevicePin = (data) => api.post('/auth/pin-login', data);
export const createDeviceAccess = (data) => api.post('/device-access/create', data);

// --- Voice Assistant (demo & streaming) ---
export const assistantQuery = (data) => api.post('/assistant/query', data);
export const assistantChat = (data) => api.post('/ai/chat', data);
export const resetAssistantSession = () => api.post('/ai/session/reset');
export const getAssistantDiagnostics = () => api.get('/ai/diagnostics');
export const recordAssistantTelemetry = (data) => api.post('/ai/telemetry', data);
export const getAssistantTelemetry = (params) => api.get('/ai/telemetry', { params });

/**
 * Streams an assistant turn over `POST /api/v1/ai/chat` (`Accept: text/event-stream`)
 * using the exact same typed event envelope protocol as the WebSocket channel.
 */
export const assistantChatStream = async ({ payload, signal, onEvent }) => {
    const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('adminToken');

    const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal,
    });

    if (!response.ok || !response.body) {
        let errMessage = `HTTP ${response.status}`;
        try {
            const errJson = await response.json();
            if (errJson?.error) errMessage = errJson.error;
        } catch {
            // Ignore non-JSON body
        }
        throw new Error(errMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastSeq = 0;
    let finalResult = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const rawBlock = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            for (const line of rawBlock.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const dataStr = trimmed.slice(5).trim();
                if (!dataStr || dataStr === '[DONE]') continue;

                let parsed;
                try {
                    parsed = JSON.parse(dataStr);
                } catch {
                    continue;
                }

                const check = validateWsEventEnvelope(parsed);
                if (!check.success) continue;
                const env = check.data;
                if (env.sequence <= lastSeq) continue;
                lastSeq = env.sequence;

                onEvent?.(env);

                if (env.type === 'turn_completed') {
                    finalResult = env.payload;
                } else if (env.type === 'turn_failed') {
                    const failErr = new Error(env.payload?.message || 'Assistant stream failed');
                    failErr.code = env.payload?.code || 'TURN_FAILED';
                    throw failErr;
                }
            }
        }
    }

    if (!finalResult) {
        throw new Error('SSE_STREAM_INCOMPLETE');
    }

    return finalResult;
};

// --- Commands History ---
export const getCommandHistory = (params) => api.get('/commands', { params });
export const getCommandStats = (params) => api.get('/commands/stats', { params });
export const sendCommand = (data) => api.post('/commands/send', data);

// --- Telemetry Alerts ---
export const getAlertsHistory = (params) => api.get('/alerts', { params });
export const getAlertsStats = (params) => api.get('/alerts/stats', { params });
export const updateAlertStatus = (id, data) => api.patch(`/alerts/${id}/status`, data);

// --- Dashboard ---
export const getDashboardStats = (params) => api.get('/dashboard/stats', { params });

// --- Devices ---
export const getAllDevices = () => api.get('/devices');
export const createDevice = (data) => api.post('/devices', data);
export const updateDevice = (id, data) => api.put(`/devices/${id}`, data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);
export const syncDevices = () => api.post('/devices/sync');
export const assignDevicesToCompany = (companyId, deviceIds) => api.post('/devices/assign-to-company', { companyId, deviceIds });
export const controlEngine = (deviceId, command) => api.post(`/devices/${deviceId}/engine`, { command });
export const cutoffDebtors = () => api.post('/devices/cutoff-debtors');

// --- Contracts ---
export const getAllContracts = () => api.get('/contracts/all');
export const getDevicesWithContracts = () => api.get('/contracts/devices');
export const createContract = (data) => api.post('/contracts/create', data);
export const updateContract = (id, data) => api.put(`/contracts/${id}/update`, data);
export const updateContractStatus = (id, status) => api.put(`/contracts/${id}/status`, { status });
export const getContractStats = (deviceId) => api.get(`/contracts/${deviceId}/stats`);
export const getActiveContract = (deviceId) => api.get(`/contracts/${deviceId}`);
export const fetchContractDocumentBlob = async (contractId) => {
    const data = await api.get(`/contracts/${contractId}/document`, {
        responseType: 'blob',
    });
    return data instanceof Blob ? data : (data?.data instanceof Blob ? data.data : new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }));
};

export const getContractDocxBlob = async (contractId) => {
    const data = await api.get(`/contracts/${contractId}/document`, {
        responseType: 'blob',
    });
    return data instanceof Blob 
        ? data 
        : new Blob([data?.data || data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
};

export const downloadContractDocument = async (contractId, customFilename) => {
    const blob = await getContractDocxBlob(contractId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename || `Contrato_${contractId}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const downloadContractPdf = async (contractId, customFilename) => {
    const data = await api.get(`/contracts/${contractId}/pdf`, {
        responseType: 'blob',
    });
    const blob = data instanceof Blob ? data : new Blob([data?.data || data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename || `Contrato_${contractId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const extractContractDocument = (data) => api.post('/contracts/extract-document', data);

// --- Invoices ---
export const getAllInvoices = (params) => api.get('/invoices/all', { params });
export const createInvoice = (data) => api.post('/invoices/create', data);

export const exportInvoicesCSV = async (month, year) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        || localStorage.getItem('token') || localStorage.getItem('adminToken');
    const res = await fetch(`${API_URL}/invoices/export?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

export const getInvoiceStats = async (params) => {
    return api.get('/invoices/stats', { params });
};

export const getUnpaidInvoices = async (deviceId) => {
    return api.get(`/invoices/${deviceId}/unpaid`);
};

export const getStatusReport = async () => {
    return api.get('/invoices/status-report');
};

export const getDailyReconciliationReport = async (month, year, companyId) => {
    try {
        const params = new URLSearchParams({ month, year });
        if (companyId && companyId !== 'all') {
            params.append('companyId', companyId);
        }
        const response = await api.get(`/payments/reconciliation?${params.toString()}`);
        return response;
    } catch (error) {
        return Promise.reject(error);
    }
};

export const toggleReconciliation = async (date, reconciled, transactionId, companyId) => {
    try {
        const payload = { date, reconciled, transactionId };
        if (companyId && companyId !== 'all') {
            payload.companyId = companyId;
        }
        const response = await api.post('/payments/reconciliation/toggle', payload);
        return response;
    } catch (error) {
        return Promise.reject(error);
    }
};

export const getInvoiceById = (id) => api.get(`/invoices/${id}`);

// --- Users & Companies ---
export const getAllUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const getAllCompanies = () => api.get('/companies');
export const createCompany = (data) => api.post('/companies', data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);

// --- Payments ---
export const createPaymentIntent = (data) => api.post('/payments/request', data);
export const getAllPayments = (params) => api.get('/payments/all', { params });
export const getPaymentSummary = (params) => api.get('/payments/allPayments', { params });
export const getPaymentHistory = (deviceId, params) => api.get(`/payments/history/${deviceId}`, { params });
export const registerManualAdjustment = (data) => api.post('/payments/admin/manual', data);

export const exportPaymentsCSV = async (month, year, companyId = '') => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        || localStorage.getItem('token') || localStorage.getItem('adminToken');
    const compParam = companyId ? `&companyId=${companyId}` : '';
    const res = await fetch(`${API_URL}/payments/export?month=${month}&year=${year}${compParam}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};


// --- settings ---
export const getSettings = () => api.get('/companies/settings');
export const updateSettings = (data) => api.put('/companies/settings', data);
export const validateTraccarConnection = (data) => api.post('/companies/validate-traccar', data);
export const getTraccarNotifications = (companyId = 'me') => api.get(`/companies/${companyId}/traccar-notifications`);
export const updateTraccarNotifications = (companyId = 'me', data) => api.put(`/companies/${companyId}/traccar-notifications`, data);
export const getAdjustmentTypes = () => api.get('/settings/adjustment-types');
export const updateAdjustmentTypes = (data) => api.put('/settings/adjustment-types', data);
export const getPaymentStatuses = () => api.get('/settings/payment-status');
export const updatePaymentStatuses = (data) => api.put('/settings/payment-status', data);
export const getOcrTemplates = () => api.get('/settings/ocr-templates');
export const updateOcrTemplates = (data) => api.put('/settings/ocr-templates', data);
export const resetOcrTemplates = () => api.post('/settings/ocr-templates/reset');

// --- SSE ---
export const createSSEConnection = (clientId, companyId = null) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('adminToken');
    const authUserStr = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    let effectiveCompanyId = companyId;
    if (!effectiveCompanyId && authUserStr) {
        try {
            const authUser = JSON.parse(authUserStr);
            effectiveCompanyId = authUser.companyId || null;
        } catch (e) {}
    }
    const url = new URL(`${window.location.origin}${API_URL}/sse/subscribe`);
    url.searchParams.append('clientId', clientId);
    if (effectiveCompanyId) {
        url.searchParams.append('companyId', effectiveCompanyId);
    }
    if (token) {
        url.searchParams.append('token', token);
    }
    return new EventSource(url.toString());
};

// --- Company Billing ---
export const getCompanyInvoices = async (companyId = '') => {
    try {
        const response = await api.get(`/company-invoices${companyId ? `?companyId=${companyId}` : ''}`);
        return response;
    } catch (error) {
        return Promise.reject(error);
    }
};

export const generateCompanyInvoice = async (data) => {
    try {
        const response = await api.post('/company-invoices/generate', data);
        return response;
    } catch (error) {
        return Promise.reject(error);
    }
};

// --- Cron & System Jobs ---
export const getAvailableCronJobs = () => api.get('/cron/available-jobs');
export const getSystemJobs = () => api.get('/system-jobs');
export const createSystemJob = (data) => api.post('/system-jobs', data);
export const updateSystemJob = (id, data) => api.put(`/system-jobs/${id}`, data);
export const deleteSystemJob = (id) => api.delete(`/system-jobs/${id}`);

export default api;
