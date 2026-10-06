// js/services/settingsService.js
import { api } from '../api.js';

let cachedSettings = null;

export const settingsService = {
  getSettings: async (forceRefresh = false) => {
    if (!forceRefresh && cachedSettings) {
      return cachedSettings;
    }
    try {
      const resp = await api.get('/settings');
      if (resp?.data) {
        cachedSettings = resp.data;
        return cachedSettings;
      }
    } catch (e) {
      console.warn('Failed to load store settings from backend, using defaults:', e);
    }
    // Return sensible defaults if offline or error
    return cachedSettings || {
      storeName: 'MedStack Pharmacy',
      tagline: 'Retail Chemists & Druggists',
      address: 'Shop #12, Health Plaza, 100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      phone: '+91 98765 43210',
      email: 'contact@medstackpharma.in',
      gstin: '29AABCS1429B1ZV',
      dlNumber: 'KA-BLR-2024-1029',
      footerNote: 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!'
    };
  },

  updateSettings: async (data) => {
    const resp = await api.put('/settings', data);
    if (resp?.data) {
      cachedSettings = resp.data;
    }
    return resp;
  },

  clearCache: () => {
    cachedSettings = null;
  }
};
