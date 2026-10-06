// js/pages/users.js — User Management (Admin & Owner)
import { userService } from '../services/userService.js';
import { formatDate, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, badge, statusBadge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getUser } from '../auth.js';
import { can } from '../permissions.js';

export default function renderUsers(container) {
  if (!can('manage_users')) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">🔒</div>
        <div class="empty-text" style="color:var(--danger)">Access Denied: You do not have permission to manage users.</div>
      </div>
    `;
    return;
  }

  let currentPage = 0;
  let currentSearch = '';
  const pageSize = 15;
  const currentUser = getUser();

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Users</h1>
      <button class="btn btn-primary" id="addUserBtn">+ Add User</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="userSearchInput" class="form-control" placeholder="Search by username, full name, email..." />
        </div>
      </div>

      <div id="userTableContainer"></div>
      <div id="userPagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#userTableContainer');
  const paginationContainer = container.querySelector('#userPagination');
  const searchInput = container.querySelector('#userSearchInput');
  const addBtn = container.querySelector('#addUserBtn');

  const loadData = async (page = 0, search = '') => {
    currentPage = page;
    currentSearch = search;
    showLoading(tableContainer, 'Loading user accounts...');

    try {
      const resp = await userService.getAll({ page, size: pageSize, search });
      const { content, page: pageMeta } = extractPage(resp);

      const roleBadge = (role) => {
        const map = { ADMIN: 'danger', OWNER: 'warning', STAFF: 'info' };
        return badge(role, map[role] || 'secondary');
      };

      const columns = [
        { key: 'username', label: 'Username', render: (val) => `<strong style="color:var(--accent);font-family:var(--font-mono)">${val}</strong>` },
        { key: 'fullName', label: 'Full Name' },
        { key: 'email', label: 'Email', render: (val) => val || '—' },
        { key: 'role', label: 'Role', render: (val) => roleBadge(val) },
        { key: 'status', label: 'Status', render: (val) => statusBadge(val) },
        { key: 'createdAt', label: 'Created', render: (val) => formatDate(val) }
      ];

      const actions = [
        {
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️ Edit',
          onClick: (usr) => openEditModal(usr)
        },
        {
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (usr) => {
            if (usr.username === currentUser?.username) {
              showToast('You cannot delete your own active account', 'warning');
              return;
            }
            const ok = await confirm(`Are you sure you want to delete user account "${usr.username}"?`, { danger: true });
            if (ok) {
              try {
                const delResp = await userService.delete(usr.id);
                if (delResp?.success) {
                  showToast('User deleted', 'success');
                  loadData(currentPage, currentSearch);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting user', 'error');
              }
            }
          }
        }
      ];

      renderTable(tableContainer, columns, content, { actions });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage, currentSearch));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading users');
    }
  };

  const openAddModal = () => {
    const fields = [
      { name: 'username', label: 'Username', required: true, placeholder: 'john_doe' },
      { name: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' },
      { name: 'fullName', label: 'Full Name', required: true, placeholder: 'John Doe' },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number' },
      {
        name: 'role', label: 'Role', type: 'select', required: true,
        options: [
          { value: 'ADMIN', label: 'ADMIN — Full system access' },
          { value: 'OWNER', label: 'OWNER — Store manager' },
          { value: 'STAFF', label: 'STAFF — POS cashier' }
        ]
      },
      {
        name: 'status', label: 'Status', type: 'select', required: true,
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'INACTIVE', label: 'INACTIVE' }
        ]
      }
    ];

    const formHtml = `<form id="addUserForm">${buildFormHtml(fields, { role: 'STAFF', status: 'ACTIVE' })}</form>`;
    const modal = showModal({
      title: 'Create New User Account',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Create Account',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addUserForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await userService.create(data);
              if (res?.success) {
                showToast('User created successfully', 'success');
                modal.close();
                loadData(0, currentSearch);
              } else {
                showToast(res?.message || 'Failed to create user', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error creating user', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (usr) => {
    const fields = [
      { name: 'fullName', label: 'Full Name', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number' },
      {
        name: 'role', label: 'Role', type: 'select', required: true,
        options: [
          { value: 'ADMIN', label: 'ADMIN' },
          { value: 'OWNER', label: 'OWNER' },
          { value: 'STAFF', label: 'STAFF' }
        ]
      },
      {
        name: 'status', label: 'Status', type: 'select', required: true,
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'INACTIVE', label: 'INACTIVE' }
        ]
      }
    ];

    const formHtml = `<form id="editUserForm">${buildFormHtml(fields, usr)}</form>`;
    const modal = showModal({
      title: `Edit User: ${usr.username}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update User',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editUserForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);

            try {
              const res = await userService.update(usr.id, data);
              if (res?.success) {
                showToast('User updated successfully', 'success');
                modal.close();
                loadData(currentPage, currentSearch);
              } else {
                showToast(res?.message || 'Failed to update user', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating user', 'error');
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
