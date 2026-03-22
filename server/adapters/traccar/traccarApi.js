import axios from 'axios';

class TraccarApi {

  constructor({ host, user, password }) {
    if (host && !host.startsWith('http')) {
      host = `https://${host}`;
    }

    this.axiosInstance = axios.create({
      baseURL: host,
      auth: { username: user, password },
      timeout: 15_000,
      headers: { Accept: 'application/json' },
    });

    this.axiosInstance.interceptors.request.use((req) => {
      // Only set application/json if we are sending an actual JSON body object
      // not a URLSearchParams instance (which Axios handles organically)
      if (req.data && !(req.data instanceof URLSearchParams) && typeof req.data !== 'string') {
        req.headers['Content-Type'] = 'application/json';
      }
      return req;
    });
  }

  // ── Endpoints ──────────────────────────────
  getDeviceList = (params = {}) => this.axiosInstance.get('api/devices', { params });
  getDayKmDevice = (params = {}) => this.axiosInstance.get('api/reports/summary', { params });
  getPositions = (params = {}) => this.axiosInstance.get('api/positions', { params });
  sendCommand = (body = {}) => this.axiosInstance.post('api/commands/send', body);
  createSession = () => {
    const params = new URLSearchParams();
    params.append('email', this.axiosInstance.defaults.auth.username);
    params.append('password', this.axiosInstance.defaults.auth.password);
    
    return this.axiosInstance.post('api/session', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  };
}

export default TraccarApi;