// js/components/sidebar.js
import { can } from '../permissions.js';

const NAV_ITEMS = [
  { route: '/dashboard',  icon: '⬡',  label: 'Dashboard',  always: true },
  { route: '/pos',        icon: '🖥',  label: 'POS Billing', perm: 'create_bills' },
  { route: '/medicines',  icon: '💊',  label: 'Medicines',   perm: 'manage_medicines' },
  { route: '/inventory',  icon: '📦',  label: 'Inventory',   perm: 'manage_inventory', altPerm: 'view_inventory' },
  { route: '/old-stock',  icon: '🏛️',  label: 'Opening Stock', perm: 'manage_old_stock' },
  { route: '/customers',  icon: '👤',  label: 'Customers',   perm: 'manage_customers' },
  { route: '/doctors',    icon: '🩺',  label: 'Doctors',     always: true },
  { route: '/suppliers',  icon: '🚚',  label: 'Suppliers',   perm: 'manage_suppliers' },
  { route: '/purchases',  icon: '🛒',  label: 'Purchases',   perm: 'manage_purchases' },
  { route: '/bills',      icon: '🧾',  label: 'Bills',       always: true },
  { route: '/dues',       icon: '📒',  label: 'Customer Dues', perm: 'create_bills' },
  { route: '/expenses',   icon: '💸',  label: 'Expenses',    perm: 'manage_expenses' },
  { route: '/reports',    icon: '📊',  label: 'Reports',     perm: 'view_reports' },
  { route: '/audit-logs', icon: '📜',  label: 'Activity Logs', perm: 'view_audit_logs' },
  { route: '/users',      icon: '👥',  label: 'Users',       perm: 'manage_users' },
  { route: '/settings',   icon: '⚙️',  label: 'Settings',    always: true },
];

export function buildSidebarNav(role) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  const currentHash = window.location.hash.replace('#', '') || '/dashboard';

  const items = NAV_ITEMS.filter(item => {
    if (item.always) return true;
    if (item.perm && can(item.perm)) return true;
    if (item.altPerm && can(item.altPerm)) return true;
    return false;
  });

  nav.innerHTML = items.map(item => `
    <a href="#${item.route}" data-route="${item.route}" data-label="${item.label}" class="${currentHash === item.route ? 'active' : ''}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>
  `).join('');

  // Highlight active on hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || '/dashboard';
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === hash);
    });
  });
}
