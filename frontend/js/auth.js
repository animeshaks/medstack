// js/auth.js — Authentication management with session persistence
let _token = null;
let _user = null;

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return (payload.exp * 1000) <= Date.now();
  } catch (e) {
    return true;
  }
}

export function getToken() {
  if (_token) {
    if (isTokenExpired(_token)) {
      clearStorage();
      return null;
    }
    return _token;
  }
  // Restore from localStorage or sessionStorage
  const stored = localStorage.getItem('ms_token') || sessionStorage.getItem('ms_token');
  if (stored) {
    if (isTokenExpired(stored)) {
      clearStorage();
      return null;
    }
    _token = stored;
    const userData = localStorage.getItem('ms_user') || sessionStorage.getItem('ms_user');
    if (userData) {
      try { _user = JSON.parse(userData); } catch (e) { _user = null; }
    }
  }
  return _token;
}

function clearStorage() {
  _token = null;
  _user = null;
  localStorage.removeItem('ms_token');
  localStorage.removeItem('ms_user');
  sessionStorage.removeItem('ms_token');
  sessionStorage.removeItem('ms_user');
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

export function updateStoredUser(updatedUser) {
  _user = { ..._user, ...updatedUser };
  const userJson = JSON.stringify(_user);
  if (localStorage.getItem('ms_user')) localStorage.setItem('ms_user', userJson);
  if (sessionStorage.getItem('ms_user')) sessionStorage.setItem('ms_user', userJson);
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
  clearStorage();
  window.location.href = '/login.html';
}

export async function login(username, password) {
  const isProxied = window.location.port === '3000' || window.location.port === '80' || window.location.port === '8088';
  const loginUrl = isProxied
    ? '/api/v1/auth/login'
    : (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8080')
        ? 'http://localhost:8080/api/v1/auth/login'
        : '/api/v1/auth/login');

  const resp = await fetch(loginUrl, {
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
