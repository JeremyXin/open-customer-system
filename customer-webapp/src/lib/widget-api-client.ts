import axios from 'axios';
import { API_URL } from './constants';

const widgetApiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

widgetApiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('visitor_token') : null;
  if (token) {
    config.headers['X-Visitor-Token'] = token;
  }
  return config;
});

export default widgetApiClient;
