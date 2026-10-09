// js/services/supplierService.js
import { api } from '../api.js';

export const supplierService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/suppliers?page=${page}&size=${size}${q}`);
  },
  getById: (id) => api.get(`/suppliers/${id}`),
  getKhata: (id) => api.get(`/suppliers/${id}/khata`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};
