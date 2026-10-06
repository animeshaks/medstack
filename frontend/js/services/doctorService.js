// js/services/doctorService.js
import { api } from '../api.js';

export const doctorService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/doctors?page=${page}&size=${size}${q}`);
  },
  getById: (id) => api.get(`/doctors/${id}`),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
  search: (q) => api.get(`/doctors?search=${encodeURIComponent(q)}&page=0&size=10`),
};
