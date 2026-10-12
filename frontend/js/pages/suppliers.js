// js/pages/suppliers.js — Supplier Management & Khata Dues
import { supplierService } from '../services/supplierService.js';
import { extractPage, debounce, buildFormHtml, getFormData, showLoading, showError, formatCurrency } from '../utils.js';
import { renderTable } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';
import { openSettleSupplierDuesModal } from './supplierDetail.js';

export default function renderSuppliers(container) {
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Suppliers &amp; Distributors</h1>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:2px">
          Manage medicine distributors, supplier khata accounts, and track payable dues.
        </p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <a href="#/supplier-detail" class="btn btn-secondary">📒 Open Khata Directory</a>
        ${can('manage_suppliers') ? '<button class="btn btn-primary" id="addSupplierBtn">+ Add Supplier</button>' : ''}
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="supplierSearchInput" class="form-control" placeholder="Search suppliers by name, contact, GSTIN..." />
        </div>
      </div>

      <div id="supplierTableContainer"></div>
      <div id="supplierPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#supplierTableContainer');
  const paginationContainer = container.querySelector('#supplierPagination');
  const searchInput = container.querySelector('#supplierSearchInput');
  const addBtn = container.querySelector('#addSupplierBtn');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading suppliers & ledger balances...');

    try {
      const resp = await supplierService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        {
          key: 'name',
          label: 'Supplier / Distributor',
          render: (val, row) => `
            <a href="#/supplier-detail?id=${row.id}" style="font-weight:700;color:var(--accent);text-decoration:none;cursor:pointer" title="View Supplier Khata, Invoices & Orders">
              🏢 ${val}
            </a>
          `
        },
        { key: 'contactPerson', label: 'Contact Person', render: (val) => val || '—' },
        {
          key: 'phone',
          label: 'Phone',
          render: (val) => val ? `<a href="tel:${val}" style="font-family:var(--font-mono);color:var(--text-primary);text-decoration:none">📞 ${val}</a>` : '—'
        },
        { key: 'email', label: 'Email', render: (val) => val || '—' },
        { key: 'gstin', label: 'GSTIN', render: (val) => `<code style="color:var(--accent)">${val || '—'}</code>` },
        {
          key: 'outstandingBalance',
          label: 'Khata Due',
          render: (val) => {
            const num = Number(val) || 0;
            if (num > 0) return `<span class="badge badge-danger">Due: ${formatCurrency(num)}</span>`;
            if (num < 0) return `<span class="badge badge-success">Advance: ${formatCurrency(Math.abs(num))}</span>`;
            return `<span class="badge badge-secondary" style="color:var(--text-muted)">₹0.00</span>`;
          }
        }
      ];

      const actions = [
        {
          label: 'Khata & Orders',
          class: 'btn-primary',
          icon: '📒 Khata & Orders',
          onClick: (sup) => {
            window.location.hash = `#/supplier-detail?id=${sup.id}`;
          }
        }
      ];

      if (can('manage_purchases')) {
        actions.push({
          label: 'Settle',
          class: 'btn-secondary',
          icon: '⚡ Settle',
          onClick: (sup) => {
            const bal = Number(sup.outstandingBalance || 0);
            openSettleSupplierDuesModal(sup, bal, () => {
              loadData(currentPage, currentSearch);
            });
          }
        });
      }

      if (can('manage_suppliers')) {
        actions.push({
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️ Edit',
          onClick: (sup) => openEditModal(sup)
        });
        actions.push({
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (sup) => {
            const ok = await confirm(`Are you sure you want to delete "${sup.name}"?`, { danger: true });
            if (ok) {
              try {
                const delResp = await supplierService.delete(sup.id);
                if (delResp?.success) {
                  showToast('Supplier deleted', 'success');
                  loadData(currentPage, currentSearch);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting supplier', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions, exportFilename: 'MedStack_Suppliers.csv' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading suppliers');
    }
  };

  const supplierFields = [
    { name: 'name', label: 'Supplier / Distributor Name', required: true },
    { name: 'contactPerson', label: 'Contact Person Name' },
    { name: 'phone', label: 'Phone Number', required: true, placeholder: '9810012301' },
    { name: 'email', label: 'Email Address', type: 'email' },
    { name: 'gstin', label: 'GSTIN Number', placeholder: '07AAAAA0000A1Z5' },
    { name: 'dlNumber', label: 'Drug License (DL) Number' },
    { name: 'address', label: 'Address / Warehouse Location', type: 'textarea' }
  ];

  const openAddModal = () => {
    const modal = showModal({
      title: 'Add New Supplier',
      body: `<form id="addSupplierForm">${buildFormHtml(supplierFields)}</form>`,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Create Supplier',
          class: 'btn-primary',
          onClick: async () => {
            const form = modal.element?.querySelector('#addSupplierForm') || document.getElementById('addSupplierForm');
            const data = getFormData(form);
            if (!data.name || !data.phone) {
              showToast('Supplier Name and Phone are required', 'error');
              return;
            }
            try {
              const resp = await supplierService.create(data);
              if (resp?.success) {
                showToast('Supplier created successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(resp?.message || 'Failed to create supplier', 'error');
              }
            } catch (err) {
              showToast(err.message || 'Error creating supplier', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (sup) => {
    const editFields = supplierFields.map(f => ({
      ...f,
      value: sup[f.name] !== undefined ? sup[f.name] : ''
    }));

    const modal = showModal({
      title: `Edit Supplier: ${sup.name}`,
      body: `<form id="editSupplierForm">${buildFormHtml(editFields)}</form>`,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Changes',
          class: 'btn-primary',
          onClick: async () => {
            const form = modal.element?.querySelector('#editSupplierForm') || document.getElementById('editSupplierForm');
            const data = getFormData(form);
            if (!data.name || !data.phone) {
              showToast('Supplier Name and Phone are required', 'error');
              return;
            }
            try {
              const resp = await supplierService.update(sup.id, data);
              if (resp?.success) {
                showToast('Supplier updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(resp?.message || 'Failed to update supplier', 'error');
              }
            } catch (err) {
              showToast(err.message || 'Error updating supplier', 'error');
            }
          }
        }
      ]
    });
  };

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      loadData(0, e.target.value.trim());
    }, 300));
  }

  loadData(0, '');
}
