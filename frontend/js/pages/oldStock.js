// js/pages/oldStock.js — Opening & Old Stock Management
import { oldStockService } from '../services/oldStockService.js';
import { medicineService } from '../services/medicineService.js';
import { formatCurrency, formatDate, extractPage, debounce, showLoading, showError } from '../utils.js';
import { renderTable } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default async function renderOldStock(container) {
  if (!can('manage_old_stock')) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <div class="empty-text" style="color:var(--danger)">Access Denied: Opening Stock management is restricted to Owner/Admin.</div>
      </div>`;
    return;
  }

  let currentPage = 0;
  let currentSearch = '';
  let currentStatus = 'ALL'; // 'ALL' | 'ACTIVE' | 'CLEARED'
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <h1 class="page-title" style="margin:0">Opening &amp; Old Stock</h1>
          <span class="badge badge-info" style="font-size:0.75rem">Owner / Admin Only</span>
        </div>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;margin-bottom:0">
          Maintain existing inventory when migrating a running pharmacy to MedStack. Old stocks are prioritized via FIFO and clear out automatically as dispensed.
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary btn-sm" id="downloadTemplateBtn">
          📥 Download CSV Template
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="bulkUploadCsvBtn">
          📤 Bulk CSV Upload
        </button>
        <button type="button" class="btn btn-primary" id="addOldStockBtn">
          + Add Old Stock
        </button>
      </div>
    </div>

    <!-- Summary KPIs -->
    <div id="oldStockKpiContainer" class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card">
        <div class="kpi-icon">🏛️</div>
        <div class="kpi-value" id="kpiTotalBatches">—</div>
        <div class="kpi-label">Total Old Stock Batches</div>
      </div>
      <div class="kpi-card kpi-success">
        <div class="kpi-icon">📦</div>
        <div class="kpi-value" id="kpiActiveBatches">—</div>
        <div class="kpi-label">In-Stock (Active)</div>
      </div>
      <div class="kpi-card kpi-info">
        <div class="kpi-icon">✅</div>
        <div class="kpi-value" id="kpiClearedBatches">—</div>
        <div class="kpi-label">Cleared / Depleted</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value" id="kpiTotalMrpValue">—</div>
        <div class="kpi-label">Remaining Stock Value (MRP)</div>
      </div>
    </div>

    <div class="card">
      <!-- Status Tabs & Filter Toolbar -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
        <div style="display:flex;gap:6px" id="stockStatusTabs">
          <button type="button" class="btn btn-sm btn-primary status-tab-btn" data-status="ALL">All Batches</button>
          <button type="button" class="btn btn-sm btn-secondary status-tab-btn" data-status="ACTIVE">📦 In-Stock Only</button>
          <button type="button" class="btn btn-sm btn-secondary status-tab-btn" data-status="CLEARED">✅ Cleared (0 Qty)</button>
        </div>

        <div class="search-box" style="flex:1;min-width:240px;max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="oldStockSearchInput" class="form-control" placeholder="Search by medicine, generic name, or batch #..." />
        </div>
      </div>

      <div id="oldStockTableContainer"></div>
      <div id="oldStockPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#oldStockTableContainer');
  const paginationContainer = container.querySelector('#oldStockPagination');
  const searchInput = container.querySelector('#oldStockSearchInput');
  const statusTabs = container.querySelectorAll('.status-tab-btn');
  const addBtn = container.querySelector('#addOldStockBtn');
  const downloadTemplateBtn = container.querySelector('#downloadTemplateBtn');
  const bulkUploadBtn = container.querySelector('#bulkUploadCsvBtn');

  // Load KPI Summary
  const loadSummary = async () => {
    try {
      const resp = await oldStockService.getSummary();
      const s = resp?.data || {};
      const elTotal = container.querySelector('#kpiTotalBatches');
      const elActive = container.querySelector('#kpiActiveBatches');
      const elCleared = container.querySelector('#kpiClearedBatches');
      const elValue = container.querySelector('#kpiTotalMrpValue');

      if (elTotal) elTotal.textContent = s.totalBatches ?? 0;
      if (elActive) elActive.textContent = s.activeBatches ?? 0;
      if (elCleared) elCleared.textContent = s.clearedBatches ?? 0;
      if (elValue) elValue.textContent = formatCurrency(s.totalMrpValue || 0);
    } catch (e) {
      console.warn('Could not load old stock summary', e);
    }
  };

  // Load Data Table
  const loadData = async (page = 0) => {
    currentPage = page;
    showLoading(tableContainer, 'Loading opening stock batches...');

    try {
      const resp = await oldStockService.getAll({
        page,
        size: pageSize,
        search: currentSearch,
        status: currentStatus
      });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        {
          key: 'medicineName',
          label: 'Medicine',
          render: (val, row) => `
            <div>
              <strong style="color:var(--text-primary)">${val}</strong>
              ${row.genericName ? `<div style="font-size:0.75rem;color:var(--text-muted)">${row.genericName}</div>` : ''}
              ${row.category ? `<span class="badge" style="font-size:0.65rem;background:var(--bg-tertiary);margin-top:2px">${row.category}</span>` : ''}
            </div>`
        },
        {
          key: 'batchNumber',
          label: 'Batch # & Label',
          render: (val, row) => `
            <div>
              <strong style="color:var(--accent);font-family:var(--font-mono)">${val}</strong>
              <div style="margin-top:3px">
                <span class="badge badge-info" style="font-size:0.7rem;padding:2px 6px" title="Legacy Opening Stock">🏛️ Old Stock</span>
              </div>
            </div>`
        },
        {
          key: 'expiryDate',
          label: 'Expiry',
          render: (val) => {
            const exp = new Date(val);
            const now = new Date();
            const isExp = exp <= now;
            const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            const isNear = diffDays > 0 && diffDays <= 90;

            if (isExp) {
              return `<span class="badge badge-danger">⚠️ Expired (${formatDate(val)})</span>`;
            }
            if (isNear) {
              return `<span class="badge badge-warning">⏰ Near (${formatDate(val)})</span>`;
            }
            return formatDate(val);
          }
        },
        {
          key: 'quantity',
          label: 'Stock Remaining',
          render: (val, row) => {
            const isCleared = val === 0 && (row.looseQuantity || 0) === 0;
            if (isCleared) {
              return `<span class="badge badge-secondary" style="font-weight:600">✅ Cleared (0 Qty)</span>`;
            }
            return `
              <div>
                <strong style="color:var(--success)">${val} packs</strong>
                ${row.looseQuantity > 0 ? `<span style="font-size:0.8rem;color:var(--text-muted)"> + ${row.looseQuantity} loose</span>` : ''}
                <div style="font-size:0.75rem;color:var(--text-muted)">Total: ${row.totalUnits || val} units</div>
              </div>`;
          }
        },
        {
          key: 'rackLocation',
          label: 'Rack / Shelf',
          render: (val) => val ? `<span style="font-family:var(--font-mono);font-size:0.8rem">${val}</span>` : '<span style="color:var(--text-muted)">—</span>'
        },
        {
          key: 'mrp',
          label: 'Pricing',
          render: (val, row) => `
            <div style="font-size:0.85rem">
              <div>MRP: <strong>${formatCurrency(val)}</strong></div>
              <div style="color:var(--accent)">Sale: ${formatCurrency(row.sellingPrice)}</div>
              ${row.costPrice && row.costPrice > 0 ? `<div style="color:var(--text-muted);font-size:0.75rem">Cost: ${formatCurrency(row.costPrice)}</div>` : ''}
            </div>`
        },
        {
          key: 'stockNotes',
          label: 'Remarks',
          render: (val) => val ? `<span style="font-size:0.8rem;color:var(--text-muted)" title="${val}">${val}</span>` : '<span style="color:var(--text-muted)">—</span>'
        }
      ];

      const actions = [
        {
          label: 'Edit',
          class: 'btn-secondary btn-sm',
          onClick: (batch) => openEditModal(batch)
        },
        {
          label: 'Delete',
          class: 'btn-danger btn-sm',
          onClick: (batch) => handleDelete(batch)
        }
      ];

      renderTable(tableContainer, columns, content, { actions });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage));
    } catch (e) {
      console.error(e);
      showError(tableContainer, 'Error loading opening stock');
    }
  };

  // Status Tab Switches
  statusTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStatus = btn.getAttribute('data-status');
      statusTabs.forEach(b => {
        b.className = b === btn ? 'btn btn-sm btn-primary status-tab-btn' : 'btn btn-sm btn-secondary status-tab-btn';
      });
      loadData(0);
    });
  });

  // Search input
  searchInput?.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim();
    loadData(0);
  }, 300));

  // ── Modal: Add Old Stock ───────────────────────────────────────────────────
  const openAddModal = () => {
    const modal = showModal({
      title: '➕ Add Opening / Old Stock',
      size: 'lg',
      body: `
        <div style="margin-bottom:16px;padding:10px 14px;background:var(--bg-tertiary);border-left:4px solid var(--accent);border-radius:var(--radius);font-size:0.85rem">
          <strong>Mandatory Fields:</strong> Please fill in all fields marked with <span style="color:var(--danger);font-weight:bold">*</span>. 
          If the medicine is not already in MedStack, it will be automatically registered into your store's master catalog.
        </div>

        <form id="addOldStockForm">
          <!-- Section 1: Medicine Details -->
          <h4 style="margin:0 0 10px 0;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent)">
            1. Medicine Details
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:16px">
            <div class="form-group" style="grid-column:span 2">
              <label class="form-label" style="font-weight:bold">
                Medicine Name <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="text" name="medicineName" class="form-control" required placeholder="e.g. Paracetamol 650mg, Dolo 650" />
            </div>
            <div class="form-group">
              <label class="form-label">Generic Name <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="text" name="genericName" class="form-control" placeholder="e.g. Paracetamol" />
            </div>
            <div class="form-group">
              <label class="form-label">Category <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="text" name="category" class="form-control" placeholder="e.g. Fever / Analgesic, Antibiotic" />
            </div>
            <div class="form-group">
              <label class="form-label">Manufacturer / Brand <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="text" name="manufacturer" class="form-control" placeholder="e.g. Micro Labs, Cipla" />
            </div>
            <div class="form-group">
              <label class="form-label">Rack / Shelf Location <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="text" name="rackLocation" class="form-control" placeholder="e.g. Rack A-1" />
            </div>
          </div>

          <!-- Section 2: Batch & Inventory Details -->
          <h4 style="margin:16px 0 10px 0;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent)">
            2. Batch &amp; Stock Information
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px">
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">
                Batch Number <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="text" name="batchNumber" class="form-control" required placeholder="e.g. B1044, AMX99" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">
                Expiry Date <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="date" name="expiryDate" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">
                Quantity (Packs / Strips) <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="number" name="quantity" class="form-control" required min="0" placeholder="e.g. 20" />
            </div>
            <div class="form-group">
              <label class="form-label">Loose Quantity <span style="color:var(--text-muted);font-size:0.75rem">(Tablets)</span></label>
              <input type="number" name="looseQuantity" class="form-control" min="0" value="0" />
            </div>
          </div>

          <!-- Section 3: Pricing & Compliance -->
          <h4 style="margin:16px 0 10px 0;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent)">
            3. Pricing &amp; Tax Settings
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px">
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">
                MRP (₹ per pack) <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="number" step="0.01" min="0.01" name="mrp" id="addMrpInput" class="form-control" required placeholder="e.g. 30.00" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">
                Selling Price (₹ per pack) <span style="color:var(--danger)">* Mandatory</span>
              </label>
              <input type="number" step="0.01" min="0.01" name="sellingPrice" id="addSellingInput" class="form-control" required placeholder="e.g. 28.00" />
              <small style="color:var(--text-muted);font-size:0.7rem">Cannot exceed MRP</small>
            </div>
            <div class="form-group">
              <label class="form-label">Cost / Purchase Price (₹) <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="number" step="0.01" min="0" name="costPrice" class="form-control" placeholder="Defaults to MRP" />
            </div>
            <div class="form-group">
              <label class="form-label">GST Rate (%) <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <select name="gstRate" class="form-control">
                <option value="5.00" selected>5% (Standard Medicines)</option>
                <option value="0.00">0% (Nil / Contraceptives)</option>
                <option value="12.00">12%</option>
                <option value="18.00">18%</option>
              </select>
            </div>
          </div>

          <!-- Section 4: Additional Details -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label class="form-label">Units per Pack <span style="color:var(--text-muted);font-size:0.75rem">(e.g. 10 tablets/strip)</span></label>
              <input type="number" name="unitsPerPack" class="form-control" min="1" value="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Min Stock Alert Level</label>
              <input type="number" name="minStockAlertLevel" class="form-control" min="0" value="10" />
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label class="form-label">Remarks / Stock Notes <span style="color:var(--text-muted);font-size:0.75rem">(Optional)</span></label>
              <input type="text" name="stockNotes" class="form-control" placeholder="e.g. Initial stock from legacy drawer" />
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <input type="checkbox" id="addRxRequired" name="requiresPrescription" />
            <label for="addRxRequired" style="cursor:pointer;font-size:0.85rem">⚕️ Prescription Required (Doctor consultation needed for sale)</label>
          </div>
        </form>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Opening Stock',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.getElementById('addOldStockForm');
            if (!form.reportValidity()) return;

            const fd = new FormData(form);
            const mrp = parseFloat(fd.get('mrp'));
            const sellingPrice = parseFloat(fd.get('sellingPrice'));

            if (sellingPrice > mrp) {
              showToast('Selling price cannot exceed MRP', 'error');
              return;
            }

            const payload = {
              medicineName: fd.get('medicineName')?.trim(),
              genericName: fd.get('genericName')?.trim() || null,
              category: fd.get('category')?.trim() || null,
              manufacturer: fd.get('manufacturer')?.trim() || null,
              rackLocation: fd.get('rackLocation')?.trim() || null,
              batchNumber: fd.get('batchNumber')?.trim(),
              expiryDate: fd.get('expiryDate'),
              quantity: parseInt(fd.get('quantity'), 10),
              looseQuantity: parseInt(fd.get('looseQuantity') || 0, 10),
              mrp: mrp,
              sellingPrice: sellingPrice,
              costPrice: fd.get('costPrice') ? parseFloat(fd.get('costPrice')) : mrp,
              gstRate: parseFloat(fd.get('gstRate') || 5.0),
              unitsPerPack: parseInt(fd.get('unitsPerPack') || 1, 10),
              requiresPrescription: fd.get('requiresPrescription') === 'on',
              minStockAlertLevel: parseInt(fd.get('minStockAlertLevel') || 10, 10),
              stockNotes: fd.get('stockNotes')?.trim() || null
            };

            try {
              await oldStockService.add(payload);
              showToast('Opening stock batch added successfully!', 'success');
              modal.close();
              loadSummary();
              loadData(0);
            } catch (err) {
              showToast(err.message || 'Failed to add opening stock', 'error');
            }
          }
        }
      ]
    });

    // Auto-fill selling price with MRP if empty
    const mrpInput = document.getElementById('addMrpInput');
    const sellingInput = document.getElementById('addSellingInput');
    mrpInput?.addEventListener('input', () => {
      if (!sellingInput.value || parseFloat(sellingInput.value) > parseFloat(mrpInput.value)) {
        sellingInput.value = mrpInput.value;
      }
    });
  };

  // ── Modal: Edit Old Stock ──────────────────────────────────────────────────
  const openEditModal = (batch) => {
    const modal = showModal({
      title: `✏️ Edit Opening Stock: ${batch.medicineName}`,
      size: 'md',
      body: `
        <form id="editOldStockForm">
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="font-weight:bold">Batch Number <span style="color:var(--danger)">* Mandatory</span></label>
            <input type="text" name="batchNumber" class="form-control" value="${batch.batchNumber || ''}" required />
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="font-weight:bold">Expiry Date <span style="color:var(--danger)">* Mandatory</span></label>
            <input type="date" name="expiryDate" class="form-control" value="${batch.expiryDate || ''}" required />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">Quantity (Packs) <span style="color:var(--danger)">*</span></label>
              <input type="number" name="quantity" class="form-control" value="${batch.quantity ?? 0}" min="0" required />
            </div>
            <div class="form-group">
              <label class="form-label">Loose Quantity</label>
              <input type="number" name="looseQuantity" class="form-control" value="${batch.looseQuantity ?? 0}" min="0" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">MRP (₹) <span style="color:var(--danger)">*</span></label>
              <input type="number" step="0.01" min="0.01" name="mrp" id="editMrpInput" class="form-control" value="${batch.mrp ?? ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:bold">Selling Price (₹) <span style="color:var(--danger)">*</span></label>
              <input type="number" step="0.01" min="0.01" name="sellingPrice" id="editSellingInput" class="form-control" value="${batch.sellingPrice ?? ''}" required />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Cost Price (₹)</label>
            <input type="number" step="0.01" min="0" name="costPrice" class="form-control" value="${batch.costPrice ?? ''}" />
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Rack / Shelf Location</label>
            <input type="text" name="rackLocation" class="form-control" value="${batch.rackLocation || ''}" placeholder="e.g. Rack A-1" />
          </div>

          <div class="form-group">
            <label class="form-label">Stock Remarks / Notes</label>
            <input type="text" name="stockNotes" class="form-control" value="${batch.stockNotes || ''}" />
          </div>
        </form>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update Batch',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.getElementById('editOldStockForm');
            if (!form.reportValidity()) return;

            const fd = new FormData(form);
            const mrp = parseFloat(fd.get('mrp'));
            const sellingPrice = parseFloat(fd.get('sellingPrice'));

            if (sellingPrice > mrp) {
              showToast('Selling price cannot exceed MRP', 'error');
              return;
            }

            const payload = {
              medicineName: batch.medicineName,
              batchNumber: fd.get('batchNumber')?.trim(),
              expiryDate: fd.get('expiryDate'),
              quantity: parseInt(fd.get('quantity'), 10),
              looseQuantity: parseInt(fd.get('looseQuantity') || 0, 10),
              mrp: mrp,
              sellingPrice: sellingPrice,
              costPrice: fd.get('costPrice') ? parseFloat(fd.get('costPrice')) : mrp,
              rackLocation: fd.get('rackLocation')?.trim() || null,
              stockNotes: fd.get('stockNotes')?.trim() || null
            };

            try {
              await oldStockService.update(batch.id, payload);
              showToast('Opening stock updated successfully!', 'success');
              modal.close();
              loadSummary();
              loadData(currentPage);
            } catch (err) {
              showToast(err.message || 'Failed to update opening stock', 'error');
            }
          }
        }
      ]
    });
  };

  // ── Handle Delete ──────────────────────────────────────────────────────────
  const handleDelete = async (batch) => {
    const ok = await confirm(`Are you sure you want to delete opening stock batch [${batch.batchNumber}] for ${batch.medicineName}?`);
    if (!ok) return;

    try {
      await oldStockService.delete(batch.id);
      showToast('Opening stock batch deleted successfully', 'success');
      loadSummary();
      loadData(currentPage);
    } catch (e) {
      showToast(e.message || 'Failed to delete batch', 'error');
    }
  };

  // ── Download Template ──────────────────────────────────────────────────────
  downloadTemplateBtn?.addEventListener('click', async () => {
    try {
      const resp = await oldStockService.getTemplate();
      const csvText = typeof resp === 'string' ? resp : (resp?.data || '');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medstack_opening_stock_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Template downloaded! Fill in your data and use Bulk CSV Upload.', 'success');
    } catch (e) {
      showToast('Error downloading template', 'error');
    }
  });

  // ── Modal: Bulk CSV Upload ─────────────────────────────────────────────────
  const openBulkUploadModal = () => {
    let uploadedCsvText = '';

    const modal = showModal({
      title: '📤 Bulk CSV Import — Opening / Old Stock',
      size: 'lg',
      body: `
        <div style="font-size:0.85rem;margin-bottom:14px;color:var(--text-secondary)">
          Import existing store medicines and opening inventory in bulk from a spreadsheet or CSV file.
        </div>

        <!-- Mandatory vs Optional Fields Guide -->
        <div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:16px;background:var(--bg-secondary)">
          <div style="font-weight:bold;margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span>📋 CSV Columns &amp; Field Requirements</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.8rem">
            <div style="padding:8px;background:rgba(239, 68, 68, 0.08);border:1px solid rgba(239, 68, 68, 0.2);border-radius:var(--radius)">
              <strong style="color:var(--danger)">🔴 Mandatory Fields (Required in every row):</strong>
              <ul style="margin:6px 0 0 16px;padding:0;line-height:1.5">
                <li><code>medicine_name</code> — Name of the medicine</li>
                <li><code>batch_number</code> — Batch number code</li>
                <li><code>expiry_date</code> — Format <code>YYYY-MM-DD</code> or <code>MM/YYYY</code></li>
                <li><code>quantity</code> — Number of full packs/strips</li>
                <li><code>mrp</code> — Maximum retail price</li>
                <li><code>selling_price</code> — Sale price (must be &le; MRP)</li>
              </ul>
            </div>
            <div style="padding:8px;background:rgba(59, 130, 246, 0.08);border:1px solid rgba(59, 130, 246, 0.2);border-radius:var(--radius)">
              <strong style="color:var(--accent)">🔵 Optional Fields (Auto-defaulted if blank):</strong>
              <ul style="margin:6px 0 0 16px;padding:0;line-height:1.5">
                <li><code>cost_price</code> — Default: MRP</li>
                <li><code>generic_name</code>, <code>category</code>, <code>manufacturer</code></li>
                <li><code>rack_location</code> — Shelf/rack code</li>
                <li><code>gst_rate</code> — Default: 5.00%</li>
                <li><code>units_per_pack</code> — Default: 1</li>
                <li><code>loose_quantity</code> — Default: 0</li>
                <li><code>requires_prescription</code> — TRUE / FALSE</li>
                <li><code>min_stock_alert_level</code> — Default: 10</li>
                <li><code>stock_notes</code> — Free remarks</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- File Upload Section -->
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" style="font-weight:bold">Select CSV File to Upload:</label>
          <input type="file" id="csvFileInput" accept=".csv,text/csv,text/plain" class="form-control" style="padding:8px" />
        </div>

        <!-- Or Paste CSV Content -->
        <details style="margin-bottom:14px;cursor:pointer">
          <summary style="font-size:0.85rem;color:var(--accent);font-weight:600">Or paste raw CSV text directly</summary>
          <div style="margin-top:8px">
            <textarea id="csvTextInput" class="form-control" rows="6" style="font-family:var(--font-mono);font-size:0.8rem" placeholder="medicine_name*,batch_number*,expiry_date*,quantity*,mrp*,selling_price*&#10;Paracetamol 650,B101,2027-12-31,20,30.00,28.00"></textarea>
          </div>
        </details>

        <!-- Preview & Status Feedback Area -->
        <div id="csvUploadFeedback" style="display:none;margin-top:10px"></div>
      `,
      buttons: [
        { label: 'Close', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Validate &amp; Import Opening Stock',
          class: 'btn-primary',
          id: 'btnSubmitCsvUpload',
          onClick: async () => {
            const feedbackEl = document.getElementById('csvUploadFeedback');
            const fileInput = document.getElementById('csvFileInput');
            const textArea = document.getElementById('csvTextInput');

            let contentToUpload = uploadedCsvText || textArea?.value?.trim();

            if (!contentToUpload && fileInput?.files?.length > 0) {
              const file = fileInput.files[0];
              contentToUpload = await file.text();
            }

            if (!contentToUpload || !contentToUpload.trim()) {
              showToast('Please select a CSV file or paste CSV text first', 'warning');
              return;
            }

            if (feedbackEl) {
              feedbackEl.style.display = 'block';
              feedbackEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><div class="spinner"></div><span>Validating and importing batches...</span></div>`;
            }

            try {
              const resp = await oldStockService.uploadCsv(contentToUpload);
              const res = resp?.data || {};

              if (res.errorCount === 0) {
                feedbackEl.innerHTML = `
                  <div style="padding:12px;background:rgba(34, 197, 94, 0.1);border:1px solid var(--success);border-radius:var(--radius);color:var(--success)">
                    <strong>✅ Import Successful!</strong><br />
                    Successfully imported <strong>${res.importedCount}</strong> batches across your inventory master without any errors.
                  </div>
                `;
                showToast(`Success! ${res.importedCount} batches imported into opening stock`, 'success');
                loadSummary();
                loadData(0);
              } else {
                feedbackEl.innerHTML = `
                  <div style="padding:12px;background:rgba(239, 68, 68, 0.08);border:1px solid var(--danger);border-radius:var(--radius);margin-bottom:10px">
                    <strong style="color:var(--danger)">⚠️ Validation Failed (${res.errorCount} errors found):</strong>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">
                      No batches were imported to prevent partial or corrupted inventory state. Please correct the rows highlighted below in your file and try again.
                    </div>
                  </div>
                  <div class="table-container" style="max-height:220px;overflow-y:auto">
                    <table class="data-table" style="font-size:0.8rem">
                      <thead>
                        <tr>
                          <th style="width:70px">Row #</th>
                          <th style="width:130px">Column</th>
                          <th>Error Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${res.errors.map(err => `
                          <tr>
                            <td><strong style="color:var(--danger)">Row ${err.row || '—'}</strong></td>
                            <td><code>${err.field || '—'}</code></td>
                            <td style="color:var(--danger)">${err.message || 'Invalid value'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `;
                showToast(`CSV validation failed with ${res.errorCount} errors`, 'error');
              }
            } catch (err) {
              if (feedbackEl) {
                feedbackEl.innerHTML = `<div style="color:var(--danger);padding:8px">Error uploading CSV: ${err.message || 'Unknown error'}</div>`;
              }
              showToast(err.message || 'Failed to upload CSV', 'error');
            }
          }
        }
      ]
    });

    const fileInput = document.getElementById('csvFileInput');
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      uploadedCsvText = await file.text();
      const feedbackEl = document.getElementById('csvUploadFeedback');
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <div style="font-size:0.8rem;color:var(--text-muted)">
            📄 File <strong>${file.name}</strong> ready (${(file.size / 1024).toFixed(1)} KB). Click <strong>"Validate &amp; Import Opening Stock"</strong> to proceed.
          </div>`;
      }
    });
  };

  addBtn?.addEventListener('click', openAddModal);
  bulkUploadBtn?.addEventListener('click', openBulkUploadModal);

  // Initial load
  loadSummary();
  loadData(0);
}
