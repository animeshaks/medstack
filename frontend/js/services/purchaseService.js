// js/services/purchaseService.js
import { api } from '../api.js';

export const purchaseService = {
  getAll: ({ page = 0, size = 20, search = '' } = {}) => {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return api.get(`/purchases?page=${page}&size=${size}&sort=createdAt,desc${q}`);
  },
  getById: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  receive: (id, receiveData = null) => api.post(`/purchases/${id}/receive`, receiveData || {}),
  getItems: async (id) => {
    try {
      const res = await api.get(`/purchases/${id}/items`);
      if (res?.data) return res;
    } catch (_) {}
    const res = await api.get(`/purchases/${id}`);
    return { success: true, data: res?.data?.items || [] };
  },
};
