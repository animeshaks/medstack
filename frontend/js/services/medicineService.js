// js/services/medicineService.js
import { api } from '../api.js';

export const medicineService = {
  getAll: ({ page = 0, size = 20, search = '', symptom = '', ageGroup = '' } = {}) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    if (search) params.append('search', search);
    if (symptom) params.append('symptom', symptom);
    if (ageGroup) params.append('ageGroup', ageGroup);
    return api.get(`/medicines?${params.toString()}`);
  },
  getById: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  search: (q) => api.get(`/medicines?search=${encodeURIComponent(q)}&page=0&size=10`),
};
