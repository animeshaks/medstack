// js/components/toast.js
let container = null;

function getContainer() {
  if (!container) container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

export function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Close">✕</button>
  `;

  const close = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', close);
  getContainer().appendChild(toast);
  setTimeout(close, duration);
  return toast;
}
