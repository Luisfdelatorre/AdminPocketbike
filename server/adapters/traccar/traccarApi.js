import axios from 'axios';

class TraccarApi {

  constructor({ host, user, password }) {
    if (host && !host.startsWith('http')) {
      host = `https://${host}`;
    }

    const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

    this.user = user;
    this.password = password;

    this.axiosInstance = axios.create({
      baseURL: host,
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        Authorization: authHeader
      },
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
    params.append('email', this.user);
    params.append('password', this.password);

    return this.axiosInstance.post('api/session', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  };
}

export default TraccarApi;