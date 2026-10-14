// js/services/purchaseService.js
import { api } from '../api.js';

export const purchaseService = {
  getAll: ({ page = 0, size = 15, search = '', supplierId = '', paymentStatus = '', status = '', from = '', to = '' } = {}) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    params.append('sort', 'createdAt,desc');
    if (search) params.append('search', search);
    if (supplierId) params.append('supplierId', supplierId);
    if (paymentStatus) params.append('paymentStatus', paymentStatus);
    if (status) params.append('status', status);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get(`/purchases?${params.toString()}`);
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

  getBySupplier: (supplierId, { page = 0, size = 50, paymentStatus = '' } = {}) => {
    let q = `page=${page}&size=${size}&sort=createdAt,desc`;
    if (paymentStatus) q += `&paymentStatus=${encodeURIComponent(paymentStatus)}`;
    return api.get(`/purchases/supplier/${supplierId}?${q}`);
  },

  getAllBySupplier: (supplierId) => api.get(`/purchases/supplier/${supplierId}/all`),

  pay: (id, paymentData) => api.post(`/purchases/${id}/pay`, paymentData),

  settleSupplier: (supplierId, settleData) => api.post(`/purchases/supplier/${supplierId}/settle`, settleData),

  getPayments: (id) => api.get(`/purchases/${id}/payments`),

  getSupplierPayments: (supplierId) => api.get(`/purchases/supplier/${supplierId}/payments`),
};
