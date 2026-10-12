// js/pages/supplierDetail.js — Dedicated Supplier Profile, Khata Ledger & Order History
import { supplierService } from '../services/supplierService.js';
import { purchaseService } from '../services/purchaseService.js';
import { settingsService } from '../services/settingsService.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  buildFormHtml,
  getFormData,
  showLoading,
  showError,
  debounce,
  downloadCsv
} from '../utils.js';
import { statusBadge } from '../components/table.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default async function renderSupplierDetail(container, params = {}) {
  const supplierId = params?.id || new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');

  // If no supplier ID is specified, show supplier selector interface
  if (!supplierId) {
    renderSupplierSelector(container);
    return;
  }

  showLoading(container, 'Loading supplier profile, khata & purchase history...');

  try {
    const [supResp, khataResp, ordersResp, paymentsResp, settings] = await Promise.all([
      supplierService.getById(supplierId),
      supplierService.getKhata(supplierId).catch(() => null),
      purchaseService.getAllBySupplier(supplierId).catch(() => ({ data: [] })),
      purchaseService.getSupplierPayments(supplierId).catch(() => ({ data: [] })),
      settingsService.getSettings().catch(() => ({}))
    ]);

    const supplier = supResp?.data;
    if (!supplier) {
      container.innerHTML = `
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon" style="font-size:3rem">🔍</div>
          <div class="empty-title" style="font-size:1.2rem;font-weight:700;margin-top:10px">Supplier Not Found</div>
          <div class="empty-text" style="color:var(--text-muted);margin:8px 0 20px">The requested supplier could not be found or has been removed.</div>
          <a href="#/suppliers" class="btn btn-primary">← Back to All Suppliers</a>
        </div>
      `;
      return;
    }

    const khata = khataResp?.data || {};
    const orders = ordersResp?.data || [];
    const payments = paymentsResp?.data || [];

    // Financial calculations
    const totalOrders = orders.length;
    const totalPurchased = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const outstandingDue = Number(supplier.outstandingBalance != null ? supplier.outstandingBalance : (khata.outstandingBalance || 0));
    const unpaidOrders = orders.filter(o => o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIAL');

    // Build Page Structure
    container.innerHTML = `
      <!-- Top Navigation & Breadcrumbs -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <a href="#/suppliers" class="btn btn-secondary btn-sm" title="Back to All Suppliers">← Suppliers</a>
          <span style="color:var(--text-muted)">/</span>
          <span style="font-weight:700;color:var(--text-primary)">${supplier.name}</span>
          <span class="badge ${outstandingDue > 0 ? 'badge-danger' : 'badge-success'}" style="font-size:0.8rem;margin-left:4px">
            ${outstandingDue > 0 ? `Khata Due: ${formatCurrency(outstandingDue)}` : '✓ All Bills Cleared'}
          </span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${outstandingDue > 0 && can('manage_purchases') ? `
            <button class="btn btn-primary btn-sm" id="btnSettleSupplierDuesTop">
              ⚡ Settle Dues (FIFO)
            </button>
          ` : ''}
          <a href="#/purchases" class="btn btn-secondary btn-sm">+ New PO</a>
          ${can('manage_suppliers') ? `
            <button class="btn btn-secondary btn-sm" id="btnEditSupplierProfile">✏️ Edit Profile</button>
          ` : ''}
        </div>
      </div>

      <!-- Supplier Profile & Contact Card -->
      <div class="card" style="margin-bottom:20px;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="width:52px;height:52px;border-radius:12px;background:rgba(99,102,241,0.12);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:bold;flex-shrink:0">
              🏢
            </div>
            <div>
              <h2 style="margin:0 0 4px;font-size:1.35rem;font-weight:800;color:var(--text-primary)">${supplier.name}</h2>
              <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.85rem;color:var(--text-muted)">
                ${supplier.contactPerson ? `<span>👤 Contact: <strong style="color:var(--text-primary)">${supplier.contactPerson}</strong></span>` : ''}
                ${supplier.phone ? `<span>📞 <a href="tel:${supplier.phone}" style="color:var(--accent);text-decoration:none">${supplier.phone}</a></span>` : ''}
                ${supplier.email ? `<span>✉️ <a href="mailto:${supplier.email}" style="color:var(--text-secondary);text-decoration:none">${supplier.email}</a></span>` : ''}
              </div>
              <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.8rem;color:var(--text-muted);margin-top:6px">
                ${supplier.gstin ? `<span>GSTIN: <code style="color:var(--accent)">${supplier.gstin}</code></span>` : ''}
                ${supplier.dlNumber ? `<span>DL No: <code>${supplier.dlNumber}</code></span>` : ''}
                ${supplier.address ? `<span>📍 ${supplier.address}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="text-align:right">
            <span style="font-size:0.75rem;color:var(--text-muted);display:block">Supplier Added On</span>
            <span style="font-size:0.85rem;color:var(--text-secondary)">${formatDate(supplier.createdAt)}</span>
          </div>
        </div>
      </div>

      <!-- Financial KPI Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px">
        <!-- Outstanding Balance / Advance Card -->
        <div class="card" style="padding:16px 18px;border-left:4px solid ${outstandingDue > 0 ? 'var(--danger)' : (outstandingDue < 0 ? 'var(--success)' : 'var(--border)')};background:${outstandingDue > 0 ? 'rgba(239,68,68,0.03)' : (outstandingDue < 0 ? 'rgba(16,185,129,0.04)' : 'var(--bg-secondary)')}">
          <div style="font-size:0.75rem;font-weight:700;color:${outstandingDue > 0 ? 'var(--danger)' : (outstandingDue < 0 ? 'var(--success)' : 'var(--text-muted)')};text-transform:uppercase;letter-spacing:0.5px">
            ${outstandingDue < 0 ? 'Advance Credit' : 'Outstanding Payable'}
          </div>
          <div style="font-size:1.6rem;font-weight:800;color:${outstandingDue > 0 ? 'var(--danger)' : (outstandingDue < 0 ? 'var(--success)' : 'var(--text-muted)')};margin:4px 0 2px;font-family:var(--font-mono)">
            ${outstandingDue < 0 ? `${formatCurrency(Math.abs(outstandingDue))} (Cr)` : formatCurrency(outstandingDue)}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span style="font-size:0.75rem;color:var(--text-muted)">
              ${outstandingDue < 0 ? '🟢 Advance with distributor' : `${unpaidOrders.length} unpaid bill${unpaidOrders.length === 1 ? '' : 's'}`}
            </span>
            ${can('manage_purchases') ? `
              <button class="btn btn-sm btn-primary" id="btnSettleSupplierDuesCard" style="padding:4px 10px;font-size:0.75rem">
                ${outstandingDue > 0 ? '⚡ Settle Dues' : '💳 Pay / Advance'}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Total Orders Card -->
        <div class="card" style="padding:16px 18px;border-left:4px solid var(--accent)">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">
            Total Purchase Invoices
          </div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--text-primary);margin:4px 0 2px">
            ${totalOrders}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
            ${orders.filter(o => o.status === 'RECEIVED' || o.status === 'PARTIALLY_RECEIVED').length} received stock
          </div>
        </div>

        <!-- Total Purchased Volume Card -->
        <div class="card" style="padding:16px 18px;border-left:4px solid var(--primary)">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">
            Lifetime Purchase Volume
          </div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--text-primary);margin:4px 0 2px;font-family:var(--font-mono)">
            ${formatCurrency(totalPurchased)}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
            Gross procurement total
          </div>
        </div>

        <!-- Total Payments Disbursed Card -->
        <div class="card" style="padding:16px 18px;border-left:4px solid var(--success)">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">
            Total Payments Disbursed
          </div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--success);margin:4px 0 2px;font-family:var(--font-mono)">
            ${formatCurrency(totalPaid)}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
            ${payments.length} payment voucher${payments.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:18px">
        <button class="btn btn-tab active" id="tabSupOrders" style="border-radius:var(--radius) var(--radius) 0 0;padding:8px 18px;border-bottom:2px solid var(--accent);background:var(--bg-secondary);font-weight:600">
          📦 Purchase Invoices &amp; Bills (${totalOrders})
        </button>
        <button class="btn btn-tab" id="tabSupPayments" style="border-radius:var(--radius) var(--radius) 0 0;padding:8px 18px;border-bottom:2px solid transparent;background:transparent;color:var(--text-secondary)">
          💳 Payment History &amp; Vouchers (${payments.length})
        </button>
        <button class="btn btn-tab" id="tabSupKhata" style="border-radius:var(--radius) var(--radius) 0 0;padding:8px 18px;border-bottom:2px solid transparent;background:transparent;color:var(--text-secondary)">
          📒 Khata Ledger Statement
        </button>
      </div>

      <!-- Tab 1: Orders / Invoices Content -->
      <div id="supOrdersSection" class="card" style="padding:16px">
        <div class="toolbar" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <div class="search-box" style="flex:1;min-width:200px">
            <span class="search-icon">🔍</span>
            <input type="text" id="supOrderSearchInput" class="form-control" placeholder="Search by Invoice #..." />
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="supOrderPaymentFilter" class="form-control" style="width:auto">
              <option value="ALL">Payment: All</option>
              <option value="UNPAID">Payment: Unpaid</option>
              <option value="PARTIAL">Payment: Partial</option>
              <option value="PAID">Payment: Fully Paid</option>
            </select>
            <select id="supOrderStatusFilter" class="form-control" style="width:auto">
              <option value="ALL">Status: All</option>
              <option value="RECEIVED">Received</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="PENDING">Pending Delivery</option>
            </select>
            <input type="date" id="supOrderStartDate" class="form-control" style="width:auto" title="From Date" />
            <input type="date" id="supOrderEndDate" class="form-control" style="width:auto" title="To Date" />
            <button class="btn btn-secondary btn-sm" id="btnResetOrderFilters">Reset</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div id="supOrderCountSummary" style="font-size:0.8rem;color:var(--text-muted)"></div>
          <button type="button" class="btn btn-secondary btn-sm" id="btnExportSupOrders" style="font-size:0.75rem;padding:4px 8px" title="Export Purchase Orders to CSV">📥 Export CSV</button>
        </div>
        <div id="supOrdersTableContainer"></div>
      </div>

      <!-- Tab 2: Payment Vouchers Content -->
      <div id="supPaymentsSection" class="card" style="display:none;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:1.05rem;font-weight:700">Payment Vouchers &amp; Disbursements</h3>
            <p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-muted)">Record of all outgoing payments made to ${supplier.name}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${outstandingDue > 0 && can('manage_purchases') ? `
              <button class="btn btn-primary btn-sm" id="btnSettleSupplierDuesTab2">⚡ Record Payment</button>
            ` : ''}
            <button type="button" class="btn btn-secondary btn-sm" id="btnExportSupPayments" style="font-size:0.75rem;padding:4px 8px" title="Export Payments to CSV">📥 Export CSV</button>
          </div>
        </div>
        <div id="supPaymentsTableContainer"></div>
      </div>

      <!-- Tab 3: Khata Ledger Statement Content -->
      <div id="supKhataSection" class="card" style="display:none;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:1.05rem;font-weight:700">Khata Ledger Account</h3>
            <p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-muted)">Running chronological account statement for ${supplier.name}</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" id="btnPrintKhataStatement">🖨️ Print Statement</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnExportSupKhata" style="font-size:0.75rem;padding:4px 8px" title="Export Khata Statement to CSV">📥 Export CSV</button>
          </div>
        </div>
        <div id="supKhataStatementContainer"></div>
      </div>
    `;

    // ── Tab Switching Logic ──────────────────────────────────────────────────
    const tabOrders = container.querySelector('#tabSupOrders');
    const tabPayments = container.querySelector('#tabSupPayments');
    const tabKhata = container.querySelector('#tabSupKhata');
    const secOrders = container.querySelector('#supOrdersSection');
    const secPayments = container.querySelector('#supPaymentsSection');
    const secKhata = container.querySelector('#supKhataSection');

    const activateTab = (tabName) => {
      [tabOrders, tabPayments, tabKhata].forEach(t => {
        t.style.borderBottomColor = 'transparent';
        t.style.background = 'transparent';
        t.style.color = 'var(--text-secondary)';
      });
      [secOrders, secPayments, secKhata].forEach(s => s.style.display = 'none');

      if (tabName === 'orders') {
        tabOrders.style.borderBottomColor = 'var(--accent)';
        tabOrders.style.background = 'var(--bg-secondary)';
        tabOrders.style.color = 'var(--text-primary)';
        secOrders.style.display = 'block';
        renderOrdersList();
      } else if (tabName === 'payments') {
        tabPayments.style.borderBottomColor = 'var(--accent)';
        tabPayments.style.background = 'var(--bg-secondary)';
        tabPayments.style.color = 'var(--text-primary)';
        secPayments.style.display = 'block';
        renderPaymentsList();
      } else if (tabName === 'khata') {
        tabKhata.style.borderBottomColor = 'var(--accent)';
        tabKhata.style.background = 'var(--bg-secondary)';
        tabKhata.style.color = 'var(--text-primary)';
        secKhata.style.display = 'block';
        renderKhataStatement();
      }
    };

    tabOrders?.addEventListener('click', () => activateTab('orders'));
    tabPayments?.addEventListener('click', () => activateTab('payments'));
    tabKhata?.addEventListener('click', () => activateTab('khata'));

    // ── Top Action Buttons & Settle Triggers ─────────────────────────────────
    const triggerSettleModal = () => {
      openSettleSupplierDuesModal(supplier, outstandingDue, () => {
        renderSupplierDetail(container, params);
      });
    };

    container.querySelector('#btnSettleSupplierDuesTop')?.addEventListener('click', triggerSettleModal);
    container.querySelector('#btnSettleSupplierDuesCard')?.addEventListener('click', triggerSettleModal);
    container.querySelector('#btnSettleSupplierDuesTab2')?.addEventListener('click', triggerSettleModal);

    // Edit Profile Trigger
    container.querySelector('#btnEditSupplierProfile')?.addEventListener('click', () => {
      openEditSupplierModal(supplier, () => {
        renderSupplierDetail(container, params);
      });
    });

    // ── Tab 1: Render Orders / Invoices ──────────────────────────────────────
    const ordersTableContainer = container.querySelector('#supOrdersTableContainer');
    const orderSearchInput = container.querySelector('#supOrderSearchInput');
    const orderPaymentFilter = container.querySelector('#supOrderPaymentFilter');
    const orderStatusFilter = container.querySelector('#supOrderStatusFilter');
    const orderStartDate = container.querySelector('#supOrderStartDate');
    const orderEndDate = container.querySelector('#supOrderEndDate');
    const btnResetFilters = container.querySelector('#btnResetOrderFilters');
    const countSummaryEl = container.querySelector('#supOrderCountSummary');

    const renderOrdersList = () => {
      const q = (orderSearchInput?.value || '').toLowerCase().trim();
      const pFilter = orderPaymentFilter?.value || 'ALL';
      const sFilter = orderStatusFilter?.value || 'ALL';
      const fromDate = orderStartDate?.value ? new Date(orderStartDate.value) : null;
      const toDate = orderEndDate?.value ? new Date(orderEndDate.value + 'T23:59:59') : null;

      const filtered = orders.filter(o => {
        if (q && !(o.invoiceNumber || '').toLowerCase().includes(q)) return false;
        if (pFilter !== 'ALL' && o.paymentStatus !== pFilter) return false;
        if (sFilter !== 'ALL' && o.status !== sFilter) return false;
        if (fromDate || toDate) {
          const oDate = new Date(o.invoiceDate || o.createdAt);
          if (fromDate && oDate < fromDate) return false;
          if (toDate && oDate > toDate) return false;
        }
        return true;
      });

      if (countSummaryEl) {
        countSummaryEl.textContent = `Showing ${filtered.length} of ${orders.length} purchase invoices`;
      }

      if (!filtered.length) {
        ordersTableContainer.innerHTML = `
          <div class="empty-state" style="padding:40px 16px">
            <div class="empty-icon">🧾</div>
            <div class="empty-text">No purchase orders match the selected filters</div>
          </div>
        `;
        return;
      }

      ordersTableContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Invoice Date</th>
                <th>Stock Status</th>
                <th style="text-align:right">Subtotal</th>
                <th style="text-align:right">Tax</th>
                <th style="text-align:right">Grand Total</th>
                <th style="text-align:right">Paid</th>
                <th style="text-align:right">Due</th>
                <th>Payment</th>
                <th style="text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(o => {
                const total = Number(o.totalAmount) || 0;
                const paid = Number(o.paidAmount != null ? o.paidAmount : (o.paymentStatus === 'PAID' ? total : 0));
                const due = Number(o.dueAmount != null ? o.dueAmount : Math.max(0, total - paid));
                const isPaid = o.paymentStatus === 'PAID' || due <= 0;
                const isPartial = o.paymentStatus === 'PARTIAL' && due > 0;

                const paymentBadgeClass = isPaid ? 'badge-success' : (isPartial ? 'badge-warning' : 'badge-danger');
                const paymentBadgeText = isPaid ? '✓ PAID' : (isPartial ? '⚡ PARTIAL' : '⚠️ UNPAID');

                return `
                  <tr>
                    <td>
                      <strong style="color:var(--accent);font-family:var(--font-mono)">${o.invoiceNumber || '—'}</strong>
                    </td>
                    <td>${formatDate(o.invoiceDate || o.createdAt)}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td style="text-align:right">${formatCurrency(o.subtotal || (total - (Number(o.taxAmount) || 0)))}</td>
                    <td style="text-align:right">${formatCurrency(o.taxAmount || 0)}</td>
                    <td style="text-align:right"><strong>${formatCurrency(total)}</strong></td>
                    <td style="text-align:right;color:var(--success)">${formatCurrency(paid)}</td>
                    <td style="text-align:right">
                      ${due > 0 ? `<strong style="color:var(--danger)">${formatCurrency(due)}</strong>` : '<span style="color:var(--text-muted)">₹0.00</span>'}
                    </td>
                    <td>
                      <span class="badge ${paymentBadgeClass}">${paymentBadgeText}</span>
                    </td>
                    <td style="text-align:center">
                      <div style="display:flex;gap:6px;justify-content:center">
                        <button class="btn btn-sm btn-secondary btn-view-po" data-id="${o.id}">👁️ View</button>
                        ${due > 0 && can('manage_purchases') ? `
                          <button class="btn btn-sm btn-primary btn-pay-po" data-id="${o.id}" data-inv="${o.invoiceNumber}" data-due="${due}">
                            💳 Clear Bill
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Attach row actions
      ordersTableContainer.querySelectorAll('.btn-view-po').forEach(btn => {
        btn.addEventListener('click', () => {
          const po = orders.find(x => x.id === btn.dataset.id);
          if (po) openPurchaseDetailModal(po);
        });
      });

      ordersTableContainer.querySelectorAll('.btn-pay-po').forEach(btn => {
        btn.addEventListener('click', () => {
          const po = orders.find(x => x.id === btn.dataset.id);
          if (po) {
            openPayPoModal(po, parseFloat(btn.dataset.due), supplier, () => {
              renderSupplierDetail(container, params);
            });
          }
        });
      });
    };

    orderSearchInput?.addEventListener('input', debounce(renderOrdersList, 250));
    orderPaymentFilter?.addEventListener('change', renderOrdersList);
    orderStatusFilter?.addEventListener('change', renderOrdersList);
    orderStartDate?.addEventListener('change', renderOrdersList);
    orderEndDate?.addEventListener('change', renderOrdersList);
    btnResetFilters?.addEventListener('click', () => {
      if (orderSearchInput) orderSearchInput.value = '';
      if (orderPaymentFilter) orderPaymentFilter.value = 'ALL';
      if (orderStatusFilter) orderStatusFilter.value = 'ALL';
      if (orderStartDate) orderStartDate.value = '';
      if (orderEndDate) orderEndDate.value = '';
      renderOrdersList();
    });

    container.querySelector('#btnExportSupOrders')?.addEventListener('click', () => {
      const q = (orderSearchInput?.value || '').toLowerCase().trim();
      const pFilter = orderPaymentFilter?.value || 'ALL';
      const sFilter = orderStatusFilter?.value || 'ALL';
      const fromDate = orderStartDate?.value ? new Date(orderStartDate.value) : null;
      const toDate = orderEndDate?.value ? new Date(orderEndDate.value + 'T23:59:59') : null;

      const filtered = orders.filter(o => {
        if (q && !(o.invoiceNumber || '').toLowerCase().includes(q)) return false;
        if (pFilter !== 'ALL' && o.paymentStatus !== pFilter) return false;
        if (sFilter !== 'ALL' && o.status !== sFilter) return false;
        if (fromDate || toDate) {
          const oDate = new Date(o.invoiceDate || o.createdAt);
          if (fromDate && oDate < fromDate) return false;
          if (toDate && oDate > toDate) return false;
        }
        return true;
      });

      const cols = [
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'invoiceDate', label: 'Invoice Date', render: (val, o) => formatDate(val || o.createdAt) },
        { key: 'status', label: 'Stock Status' },
        { key: 'totalAmount', label: 'Grand Total', render: (val) => formatCurrency(val) },
        { key: 'paidAmount', label: 'Paid', render: (val, o) => formatCurrency(val != null ? val : (o.paymentStatus === 'PAID' ? o.totalAmount : 0)) },
        { key: 'dueAmount', label: 'Due', render: (val, o) => {
          const total = Number(o.totalAmount) || 0;
          const paid = Number(o.paidAmount != null ? o.paidAmount : (o.paymentStatus === 'PAID' ? total : 0));
          return formatCurrency(val != null ? val : Math.max(0, total - paid));
        }},
        { key: 'paymentStatus', label: 'Payment Status' }
      ];
      downloadCsv(`MedStack_${supplier.name.replace(/\s+/g, '_')}_PO_Invoices.csv`, cols, filtered);
    });

    renderOrdersList();

    // ── Tab 2: Render Payment Vouchers List ──────────────────────────────────
    const paymentsTableContainer = container.querySelector('#supPaymentsTableContainer');

    const renderPaymentsList = () => {
      if (!payments.length) {
        paymentsTableContainer.innerHTML = `
          <div class="empty-state" style="padding:40px 16px">
            <div class="empty-icon">💳</div>
            <div class="empty-text">No payment vouchers recorded for this supplier yet</div>
          </div>
        `;
        return;
      }

      paymentsTableContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Against Invoice #</th>
                <th>Payment Mode</th>
                <th style="text-align:right">Amount Paid</th>
                <th>UTR / Transaction Ref</th>
                <th>Remarks / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td style="font-size:0.85rem">${formatDateTime(p.paymentTime || p.createdAt)}</td>
                  <td>
                    <strong style="color:var(--accent);font-family:var(--font-mono)">${p.invoiceNumber || '—'}</strong>
                  </td>
                  <td>
                    <span class="badge badge-secondary">${getPaymentModeLabel(p.paymentMethod)}</span>
                  </td>
                  <td style="text-align:right;font-weight:700;color:var(--success)">
                    ${formatCurrency(p.amount)}
                  </td>
                  <td>
                    <code style="font-size:0.8rem">${p.transactionRef || '—'}</code>
                  </td>
                  <td style="font-size:0.85rem;color:var(--text-secondary)">
                    ${p.notes || '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelector('#btnExportSupPayments')?.addEventListener('click', () => {
        const cols = [
          { key: 'paymentTime', label: 'Date & Time', render: (val, p) => formatDateTime(val || p.createdAt) },
          { key: 'invoiceNumber', label: 'Against Invoice #' },
          { key: 'paymentMethod', label: 'Payment Mode', render: (val) => getPaymentModeLabel(val) },
          { key: 'amount', label: 'Amount Paid', render: (val) => formatCurrency(val) },
          { key: 'transactionRef', label: 'UTR / Ref #' },
          { key: 'notes', label: 'Remarks / Notes' }
        ];
        downloadCsv(`MedStack_${supplier.name.replace(/\s+/g, '_')}_Payments.csv`, cols, payments);
      });
    };

    // ── Tab 3: Khata Ledger Statement ───────────────────────────────────────
    const khataContainer = container.querySelector('#supKhataStatementContainer');

    const renderKhataStatement = () => {
      // Build unified timeline entries (Purchases = Debit to store / Credit to supplier liability; Payments = Credit to store)
      const ledgerEntries = [];

      orders.forEach(o => {
        ledgerEntries.push({
          type: 'INVOICE',
          date: new Date(o.invoiceDate || o.createdAt),
          ref: o.invoiceNumber,
          description: `Purchase Tax Invoice #${o.invoiceNumber}`,
          debit: Number(o.totalAmount) || 0, // Increase liability
          credit: 0
        });
      });

      payments.forEach(p => {
        const isAdvance = !p.purchaseOrderId && !p.invoiceNumber;
        ledgerEntries.push({
          type: isAdvance ? 'ADVANCE' : 'PAYMENT',
          date: new Date(p.paymentTime || p.createdAt),
          ref: isAdvance ? (p.transactionRef || 'ADVANCE') : (p.invoiceNumber || p.transactionRef || 'Payment'),
          description: isAdvance
            ? `Advance Credit Disbursement (${getPaymentModeLabel(p.paymentMethod)}) ${p.notes ? '• ' + p.notes : ''}`
            : `Disbursement (${getPaymentModeLabel(p.paymentMethod)}) ${p.transactionRef ? 'Ref: ' + p.transactionRef : ''}`,
          debit: 0,
          credit: Number(p.amount) || 0 // Decrease liability
        });
      });

      // Sort chronological (oldest to newest)
      ledgerEntries.sort((a, b) => a.date - b.date);

      let runningBalance = 0;
      const ledgerRows = ledgerEntries.map(e => {
        runningBalance += (e.debit - e.credit);
        return {
          ...e,
          balance: runningBalance
        };
      });

      khataContainer.innerHTML = `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <span style="color:var(--text-muted);font-size:0.75rem">Closing Khata Balance</span>
            <div style="font-size:1.4rem;font-weight:800;color:${runningBalance > 0 ? 'var(--danger)' : (runningBalance < 0 ? 'var(--success)' : 'var(--text-primary)')};font-family:var(--font-mono)">
              ${runningBalance < 0 ? `${formatCurrency(Math.abs(runningBalance))} (Advance Credit)` : (runningBalance > 0 ? `${formatCurrency(runningBalance)} (Due Payable)` : '₹0.00 (Nil)')}
            </div>
          </div>
          <div style="text-align:right">
            <span style="color:var(--text-muted);font-size:0.75rem">Ledger Activity</span>
            <div style="font-weight:600;font-size:0.9rem">${ledgerEntries.length} transactions recorded</div>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Particulars</th>
                <th style="text-align:right">Inward Bill (₹)</th>
                <th style="text-align:right">Payment Paid (₹)</th>
                <th style="text-align:right">Balance Due (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerRows.map(r => `
                <tr>
                  <td style="font-size:0.85rem">${formatDate(r.date)}</td>
                  <td>
                    <span class="badge ${r.type === 'INVOICE' ? 'badge-primary' : (r.type === 'ADVANCE' ? 'badge-info' : 'badge-success')}">${r.type}</span>
                  </td>
                  <td><code style="font-family:var(--font-mono)">${r.ref || '—'}</code></td>
                  <td style="font-size:0.85rem">${r.description}</td>
                  <td style="text-align:right;font-weight:600;color:var(--text-primary)">
                    ${r.debit > 0 ? formatCurrency(r.debit) : '—'}
                  </td>
                  <td style="text-align:right;font-weight:600;color:var(--success)">
                    ${r.credit > 0 ? formatCurrency(r.credit) : '—'}
                  </td>
                  <td style="text-align:right;font-weight:700;font-family:var(--font-mono);color:${r.balance > 0 ? 'var(--danger)' : (r.balance < 0 ? 'var(--success)' : 'var(--text-muted)')}">
                    ${r.balance < 0 ? `${formatCurrency(Math.abs(r.balance))} (Cr)` : formatCurrency(r.balance)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelector('#btnPrintKhataStatement')?.addEventListener('click', () => {
        window.print();
      });

      container.querySelector('#btnExportSupKhata')?.addEventListener('click', () => {
        const cols = [
          { key: 'date', label: 'Date', render: (val) => formatDate(val) },
          { key: 'type', label: 'Type' },
          { key: 'ref', label: 'Reference' },
          { key: 'description', label: 'Particulars' },
          { key: 'debit', label: 'Inward Bill (₹)', render: (val) => val > 0 ? formatCurrency(val) : '' },
          { key: 'credit', label: 'Payment Paid (₹)', render: (val) => val > 0 ? formatCurrency(val) : '' },
          { key: 'balance', label: 'Balance Due (₹)', render: (val) => val < 0 ? `${formatCurrency(Math.abs(val))} (Cr)` : formatCurrency(val) }
        ];
        downloadCsv(`MedStack_${supplier.name.replace(/\s+/g, '_')}_Khata_Statement.csv`, cols, ledgerRows);
      });
    };

  } catch (err) {
    console.error('Error rendering supplier details:', err);
    showError(container, 'Failed to load supplier details: ' + (err.message || 'Unknown error'));
  }
}

// ── Fallback Supplier Selector Interface ─────────────────────────────────────
async function renderSupplierSelector(container) {
  showLoading(container, 'Loading suppliers list...');
  try {
    const resp = await supplierService.getAll({ page: 0, size: 100 });
    const suppliers = resp?.data?.content || resp?.data || [];

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Supplier Khata &amp; Ledger Directory</h1>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:2px">
          Select a distributor / supplier to view their ledger balance, past invoices, and settle payments.
        </p>
      </div>

      <div class="card" style="padding:20px;max-width:800px;margin:0 auto">
        <div class="form-group">
          <label class="form-label" style="font-weight:700">Search &amp; Select Supplier</label>
          <input type="text" id="supDirectorySearch" class="form-control" placeholder="Type supplier name, contact, phone, or GSTIN..." style="margin-bottom:12px" />
        </div>

        <div id="supDirectoryList" style="display:flex;flex-direction:column;gap:8px;max-height:450px;overflow-y:auto"></div>
      </div>
    `;

    const listEl = container.querySelector('#supDirectoryList');
    const searchEl = container.querySelector('#supDirectorySearch');

    const renderList = () => {
      const q = (searchEl?.value || '').toLowerCase().trim();
      const filtered = suppliers.filter(s =>
        !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.gstin || '').toLowerCase().includes(q)
      );

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:20px 0">
            <div class="empty-text">No suppliers match your search</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered.map(s => {
        const bal = Number(s.outstandingBalance || 0);
        return `
          <a href="#/supplier-detail?id=${s.id}" class="card" style="padding:12px 16px;text-decoration:none;display:flex;justify-content:space-between;align-items:center;transition:background 0.15s;border:1px solid var(--border)">
            <div>
              <div style="font-weight:700;color:var(--text-primary);font-size:1rem">${s.name}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">
                ${s.contactPerson ? '👤 ' + s.contactPerson : ''} ${s.phone ? '• 📞 ' + s.phone : ''} ${s.gstin ? '• GST: ' + s.gstin : ''}
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${bal > 0 ? 'badge-danger' : 'badge-success'}" style="font-size:0.85rem">
                ${bal > 0 ? `Due: ${formatCurrency(bal)}` : 'Cleared'}
              </span>
            </div>
          </a>
        `;
      }).join('');
    };

    searchEl?.addEventListener('input', debounce(renderList, 200));
    renderList();

  } catch (err) {
    showError(container, 'Failed to load suppliers');
  }
}

// ── Modal: Settle Supplier Dues (FIFO Lump Sum) ──────────────────────────────
export function openSettleSupplierDuesModal(supplier, currentBalance, onSuccess) {
  let selectedMode = 'CASH';
  const defaultDateTime = new Date().toISOString().slice(0, 16);

  const modal = showModal({
    title: `Settle Dues for ${supplier.name}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.75rem;color:var(--danger);font-weight:700">Current Outstanding Dues</div>
            <strong style="font-size:1.3rem;color:var(--danger);font-family:var(--font-mono)">${formatCurrency(currentBalance)}</strong>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted)">Distributor</div>
            <strong style="font-size:0.9rem">${supplier.name}</strong>
          </div>
        </div>

        <div style="background:var(--bg-secondary);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--border);font-size:0.8rem;color:var(--text-secondary)">
          ℹ️ <strong>FIFO Settlement:</strong> This lump sum payment will automatically clear older unpaid purchase orders first, moving progressively to newer bills until fully applied.
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Amount to Disburse (₹) *</label>
          <input type="number" id="settleSupAmountInput" class="form-control" value="${currentBalance > 0 ? currentBalance.toFixed(2) : '0.00'}" min="0.01" step="0.01" style="font-size:1.15rem;font-weight:bold" />
          <div id="settleSupAdvanceFeedback" style="font-size:0.8rem;margin-top:6px;display:none"></div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Disbursed Date &amp; Time *</label>
          <input type="datetime-local" id="settleSupPaymentTime" class="form-control" value="${defaultDateTime}" />
        </div>

        <div>
          <label class="form-label" style="margin-bottom:6px">Payment Mode *</label>
          <div style="display:flex;gap:8px" id="settleSupModeGroup">
            <button type="button" class="btn btn-primary settle-sup-mode-btn" data-mode="CASH">💵 Cash</button>
            <button type="button" class="btn btn-secondary settle-sup-mode-btn" data-mode="UPI">📱 UPI</button>
            <button type="button" class="btn btn-secondary settle-sup-mode-btn" data-mode="CARD">💳 Card</button>
            <button type="button" class="btn btn-secondary settle-sup-mode-btn" data-mode="NETBANKING">🏦 Net Banking</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Transaction Reference / UTR (Optional)</label>
          <input type="text" id="settleSupTxnRef" class="form-control" placeholder="e.g. Bank UTR / Cheque No / Reference" />
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Notes / Remarks (Optional)</label>
          <input type="text" id="settleSupNotes" class="form-control" placeholder="e.g. Month-end distributor settlement" />
        </div>
      </div>
    `,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: '✓ Record Disbursement',
        class: 'btn-primary',
        onClick: async () => {
          const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
          const amtInp = modalEl?.querySelector('#settleSupAmountInput') || document.getElementById('settleSupAmountInput');
          const amt = parseFloat(amtInp?.value);
          if (isNaN(amt) || amt <= 0) {
            showToast('Please enter a valid disbursement amount greater than ₹0', 'error');
            return;
          }

          const ref = (modalEl?.querySelector('#settleSupTxnRef') || document.getElementById('settleSupTxnRef'))?.value.trim() || null;
          const notes = (modalEl?.querySelector('#settleSupNotes') || document.getElementById('settleSupNotes'))?.value.trim() || null;
          const dtVal = (modalEl?.querySelector('#settleSupPaymentTime') || document.getElementById('settleSupPaymentTime'))?.value;
          let paymentTime = null;
          if (dtVal) {
            const d = new Date(dtVal);
            if (!isNaN(d.getTime())) paymentTime = d.toISOString();
          }

          try {
            const resp = await purchaseService.settleSupplier(supplier.id, {
              paymentMethod: selectedMode,
              amount: amt,
              transactionRef: ref,
              paymentTime: paymentTime,
              notes: notes
            });

            if (resp?.success) {
              const curDue = Math.max(0, currentBalance);
              const advancePortion = amt > curDue ? (amt - curDue) : 0;
              const msg = advancePortion > 0
                ? `Disbursement of ${formatCurrency(amt)} recorded (${curDue > 0 ? 'Dues cleared + ' : ''}${formatCurrency(advancePortion)} Advance Credit added to Khata)!`
                : `Disbursement of ${formatCurrency(amt)} recorded for ${supplier.name}!`;
              showToast(msg, 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            } else {
              showToast(resp?.message || 'Failed to record payment', 'error');
            }
          } catch (err) {
            console.error('Error settling supplier dues:', err);
            showToast(err.message || 'Failed to record payment', 'error');
          }
        }
      }
    ]
  });

  const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
  const amtInp = modalEl?.querySelector('#settleSupAmountInput');
  const fback = modalEl?.querySelector('#settleSupAdvanceFeedback');
  const updateSettleFeedback = () => {
    const amt = parseFloat(amtInp?.value) || 0;
    const curDue = Math.max(0, currentBalance);
    if (amt > curDue && fback) {
      fback.style.display = 'block';
      fback.style.color = 'var(--success)';
      const advancePortion = amt - curDue;
      fback.innerHTML = `ℹ️ <strong>Advance Credit:</strong> ${curDue > 0 ? formatCurrency(curDue) + ' will clear current dues, and ' : ''}<strong>${formatCurrency(advancePortion)}</strong> will be credited as an Advance on ${supplier.name}'s Khata.`;
    } else if (fback) {
      fback.style.display = 'none';
    }
  };
  amtInp?.addEventListener('input', updateSettleFeedback);
  updateSettleFeedback();

  modalEl?.querySelectorAll('.settle-sup-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMode = btn.dataset.mode;
      modalEl?.querySelectorAll('.settle-sup-mode-btn').forEach(b => {
        b.className = b.dataset.mode === selectedMode ? 'btn btn-primary settle-sup-mode-btn' : 'btn btn-secondary settle-sup-mode-btn';
      });
    });
  });
}

// ── Modal: Clear / Pay a Single Specific Purchase Order Bill ─────────────────
export function openPayPoModal(po, currentDue, supplier, onSuccess) {
  let selectedMode = 'CASH';
  const defaultDateTime = new Date().toISOString().slice(0, 16);

  const modal = showModal({
    title: `Clear Bill: PO Invoice #${po.invoiceNumber}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.75rem;color:var(--danger);font-weight:700">Pending Bill Due</div>
            <strong style="font-size:1.3rem;color:var(--danger);font-family:var(--font-mono)">${formatCurrency(currentDue)}</strong>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted)">Distributor</div>
            <strong style="font-size:0.9rem">${po.supplierName || supplier?.name || '—'}</strong>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem;background:var(--bg-secondary);padding:10px 12px;border-radius:var(--radius)">
          <div>Invoice Date: <strong>${formatDate(po.invoiceDate || po.createdAt)}</strong></div>
          <div>Total Bill: <strong>${formatCurrency(po.totalAmount)}</strong></div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Amount to Disburse (₹) *</label>
          <input type="number" id="payPoAmountInput" class="form-control" value="${currentDue.toFixed(2)}" min="0.01" step="0.01" style="font-size:1.15rem;font-weight:bold" />
          <div id="payPoAdvanceFeedback" style="font-size:0.8rem;margin-top:6px;display:none"></div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Date &amp; Time *</label>
          <input type="datetime-local" id="payPoPaymentTime" class="form-control" value="${defaultDateTime}" />
        </div>

        <div>
          <label class="form-label" style="margin-bottom:6px">Payment Mode *</label>
          <div style="display:flex;gap:8px" id="payPoModeGroup">
            <button type="button" class="btn btn-primary pay-po-mode-btn" data-mode="CASH">💵 Cash</button>
            <button type="button" class="btn btn-secondary pay-po-mode-btn" data-mode="UPI">📱 UPI</button>
            <button type="button" class="btn btn-secondary pay-po-mode-btn" data-mode="CARD">💳 Card</button>
            <button type="button" class="btn btn-secondary pay-po-mode-btn" data-mode="NETBANKING">🏦 Net Banking</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Transaction Reference / UTR (Optional)</label>
          <input type="text" id="payPoTxnRef" class="form-control" placeholder="e.g. Bank UTR / Reference Number" />
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Notes / Remarks (Optional)</label>
          <input type="text" id="payPoNotes" class="form-control" placeholder="e.g. Part payment for stock shipment" />
        </div>
      </div>
    `,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: '✓ Record Payment',
        class: 'btn-primary',
        onClick: async () => {
          const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
          const amtInp = modalEl?.querySelector('#payPoAmountInput') || document.getElementById('payPoAmountInput');
          const amt = parseFloat(amtInp?.value);
          if (isNaN(amt) || amt <= 0) {
            showToast('Please enter a valid disbursement amount greater than ₹0', 'error');
            return;
          }

          const ref = (modalEl?.querySelector('#payPoTxnRef') || document.getElementById('payPoTxnRef'))?.value.trim() || null;
          const notes = (modalEl?.querySelector('#payPoNotes') || document.getElementById('payPoNotes'))?.value.trim() || null;
          const dtVal = (modalEl?.querySelector('#payPoPaymentTime') || document.getElementById('payPoPaymentTime'))?.value;
          let paymentTime = null;
          if (dtVal) {
            const d = new Date(dtVal);
            if (!isNaN(d.getTime())) paymentTime = d.toISOString();
          }

          try {
            const resp = await purchaseService.pay(po.id, {
              paymentMethod: selectedMode,
              amount: amt,
              transactionRef: ref,
              paymentTime: paymentTime,
              notes: notes
            });

            if (resp?.success) {
              const excess = amt > currentDue ? (amt - currentDue) : 0;
              const supName = po.supplierName || supplier?.name || 'Distributor';
              const msg = excess > 0
                ? `Payment of ${formatCurrency(amt)} recorded (Invoice #${po.invoiceNumber} cleared + ${formatCurrency(excess)} Advance Credit added to Khata)!`
                : `Payment of ${formatCurrency(amt)} recorded for Invoice #${po.invoiceNumber}!`;
              showToast(msg, 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            } else {
              showToast(resp?.message || 'Payment recording failed', 'error');
            }
          } catch (err) {
            console.error('Error paying PO:', err);
            showToast(err.message || 'Payment recording failed', 'error');
          }
        }
      }
    ]
  });

  const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
  const amtInp = modalEl?.querySelector('#payPoAmountInput');
  const fback = modalEl?.querySelector('#payPoAdvanceFeedback');
  const updatePayPoFeedback = () => {
    const amt = parseFloat(amtInp?.value) || 0;
    if (amt > currentDue && fback) {
      fback.style.display = 'block';
      fback.style.color = 'var(--success)';
      const excess = amt - currentDue;
      const supName = po.supplierName || supplier?.name || 'Distributor';
      fback.innerHTML = `ℹ️ <strong>Advance Credit:</strong> ${formatCurrency(currentDue)} will clear this invoice, and <strong>${formatCurrency(excess)}</strong> will be credited as an Advance on ${supName}'s Khata.`;
    } else if (fback) {
      fback.style.display = 'none';
    }
  };
  amtInp?.addEventListener('input', updatePayPoFeedback);
  updatePayPoFeedback();

  modalEl?.querySelectorAll('.pay-po-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMode = btn.dataset.mode;
      modalEl?.querySelectorAll('.pay-po-mode-btn').forEach(b => {
        b.className = b.dataset.mode === selectedMode ? 'btn btn-primary pay-po-mode-btn' : 'btn btn-secondary pay-po-mode-btn';
      });
    });
  });
}

// ── Modal: View Purchase Order Tax Invoice & Payments ───────────────────────
async function openPurchaseDetailModal(po) {
  const modal = showModal({
    title: `Purchase Tax Invoice #${po.invoiceNumber}`,
    size: 'lg',
    body: `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;font-size:0.85rem">
          <div>
            <span style="color:var(--text-muted);display:block;font-size:0.75rem">Distributor / Supplier:</span>
            <strong style="color:var(--text-primary);font-size:0.95rem">🏢 ${po.supplierName || '—'}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted);display:block;font-size:0.75rem">Invoice Number:</span>
            <strong style="color:var(--accent);font-family:var(--font-mono)">${po.invoiceNumber}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted);display:block;font-size:0.75rem">Invoice Date:</span>
            <strong>${formatDate(po.invoiceDate || po.createdAt)}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted);display:block;font-size:0.75rem">Payment Status:</span>
            <span>${po.paymentStatus || 'UNPAID'} (Paid: ${formatCurrency(po.paidAmount || 0)} / Due: ${formatCurrency(po.dueAmount != null ? po.dueAmount : po.totalAmount)})</span>
          </div>
        </div>
      </div>

      <h4 style="font-size:0.95rem;margin:0 0 8px;font-weight:700">Invoice Line Items</h4>
      <div id="poItemsContainer" style="margin-bottom:16px"><div class="spinner" style="margin:20px auto"></div></div>

      <h4 style="font-size:0.95rem;margin:0 0 8px;font-weight:700">Payment Vouchers</h4>
      <div id="poPaymentsContainer"><div class="spinner" style="margin:20px auto"></div></div>
    `,
    buttons: [
      { label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }
    ]
  });

  const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
  const itemsContainer = modalEl?.querySelector('#poItemsContainer');
  const paymentsContainer = modalEl?.querySelector('#poPaymentsContainer');

  try {
    const [itemsResp, paymentsResp] = await Promise.all([
      purchaseService.getItems(po.id),
      purchaseService.getPayments(po.id).catch(() => ({ data: [] }))
    ]);

    const items = itemsResp?.data || [];
    const payments = paymentsResp?.data || [];

    if (itemsContainer) {
      if (!items.length) {
        itemsContainer.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No items found for this invoice.</div>';
      } else {
        itemsContainer.innerHTML = `
          <div class="table-container">
            <table class="data-table" style="font-size:0.85rem">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th style="text-align:right">Qty</th>
                  <th style="text-align:right">Free</th>
                  <th style="text-align:right">Rate</th>
                  <th style="text-align:right">GST</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(it => `
                  <tr>
                    <td><strong>${it.medicineName || '—'}</strong></td>
                    <td><code>${it.batchNumber || '—'}</code></td>
                    <td>${formatDate(it.expiryDate)}</td>
                    <td style="text-align:right">${it.quantity}</td>
                    <td style="text-align:right">${it.freeQuantity || 0}</td>
                    <td style="text-align:right">${formatCurrency(it.costPrice)}</td>
                    <td style="text-align:right">${it.taxPercent || 0}%</td>
                    <td style="text-align:right;font-weight:600">${formatCurrency(it.totalAmount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    if (paymentsContainer) {
      if (!payments.length) {
        paymentsContainer.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No payments recorded for this invoice yet.</div>';
      } else {
        paymentsContainer.innerHTML = `
          <div class="table-container">
            <table class="data-table" style="font-size:0.85rem">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th style="text-align:right">Amount</th>
                  <th>UTR / Ref</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td>${formatDateTime(p.paymentTime || p.createdAt)}</td>
                    <td><span class="badge badge-secondary">${getPaymentModeLabel(p.paymentMethod)}</span></td>
                    <td style="text-align:right;font-weight:700;color:var(--success)">${formatCurrency(p.amount)}</td>
                    <td><code>${p.transactionRef || '—'}</code></td>
                    <td>${p.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

  } catch (e) {
    console.error('Error loading PO details:', e);
  }
}

// ── Modal: Edit Supplier Profile ─────────────────────────────────────────────
function openEditSupplierModal(sup, onSuccess) {
  const fields = [
    { name: 'name', label: 'Supplier / Distributor Name', value: sup.name, required: true },
    { name: 'contactPerson', label: 'Contact Person Name', value: sup.contactPerson },
    { name: 'phone', label: 'Phone Number', value: sup.phone, required: true },
    { name: 'email', label: 'Email Address', type: 'email', value: sup.email },
    { name: 'gstin', label: 'GSTIN Number', value: sup.gstin },
    { name: 'dlNumber', label: 'Drug License (DL) Number', value: sup.dlNumber },
    { name: 'address', label: 'Address / Warehouse Location', type: 'textarea', value: sup.address }
  ];

  const modal = showModal({
    title: `Edit Supplier: ${sup.name}`,
    body: `<form id="editSupForm">${buildFormHtml(fields)}</form>`,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: 'Save Changes',
        class: 'btn-primary',
        onClick: async () => {
          const form = modal.element?.querySelector('#editSupForm') || document.getElementById('editSupForm');
          const data = getFormData(form);
          if (!data.name || !data.phone) {
            showToast('Supplier Name and Phone are required', 'error');
            return;
          }
          try {
            const resp = await supplierService.update(sup.id, data);
            if (resp?.success) {
              showToast('Supplier profile updated successfully', 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            } else {
              showToast(resp?.message || 'Update failed', 'error');
            }
          } catch (err) {
            showToast(err.message || 'Error updating supplier', 'error');
          }
        }
      }
    ]
  });
}

function getPaymentModeLabel(mode) {
  switch (mode) {
    case 'CASH': return '💵 Cash';
    case 'UPI': return '📱 UPI';
    case 'CARD': return '💳 Card';
    case 'NETBANKING': return '🏦 Net Banking';
    default: return mode || '—';
  }
}
