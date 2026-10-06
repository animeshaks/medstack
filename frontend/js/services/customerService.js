// js/services/customerService.js
import { api } from '../api.js';

export const customerService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/customers?page=${page}&size=${size}${q}`);
  },
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  search: (q) => api.get(`/customers?search=${encodeURIComponent(q)}&page=0&size=10`),
};
