import axios from 'axios';

class TraccarApi {

  constructor({ host, user, password }) {
    if (host && !host.startsWith('http')) {
      host = `https://${host}`;
    }

    const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

    this.user = user;
    this.password = password;
    this.cookie = null;
    this.sessionPromise = null;

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
      if (this.cookie) {
        req.headers['Cookie'] = this.cookie;
      }
      return req;
    });
  }

  ensureSession = async () => {
    if (this.cookie) return this.cookie;
    if (this.sessionPromise) return this.sessionPromise;

    this.sessionPromise = (async () => {
      try {
        const res = await this.createSession();
        const setCookieHeader = res.headers['set-cookie'];
        if (setCookieHeader && setCookieHeader.length > 0) {
          this.cookie = setCookieHeader[0].split(';')[0];
        }
        return this.cookie;
      } catch (err) {
        console.error('[TraccarApi] Error creating session:', err.message);
        throw err;
      } finally {
        this.sessionPromise = null;
      }
    })();

    return this.sessionPromise;
  };

  // ── Endpoints ──────────────────────────────
  getDeviceList = async (params = {}) => {
    await this.ensureSession();
    return this.axiosInstance.get('api/devices', { params });
  };

  getDayKmDevice = async (params = {}) => {
    await this.ensureSession();
    return this.axiosInstance.get('api/reports/summary', { params });
  };

  getPositions = async (params = {}) => {
    await this.ensureSession();
    return this.axiosInstance.get('api/positions', { params });
  };

  sendCommand = async (body = {}) => {
    await this.ensureSession();
    try {
      return await this.axiosInstance.post('api/commands/send', body);
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401) {
        console.warn('[TraccarApi] Command failed, refreshing session and retrying...');
        this.cookie = null;
        await this.ensureSession();
        return await this.axiosInstance.post('api/commands/send', body);
      }
      throw err;
    }
  };

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