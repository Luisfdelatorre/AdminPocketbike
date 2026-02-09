import axios from 'axios';
import { Url, Header } from '../config/config.js';

const traccarApi = axios.create({
  baseURL: Url.Base,
  headers: Header.AUTH,
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

// API Functions
export const getDeviceList = (params = {}) =>
  traccarApi.get('devices', { params });
export const getDayKmDevice = (params = {}) =>
  traccarApi.get('reports/summary', { params });
export const getPositions = (params = {}) =>
  traccarApi.get('positions', { params });
export const changeEngineStatus = (body = {}) =>
  traccarApi.post('commands/send', body);

export default {
  getDeviceList,
  getDayKmDevice,
  getPositions,
  changeEngineStatus
};
