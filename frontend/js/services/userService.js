// js/services/userService.js
import { api } from '../api.js';

export const userService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/users?page=${page}&size=${size}${q}`);
  },
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};
