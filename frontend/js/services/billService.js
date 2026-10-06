// js/services/billService.js
import { api } from '../api.js';

export const billService = {
  getAll: ({ page = 0, size = 20, search = '', customerId = null, userId = null, startDate = null, endDate = null, paymentStatus = null, dueOnly = null, sort = 'createdAt,desc' } = {}) => {
    let q = `?page=${page}&size=${size}`;
    if (sort) q += `&sort=${encodeURIComponent(sort)}`;
    if (search) q += `&search=${encodeURIComponent(search)}`;
    if (customerId) q += `&customerId=${encodeURIComponent(customerId)}`;
    if (userId) q += `&userId=${encodeURIComponent(userId)}`;
    if (startDate) q += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) q += `&endDate=${encodeURIComponent(endDate)}`;
    if (paymentStatus) q += `&paymentStatus=${encodeURIComponent(paymentStatus)}`;
    if (dueOnly != null) q += `&dueOnly=${encodeURIComponent(dueOnly)}`;
    return api.get(`/bills${q}`);
  },
  getById: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
};
