import axios from 'axios';
import { config } from '../config/config.js';

const traccarApi = axios.create({
    baseURL: config.traccar.baseUrl,
    headers: config.traccar.auth,
    timeout: 15000,
});

// Add JSON headers when the request has body
traccarApi.interceptors.request.use((req) => {
    if (req.data) {
        req.headers['Content-Type'] = 'application/json';
        req.headers['Accept'] = 'application/json';
    }
    return req;
});

// Generic GET function
export const getDeviceList = (params = {}) =>
    traccarApi.get(config.traccar.urls.devices, { params });

export const getDayKmDevice = (params = {}) =>
    traccarApi.get(config.traccar.urls.kms, { params });

export const getPositions = (params = {}) =>
    traccarApi.get(config.traccar.urls.positions, { params });

export const changeEngineStatus = (body = {}) =>
    traccarApi.post(config.traccar.urls.command, body);

// Wrapper for backward compatibility with deviceController
export const fetchDevices = async () => {
    try {
        const response = await getDeviceList();
        return response.data;
    } catch (error) {
        console.error('Error fetching devices from Traccar:', error.message);
        throw error;
    }
};

export default {
    getDeviceList,
    getDayKmDevice,
    getPositions,
    changeEngineStatus,
    fetchDevices,
};
