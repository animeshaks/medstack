// js/services/inventoryService.js
import { api } from '../api.js';

export const inventoryService = {
  getBatches: ({ page = 0, size = 15, search = '' } = {}) => {
    if (search && search.trim()) {
      return api.get(`/inventory/search?q=${encodeURIComponent(search.trim())}&page=${page}&size=${size}`);
    }
    return api.get(`/inventory?page=${page}&size=${size}`);
  },
  getNearExpiry: (days = 90) => api.get(`/inventory/expiry/near?days=${days}`),
  getExpired: () => api.get('/inventory/expiry/expired'),
  getLowStock: () => api.get('/inventory/low-stock'),
  retireBatch: (id) => api.post('/inventory/expiry/retire', { batchIds: Array.isArray(id) ? id : [id] }),
};
