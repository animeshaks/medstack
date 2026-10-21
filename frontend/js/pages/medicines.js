// js/pages/medicines.js — Medicine Management
import { medicineService } from '../services/medicineService.js';
import { formatCurrency, formatDate, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError, downloadCsv } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, closeModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderMedicines(container) {
  let currentPage = 0;
  let currentSearch = '';
  let activeSymptom = '';
  let activeAgeGroup = '';
  let currentContent = [];
  const pageSize = 15;

  const symptomHelperHtml = `
    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
      <span style="font-size:0.72rem;color:var(--text-muted)">Quick Add:</span>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Fever" style="padding:2px 6px;font-size:0.7rem">+ Fever</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Pain Killer" style="padding:2px 6px;font-size:0.7rem">+ Pain Killer</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Headache" style="padding:2px 6px;font-size:0.7rem">+ Headache</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Cold & Cough" style="padding:2px 6px;font-size:0.7rem">+ Cold & Cough</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Acidity" style="padding:2px 6px;font-size:0.7rem">+ Acidity</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Infection" style="padding:2px 6px;font-size:0.7rem">+ Infection</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Allergy" style="padding:2px 6px;font-size:0.7rem">+ Allergy</button>
      <button type="button" class="btn btn-secondary btn-sm tag-pill" data-tag="Vitamins" style="padding:2px 6px;font-size:0.7rem">+ Vitamins</button>
    </div>
  `;

  const getFormFields = () => [
    { name: 'name', label: 'Medicine Name', required: true },
    { name: 'genericName', label: 'Generic Name', required: true },
    {
      name: 'category', label: 'Category (Dosage Form)', type: 'select', required: true,
      options: [
        { value: 'TABLET', label: 'TABLET' },
        { value: 'CAPSULE', label: 'CAPSULE' },
        { value: 'SYRUP', label: 'SYRUP' },
        { value: 'INJECTION', label: 'INJECTION' },
        { value: 'CREAM', label: 'CREAM' },
        { value: 'DROPS', label: 'DROPS' },
        { value: 'INHALER', label: 'INHALER' },
        { value: 'POWDER', label: 'POWDER' },
        { value: 'OTC', label: 'OTC (General / Contraceptives)' }
      ]
    },
    {
      name: 'gstRate', label: 'GST Tax Rate', type: 'select', required: true,
      options: [
        { value: '5', label: '5% (Standard Medicines & Formulations — Default)' },
        { value: '0', label: '0% (Exempted: Condoms, Contraceptives, Human Blood)' },
        { value: '12', label: '12% (Medical Devices, Diagnostic Kits, Bandages)' },
        { value: '18', label: '18% (Disinfectants, Sanitizers, Food Supplements)' },
        { value: '28', label: '28% (Luxury / Others)' }
      ]
    },
    {
      name: 'targetAgeGroup', label: 'Target Age Group', type: 'select', required: false,
      options: [
        { value: 'ALL', label: 'All Ages / General' },
        { value: 'ADULT', label: 'Adult Only' },
        { value: 'PEDIATRIC', label: 'Pediatric Only (Kids)' },
        { value: 'GERIATRIC', label: 'Geriatric (Elderly)' }
      ]
    },
    {
      name: 'symptoms', label: 'Indications / Symptoms / Use Cases', type: 'textarea',
      placeholder: 'e.g. Fever, Headache, Body Pain, Cold & Cough, Acidity',
      rows: 2,
      helperHtml: symptomHelperHtml
    },
    { name: 'manufacturer', label: 'Manufacturer', required: true },
    { name: 'hsnCode', label: 'HSN Code' },
    { name: 'rackLocation', label: 'Rack Location' },
    { name: 'requiresPrescription', label: 'Requires Prescription', type: 'checkbox' },
    { name: 'minStockAlertLevel', label: 'Min Stock Alert Level', type: 'number' },
    { name: 'unitsPerPack', label: 'Units Per Pack / Strip (e.g. 10 for tablets)', type: 'number' }
  ];

  const columns = [
    {
      key: 'name',
      label: 'Medicine Name',
      render: (val, row) => `<strong>${val}</strong><br><small style="color:var(--text-muted)">${row.genericName || ''}</small>`
    },
    {
      key: 'category',
      label: 'Category',
      render: (val, row) => `${badge(val, 'info')}${row.unitsPerPack > 1 ? `<br><small style="color:var(--accent);font-weight:600">${row.unitsPerPack} tabs/strip</small>` : ''}`
    },
    {
      key: 'gstRate',
      label: 'GST %',
      render: (val) => {
        const rate = val != null ? Number(val) : 5;
        const badgeClass = rate === 0 ? 'badge-success' : 'badge-secondary';
        return `<span class="badge ${badgeClass}" style="font-size:0.75rem;font-weight:700">${rate}%</span>`;
      }
    },
    {
      key: 'symptoms',
      label: 'Indications / Symptoms',
      render: (val) => {
        if (!val || !val.trim()) return '<span style="color:var(--text-muted)">—</span>';
        const tags = val.split(/[,;/]+/).map(t => t.trim()).filter(Boolean);
        if (!tags.length) return '<span style="color:var(--text-muted)">—</span>';
        return `<div style="display:flex;flex-wrap:wrap;gap:4px">` +
          tags.map(t => `<span class="badge badge-accent" style="font-size:0.7rem;text-transform:capitalize;padding:1px 6px">${t}</span>`).join('') +
          `</div>`;
      }
    },
    {
      key: 'targetAgeGroup',
      label: 'Age Group',
      render: (val) => {
        const grp = (val || 'ALL').toUpperCase();
        if (grp === 'PEDIATRIC') return '<span class="badge badge-warning" style="font-size:0.7rem">👶 Pediatric</span>';
        if (grp === 'ADULT') return '<span class="badge badge-info" style="font-size:0.7rem">🧑 Adult</span>';
        if (grp === 'GERIATRIC') return '<span class="badge badge-secondary" style="font-size:0.7rem">👵 Geriatric</span>';
        return '<span style="font-size:0.75rem;color:var(--text-muted)">All Ages</span>';
      }
    },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'rackLocation', label: 'Rack Location', render: (val) => val || '—' },
    {
      key: 'requiresPrescription',
      label: 'Prescription',
      render: (val) => val ? '<span class="badge badge-warning">Rx Required</span>' : '<span class="badge badge-secondary">OTC</span>'
    },
    { key: 'minStockAlertLevel', label: 'Min Alert' }
  ];

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Medicines</h1>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-secondary" id="exportMedicinesBtn">📥 Export CSV</button>
        ${can('manage_medicines') ? '<button class="btn btn-primary" id="addMedicineBtn">+ Add Medicine</button>' : ''}
      </div>
    </div>

    <div class="card">
      <div class="toolbar" style="display:flex;flex-direction:column;gap:12px;align-items:stretch">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between">
          <div class="search-box" style="flex:1;min-width:260px">
            <span class="search-icon">🔍</span>
            <input type="text" id="medicineSearchInput" class="form-control" placeholder="Search by name, generic name, manufacturer, or symptom..." />
          </div>
        </div>

        <!-- Filter Chips Bar -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;align-items:center" id="medicineFilterChips">
          <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;white-space:nowrap;margin-right:2px">Filter Indication:</span>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip active" data-symptom="" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--accent);background:var(--accent-glow, rgba(0,230,153,0.15));color:var(--accent);border-radius:14px;cursor:pointer">All</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="fever" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">🔥 Fever</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="pain" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">⚡ Pain Killer</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="cough" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">🤧 Cold &amp; Cough</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="acidity" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">🤢 Acidity &amp; Gas</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="infection" data-age="" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">🦠 Infection / Antibiotic</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="" data-age="PEDIATRIC" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">👶 Pediatric Only</button>
          <button type="button" class="btn btn-sm btn-ghost med-filter-chip" data-symptom="" data-age="ADULT" style="font-size:0.75rem;padding:3px 10px;border:1px solid var(--border);border-radius:14px;cursor:pointer">🧑 Adult</button>
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
  const exportBtn = container.querySelector('#exportMedicinesBtn');
  const filterChipsContainer = container.querySelector('#medicineFilterChips');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading medicines...');

    try {
      const resp = await medicineService.getAll({
        page,
        size: pageSize,
        search,
        symptom: activeSymptom,
        ageGroup: activeAgeGroup
      });
      const { content, page: pageMeta } = extractPage(resp);
      currentContent = content || [];

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

      renderTable(tableContainer, columns, currentContent, {
        actions,
        exportable: true,
        exportFilename: 'MedStack_Medicines.csv'
      });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading medicines');
    }
  };

  const bindTagPills = (modalEl) => {
    const textarea = modalEl.querySelector('textarea[name="symptoms"]');
    modalEl.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        if (!textarea) return;
        const current = textarea.value.trim();
        const tags = current ? current.split(/[,;/]+/).map(t => t.trim()).filter(Boolean) : [];
        if (!tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          tags.push(tag);
          textarea.value = tags.join(', ');
        }
      });
    });
  };

  const openAddModal = () => {
    const fields = getFormFields();
    const formHtml = `<form id="addMedForm">${buildFormHtml(fields, { minStockAlertLevel: 10, unitsPerPack: 1, targetAgeGroup: 'ALL', gstRate: '5' })}</form>`;

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
            data.symptoms = data.symptoms ? data.symptoms.trim() : '';
            data.targetAgeGroup = data.targetAgeGroup || 'ALL';
            data.gstRate = Number(data.gstRate != null ? data.gstRate : 5);

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

    const form = document.querySelector('#addMedForm');
    if (form) bindTagPills(form);
  };

  const openEditModal = (med) => {
    const fields = getFormFields();
    const formHtml = `<form id="editMedForm">${buildFormHtml(fields, {
      ...med,
      targetAgeGroup: med.targetAgeGroup || 'ALL',
      gstRate: med.gstRate != null ? String(med.gstRate) : '5'
    })}</form>`;

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
            data.symptoms = data.symptoms ? data.symptoms.trim() : '';
            data.targetAgeGroup = data.targetAgeGroup || 'ALL';
            data.gstRate = Number(data.gstRate != null ? data.gstRate : 5);

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

    const form = document.querySelector('#editMedForm');
    if (form) bindTagPills(form);
  };

  // Wire Filter Chips
  filterChipsContainer?.querySelectorAll('.med-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      filterChipsContainer.querySelectorAll('.med-filter-chip').forEach(b => {
        b.classList.remove('active');
        b.style.borderColor = 'var(--border)';
        b.style.background = 'transparent';
        b.style.color = 'var(--text-primary)';
      });
      btn.classList.add('active');
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--accent-glow, rgba(0,230,153,0.15))';
      btn.style.color = 'var(--accent)';

      activeSymptom = btn.dataset.symptom || '';
      activeAgeGroup = btn.dataset.age || '';
      loadData(0, currentSearch);
    });
  });

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!currentContent.length) {
        showToast('No medicine records to export', 'info');
        return;
      }
      downloadCsv('MedStack_Medicines.csv', columns, currentContent);
    });
  }

  searchInput.addEventListener('input', debounce((e) => {
    const val = e.target.value.trim();
    loadData(0, val.length >= 2 || val.length === 0 ? val : '');
  }, 300));

  loadData();
}
