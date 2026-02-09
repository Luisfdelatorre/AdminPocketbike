// megaRastreoApi.js
import axios from 'axios';
import { Url, Header, ENGINERESUME, ENGINESTOP } from '../config/config.js';
const megaRastreoApi = axios.create({
  baseURL: Url.MegarastreoBase,
  headers: Header.MEGARASTREO,
  timeout: 15000,
});

// Add JSON headers when request has body
megaRastreoApi.interceptors.request.use((req) => {
  if (req.data) {
    req.headers['Content-Type'] = 'application/json';
    req.headers['Accept'] = 'application/json';
  }
  return req;
});

// ======================================================
// REST API Functions (Megarastreo)
// ======================================================

// GET /mobiles
export const getDeviceList = (params = {}) => {
  console.log("params", params);
  return megaRastreoApi.get('/mobiles', { params });
}

// POST /commands (engineStop / engineResume)
export const sendCommand = (body = {}) =>
  megaRastreoApi.post('/commands', body);

// Helpers explícitos (más legible)
export const stopDevice = (mobileId) =>
  sendCommand({
    commandKey: ENGINESTOP,
    mobileId,
    channelKeys: ['tcp'],
    customText: '',
  });

export const resumeDevice = (mobileId) =>
  sendCommand({
    commandKey: ENGINERESUME,
    mobileId,
    channelKeys: ['tcp'],
    customText: '',
  });

export default {
  getDeviceList,
  sendCommand,
  stopDevice,
  resumeDevice,
};
