import axios from 'axios';
import { Url, Login } from '../../config/config.js';

class WompiApi {
  constructor(config = {}) {
    // Handle both flat config or Company model instance
    const finalConfig = config.wompiConfig || config;

    const publicKey = finalConfig.publicKey || Login.Wompi.publicKey;
    this.publicKey = publicKey;
    this.privateKey = finalConfig.privateKey || Login.Wompi.privateKey;
    this.baseUrl = Url.WompiBaseUrl;
    // console.log('publicKey', publicKey);
    // console.log('privateKey', this.privateKey);
    // console.log('baseUrl', this.baseUrl);

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${publicKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  getMerchantData() {
    return this.client.get(`/merchants/${this.publicKey}`);
  }

  createTransaction(body = {}) {
    return this.client.post('/transactions', body);
  }

  getTransactionData(transactionId) {
    // Note: Wompi status can often be fetched with public key, 
    // but some operations might need private key. The original code used public key.
    return this.client.get(`/transactions/${transactionId}`);
  }
}

const instances = new Map();

export const getWompiApi = (config) => {
  const key = JSON.stringify(config);
  if (!instances.has(key)) {
    instances.set(key, new WompiApi(config));
  }
  return instances.get(key);
};

export const defaultInstance = new WompiApi();

export default defaultInstance;
