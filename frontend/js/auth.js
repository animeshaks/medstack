// js/auth.js — Authentication management with session persistence
let _token = null;
let _user = null;

export function getToken() {
  if (_token) return _token;
  // Restore from localStorage or sessionStorage
  const stored = localStorage.getItem('ms_token') || sessionStorage.getItem('ms_token');
  if (stored) {
    _token = stored;
    const userData = localStorage.getItem('ms_user') || sessionStorage.getItem('ms_user');
    if (userData) {
      try { _user = JSON.parse(userData); } catch (e) { _user = null; }
    }
  }
  return _token;
}

export function setToken(token, user) {
  _token = token;
  _user = user;
  const userJson = JSON.stringify(user);
  localStorage.setItem('ms_token', token);
  localStorage.setItem('ms_user', userJson);
  sessionStorage.setItem('ms_token', token);
  sessionStorage.setItem('ms_user', userJson);
}

export function getUser() {
  if (_user) return _user;
  getToken();
  return _user;
}

export function isAuthenticated() {
  return !!getToken();
}

export function logout() {
  _token = null;
  _user = null;
  localStorage.removeItem('ms_token');
  localStorage.removeItem('ms_user');
  sessionStorage.removeItem('ms_token');
  sessionStorage.removeItem('ms_user');
  window.location.href = '/login.html';
}

export async function login(username, password) {
  const resp = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, authType: 'PASSWORD' })
  });
  const data = await resp.json();
  if (data.success && data.data) {
    setToken(data.data.accessToken, {
      username: data.data.username,
      role: data.data.role
    });
    return { success: true };
  }
  return { success: false, message: data.message || 'Login failed' };
}
