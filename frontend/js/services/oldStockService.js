// js/services/oldStockService.js
import { api } from '../api.js';

export const oldStockService = {
  getAll: ({ page = 0, size = 15, search = '', status = 'ALL' } = {}) => {
    let url = `/old-stock?page=${page}&size=${size}`;
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    if (status && status !== 'ALL') {
      url += `&status=${encodeURIComponent(status)}`;
    }
    return api.get(url);
  },
  getSummary: () => api.get('/old-stock/summary'),
  add: (data) => api.post('/old-stock', data),
  update: (id, data) => api.put(`/old-stock/${id}`, data),
  delete: (id) => api.delete(`/old-stock/${id}`),
  uploadCsv: (csvContent) => api.post('/old-stock/upload-csv-json', { csv: csvContent }),
  getTemplate: () => api.get('/old-stock/template')
};
