// js/pages/customers.js — Customer Management & Purchase History
import { customerService } from '../services/customerService.js';
import { billService } from '../services/billService.js';
import { settingsService } from '../services/settingsService.js';
import { formatCurrency, formatDateTime, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError, renderInvoiceHtml, generateWhatsAppUrl, printInvoice } from '../utils.js';
import { renderTable, statusBadge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderCustomers(container) {
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Customers</h1>
      <div class="page-actions" style="position:relative;display:flex;gap:10px;align-items:center">
        <div style="position:relative;width:320px">
          <input type="text" id="customerSearchInput" class="form-control" placeholder="Search mobile, name, email..." style="width:100%" autocomplete="off" />
          <div id="customerAutoSuggestDropdown" class="pos-search-results" style="display:none;width:100%;max-height:360px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.4)"></div>
        </div>
        <button class="btn btn-primary" id="addCustomerBtn">+ Add Customer</button>
      </div>
    </div>

    <div class="card">
      <div id="customerTableContainer"></div>
      <div id="customerPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#customerTableContainer');
  const paginationContainer = container.querySelector('#customerPagination');
  const searchInput = container.querySelector('#customerSearchInput');
  const autoSuggestDropdown = container.querySelector('#customerAutoSuggestDropdown');
  const addBtn = container.querySelector('#addCustomerBtn');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading customers...');

    try {
      const resp = await customerService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        {
          key: 'name',
          label: 'Customer Name',
          render: (val, row) => `
            <a href="#/customer-detail?id=${row.id}" style="font-weight:700;color:var(--accent);text-decoration:none;cursor:pointer" title="View Customer Profile & Purchases">
              👤 ${val}
            </a>
          `
        },
        { key: 'phone', label: 'Phone Number', render: (val) => val ? `<a href="tel:${val}" style="color:var(--text-primary);text-decoration:none">📞 ${val}</a>` : '—' },
        { key: 'email', label: 'Email', render: (val) => val ? `<a href="mailto:${val}" style="color:var(--text-muted);text-decoration:none">${val}</a>` : '—' },
        { key: 'address', label: 'Address', render: (val) => val || '—' },
        {
          key: 'rewardPoints',
          label: 'Reward Points',
          render: (val) => `<span class="badge badge-success">★ ${val || 0} pts</span>`
        },
        {
          key: 'outstandingBalance',
          label: 'Due Balance',
          render: (val) => (Number(val) || 0) > 0 
            ? `<span class="badge badge-danger">Due: ${formatCurrency(val)}</span>` 
            : `<span class="badge badge-secondary" style="color:var(--text-muted)">₹0.00</span>`
        }
      ];

      const actions = [
        {
          label: 'Details',
          class: 'btn-primary',
          icon: '👤 Details & Purchases',
          onClick: (cust) => {
            window.location.hash = `#/customer-detail?id=${cust.id}`;
          }
        },
        {
          label: 'Purchases',
          class: 'btn-secondary',
          icon: '🧾 Quick History',
          onClick: (cust) => openPurchasesModal(cust)
        }
      ];

      if (can('manage_customers')) {
        actions.push({
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️ Edit',
          onClick: (cust) => openEditModal(cust)
        });
        actions.push({
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (cust) => {
            const ok = await confirm(`Are you sure you want to delete customer "${cust.name}"?`, { danger: true });
            if (ok) {
              try {
                const delResp = await customerService.delete(cust.id);
                if (delResp?.success) {
                  showToast('Customer deleted', 'success');
                  loadData(currentPage, currentSearch);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting customer', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading customers');
    }
  };

  // ── Customer Purchase History Modal ─────────────────────────────────────────
  const openPurchasesModal = async (cust) => {
    const modal = showModal({
      title: `Purchase History: ${cust.name}`,
      size: 'lg',
      body: `
        <div id="custPurchasesBody">
          <!-- Customer Profile Bar -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;padding:12px 16px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:16px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Phone</div>
              <strong style="color:var(--text-primary)">${cust.phone || 'No phone'}</strong>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Email</div>
              <div style="color:var(--text-primary);font-size:0.85rem">${cust.email || '—'}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Reward Points</div>
              <strong style="color:var(--accent);font-size:1.05rem">★ ${cust.rewardPoints || 0} pts</strong>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Total Spent</div>
              <strong id="custTotalSpent" style="color:var(--text-primary);font-size:1.05rem">Calculating...</strong>
            </div>
          </div>

          <h4 style="margin:0 0 10px;font-size:0.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px">
            Past Invoices & Bills
          </h4>

          <div id="custBillsTableContainer" style="min-height:160px;display:flex;align-items:center;justify-content:center">
            <div class="spinner"></div>
          </div>
        </div>
      `,
      buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }]
    });

    try {
      const resp = await billService.getAll({ customerId: cust.id, size: 50, sort: 'createdAt,desc' });
      const bills = resp?.data?.content || resp?.data || [];
      const tableBox = document.querySelector('#custBillsTableContainer');
      const totalSpentEl = document.querySelector('#custTotalSpent');
      if (!tableBox) return;

      const totalSpent = bills.reduce((acc, b) => acc + (Number(b.grandTotal) || 0), 0);
      if (totalSpentEl) totalSpentEl.textContent = formatCurrency(totalSpent);

      if (!bills.length) {
        tableBox.innerHTML = `
          <div style="text-align:center;padding:30px 10px;color:var(--text-muted)">
            <div style="font-size:2rem;margin-bottom:8px">🧾</div>
            <div style="font-weight:600">No purchases found</div>
            <div style="font-size:0.8rem;margin-top:4px">This customer has not made any purchases yet.</div>
          </div>
        `;
        return;
      }

      tableBox.style.display = 'block';
      tableBox.innerHTML = `
        <div class="table-container" style="max-height:320px;overflow-y:auto">
          <table class="data-table" style="font-size:0.85rem">
            <thead>
              <tr style="position:sticky;top:0;background:var(--bg-tertiary);z-index:2">
                <th>Bill #</th>
                <th>Date & Time</th>
                <th>Prescribing Doctor</th>
                <th style="text-align:right">Subtotal</th>
                <th style="text-align:right">Discount</th>
                <th style="text-align:right">Grand Total</th>
                <th>Payment</th>
                <th style="text-align:center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${bills.map(b => `
                <tr>
                  <td><strong style="color:var(--accent);font-family:var(--font-mono)">${b.billNumber}</strong></td>
                  <td>${formatDateTime(b.createdAt)}</td>
                  <td>${b.prescribingDoctorName || 'Self / OTC'}</td>
                  <td style="text-align:right">${formatCurrency(b.totalAmount)}</td>
                  <td style="text-align:right">${b.discountAmount > 0 ? `<span style="color:var(--danger)">-${formatCurrency(b.discountAmount)}</span>` : '—'}</td>
                  <td style="text-align:right"><strong>${formatCurrency(b.grandTotal)}</strong></td>
                  <td>${statusBadge(b.paymentStatus || 'PAID')}</td>
                  <td style="text-align:center">
                    <button type="button" class="btn btn-sm btn-secondary view-cust-bill-btn" data-id="${b.id}" style="padding:3px 8px;font-size:0.75rem">
                      👁️ View Bill
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Attach view bill click handler
      tableBox.querySelectorAll('.view-cust-bill-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const billId = btn.dataset.id;
          await openSingleBillModal(billId);
        });
      });

    } catch (err) {
      console.error(err);
      const tableBox = document.querySelector('#custBillsTableContainer');
      if (tableBox) showError(tableBox, 'Error loading customer purchase history');
    }
  };

  // ── Open Single Bill Invoice Modal ──────────────────────────────────────────
  const openSingleBillModal = async (billId) => {
    const invModal = showModal({
      title: 'Tax Invoice Details',
      size: 'lg',
      body: '<div style="display:flex;align-items:center;justify-content:center;min-height:200px"><div class="spinner"></div></div>',
      buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => invModal.close() }]
    });

    const modalEl = invModal.element || invModal.el || document.querySelector('.modal-overlay:last-child');

    try {
      const [resp, settings] = await Promise.all([
        billService.getById(billId),
        settingsService.getSettings()
      ]);
      const bill = resp?.data;
      if (!bill) throw new Error('Bill not found');

      const waUrl = generateWhatsAppUrl(bill, settings);
      const bodyEl = modalEl?.querySelector('.modal-body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="width:100%">
            ${renderInvoiceHtml(bill, settings)}
            <div style="display:flex;gap:12px;justify-content:center;align-items:center;margin-top:16px;flex-wrap:wrap">
              <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Share via WhatsApp</a>
              <button id="btnPrintCustInvoice" class="btn btn-primary">🖨️ Print Tax Invoice</button>
            </div>
          </div>
        `;
      }

      modalEl?.querySelector('#btnPrintCustInvoice')?.addEventListener('click', () => {
        printInvoice(bill, settings);
      });
    } catch (e) {
      console.error(e);
      const bodyEl = modalEl?.querySelector('.modal-body');
      if (bodyEl) {
        bodyEl.innerHTML = '<div class="alert alert-danger">Error loading invoice details</div>';
      }
    }
  };

  const customerFields = [
    { name: 'name', label: 'Full Name', required: true },
    { name: 'phone', label: 'Phone Number (10 digits)', required: true, placeholder: '9810012301' },
    { name: 'email', label: 'Email Address', type: 'email' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'rewardPoints', label: 'Reward Points', type: 'number' }
  ];

  const openAddModal = () => {
    const formHtml = `<form id="addCustForm">${buildFormHtml(customerFields, { rewardPoints: 0 })}</form>`;
    const modal = showModal({
      title: 'Register New Customer',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Customer',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addCustForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.rewardPoints = Number(data.rewardPoints) || 0;

            try {
              const res = await customerService.create(data);
              if (res?.success) {
                showToast('Customer registered successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to register customer', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error registering customer', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (cust) => {
    const formHtml = `<form id="editCustForm">${buildFormHtml(customerFields, cust)}</form>`;
    const modal = showModal({
      title: `Edit Customer: ${cust.name}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editCustForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.rewardPoints = Number(data.rewardPoints) || 0;

            try {
              const res = await customerService.update(cust.id, data);
              if (res?.success) {
                showToast('Customer updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(res?.message || 'Failed to update customer', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating customer', 'error');
            }
          }
        }
      ]
    });
  };

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  // ── Auto-suggest search for Mobile, Name & Email ─────────────────────────────
  let activeSuggestIndex = -1;

  const handleSearch = debounce(async (val) => {
    // Filter the primary table
    loadData(0, val);

    if (val.length < 2) {
      if (autoSuggestDropdown) autoSuggestDropdown.style.display = 'none';
      activeSuggestIndex = -1;
      return;
    }

    if (!autoSuggestDropdown) return;
    autoSuggestDropdown.style.display = 'block';
    autoSuggestDropdown.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.8rem">Searching matching customers...</div>';

    try {
      const resp = await customerService.getAll({ page: 0, size: 8, search: val });
      const items = resp?.data?.content || resp?.data || [];

      if (!items.length) {
        autoSuggestDropdown.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--text-muted);font-size:0.8rem">No matching customers found</div>';
        return;
      }

      autoSuggestDropdown.innerHTML = items.map((c, i) => `
        <div class="pos-result-item cust-suggest-item" data-idx="${i}" style="padding:9px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.15s">
          <div>
            <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary)">
              ${c.name}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;gap:10px;margin-top:2px">
              <span>📞 <strong>${c.phone || 'No phone'}</strong></span>
              ${c.email ? `<span>✉️ ${c.email}</span>` : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--accent)">★ ${c.rewardPoints || 0} pts</div>
            ${(c.outstandingBalance || 0) > 0 
              ? `<span class="badge badge-danger" style="font-size:0.65rem">Due: ${formatCurrency(c.outstandingBalance)}</span>` 
              : '<span class="badge badge-success" style="font-size:0.65rem">Clear</span>'}
          </div>
        </div>
      `).join('');

      autoSuggestDropdown.querySelectorAll('.cust-suggest-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          autoSuggestDropdown.style.display = 'none';
          window.location.hash = `#/customer-detail?id=${items[i].id}`;
        });
      });
    } catch (err) {
      console.error(err);
      autoSuggestDropdown.innerHTML = '<div class="pos-result-item" style="color:var(--danger);font-size:0.8rem">Error fetching suggestions</div>';
    }
  }, 250);

  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value.trim());
  });

  searchInput.addEventListener('keydown', (e) => {
    if (!autoSuggestDropdown || autoSuggestDropdown.style.display === 'none') return;
    const items = autoSuggestDropdown.querySelectorAll('.cust-suggest-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestIndex = (activeSuggestIndex + 1) % items.length;
      updateActiveSuggest(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestIndex = (activeSuggestIndex - 1 + items.length) % items.length;
      updateActiveSuggest(items);
    } else if (e.key === 'Enter') {
      if (activeSuggestIndex >= 0 && activeSuggestIndex < items.length) {
        e.preventDefault();
        items[activeSuggestIndex].click();
      }
    } else if (e.key === 'Escape') {
      autoSuggestDropdown.style.display = 'none';
      activeSuggestIndex = -1;
    }
  });

  function updateActiveSuggest(items) {
    items.forEach((it, idx) => {
      if (idx === activeSuggestIndex) {
        it.style.background = 'var(--bg-tertiary)';
        it.style.borderLeft = '3px solid var(--accent)';
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.style.background = '';
        it.style.borderLeft = '';
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !autoSuggestDropdown.contains(e.target)) {
      autoSuggestDropdown.style.display = 'none';
      activeSuggestIndex = -1;
    }
  });

  loadData();
}
