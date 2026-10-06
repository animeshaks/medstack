// js/pages/medicines.js — Medicine Management
import { medicineService } from '../services/medicineService.js';
import { formatCurrency, formatDate, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, closeModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderMedicines(container) {
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Medicines</h1>
      ${can('manage_medicines') ? '<button class="btn btn-primary" id="addMedicineBtn">+ Add Medicine</button>' : ''}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="medicineSearchInput" class="form-control" placeholder="Search by name, generic name, manufacturer..." />
        </div>
      </div>

      <div id="medicineTableContainer"></div>
      <div id="medicinePagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#medicineTableContainer');
  const paginationContainer = container.querySelector('#medicinePagination');
  const searchInput = container.querySelector('#medicineSearchInput');
  const addBtn = container.querySelector('#addMedicineBtn');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading medicines...');

    try {
      const resp = await medicineService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        { key: 'name', label: 'Medicine Name', render: (val, row) => `<strong>${val}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>` },
        { key: 'category', label: 'Category', render: (val, row) => `${badge(val, 'info')}${row.unitsPerPack > 1 ? `<br><small style="color:var(--accent);font-weight:600">${row.unitsPerPack} tabs/strip</small>` : ''}` },
        { key: 'manufacturer', label: 'Manufacturer' },
        { key: 'rackLocation', label: 'Rack Location', render: (val) => val || '—' },
        {
          key: 'requiresPrescription',
          label: 'Prescription',
          render: (val) => val ? '<span class="badge badge-warning">Rx Required</span>' : '<span class="badge badge-secondary">OTC</span>'
        },
        { key: 'minStockAlertLevel', label: 'Min Alert' }
      ];

      const actions = [];
      if (can('manage_medicines')) {
        actions.push({
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️ Edit',
          onClick: (med) => openEditModal(med)
        });
        actions.push({
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (med) => {
            const ok = await confirm(`Are you sure you want to delete "${med.name}"?`, { danger: true });
            if (ok) {
              try {
                const delResp = await medicineService.delete(med.id);
                if (delResp?.success) {
                  showToast('Medicine deleted', 'success');
                  loadData(currentPage, currentSearch);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting medicine', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading medicines');
    }
  };

  const openAddModal = () => {
    const fields = [
      { name: 'name', label: 'Medicine Name', required: true },
      { name: 'genericName', label: 'Generic Name', required: true },
      {
        name: 'category', label: 'Category', type: 'select', required: true,
        options: [
          { value: 'TABLET', label: 'TABLET' },
          { value: 'CAPSULE', label: 'CAPSULE' },
          { value: 'SYRUP', label: 'SYRUP' },
          { value: 'INJECTION', label: 'INJECTION' },
          { value: 'CREAM', label: 'CREAM' },
          { value: 'DROPS', label: 'DROPS' },
          { value: 'INHALER', label: 'INHALER' },
          { value: 'POWDER', label: 'POWDER' }
        ]
      },
      { name: 'manufacturer', label: 'Manufacturer', required: true },
      { name: 'hsnCode', label: 'HSN Code' },
      { name: 'rackLocation', label: 'Rack Location' },
      { name: 'requiresPrescription', label: 'Requires Prescription', type: 'checkbox' },
      { name: 'minStockAlertLevel', label: 'Min Stock Alert Level', type: 'number' },
      { name: 'unitsPerPack', label: 'Units Per Pack / Strip (e.g. 10 for tablets)', type: 'number' }
    ];

    const formHtml = `<form id="addMedForm">${buildFormHtml(fields, { minStockAlertLevel: 10, unitsPerPack: 1 })}</form>`;

    const modal = showModal({
      title: 'Add New Medicine',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Medicine',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addMedForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.minStockAlertLevel = Number(data.minStockAlertLevel) || 10;
            data.unitsPerPack = Number(data.unitsPerPack) || 1;

            try {
              const res = await medicineService.create(data);
              if (res?.success) {
                showToast('Medicine created successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to create medicine', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error creating medicine', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (med) => {
    const fields = [
      { name: 'name', label: 'Medicine Name', required: true },
      { name: 'genericName', label: 'Generic Name', required: true },
      {
        name: 'category', label: 'Category', type: 'select', required: true,
        options: [
          { value: 'TABLET', label: 'TABLET' },
          { value: 'CAPSULE', label: 'CAPSULE' },
          { value: 'SYRUP', label: 'SYRUP' },
          { value: 'INJECTION', label: 'INJECTION' },
          { value: 'CREAM', label: 'CREAM' },
          { value: 'DROPS', label: 'DROPS' },
          { value: 'INHALER', label: 'INHALER' },
          { value: 'POWDER', label: 'POWDER' }
        ]
      },
      { name: 'manufacturer', label: 'Manufacturer', required: true },
      { name: 'hsnCode', label: 'HSN Code' },
      { name: 'rackLocation', label: 'Rack Location' },
      { name: 'requiresPrescription', label: 'Requires Prescription', type: 'checkbox' },
      { name: 'minStockAlertLevel', label: 'Min Stock Alert Level', type: 'number' },
      { name: 'unitsPerPack', label: 'Units Per Pack / Strip (e.g. 10 for tablets)', type: 'number' }
    ];

    const formHtml = `<form id="editMedForm">${buildFormHtml(fields, med)}</form>`;

    const modal = showModal({
      title: `Edit Medicine: ${med.name}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editMedForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.minStockAlertLevel = Number(data.minStockAlertLevel) || 10;
            data.unitsPerPack = Number(data.unitsPerPack) || 1;

            try {
              const res = await medicineService.update(med.id, data);
              if (res?.success) {
                showToast('Medicine updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(res?.message || 'Failed to update medicine', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating medicine', 'error');
            }
          }
        }
      ]
    });
  };

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  searchInput.addEventListener('input', debounce((e) => {
    const val = e.target.value.trim();
    loadData(0, val.length >= 3 || val.length === 0 ? val : '');
  }, 300));

  loadData();
}
