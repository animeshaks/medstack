// js/services/auditService.js
import { api } from '../api.js';

export const auditService = {
  getLogs: ({ page = 0, size = 25, outcome = 'ALL', username = '', search = '' } = {}) => {
    let url = `/audit/logs?page=${page}&size=${size}`;
    if (outcome && outcome !== 'ALL') {
      url += `&outcome=${encodeURIComponent(outcome)}`;
    }
    if (username && username.trim()) {
      url += `&username=${encodeURIComponent(username.trim())}`;
    }
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    return api.get(url);
  },

  getSummary: () => api.get('/audit/summary'),

  reportClientLog: (data) => api.post('/audit/client-log', data)
};

export default auditService;
