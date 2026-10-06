// js/components/table.js

/**
 * Render a data table into a container.
 * @param {HTMLElement} container
 * @param {Array<{key, label, render?}>} columns
 * @param {Array<object>} rows
 * @param {object} [opts]
 * @param {Array<{label, class?, onClick}>} [opts.actions] - row action buttons
 */
export function renderTable(container, columns, rows, { actions = [], onSort = null, defaultSortKey = null, defaultSortDir = 'desc' } = {}) {
  if (!rows || rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">No records found</div>
      </div>`;
    return;
  }

  let currentRows = [...rows];
  let currentSortKey = defaultSortKey;
  let currentSortDir = defaultSortDir; // 'asc' | 'desc' | 'none'

  const hasActions = actions.length > 0;

  function getSortVal(row, col) {
    const raw = col.render ? col.render(row[col.key], row) : row[col.key];
    if (raw === null || raw === undefined) return null;
    // Strip HTML tags if rendered
    let text = typeof raw === 'string' ? raw.replace(/<[^>]*>/g, '').trim() : raw;
    if (typeof text === 'number') return text;
    if (typeof text === 'string') {
      const numMatch = text.replace(/^[^\d.-]+/, '').replace(/,/g, '');
      if (numMatch && !isNaN(numMatch) && !isNaN(parseFloat(numMatch))) {
        return parseFloat(numMatch);
      }
      const parsedDate = Date.parse(text);
      if (!isNaN(parsedDate) && text.length >= 8 && (text.includes('-') || text.includes('/') || text.includes(':'))) {
        return parsedDate;
      }
      return text.toLowerCase();
    }
    return text;
  }

  function sortData(key, dir) {
    if (!key || dir === 'none') {
      currentRows = [...rows];
      return;
    }
    const col = columns.find(c => c.key === key);
    if (!col) return;

    currentRows.sort((a, b) => {
      const valA = getSortVal(a, col);
      const valB = getSortVal(b, col);

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  function renderHeaderHtml() {
    const cells = columns.map(c => {
      const isSorted = currentSortKey === c.key && currentSortDir !== 'none';
      let icon = '<span style="opacity:0.35;font-size:0.75rem;margin-left:4px">⇅</span>';
      if (isSorted) {
        icon = currentSortDir === 'asc' 
          ? '<span style="color:var(--accent);font-size:0.75rem;margin-left:4px">▲</span>' 
          : '<span style="color:var(--accent);font-size:0.75rem;margin-left:4px">▼</span>';
      }
      return `<th data-col-key="${c.key}" style="cursor:pointer;user-select:none" title="Click to sort by ${c.label}">
        <div style="display:inline-flex;align-items:center;gap:2px">
          <span>${c.label}</span>
          ${icon}
        </div>
      </th>`;
    }).join('');

    const actionHeader = hasActions ? '<th style="width:120px;text-align:right">Actions</th>' : '';
    return `<tr>${cells}${actionHeader}</tr>`;
  }

  function renderBodyRows() {
    return currentRows.map(row => {
      const cells = columns.map(col => {
        const val = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—');
        return `<td>${val}</td>`;
      }).join('');

      const actionCells = hasActions ? `<td style="text-align:right;white-space:nowrap">
        ${actions.map(a => `
          <button class="btn btn-sm ${a.class || 'btn-secondary'}" data-action="${a.label}" title="${a.label}">
            ${a.icon || a.label}
          </button>
        `).join('')}
      </td>` : '';

      return `<tr>${cells}${actionCells}</tr>`;
    }).join('');
  }

  function wireEvents() {
    // Header click sorting
    container.querySelectorAll('thead th[data-col-key]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-col-key');
        if (currentSortKey === key) {
          currentSortDir = currentSortDir === 'asc' ? 'desc' : (currentSortDir === 'desc' ? 'none' : 'asc');
        } else {
          currentSortKey = key;
          currentSortDir = 'asc';
        }
        sortData(currentSortKey, currentSortDir);
        container.querySelector('thead').innerHTML = renderHeaderHtml();
        container.querySelector('tbody').innerHTML = renderBodyRows();
        wireEvents();
        onSort?.(currentSortKey, currentSortDir);
      });
    });

    // Wire action buttons
    if (hasActions) {
      container.querySelectorAll('tbody tr').forEach((tr, idx) => {
        tr.querySelectorAll('[data-action]').forEach(btn => {
          const actionLabel = btn.getAttribute('data-action');
          const action = actions.find(a => a.label === actionLabel);
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            action?.onClick(currentRows[idx], idx);
          });
        });
      });
    }
  }

  if (currentSortKey) {
    sortData(currentSortKey, currentSortDir);
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>${renderHeaderHtml()}</thead>
        <tbody>${renderBodyRows()}</tbody>
      </table>
    </div>`;

  wireEvents();
}

// Badge helpers
export function badge(text, type = 'secondary') {
  return `<span class="badge badge-${type}">${text}</span>`;
}

export function statusBadge(status) {
  const map = {
    ACTIVE: 'success', INACTIVE: 'danger',
    PENDING: 'warning', RECEIVED: 'success', COMPLETED: 'success',
    PARTIALLY_RECEIVED: 'warning',
    RECEIVED_FULL: 'success', RECEIVED_PARTIAL: 'warning', NOT_RECEIVED: 'danger',
    PAID: 'success', UNPAID: 'danger', PARTIAL: 'warning',
    true: 'success', false: 'secondary',
  };
  const label = (status || '').replace(/_/g, ' ');
  return badge(label, map[status] ?? 'secondary');
}
