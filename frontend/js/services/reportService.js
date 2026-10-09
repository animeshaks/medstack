// js/services/reportService.js
import { api } from '../api.js';

export const reportService = {
  getDashboardKpis: () => api.get('/reports/dashboard'),
  getSalesReport: (from, to) => api.get(`/reports/sales?from=${from}&to=${to}`),
  getInventoryReport: () => api.get('/reports/inventory'),
};
