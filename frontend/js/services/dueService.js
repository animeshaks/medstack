// js/services/dueService.js — Customer Dues & Credit Ledger API
import { api } from '../api.js';

export const dueService = {
  getSummary: () => api.get('/bills/dues/summary'),
  
  getCustomersWithDues: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.page !== undefined) q.append('page', params.page);
    if (params.size !== undefined) q.append('size', params.size);
    const qs = q.toString();
    return api.get(`/bills/dues/customers${qs ? '?' + qs : ''}`);
  },

  getDueBills: (params = {}) => {
    const q = new URLSearchParams();
    q.append('dueOnly', 'true');
    if (params.search) q.append('search', params.search);
    if (params.customerId) q.append('customerId', params.customerId);
    if (params.paymentStatus) q.append('paymentStatus', params.paymentStatus);
    if (params.page !== undefined) q.append('page', params.page);
    if (params.size !== undefined) q.append('size', params.size);
    if (params.sort) q.append('sort', params.sort);
    else q.append('sort', 'createdAt,desc');
    return api.get(`/bills?${q.toString()}`);
  },

  collectBillPayment: (billId, payload) => api.post(`/bills/${billId}/payments`, payload),

  settleCustomerDue: (customerId, payload) => api.post(`/bills/dues/settle-customer/${customerId}`, payload),
};
