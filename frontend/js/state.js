// js/state.js
const state = {
  currentUser: null,
  role: null,
  cart: [],           // Array of { medicineId, medicineName, quantity, unitPrice, taxRate }
  selectedCustomer: null,
  selectedDoctor: null,
  theme: localStorage.getItem('ms_theme') || 'light',
  currentPage: 'dashboard',
};

const listeners = {};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  if (listeners[key]) listeners[key].forEach(fn => fn(value));
}

export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  return () => { listeners[key] = listeners[key].filter(f => f !== fn); };
}

// Cart helpers
export function addToCart(item) {
  const existing = state.cart.find(i => i.medicineId === item.medicineId);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    state.cart.push({ ...item });
  }
  setState('cart', [...state.cart]);
}

export function removeFromCart(medicineId) {
  setState('cart', state.cart.filter(i => i.medicineId !== medicineId));
}

export function updateCartQty(medicineId, qty) {
  const item = state.cart.find(i => i.medicineId === medicineId);
  if (item) { item.quantity = qty; setState('cart', [...state.cart]); }
}

export function clearCart() {
  setState('cart', []);
  setState('selectedCustomer', null);
  setState('selectedDoctor', null);
}
