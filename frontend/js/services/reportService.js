// js/services/reportService.js
import { api } from '../api.js';

export const reportService = {
  getDashboardKpis: () => api.get('/reports/dashboard'),
  getSalesReport: (from, to) => api.get(`/reports/sales?from=${from}&to=${to}`),
  getPurchasesReport: (from, to) => api.get(`/reports/purchases?from=${from}&to=${to}`),
  getExpensesReport: (from, to) => api.get(`/reports/expenses?from=${from}&to=${to}`),
  getFinancialSummary: (from, to) => api.get(`/reports/summary?from=${from}&to=${to}`),
  getInventoryReport: () => api.get('/reports/inventory'),
};
