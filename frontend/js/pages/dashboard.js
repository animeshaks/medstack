// js/pages/dashboard.js
import { api } from '../api.js';
import { reportService } from '../services/reportService.js';
import { billService } from '../services/billService.js';
import { settingsService } from '../services/settingsService.js';
import { formatCurrency, formatDate, formatDateTime, generateWhatsAppUrl, renderInvoiceHtml, printInvoice, showLoading, showError } from '../utils.js';
import { getUser } from '../auth.js';
import { can } from '../permissions.js';
import { showModal } from '../components/modal.js';

export default async function renderDashboard(container) {
  showLoading(container, 'Loading dashboard...');

  try {
    const user = getUser();
    const canViewFinancial = can('view_financial') || can('view_reports');

    // Fetch dashboard KPIs and recent bills
    const [kpiResp, billsResp, lowStockResp, expiredResp, nearResp] = await Promise.all([
      reportService.getDashboardKpis().catch(() => null),
      api.get('/bills?page=0&size=6&sort=createdAt,desc').catch(() => null),
      api.get('/inventory/low-stock').catch(() => null),
      api.get('/inventory/expiry/expired').catch(() => null),
      api.get('/inventory/expiry/near?days=90').catch(() => null),
    ]);

    const kpi = kpiResp?.data || {};
    const recentBills = Array.isArray(billsResp?.data?.content) ? billsResp.data.content : (Array.isArray(billsResp?.data) ? billsResp.data : []);
    const lowStockItems = Array.isArray(lowStockResp?.data) ? lowStockResp.data : (lowStockResp?.data?.content ?? []);
    const expiredItems = Array.isArray(expiredResp?.data) ? expiredResp.data : (expiredResp?.data?.content ?? []);
    const nearItems = Array.isArray(nearResp?.data) ? nearResp.data : (nearResp?.data?.content ?? []);

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <div style="font-size:0.8rem;color:var(--text-muted)">Welcome, <strong>${user?.username || 'Operator'}</strong> (${user?.role || 'STAFF'})</div>
      </div>

      <div class="kpi-grid">
        ${canViewFinancial ? `
        <a href="#/bills?datePreset=today" class="kpi-card" style="text-decoration:none;cursor:pointer">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${formatCurrency(kpi.todaySalesTotal ?? 0)}</div>
          <div class="kpi-label">Today's Revenue ↗</div>
        </a>` : ''}
        <a href="#/bills?datePreset=today" class="kpi-card" style="text-decoration:none;cursor:pointer">
          <div class="kpi-icon">🧾</div>
          <div class="kpi-value">${kpi.todayBillCount ?? 0}</div>
          <div class="kpi-label">Today's Bills ↗</div>
        </a>
        <a href="#/inventory#near" class="kpi-card kpi-warning" style="text-decoration:none;cursor:pointer">
          <div class="kpi-icon">⏰</div>
          <div class="kpi-value">${kpi.nearExpiryItemCount ?? (nearItems?.length || 0)}</div>
          <div class="kpi-label">Near Expiry (90d) ↗</div>
        </a>
        <a href="#/inventory#expired" class="kpi-card kpi-danger" style="text-decoration:none;cursor:pointer">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-value">${kpi.expiredBatchCount ?? (expiredItems?.length || 0)}</div>
          <div class="kpi-label">Expired Batches ↗</div>
        </a>
        <a href="#/inventory#low" class="kpi-card kpi-info" style="text-decoration:none;cursor:pointer">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">${kpi.lowStockItemCount ?? (lowStockItems?.length || 0)}</div>
          <div class="kpi-label">Low Stock Items ↗</div>
        </a>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;margin-top:20px">

        <!-- Recent Bills -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Recent Sales Orders</h3>
            <a href="#/bills" class="btn btn-secondary btn-sm">View All</a>
          </div>
          ${recentBills.length === 0
            ? '<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-text">No bills recorded yet</div></div>'
            : `<div class="table-container">
                <table class="data-table">
                  <thead><tr><th>Bill #</th><th>Grand Total</th><th>Payment</th><th>Date &amp; Time</th></tr></thead>
                  <tbody>
                    ${recentBills.map(b => `
                      <tr class="recent-bill-row" data-id="${b.id}" style="cursor:pointer" title="Click to view complete invoice">
                        <td><strong style="color:var(--accent);font-family:var(--font-mono)">${b.billNumber || '—'}</strong></td>
                        <td>${formatCurrency(b.grandTotal)}</td>
                        <td><span class="badge badge-${b.paymentStatus === 'PAID' ? 'success' : 'warning'}">${b.paymentStatus || '—'}</span></td>
                        <td style="color:var(--text-muted);font-size:0.8rem">${formatDateTime(b.createdAt)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- System Alerts -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Operational Alerts</h3>
          </div>
          <div id="alertsList"></div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Quick Actions</h3>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px">
          ${can('create_bills') ? '<a href="#/pos" class="btn btn-primary">🖥 New POS Bill</a>' : ''}
          ${can('manage_medicines') ? '<a href="#/medicines" class="btn btn-secondary">💊 Medicines Master</a>' : ''}
          ${(can('manage_inventory') || can('view_inventory')) ? '<a href="#/inventory" class="btn btn-secondary">📦 Batches &amp; Expiry</a>' : ''}
          ${can('manage_customers') ? '<a href="#/customers" class="btn btn-secondary">👤 Customer Directory</a>' : ''}
          ${can('manage_purchases') ? '<a href="#/purchases" class="btn btn-secondary">🛒 Purchase Orders</a>' : ''}
          ${can('view_reports') ? '<a href="#/reports" class="btn btn-secondary">📊 Reports &amp; Analytics</a>' : ''}
        </div>
      </div>
    `;

    // Populate alerts
    const alertsList = container.querySelector('#alertsList');
    const alerts = [];

    if (expiredItems.length > 0) {
      alerts.push({ type: 'danger', icon: '⚠️', msg: `${expiredItems.length} batch(es) have expired. Action required to retire them.`, link: '#/inventory' });
    }
    if (nearItems.length > 0) {
      alerts.push({ type: 'warning', icon: '⏰', msg: `${nearItems.length} batch(es) are expiring within the next 90 days.`, link: '#/inventory' });
    }
    if (lowStockItems.length > 0) {
      alerts.push({ type: 'info', icon: '📦', msg: `${lowStockItems.length} medicine(s) are below safety stock threshold.`, link: '#/inventory' });
    }
    if (alerts.length === 0) {
      alerts.push({ type: 'success', icon: '✓', msg: 'Inventory and stock operations are normal. No urgent alerts.' });
    }

    alertsList.innerHTML = alerts.map(a => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);margin-bottom:10px;background:var(--bg-tertiary);border-left:4px solid var(--${a.type})">
        <span style="font-size:1.1rem">${a.icon}</span>
        <span style="flex:1;font-size:0.85rem;color:var(--text-secondary)">${a.msg}</span>
        ${a.link ? `<a href="${a.link}" class="btn btn-secondary btn-sm">Inspect</a>` : ''}
      </div>
    `).join('');

    // Wire recent bills row click to view complete bill invoice
    container.querySelectorAll('.recent-bill-row').forEach(row => {
      row.addEventListener('click', async () => {
        const id = row.getAttribute('data-id');
        if (!id) return;
        
        const modal = showModal({
          title: 'Invoice Details',
          size: 'lg',
          body: '<div style="min-height:200px;display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>',
          buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }]
        });

        try {
          const [resp, settings] = await Promise.all([
            billService.getById(id),
            settingsService.getSettings().catch(() => null)
          ]);
          const bill = resp?.data;
          if (!bill) {
            modal.close();
            return;
          }
          const waUrl = generateWhatsAppUrl(bill, settings);
          const modalBody = document.querySelector('.modal-body');
          if (modalBody) {
            modalBody.innerHTML = `
              <div style="width:100%">
                ${renderInvoiceHtml(bill, settings)}
                <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;width:100%;flex-wrap:wrap">
                  <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Share via WhatsApp</a>
                  <button id="btnDashPrintInvoice" class="btn btn-primary">🖨️ Print Tax Invoice</button>
                </div>
              </div>
            `;
            document.getElementById('btnDashPrintInvoice')?.addEventListener('click', () => {
              printInvoice(bill, settings);
            });
          }
        } catch (e) {
          console.error(e);
        }
      });
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    showError(container, 'Failed to load dashboard.');
  }
}
