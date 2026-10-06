// js/pages/expenses.js — Store Expense Management with Advanced Filters
import { expenseService } from '../services/expenseService.js';
import { formatCurrency, formatDate, extractPage, debounce, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderExpenses(container) {
  let currentPage = 0;
  const pageSize = 15;

  let filterCategory = 'ALL';
  let filterPeriod = 'ALL';
  let filterStartDate = '';
  let filterEndDate = '';
  let filterSearch = '';

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title" style="margin-bottom:4px">Expenses</h1>
        <div style="font-size:0.8rem;color:var(--text-muted)">Track store expenditures, operational overheads, and utilities</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <div id="expenseSummaryBadge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);font-size:0.85rem">
          <span style="color:var(--text-muted)">Total Expense:</span>
          <strong id="expenseTotalAmount" style="color:var(--danger)">₹0.00</strong>
        </div>
        ${can('manage_expenses') ? '<button class="btn btn-primary" id="addExpenseBtn">+ Log Expense</button>' : ''}
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="card" style="margin-bottom:16px;padding:12px 16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)) auto;gap:12px;align-items:end">
        
        <!-- Search Input -->
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.75rem">Search</label>
          <input type="text" id="expenseSearchInput" class="form-control" placeholder="Search description..." style="font-size:0.85rem" />
        </div>

        <!-- Category Filter -->
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.75rem">Category</label>
          <select id="expenseCategoryFilter" class="form-control" style="font-size:0.85rem">
            <option value="ALL">All Categories</option>
            <option value="RENT">Rent</option>
            <option value="SALARY">Salary / Wages</option>
            <option value="ELECTRICITY">Electricity & Power</option>
            <option value="SUPPLIES">Packaging & Supplies</option>
            <option value="MAINTENANCE">Maintenance & Repairs</option>
            <option value="UTILITIES">Water & Utilities</option>
            <option value="MARKETING">Marketing & Signage</option>
            <option value="MISCELLANEOUS">Miscellaneous</option>
          </select>
        </div>

        <!-- Period Preset Filter -->
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.75rem">Period</label>
          <select id="expensePeriodFilter" class="form-control" style="font-size:0.85rem">
            <option value="ALL">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year (2026)</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>

        <!-- Start Date -->
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.75rem">From Date</label>
          <input type="date" id="expenseStartDate" class="form-control" style="font-size:0.85rem" />
        </div>

        <!-- End Date -->
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.75rem">To Date</label>
          <input type="date" id="expenseEndDate" class="form-control" style="font-size:0.85rem" />
        </div>

        <!-- Reset Button -->
        <div style="margin-bottom:0">
          <button type="button" class="btn btn-secondary" id="resetExpenseFiltersBtn" style="font-size:0.85rem;padding:7px 14px">
            ↺ Reset
          </button>
        </div>

      </div>
    </div>

    <div class="card">
      <div id="expenseTableContainer"></div>
      <div id="expensePagination"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#expenseTableContainer');
  const paginationContainer = container.querySelector('#expensePagination');
  const addBtn = container.querySelector('#addExpenseBtn');
  const searchInput = container.querySelector('#expenseSearchInput');
  const categoryFilter = container.querySelector('#expenseCategoryFilter');
  const periodFilter = container.querySelector('#expensePeriodFilter');
  const startDateInput = container.querySelector('#expenseStartDate');
  const endDateInput = container.querySelector('#expenseEndDate');
  const resetBtn = container.querySelector('#resetExpenseFiltersBtn');
  const totalAmountEl = container.querySelector('#expenseTotalAmount');

  // Helper to compute date range from preset
  const applyPeriodPreset = (preset) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed

    if (preset === 'THIS_MONTH') {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      filterStartDate = first.toISOString().split('T')[0];
      filterEndDate = last.toISOString().split('T')[0];
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      filterStartDate = first.toISOString().split('T')[0];
      filterEndDate = last.toISOString().split('T')[0];
    } else if (preset === 'THIS_YEAR') {
      filterStartDate = `${y}-01-01`;
      filterEndDate = `${y}-12-31`;
    } else if (preset === 'ALL') {
      filterStartDate = '';
      filterEndDate = '';
    }
    startDateInput.value = filterStartDate;
    endDateInput.value = filterEndDate;
  };

  const loadData = async (page = 0) => {
    currentPage = page;
    showLoading(tableContainer, 'Loading expenses...');

    try {
      const params = {
        page,
        size: pageSize,
        sort: 'expenseDate,desc'
      };
      if (filterSearch) params.search = filterSearch;
      if (filterCategory && filterCategory !== 'ALL') params.category = filterCategory;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;

      const resp = await expenseService.getAll(params);
      const { content, page: pageMeta } = extractPage(resp);

      // Compute page total amount
      const pageTotal = content.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      if (totalAmountEl) {
        totalAmountEl.textContent = formatCurrency(pageTotal);
      }

      const categoryBadge = (cat) => {
        const map = {
          RENT: 'info', ELECTRICITY: 'warning', SALARY: 'success',
          SUPPLIES: 'secondary', MAINTENANCE: 'danger', MARKETING: 'info',
          UTILITIES: 'warning', MISCELLANEOUS: 'secondary'
        };
        return badge(cat, map[cat] || 'secondary');
      };

      const columns = [
        { key: 'category', label: 'Category', render: (val) => categoryBadge(val) },
        { key: 'amount', label: 'Amount', render: (val) => `<strong style="color:var(--danger)">-${formatCurrency(val)}</strong>` },
        { key: 'description', label: 'Description', render: (val) => val || '—' },
        { key: 'expenseDate', label: 'Expense Date', render: (val) => formatDate(val) },
        { key: 'loggedBy', label: 'Logged By', render: (val) => val ? `<span style="font-size:0.8rem;color:var(--text-muted)">👤 ${val}</span>` : '—' }
      ];

      const actions = [];
      if (can('manage_expenses')) {
        actions.push({
          label: 'Edit',
          class: 'btn-secondary',
          icon: '✏️',
          onClick: (exp) => openEditModal(exp)
        });
        actions.push({
          label: 'Delete',
          class: 'btn-danger',
          icon: '🗑️',
          onClick: async (exp) => {
            const ok = await confirm(`Are you sure you want to delete this ${exp.category} expense of ${formatCurrency(exp.amount)}?`, { title: 'Delete Expense', danger: true });
            if (ok) {
              try {
                const delResp = await expenseService.delete(exp.id);
                if (delResp?.success) {
                  showToast('Expense record deleted', 'success');
                  loadData(currentPage);
                } else {
                  showToast(delResp?.message || 'Delete failed', 'error');
                }
              } catch (e) {
                showToast(e.message || 'Error deleting expense', 'error');
              }
            }
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions, defaultSortKey: 'expenseDate', defaultSortDir: 'desc' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading expenses');
    }
  };

  // Event handlers
  searchInput.addEventListener('input', debounce((e) => {
    filterSearch = e.target.value.trim();
    loadData(0);
  }, 300));

  categoryFilter.addEventListener('change', (e) => {
    filterCategory = e.target.value;
    loadData(0);
  });

  periodFilter.addEventListener('change', (e) => {
    filterPeriod = e.target.value;
    applyPeriodPreset(filterPeriod);
    loadData(0);
  });

  startDateInput.addEventListener('change', (e) => {
    filterStartDate = e.target.value;
    periodFilter.value = 'CUSTOM';
    loadData(0);
  });

  endDateInput.addEventListener('change', (e) => {
    filterEndDate = e.target.value;
    periodFilter.value = 'CUSTOM';
    loadData(0);
  });

  resetBtn.addEventListener('click', () => {
    filterCategory = 'ALL';
    filterPeriod = 'ALL';
    filterStartDate = '';
    filterEndDate = '';
    filterSearch = '';
    searchInput.value = '';
    categoryFilter.value = 'ALL';
    periodFilter.value = 'ALL';
    startDateInput.value = '';
    endDateInput.value = '';
    loadData(0);
  });

  const expenseFields = [
    {
      name: 'category', label: 'Category', type: 'select', required: true,
      options: [
        { value: 'RENT', label: 'Rent' },
        { value: 'SALARY', label: 'Salary / Wages' },
        { value: 'ELECTRICITY', label: 'Electricity & Power' },
        { value: 'SUPPLIES', label: 'Packaging & Supplies' },
        { value: 'MAINTENANCE', label: 'Maintenance & Repairs' },
        { value: 'UTILITIES', label: 'Water & Utilities' },
        { value: 'MARKETING', label: 'Marketing & Signage' },
        { value: 'MISCELLANEOUS', label: 'Miscellaneous' }
      ]
    },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, placeholder: '1500.00' },
    { name: 'description', label: 'Description / Purpose', type: 'textarea' },
    { name: 'expenseDate', label: 'Expense Date', type: 'date', required: true }
  ];

  const openAddModal = () => {
    const formHtml = `<form id="addExpForm">${buildFormHtml(expenseFields, { expenseDate: new Date().toISOString().split('T')[0] })}</form>`;
    const modal = showModal({
      title: 'Log New Expense',
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Save Expense',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#addExpForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.amount = Number(data.amount) || 0;

            try {
              const res = await expenseService.create(data);
              if (res?.success) {
                showToast('Expense logged successfully', 'success');
                modal.close();
                loadData(0);
              } else {
                showToast(res?.message || 'Failed to log expense', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error logging expense', 'error');
            }
          }
        }
      ]
    });
  };

  const openEditModal = (exp) => {
    const formHtml = `<form id="editExpForm">${buildFormHtml(expenseFields, {
      category: exp.category,
      amount: exp.amount,
      description: exp.description || '',
      expenseDate: exp.expenseDate
    })}</form>`;

    const modal = showModal({
      title: `Edit Expense: ${exp.category}`,
      body: formHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Update Expense',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#editExpForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            data.amount = Number(data.amount) || 0;

            try {
              const res = await expenseService.update(exp.id, data);
              if (res?.success) {
                showToast('Expense updated successfully', 'success');
                modal.close();
                loadData(currentPage);
              } else {
                showToast(res?.message || 'Failed to update expense', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error updating expense', 'error');
            }
          }
        }
      ]
    });
  };

  if (addBtn) addBtn.addEventListener('click', openAddModal);

  loadData();
}
