// js/app.js — Main application bootstrap
import { isAuthenticated, getUser, logout } from './auth.js';
import { initRouter, navigate, registerRoute } from './router.js';
import { getState, setState } from './state.js';
import { showToast } from './components/toast.js';
import { buildSidebarNav } from './components/sidebar.js';
import { openProfileModal } from './components/profileModal.js';

// Static page imports — guaranteed reliable resolution & zero latency
import renderDashboard from './pages/dashboard.js';
import renderPOS from './pages/pos.js';
import renderMedicines from './pages/medicines.js';
import renderInventory from './pages/inventory.js';
import renderCustomers from './pages/customers.js';
import renderDoctors from './pages/doctors.js';
import renderSuppliers from './pages/suppliers.js';
import renderPurchases from './pages/purchases.js';
import renderBills from './pages/bills.js';
import renderDues from './pages/dues.js';
import renderExpenses from './pages/expenses.js';
import renderReports from './pages/reports.js';
import renderUsers from './pages/users.js';
import renderSettings from './pages/settings.js';
import renderCustomerDetail from './pages/customerDetail.js';
import renderSupplierDetail from './pages/supplierDetail.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!isAuthenticated()) {
  window.location.href = '/login.html';
  throw new Error('Redirect to login');
}

const user = getUser();

// ── Theme ─────────────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('ms_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
setState('theme', savedTheme);

const themeBtn = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ms_theme', theme);
  setState('theme', theme);
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
applyTheme(savedTheme);

themeBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── User display & Profile Modal ──────────────────────────────────────────────
const navbarUserEl = document.getElementById('navbarUser');
const userNameEl = document.getElementById('userNameDisplay');
const userRoleEl = document.getElementById('userRoleBadge');
if (userNameEl) userNameEl.textContent = user?.username || '';
if (userRoleEl) {
  userRoleEl.textContent = user?.role || '';
  userRoleEl.className = `user-badge role-${(user?.role || '').toLowerCase()}`;
}
navbarUserEl?.addEventListener('click', () => {
  openProfileModal();
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  logout();
});

// ── Sidebar collapse ──────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const backdrop = document.getElementById('sidebarBackdrop');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');

let sidebarCollapsed = localStorage.getItem('ms_sidebar_collapsed') === 'true';

function applySidebarState() {
  if (sidebarCollapsed) {
    sidebar?.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    if (sidebarToggle) sidebarToggle.textContent = '▶';
  } else {
    sidebar?.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
    if (sidebarToggle) sidebarToggle.textContent = '◀';
  }
}

applySidebarState();

sidebarToggle?.addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('ms_sidebar_collapsed', sidebarCollapsed);
  applySidebarState();
});

// Mobile sidebar
function openMobileSidebar() {
  sidebar?.classList.add('mobile-open');
  backdrop?.classList.add('active');
}

function closeMobileSidebar() {
  sidebar?.classList.remove('mobile-open');
  backdrop?.classList.remove('active');
}

mobileMenuBtn?.addEventListener('click', openMobileSidebar);
backdrop?.addEventListener('click', closeMobileSidebar);

// ── Build sidebar navigation ──────────────────────────────────────────────────
buildSidebarNav(user?.role);

// ── Page title helper ─────────────────────────────────────────────────────────
export function setPageTitle(title) {
  const el = document.getElementById('navbarTitle');
  if (el) el.textContent = title;
  document.title = `MedStack — ${title}`;
}

// ── Load Page Runner ──────────────────────────────────────────────────────────
function loadPage(renderFn, title) {
  setPageTitle(title);
  closeMobileSidebar();

  const rawPath = window.location.hash.replace(/^#+/, '') || '/dashboard';
  const currentPath = '/' + rawPath.split('?')[0].replace(/^\//, '');
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    const route = a.getAttribute('data-route');
    const isActive = route === currentPath ||
      (currentPath === '/customer-detail' && route === '/customers') ||
      (currentPath === '/supplier-detail' && route === '/suppliers');
    a.classList.toggle('active', isActive);
  });

  const main = document.getElementById('mainContent');
  if (!main) return;

  // Cleanup any listeners from previous page (e.g. POS keydown)
  if (typeof main._cleanup === 'function') {
    try { main._cleanup(); } catch (e) { console.warn('Cleanup error', e); }
    main._cleanup = null;
  }

  main.innerHTML = '';

  try {
    const res = renderFn(main);
    // If render function returns a promise, catch any async rejection
    if (res && typeof res.catch === 'function') {
      res.catch(err => {
        console.error(`Error rendering page [${title}]:`, err);
        main.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon" style="color:var(--danger)">⚠️</div>
            <div class="empty-text" style="color:var(--danger)">Failed to render page: ${err.message || 'Unknown error'}</div>
          </div>
        `;
      });
    }
  } catch (err) {
    console.error(`Error rendering page [${title}]:`, err);
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">⚠️</div>
        <div class="empty-text" style="color:var(--danger)">Failed to render page: ${err.message || 'Unknown error'}</div>
      </div>
    `;
  }
}

// ── Register all routes ───────────────────────────────────────────────────────
registerRoute('/dashboard',        () => loadPage(renderDashboard,        'Dashboard'));
registerRoute('/pos',              () => loadPage(renderPOS,              'Point of Sale'));
registerRoute('/medicines',        () => loadPage(renderMedicines,        'Medicines'));
registerRoute('/inventory',        () => loadPage(renderInventory,        'Inventory'));
registerRoute('/customers',        () => loadPage(renderCustomers,        'Customers'));
registerRoute('/customer-detail',  (params) => loadPage((container) => renderCustomerDetail(container, params), 'Customer Profile & Purchases'));
registerRoute('/doctors',          () => loadPage(renderDoctors,          'Doctors'));
registerRoute('/suppliers',        () => loadPage(renderSuppliers,        'Suppliers'));
registerRoute('/supplier-detail',  (params) => loadPage((container) => renderSupplierDetail(container, params), 'Supplier Ledger & Orders'));
registerRoute('/purchases',        () => loadPage(renderPurchases,        'Purchases'));
registerRoute('/bills',            () => loadPage(renderBills,            'Bills'));
registerRoute('/dues',             () => loadPage(renderDues,             'Customer Dues & Ledger'));
registerRoute('/expenses',         () => loadPage(renderExpenses,         'Expenses'));
registerRoute('/reports',          () => loadPage(renderReports,          'Reports'));
registerRoute('/users',            () => loadPage(renderUsers,            'Users'));
registerRoute('/settings',         () => loadPage(renderSettings,         'Store Settings'));

// ── Start router ──────────────────────────────────────────────────────────────
initRouter();
