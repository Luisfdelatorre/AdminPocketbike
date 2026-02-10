import axios from 'axios';
import { Url, Login } from '../../config/config.js';

const wompiApi = axios.create({
  baseURL: Url.WompiBaseUrl,
  headers: Login.Wompi.AUTH,
  timeout: 15000,
});

const getMerchantData = () => wompiApi.get(`/merchants/${Login.Wompi.publicKey}`);
const createTransaction = (body = {}) => wompiApi.post(Url.Transactions, body);
const getTransactionData = (transactionId) => wompiApi.get(`/transactions/${transactionId}`);

export default {
  createTransaction,
  getMerchantData,
  getTransactionData
};
