// js/services/medicineService.js
import { api } from '../api.js';

export const medicineService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/medicines?page=${page}&size=${size}${q}`);
  },
  getById: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  search: (q) => api.get(`/medicines?search=${encodeURIComponent(q)}&page=0&size=10`),
};
