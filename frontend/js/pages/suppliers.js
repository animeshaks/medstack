// js/pages/suppliers.js — Supplier Management
import { supplierService } from '../services/supplierService.js';
import { extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderSuppliers(container) {
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Suppliers</h1>
      ${can('manage_suppliers') ? '<button class="btn btn-primary" id="addSupplierBtn">+ Add Supplier</button>' : ''}
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
    showLoading(tableContainer, 'Loading suppliers...');

    try {
      const resp = await supplierService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        { key: 'name', label: 'Supplier Name', render: (val) => `<strong>${val}</strong>` },
        { key: 'contactPerson', label: 'Contact Person', render: (val) => val || '—' },
        { key: 'phone', label: 'Phone', render: (val) => `<span style="font-family:var(--font-mono)">${val}</span>` },
        { key: 'email', label: 'Email', render: (val) => val || '—' },
        { key: 'gstin', label: 'GSTIN', render: (val) => `<code style="color:var(--accent)">${val || '—'}</code>` },
        { key: 'dlNumber', label: 'DL Number', render: (val) => val || '—' },
        { key: 'address', label: 'Address', render: (val) => val || '—' }
      ];

      const actions = [];
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

      renderTable(tableContainer, columns, content, { actions });
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
    { name: 'gstin', label: 'GSTIN (15 characters)', placeholder: '27AAACL5055K1ZV' },
    { name: 'dlNumber', label: 'Drug License (DL) Number', placeholder: 'MH/MUM/DL-101234' },
    { name: 'address', label: 'Full Address', type: 'textarea' }
  ];

  const openAddModal = () => {
    const formHtml = `<form id="addSupForm">${buildFormHtml(supplierFields)}</form>`;
    const modal = showModal({
      title: 'Add New Supplier',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Supplier',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addSupForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await supplierService.create(data);
              if (res?.success) {
                showToast('Supplier added successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to add supplier', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error adding supplier', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (sup) => {
    const formHtml = `<form id="editSupForm">${buildFormHtml(supplierFields, sup)}</form>`;
    const modal = showModal({
      title: `Edit Supplier: ${sup.name}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editSupForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await supplierService.update(sup.id, data);
              if (res?.success) {
                showToast('Supplier updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(res?.message || 'Failed to update supplier', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating supplier', 'error');
            }
          }
        }
      ]
    });
  };

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  searchInput.addEventListener('input', debounce((e) => {
    const val = e.target.value.trim();
    loadData(0, val);
  }, 300));

  loadData();
}
