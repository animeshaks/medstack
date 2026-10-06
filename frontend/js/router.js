// js/router.js
import { isAuthenticated } from './auth.js';

const routes = {};
let currentRoute = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

async function handleRoute() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }
  const rawHash = window.location.hash.replace(/^#+/, '') || '/dashboard';
  const path = '/' + rawHash.split('?')[0].split('#')[0].replace(/^\//, '');
  const handler = routes[path];
  if (handler) {
    currentRoute = path;
    await handler(getQueryParams());
  } else {
    navigate('/dashboard');
  }
}

function getQueryParams() {
  const hash = window.location.hash.replace('#', '');
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
}

export function getCurrentRoute() { return currentRoute; }
