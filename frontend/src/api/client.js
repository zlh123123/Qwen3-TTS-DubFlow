import axios from 'axios';

// 创建 axios 实例
const client = axios.create({
  baseURL: '/api', 
  timeout: 30000, // 请求超时时间 30秒
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.detail || '网络请求失败';
    console.error('API Error:', msg);
    return Promise.reject(new Error(msg));
  }
);

export default client;