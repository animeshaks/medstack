// js/pages/bills.js — Sales Orders / Bills History
import { billService } from '../services/billService.js';
import { settingsService } from '../services/settingsService.js';
import { customerService } from '../services/customerService.js';
import { userService } from '../services/userService.js';
import { medicineService } from '../services/medicineService.js';
import { formatCurrency, formatDate, formatDateTime, extractPage, debounce, showLoading, showError, generateWhatsAppUrl, renderInvoiceHtml, printInvoice, downloadCsv } from '../utils.js';
import { renderTable, statusBadge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

const computeBillDateRange = (preset) => {
  const now = new Date();
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'today') {
    const todayStr = formatYMD(now);
    return { from: todayStr, to: todayStr };
  }
  if (preset === 'week') {
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    return { from: formatYMD(monday), to: formatYMD(now) };
  }
  if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatYMD(firstDay), to: formatYMD(lastDay) };
  }
  if (preset === 'fy') {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    return {
      from: `${startYear}-04-01`,
      to: `${endYear}-03-31`
    };
  }
  return { from: '', to: '' };
};

const toStartOfDayIso = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
};

const toEndOfDayIso = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
};

export default async function renderBills(container, params = {}) {
  if (!params || Object.keys(params).length === 0) {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      params = Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
    }
  }

  let selectedPreset = (params.datePreset || params.preset || 'all').toLowerCase();
  let { from: initialFrom, to: initialTo } = computeBillDateRange(selectedPreset);
  if (params.startDate) initialFrom = params.startDate;
  if (params.endDate) initialTo = params.endDate;
  if (!initialFrom && !initialTo && selectedPreset !== 'all') {
    selectedPreset = 'custom';
  }

  let currentPage = 0;
  let currentSearch = params.search || '';
  let selectedCustomerId = params.customerId || '';
  let selectedUserId = params.userId || '';
  let selectedPaymentStatus = params.paymentStatus || '';
  let startDate = initialFrom || '';
  let endDate = initialTo || '';
  let rxRequiredOnly = params.rxRequiredOnly === 'true' || params.rxRequired === 'true';
  let currentContent = [];
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Sales Orders &amp; Bills</h1>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-secondary" id="exportBillsBtn">📥 Export CSV</button>
        <a href="#/pos" class="btn btn-primary">🖥 New POS Bill</a>
      </div>
    </div>

    <div class="card">
      <div class="toolbar" style="flex-wrap:wrap;gap:10px;align-items:center">
        <!-- Search Box -->
        <div class="search-box" style="flex:1;min-width:200px">
          <span class="search-icon">🔍</span>
          <input type="text" id="billSearchInput" class="form-control" value="${currentSearch}" placeholder="Search by Bill # or customer..." />
        </div>

        <!-- Filter by Customer -->
        <div style="min-width:180px">
          <select id="filterCustomerSelect" class="form-control" style="font-size:0.85rem">
            <option value="">— All Customers —</option>
          </select>
        </div>

        <!-- Filter by Cashier / User -->
        <div style="min-width:160px">
          <select id="filterUserSelect" class="form-control" style="font-size:0.85rem">
            <option value="">— All Cashiers —</option>
          </select>
        </div>

        <!-- Filter by Payment Status -->
        <div style="min-width:150px">
          <select id="filterPaymentStatusSelect" class="form-control" style="font-size:0.85rem">
            <option value="" ${!selectedPaymentStatus ? 'selected' : ''}>— All Payments —</option>
            <option value="PAID" ${selectedPaymentStatus === 'PAID' ? 'selected' : ''}>Paid Only</option>
            <option value="PARTIAL" ${selectedPaymentStatus === 'PARTIAL' ? 'selected' : ''}>Partial Only</option>
            <option value="PENDING" ${selectedPaymentStatus === 'PENDING' ? 'selected' : ''}>Pending (Due Only)</option>
          </select>
        </div>

        <!-- Filter by Rx Required -->
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:0.8rem;font-weight:600;padding:5px 10px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid var(--border);user-select:none" title="Filter bills containing prescription medicines">
          <input type="checkbox" id="filterRxRequired" style="cursor:pointer" ${rxRequiredOnly ? 'checked' : ''} />
          <span>⚕️ Rx Only</span>
        </label>

        <!-- Period Presets -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600">Period:</span>
          <div style="display:flex;gap:4px" id="billDatePresets">
            <button type="button" class="btn btn-sm ${selectedPreset === 'all' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="all">All</button>
            <button type="button" class="btn btn-sm ${selectedPreset === 'today' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="today">Today</button>
            <button type="button" class="btn btn-sm ${selectedPreset === 'week' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="week">This Week</button>
            <button type="button" class="btn btn-sm ${selectedPreset === 'month' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="month">This Month</button>
            <button type="button" class="btn btn-sm ${selectedPreset === 'fy' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="fy">This FY</button>
            <button type="button" class="btn btn-sm ${selectedPreset === 'custom' ? 'btn-primary' : 'btn-secondary'} bill-preset-btn" data-preset="custom">Custom</button>
          </div>
        </div>

        <!-- Date Range Filters -->
        <div id="billDateRangeWrap" style="display:${selectedPreset === 'all' ? 'none' : 'flex'};align-items:center;gap:6px">
          <input type="date" id="filterStartDate" class="form-control" value="${startDate}" style="font-size:0.8rem;padding:4px 8px;width:auto" title="From Date" />
          <span style="font-size:0.8rem;color:var(--text-muted)">to</span>
          <input type="date" id="filterEndDate" class="form-control" value="${endDate}" style="font-size:0.8rem;padding:4px 8px;width:auto" title="To Date" />
        </div>

        <!-- Reset Button -->
        <button type="button" id="btnResetFilters" class="btn btn-secondary btn-sm" title="Clear all filters">✕ Reset</button>
      </div>

      <div id="billTableContainer" style="margin-top:12px"></div>
      <div id="billPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#billTableContainer');
  const paginationContainer = container.querySelector('#billPagination');
  const searchInput = container.querySelector('#billSearchInput');
  const custSelect = container.querySelector('#filterCustomerSelect');
  const userSelect = container.querySelector('#filterUserSelect');
  const paySelect = container.querySelector('#filterPaymentStatusSelect');
  const rxCheck = container.querySelector('#filterRxRequired');
  const dateRangeWrap = container.querySelector('#billDateRangeWrap');
  const startInput = container.querySelector('#filterStartDate');
  const endInput = container.querySelector('#filterEndDate');
  const resetBtn = container.querySelector('#btnResetFilters');
  const presetBtns = container.querySelectorAll('.bill-preset-btn');

  // Populate Customers & Users in background
  try {
    const [custResp, userResp] = await Promise.all([
      customerService.getAll({ page: 0, size: 100 }).catch(() => null),
      userService.getAll({ page: 0, size: 50 }).catch(() => null)
    ]);
    const customers = custResp?.data?.content ?? custResp?.data ?? [];
    const users = userResp?.data?.content ?? userResp?.data ?? [];

    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.phone || 'No phone'})`;
      if (selectedCustomerId && c.id === selectedCustomerId) {
        opt.selected = true;
      }
      custSelect.appendChild(opt);
    });

    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.fullName || u.username} (${u.role})`;
      if (selectedUserId && u.id === selectedUserId) {
        opt.selected = true;
      }
      userSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn('Could not populate filter options', e);
  }

  const loadData = async (page = 0) => {
    currentPage = page;
    showLoading(tableContainer, 'Loading bills...');

    try {
      const resp = await billService.getAll({
        page,
        size: pageSize,
        search: currentSearch,
        customerId: selectedCustomerId || null,
        userId: selectedUserId || null,
        paymentStatus: selectedPaymentStatus || null,
        rxRequiredOnly: rxRequiredOnly ? true : null,
        startDate: toStartOfDayIso(startDate),
        endDate: toEndOfDayIso(endDate)
      });
      let { content, page: pageMeta } = extractPage(resp);
      if (rxRequiredOnly) {
        content = content.filter(b => Boolean(b.rxRequired));
      }
      currentContent = content;

      const columns = [
        {
          key: 'billNumber',
          label: 'Bill #',
          render: (val, row) => `
            <div style="display:flex;align-items:center;gap:6px">
              <strong style="color:var(--accent);font-family:var(--font-mono)">${val}</strong>
              ${row.rxRequired ? '<span class="badge badge-warning" style="font-size:0.65rem;padding:2px 5px" title="Prescription Required Medicine Included">⚕️ Rx</span>' : ''}
            </div>
          `
        },
        { key: 'createdAt', label: 'Date & Time', render: (val) => formatDateTime(val) },
        { key: 'customerName', label: 'Customer', render: (val) => `<span style="font-weight:600;color:var(--text-primary)">${val || 'Walk-in Customer'}</span>` },
        { key: 'createdBy', label: 'Cashier', render: (val) => `<span style="color:var(--text-muted);font-size:0.8rem">${val || 'Staff'}</span>` },
        { key: 'totalAmount', label: 'Subtotal', render: (val) => formatCurrency(val) },
        { key: 'discountAmount', label: 'Discount', render: (val) => val > 0 ? `<span style="color:var(--danger)">-${formatCurrency(val)}</span>` : '—' },
        { key: 'grandTotal', label: 'Grand Total', render: (val) => `<strong>${formatCurrency(val)}</strong>` },
        { key: 'paidAmount', label: 'Paid', render: (val, row) => `<span style="color:var(--text-primary)">${formatCurrency(val != null ? val : (row.paymentStatus === 'PENDING' ? 0 : row.grandTotal))}</span>` },
        { key: 'dueAmount', label: 'Due', render: (val, row) => {
          const due = val != null ? val : (row.paymentStatus === 'PAID' ? 0 : Math.max(0, (row.grandTotal || 0) - (row.paidAmount || 0)));
          return due > 0 ? `<strong style="color:var(--danger)">${formatCurrency(due)}</strong>` : '<span style="color:var(--text-muted)">₹0.00</span>';
        } },
        { key: 'paymentStatus', label: 'Payment', render: (val) => statusBadge(val) },
        { key: 'orderStatus', label: 'Status', render: (val) => statusBadge(val) }
      ];

      const actions = [
        {
          label: 'View',
          class: 'btn-secondary',
          icon: '🧾 View Bill',
          onClick: (bill) => openBillModal(bill)
        }
      ];

      renderTable(tableContainer, columns, content, { actions, exportFilename: 'MedStack_Bills.csv' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading bills');
    }
  };

  const exportBtn = container.querySelector('#exportBillsBtn');
  exportBtn?.addEventListener('click', () => {
    downloadCsv('MedStack_Bills.csv', [
      { key: 'billNumber', label: 'Bill #' },
      { key: 'createdAt', label: 'Date & Time' },
      { key: 'customerName', label: 'Customer' },
      { key: 'createdBy', label: 'Cashier' },
      { key: 'totalAmount', label: 'Subtotal' },
      { key: 'discountAmount', label: 'Discount' },
      { key: 'grandTotal', label: 'Grand Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'dueAmount', label: 'Due' },
      { key: 'paymentStatus', label: 'Payment Status' },
      { key: 'rxRequired', label: 'Rx Required', render: (val) => val ? 'Yes' : 'No' }
    ], currentContent);
  });

  // ── Open View Bill Modal ───────────────────────────────────────────────────
  const openBillModal = async (initialBill) => {
    const modal = showModal({
      title: `Invoice: ${initialBill.billNumber}`,
      size: 'lg',
      body: `
        <div id="billDetailsBody" style="min-height:200px;display:flex;align-items:center;justify-content:center">
          <div class="spinner"></div>
        </div>
      `,
      buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }]
    });

    try {
      const [resp, settings] = await Promise.all([
        billService.getById(initialBill.id),
        settingsService.getSettings()
      ]);
      const bill = resp?.data || initialBill;
      const waUrl = generateWhatsAppUrl(bill, settings);
      const detailsBody = document.querySelector('#billDetailsBody');
      if (!detailsBody) return;

      // Check return period (7 days)
      const createdAt = new Date(bill.createdAt);
      const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isReturnAllowed = daysOld <= 7 && bill.orderStatus !== 'CANCELLED';

      detailsBody.innerHTML = `
        <div style="width:100%">
          ${renderInvoiceHtml(bill, settings)}
          <div style="display:flex;gap:12px;justify-content:center;align-items:center;margin-top:16px;width:100%;flex-wrap:wrap">
            <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Share via WhatsApp</a>
            <button id="btnPrintInvoiceModal" class="btn btn-primary">🖨️ Print Tax Invoice</button>
            ${can('edit_bills') ? (
              isReturnAllowed
                ? `<button id="btnEditBillModal" class="btn btn-warning">✏️ Update / Edit Bill</button>`
                : `<span class="badge badge-secondary" title="Medicines can only be returned within 7 days">Return Expired (${daysOld}d ago)</span>`
            ) : ''}
          </div>
        </div>
      `;

      document.getElementById('btnPrintInvoiceModal')?.addEventListener('click', () => {
        printInvoice(bill, settings);
      });

      document.getElementById('btnEditBillModal')?.addEventListener('click', () => {
        modal.close();
        openEditBillModal(bill);
      });
    } catch (err) {
      console.error(err);
      const detailsBody = document.querySelector('#billDetailsBody');
      if (detailsBody) detailsBody.innerHTML = '<div style="color:var(--danger)">Failed to load bill details.</div>';
    }
  };

  // ── Open Edit / Update Bill Modal (Requirement 2) ──────────────────────────
  const openEditBillModal = (bill) => {
    // Clone items for editing
    let editItems = (bill.items || []).map(i => ({
      medicineId: i.medicineId,
      medicineName: i.medicineName,
      batchNumber: i.batchNumber,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      taxRate: i.taxRate != null ? Number(i.taxRate) : 5,
      dispenseUnit: i.dispenseUnit || 'UNIT',
      packSize: i.packSize || 1,
    }));
    let editDiscount = Number(bill.discountAmount) || 0;

    const modal = showModal({
      title: `Update Bill — ${bill.billNumber}`,
      size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius);font-size:0.85rem">
            <strong>Customer:</strong> ${bill.customerName || 'Walk-in Customer'} · 
            <strong>Created:</strong> ${formatDateTime(bill.createdAt)}
            <div style="font-size:0.75rem;color:var(--warning);margin-top:4px">
              ℹ️ Updating this bill will reverse original inventory deductions and re-allocate stock based on your modified cart.
            </div>
          </div>

          <!-- Items Table -->
          <div class="table-container" style="max-height:220px;overflow-y:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th style="text-align:center">Batch</th>
                  <th style="text-align:right">Rate</th>
                  <th style="text-align:center">GST</th>
                  <th style="text-align:center">Qty</th>
                  <th style="text-align:right">Subtotal</th>
                  <th style="text-align:center">Remove</th>
                </tr>
              </thead>
              <tbody id="editItemsTableBody"></tbody>
            </table>
          </div>

          <!-- Financial summary -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
            <div>
              <label class="form-label" style="font-size:0.8rem">Discount Amount (₹)</label>
              <input type="number" id="editDiscountInput" class="form-control" value="${editDiscount}" min="0" step="0.01" style="font-size:0.9rem" />
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;justify-content:center">
              <span style="font-size:0.8rem;color:var(--text-muted)">REVISED GRAND TOTAL</span>
              <span id="editGrandTotalDisplay" style="font-size:1.4rem;font-weight:800;color:var(--accent)">₹0.00</span>
            </div>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save & Update Bill',
          class: 'btn-primary',
          id: 'btnSaveBillEdit',
          onClick: async () => {
            if (editItems.length === 0) {
              showToast('Bill cannot be empty. At least one item is required.', 'warning');
              return;
            }
            const saveBtn = document.getElementById('btnSaveBillEdit');
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.textContent = 'Saving changes...';
            }

            try {
              const payload = {
                customerId: bill.customerId || null,
                prescribingDoctorId: bill.prescribingDoctorId || null,
                discountAmount: editDiscount,
                items: editItems.map(it => ({
                  medicineId: it.medicineId,
                  quantity: it.quantity,
                  dispenseUnit: it.dispenseUnit
                }))
              };

              const resp = await billService.update(bill.id, payload);
              if (resp?.success) {
                showToast('Bill updated successfully! Inventory has been adjusted.', 'success');
                modal.close();
                loadData(currentPage);
              } else {
                showToast(resp?.message || 'Failed to update bill', 'error');
                if (saveBtn) {
                  saveBtn.disabled = false;
                  saveBtn.textContent = 'Save & Update Bill';
                }
              }
            } catch (err) {
              showToast(err.message || 'Error updating bill', 'error');
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save & Update Bill';
              }
            }
          }
        }
      ]
    });

    const renderEditRows = () => {
      const tbody = document.getElementById('editItemsTableBody');
      if (!tbody) return;

      if (editItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No items remaining in bill.</td></tr>';
        updateEditTotals();
        return;
      }

      tbody.innerHTML = editItems.map((it, idx) => `
        <tr>
          <td><strong>${it.medicineName}</strong></td>
          <td style="text-align:center"><code>${it.batchNumber}</code></td>
          <td style="text-align:right">₹${it.unitPrice.toFixed(2)}</td>
          <td style="text-align:center"><span class="badge ${Number(it.taxRate) === 0 ? 'badge-success' : 'badge-secondary'}" style="font-size:0.7rem;font-weight:700">${it.taxRate != null ? it.taxRate : 5}%</span></td>
          <td style="text-align:center">
            <div style="display:flex;align-items:center;justify-content:center;gap:4px">
              <button type="button" class="btn btn-secondary btn-sm" data-edit-dec="${idx}" style="padding:2px 6px">−</button>
              <input type="number" class="form-control" data-edit-qty="${idx}" value="${it.quantity}" min="1" max="9999"
                style="width:50px;text-align:center;padding:2px 4px;font-size:0.85rem;font-weight:700" />
              <button type="button" class="btn btn-secondary btn-sm" data-edit-inc="${idx}" style="padding:2px 6px">+</button>
              <span style="font-size:0.75rem;color:var(--text-muted)">${it.dispenseUnit ? it.dispenseUnit.toLowerCase() : 'units'}</span>
            </div>
          </td>
          <td style="text-align:right"><strong>${formatCurrency(it.unitPrice * it.quantity)}</strong></td>
          <td style="text-align:center">
            <button type="button" class="btn btn-sm btn-danger" data-edit-del="${idx}" style="padding:2px 6px">✕</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit-inc]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-edit-inc'));
          editItems[idx].quantity += 1;
          renderEditRows();
        });
      });

      tbody.querySelectorAll('[data-edit-dec]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-edit-dec'));
          if (editItems[idx].quantity > 1) {
            editItems[idx].quantity -= 1;
            renderEditRows();
          }
        });
      });

      tbody.querySelectorAll('[data-edit-qty]').forEach(inp => {
        inp.addEventListener('change', () => {
          const idx = parseInt(inp.getAttribute('data-edit-qty'));
          const val = parseInt(inp.value) || 1;
          editItems[idx].quantity = Math.max(1, val);
          renderEditRows();
        });
      });

      tbody.querySelectorAll('[data-edit-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-edit-del'));
          editItems.splice(idx, 1);
          renderEditRows();
        });
      });

      updateEditTotals();
    };

    const updateEditTotals = () => {
      let taxableSubtotalSum = 0;
      let totalTax = 0;
      editItems.forEach(it => {
        const rate = Number(it.taxRate != null ? it.taxRate : 5);
        const lineTaxable = (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
        const lineTax = lineTaxable * (rate / 100);
        taxableSubtotalSum += lineTaxable;
        totalTax += lineTax;
      });
      const unrounded = Math.max(0, taxableSubtotalSum + totalTax - editDiscount);
      const grand = Math.floor(unrounded);
      const el = document.getElementById('editGrandTotalDisplay');
      if (el) el.textContent = formatCurrency(grand);
    };

    document.getElementById('editDiscountInput')?.addEventListener('input', (e) => {
      editDiscount = Math.max(0, parseFloat(e.target.value) || 0);
      updateEditTotals();
    });

    renderEditRows();
  };

  // Wire search input
  searchInput?.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim();
    loadData(0);
  }, 300));

  // Wire Customer filter
  custSelect?.addEventListener('change', (e) => {
    selectedCustomerId = e.target.value;
    loadData(0);
  });

  // Wire Cashier / User filter
  userSelect?.addEventListener('change', (e) => {
    selectedUserId = e.target.value;
    loadData(0);
  });

  // Wire Payment Status filter
  paySelect?.addEventListener('change', (e) => {
    selectedPaymentStatus = e.target.value;
    loadData(0);
  });

  const updatePresetUI = (preset) => {
    selectedPreset = preset;
    presetBtns.forEach(btn => {
      const p = btn.getAttribute('data-preset');
      if (p === preset) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });
    if (preset === 'all') {
      if (dateRangeWrap) dateRangeWrap.style.display = 'none';
    } else {
      if (dateRangeWrap) dateRangeWrap.style.display = 'flex';
    }
  };

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      updatePresetUI(p);
      if (p === 'all') {
        startDate = '';
        endDate = '';
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        if (window.location.hash.includes('?')) history.replaceState(null, '', '#/bills');
        loadData(0);
      } else if (p === 'custom') {
        // Just show date inputs, let user pick
      } else {
        const range = computeBillDateRange(p);
        startDate = range.from;
        endDate = range.to;
        if (startInput) startInput.value = startDate;
        if (endInput) endInput.value = endDate;
        loadData(0);
      }
    });
  });

  // Wire Date range filters
  startInput?.addEventListener('change', (e) => {
    startDate = e.target.value;
    updatePresetUI('custom');
    loadData(0);
  });

  endInput?.addEventListener('change', (e) => {
    endDate = e.target.value;
    updatePresetUI('custom');
    loadData(0);
  });

  // Wire Rx Required filter
  rxCheck?.addEventListener('change', (e) => {
    rxRequiredOnly = e.target.checked;
    loadData(0);
  });

  // Wire Reset button
  resetBtn?.addEventListener('click', () => {
    currentSearch = '';
    selectedCustomerId = '';
    selectedUserId = '';
    selectedPaymentStatus = '';
    startDate = '';
    endDate = '';
    rxRequiredOnly = false;
    if (searchInput) searchInput.value = '';
    if (custSelect) custSelect.value = '';
    if (userSelect) userSelect.value = '';
    if (paySelect) paySelect.value = '';
    if (rxCheck) rxCheck.checked = false;
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    updatePresetUI('all');
    if (window.location.hash.includes('?')) {
      history.replaceState(null, '', '#/bills');
    }
    loadData(0);
  });

  loadData();
}
