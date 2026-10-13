// js/pages/inventory.js — Inventory & Expiry Management
import { inventoryService } from '../services/inventoryService.js';
import { medicineService } from '../services/medicineService.js';
import { formatCurrency, formatDate, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderInventory(container) {
  let activeTab = 'all';
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Inventory &amp; Batches</h1>
      ${can('manage_inventory') ? '<button class="btn btn-primary" id="addBatchBtn">+ Add Batch</button>' : ''}
    </div>

    <div class="card">
      <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary tab-btn" data-tab="all">All Batches</button>
        <button class="btn btn-sm btn-secondary tab-btn" data-tab="near">⏰ Near Expiry (90d)</button>
        <button class="btn btn-sm btn-secondary tab-btn" data-tab="expired">⚠️ Expired</button>
        <button class="btn btn-sm btn-secondary tab-btn" data-tab="low">📦 Low Stock</button>
      </div>

      <div id="tabToolbar" class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="batchSearchInput" class="form-control" placeholder="Search batch by batch #..." />
        </div>
      </div>

      <div id="inventoryTableContainer"></div>
      <div id="inventoryPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#inventoryTableContainer');
  const paginationContainer = container.querySelector('#inventoryPagination');
  const searchInput = container.querySelector('#batchSearchInput');
  const tabToolbar = container.querySelector('#tabToolbar');
  const addBtn = container.querySelector('#addBatchBtn');
  const tabBtns = container.querySelectorAll('.tab-btn');

  const switchTab = (tab) => {
    activeTab = tab;
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === tab) {
        b.className = 'btn btn-sm btn-primary tab-btn';
      } else {
        b.className = 'btn btn-sm btn-secondary tab-btn';
      }
    });

    if (tab === 'all') {
      tabToolbar.style.display = 'flex';
      loadAllBatches(0, currentSearch);
    } else if (tab === 'near') {
      tabToolbar.style.display = 'none';
      paginationContainer.innerHTML = '';
      loadNearExpiry();
    } else if (tab === 'expired') {
      tabToolbar.style.display = 'none';
      paginationContainer.innerHTML = '';
      loadExpired();
    } else if (tab === 'low') {
      tabToolbar.style.display = 'none';
      paginationContainer.innerHTML = '';
      loadLowStock();
    }
  };

  const batchStatusBadge = (batch) => {
    if (batch.isRetired) return '<span class="badge badge-secondary">Retired</span>';
    const exp = new Date(batch.expiryDate);
    const now = new Date();
    if (exp < now) return '<span class="badge badge-danger">Expired</span>';
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diffDays <= 90) return `<span class="badge badge-warning">Expiring (${diffDays}d)</span>`;
    return '<span class="badge badge-success">Active</span>';
  };

  const loadAllBatches = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading inventory batches...');

    try {
      const resp = await inventoryService.getBatches({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        {
          key: 'medicineName',
          label: 'Medicine',
          render: (val, row) => `<strong>${val || row.itemName || '—'}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>`
        },
        { key: 'batchNumber', label: 'Batch #', render: (val) => `<code style="color:var(--accent);font-weight:700">${val}</code>` },
        { key: 'expiryDate', label: 'Expiry Date', render: (val) => {
          const exp = new Date(val);
          const now = new Date();
          const color = exp < now ? 'var(--danger)' : (exp - now < 90 * 86400000 ? 'var(--warning)' : 'inherit');
          return `<span style="color:${color};font-weight:600">${formatDate(val)}</span>`;
        }},
        {
          key: 'quantity',
          label: 'In Stock',
          render: (val, row) => {
            if (row.unitsPerPack && row.unitsPerPack > 1) {
              const loose = row.looseQuantity || 0;
              const total = row.totalUnits !== undefined ? row.totalUnits : ((val * row.unitsPerPack) + loose);
              return `<strong>${val} pack(s)</strong>${loose > 0 ? ` + <span style="color:var(--accent);font-weight:600">${loose} tab(s)</span>` : ''}<br><small style="color:var(--text-muted)">Total: ${total} tab(s)</small>`;
            }
            return `<strong>${val}</strong>`;
          }
        },
        { key: 'mrp', label: 'MRP', render: (val, row) => {
          if (row.unitsPerPack && row.unitsPerPack > 1) {
            const perTab = (Number(val) / row.unitsPerPack).toFixed(2);
            return `${formatCurrency(val)}<br><small style="color:var(--text-muted)">₹${perTab}/tab</small>`;
          }
          return formatCurrency(val);
        }},
        { key: 'sellingPrice', label: 'Selling Price', render: (val, row) => {
          if (row.unitsPerPack && row.unitsPerPack > 1) {
            const perTab = (Number(val) / row.unitsPerPack).toFixed(2);
            return `${formatCurrency(val)}<br><small style="color:var(--accent)">₹${perTab}/tab</small>`;
          }
          return formatCurrency(val);
        }},
        { key: 'status', label: 'Status', render: (_, row) => batchStatusBadge(row) }
      ];

      const actions = [];
      if (can('manage_inventory')) {
        actions.push({
          label: 'Retire',
          class: 'btn-danger',
          icon: '🛑 Retire',
          onClick: async (batch) => {
            if (batch.isRetired) {
              showToast('Batch is already retired', 'info');
              return;
            }
            const ok = await confirm(`Are you sure you want to retire batch ${batch.batchNumber}? It will no longer be available for dispensing.`, { danger: true });
            if (ok) {
              try {
                const retResp = await inventoryService.retireBatch(batch.id);
                if (retResp?.success) {
                  showToast('Batch retired successfully', 'success');
                  loadAllBatches(currentPage, currentSearch);
                } else {
                  showToast(retResp?.message || 'Retire failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error retiring batch', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions, exportFilename: 'MedStack_Inventory_Batches.csv' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadAllBatches(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading inventory batches');
    }
  };

  const loadNearExpiry = async () => {
    showLoading(tableContainer, 'Checking batches expiring soon...');
    try {
      const resp = await inventoryService.getNearExpiry(90);
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.content ?? []);

      const columns = [
        {
          key: 'medicineName',
          label: 'Medicine',
          render: (val, row) => `<strong>${val || row.itemName || '—'}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>`
        },
        { key: 'batchNumber', label: 'Batch #', render: (val) => `<code style="color:var(--accent)">${val}</code>` },
        { key: 'expiryDate', label: 'Expiry Date', render: (val) => `<span style="color:var(--warning);font-weight:700">${formatDate(val)}</span>` },
        { key: 'quantity', label: 'Current Qty', render: (val) => `<strong>${val}</strong>` },
        { key: 'mrp', label: 'MRP', render: (val) => formatCurrency(val) },
        { key: 'sellingPrice', label: 'Selling Price', render: (val) => formatCurrency(val) },
        { key: 'status', label: 'Status', render: (_, row) => batchStatusBadge(row) }
      ];

      const actions = can('manage_inventory') ? [
        {
          label: 'Retire',
          class: 'btn-danger',
          icon: '🛑 Retire',
          onClick: async (batch) => {
            const ok = await confirm(`Retire near-expiry batch ${batch.batchNumber}?`, { danger: true });
            if (ok) {
              await inventoryService.retireBatch(batch.id);
              showToast('Batch retired', 'success');
              loadNearExpiry();
            }
          }
        }
      ] : [];

      renderTable(tableContainer, columns, items, { actions, exportFilename: 'MedStack_Near_Expiry.csv' });
    } catch (e) {
      showError(tableContainer, 'Error loading near-expiry batches');
    }
  };

  const loadExpired = async () => {
    showLoading(tableContainer, 'Checking expired batches...');
    try {
      const resp = await inventoryService.getExpired();
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.content ?? []);

      const columns = [
        {
          key: 'medicineName',
          label: 'Medicine',
          render: (val, row) => `<strong>${val || row.itemName || '—'}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>`
        },
        { key: 'batchNumber', label: 'Batch #', render: (val) => `<code style="color:var(--danger)">${val}</code>` },
        { key: 'expiryDate', label: 'Expired On', render: (val) => `<span style="color:var(--danger);font-weight:700">${formatDate(val)}</span>` },
        { key: 'quantity', label: 'Unsold Qty', render: (val) => `<strong style="color:var(--danger)">${val}</strong>` },
        { key: 'mrp', label: 'MRP', render: (val) => formatCurrency(val) },
        { key: 'status', label: 'Status', render: (_, row) => batchStatusBadge(row) }
      ];

      const actions = can('manage_inventory') ? [
        {
          label: 'Retire',
          class: 'btn-danger',
          icon: '🛑 Retire',
          onClick: async (batch) => {
            const ok = await confirm(`Retire expired batch ${batch.batchNumber}?`, { danger: true });
            if (ok) {
              await inventoryService.retireBatch(batch.id);
              showToast('Expired batch retired', 'success');
              loadExpired();
            }
          }
        }
      ] : [];

      renderTable(tableContainer, columns, items, { actions, exportFilename: 'MedStack_Expired_Batches.csv' });
    } catch (e) {
      showError(tableContainer, 'Error loading expired batches');
    }
  };

  const loadLowStock = async () => {
    showLoading(tableContainer, 'Checking low stock items...');
    try {
      const resp = await inventoryService.getLowStock();
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.content ?? []);

      const columns = [
        {
          key: 'medicineName',
          label: 'Medicine',
          render: (val, row) => `<strong>${val || row.name || row.itemName || '—'}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>`
        },
        {
          key: 'batchNumber',
          label: 'Batch #',
          render: (val) => val ? `<code style="color:var(--accent);font-weight:700">${val}</code>` : '—'
        },
        {
          key: 'category',
          label: 'Category',
          render: (val) => val ? badge(val, 'info') : '—'
        },
        {
          key: 'rackLocation',
          label: 'Rack',
          render: (val) => val ? `📍 <strong>${val}</strong>` : '—'
        },
        {
          key: 'quantity',
          label: 'In Stock',
          render: (val, row) => {
            const qty = val !== undefined ? val : (row.currentStock ?? 0);
            if (row.unitsPerPack && row.unitsPerPack > 1) {
              const loose = row.looseQuantity || 0;
              const total = row.totalUnits !== undefined ? row.totalUnits : ((qty * row.unitsPerPack) + loose);
              return `<span class="badge badge-danger" style="font-size:0.85rem">${qty} pack(s)</span>${loose > 0 ? ` + <span style="color:var(--accent);font-weight:600">${loose} tab(s)</span>` : ''}<br><small style="color:var(--text-muted)">Total: ${total} tab(s)</small>`;
            }
            return `<span class="badge badge-danger" style="font-size:0.85rem">${qty}</span>`;
          }
        },
        {
          key: 'minStockAlertLevel',
          label: 'Min Alert Level',
          render: (val, row) => `<code>${val !== undefined ? val : (row.minStockAlertLevel ?? '—')}</code>`
        },
        {
          key: 'mrp',
          label: 'MRP',
          render: (val) => val !== undefined ? formatCurrency(val) : '—'
        },
        {
          key: 'status',
          label: 'Status',
          render: () => '<span class="badge badge-danger">⚠️ Low Stock</span>'
        }
      ];

      renderTable(tableContainer, columns, items, { exportFilename: 'MedStack_Low_Stock.csv' });
    } catch (e) {
      showError(tableContainer, 'Error loading low stock items');
    }
  };

  const openAddBatchModal = async () => {
    let medicineOpts = [];
    try {
      const medResp = await medicineService.getAll({ page: 0, size: 50 });
      const meds = medResp?.data?.content ?? medResp?.data ?? [];
      medicineOpts = meds.map(m => ({ value: m.id, label: m.name }));
    } catch (e) {
      console.error(e);
    }

    const fields = [
      { name: 'itemId', label: 'Medicine', type: 'select', required: true, options: medicineOpts },
      { name: 'batchNumber', label: 'Batch Number', required: true, placeholder: 'BAT-2026-01' },
      { name: 'expiryDate', label: 'Expiry Date', type: 'date', required: true },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true },
      { name: 'costPrice', label: 'Cost Price (₹)', type: 'number', required: true },
      { name: 'mrp', label: 'MRP (₹)', type: 'number', required: true },
      { name: 'sellingPrice', label: 'Selling Price (₹)', type: 'number', required: true }
    ];

    const formHtml = `<form id="addBatchForm">${buildFormHtml(fields)}</form>`;
    const modal = showModal({
      title: 'Add Inventory Batch',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Batch',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addBatchForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.quantity = Number(data.quantity) || 0;
            data.costPrice = Number(data.costPrice) || 0;
            data.mrp = Number(data.mrp) || 0;
            data.sellingPrice = Number(data.sellingPrice) || 0;

            try {
              const res = await inventoryService.addBatch(data);
              if (res?.success) {
                showToast('Batch added successfully', 'success');
                modal.close();
                loadAllBatches(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to add batch', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error adding batch', 'error');
            }
          }
        }
      ]
    });
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  if (addBtn) addBtn.addEventListener('click', openAddBatchModal);

  searchInput.addEventListener('input', debounce((e) => {
    const val = e.target.value.trim();
    loadAllBatches(0, val);
  }, 300));

  // Check hash for direct tab target (e.g. #/inventory#low, #/inventory#near, #/inventory#expired)
  const hash = window.location.hash || '';
  const hashParts = hash.split('#');
  const targetTab = hashParts[2];
  if (targetTab && ['near', 'expired', 'low', 'all'].includes(targetTab)) {
    switchTab(targetTab);
  } else {
    loadAllBatches();
  }
}
