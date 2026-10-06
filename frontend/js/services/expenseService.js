// js/services/expenseService.js
import { api } from '../api.js';

export const expenseService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', params.page);
    if (params.size !== undefined) query.set('size', params.size);
    if (params.search) query.set('search', params.search);
    if (params.category && params.category !== 'ALL') query.set('category', params.category);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.month) query.set('month', params.month);
    if (params.year) query.set('year', params.year);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return api.get(`/expenses${qs ? '?' + qs : ''}`);
  },
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};
