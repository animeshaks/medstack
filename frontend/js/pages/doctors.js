// js/pages/doctors.js — Doctor Management
import { doctorService } from '../services/doctorService.js';
import { extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderDoctors(container) {
  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Doctors</h1>
      ${can('manage_doctors') || can('manage_medicines') ? '<button class="btn btn-primary" id="addDoctorBtn">+ Add Doctor</button>' : ''}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="doctorSearchInput" class="form-control" placeholder="Search by doctor name, specialization, clinic..." />
        </div>
      </div>

      <div id="doctorTableContainer"></div>
      <div id="doctorPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#doctorTableContainer');
  const paginationContainer = container.querySelector('#doctorPagination');
  const searchInput = container.querySelector('#doctorSearchInput');
  const addBtn = container.querySelector('#addDoctorBtn');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading doctors...');

    try {
      const resp = await doctorService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        { key: 'name', label: 'Doctor Name', render: (val) => `<strong>${val}</strong>` },
        { key: 'specialization', label: 'Specialization', render: (val) => badge(val, 'info') },
        { key: 'phone', label: 'Phone', render: (val) => val || '—' },
        { key: 'email', label: 'Email', render: (val) => val || '—' },
        { key: 'clinicHospitalName', label: 'Clinic / Hospital', render: (val) => val || '—' },
        { key: 'registrationNumber', label: 'Reg. Number', render: (val) => `<code style="color:var(--accent)">${val || '—'}</code>` }
      ];

      const actions = [];
      if (can('manage_doctors') || can('manage_medicines')) {
        actions.push({
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️ Edit',
          onClick: (doc) => openEditModal(doc)
        });
        actions.push({
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (doc) => {
            const ok = await confirm(`Are you sure you want to delete "${doc.name}"?`, { danger: true });
            if (ok) {
              try {
                const delResp = await doctorService.delete(doc.id);
                if (delResp?.success) {
                  showToast('Doctor record deleted', 'success');
                  loadData(currentPage, currentSearch);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting doctor', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions, exportFilename: 'MedStack_Doctors.csv' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading doctors');
    }
  };

  const doctorFields = [
    { name: 'name', label: 'Doctor Full Name', required: true, placeholder: 'Dr. John Doe' },
    { name: 'specialization', label: 'Specialization', required: true, placeholder: 'General Physician, Cardiologist...' },
    { name: 'phone', label: 'Phone Number', placeholder: '9810012301' },
    { name: 'email', label: 'Email Address', type: 'email' },
    { name: 'clinicHospitalName', label: 'Clinic or Hospital Name' },
    { name: 'registrationNumber', label: 'Medical Registration Number', required: true, placeholder: 'DL-12345' }
  ];

  const openAddModal = () => {
    const formHtml = `<form id="addDocForm">${buildFormHtml(doctorFields)}</form>`;
    const modal = showModal({
      title: 'Add New Doctor',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Doctor',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addDocForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await doctorService.create(data);
              if (res?.success) {
                showToast('Doctor registered successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to register doctor', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error registering doctor', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (doc) => {
    const formHtml = `<form id="editDocForm">${buildFormHtml(doctorFields, doc)}</form>`;
    const modal = showModal({
      title: `Edit Doctor: ${doc.name}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editDocForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await doctorService.update(doc.id, data);
              if (res?.success) {
                showToast('Doctor updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(res?.message || 'Failed to update doctor', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating doctor', 'error');
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
