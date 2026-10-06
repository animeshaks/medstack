// js/api.js
// Base API URL — relative so Nginx proxy works
const API_BASE = '/api/v1';

async function request(method, path, body = null, options = {}) {
  try {
    const { getToken } = await import('./auth.js');
    const token = getToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = {
      method,
      headers,
      signal: options.signal || (AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined),
      ...options
    };
    if (body !== null) config.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${path}`, config);

    if (response.status === 401) {
      const { logout } = await import('./auth.js');
      logout();
      return null;
    }

    if (response.status === 504) {
      throw new Error('Gateway / Server timeout. The backend service took too long to respond.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok && data?.message) {
        throw new Error(data.message);
      }
      return data;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server request failed with status ${response.status}: ${text.slice(0, 100)}`);
    }
    return { success: true, data: text };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Request timed out after 25 seconds. Please ensure the backend server is running.');
    }
    console.error(`API [${method} ${path}] error:`, err);
    throw err;
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  postForm: async (path, formData) => {
    try {
      const { getToken } = await import('./auth.js');
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
      if (resp.status === 401) {
        const { logout } = await import('./auth.js');
        logout();
        return null;
      }
      return await resp.json();
    } catch (err) {
      console.error(`API [POST form ${path}] error:`, err);
      throw err;
    }
  }
};

export default api;
