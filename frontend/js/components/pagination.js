// js/components/pagination.js

/**
 * Render pagination controls.
 * @param {HTMLElement} container - element to render into
 * @param {object} page - Spring Data Page object { number, totalPages, totalElements }
 * @param {Function} onPageChange - callback(pageNumber)
 */
export function renderPagination(container, page, onPageChange) {
  if (!page || page.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const { number: current, totalPages } = page;

  // Show window of pages: prev 2, current, next 2
  const pages = [];
  const start = Math.max(0, current - 2);
  const end = Math.min(totalPages - 1, current + 2);

  if (start > 0) pages.push({ label: '1', page: 0 });
  if (start > 1) pages.push({ label: '…', page: null });
  for (let i = start; i <= end; i++) pages.push({ label: String(i + 1), page: i });
  if (end < totalPages - 2) pages.push({ label: '…', page: null });
  if (end < totalPages - 1) pages.push({ label: String(totalPages), page: totalPages - 1 });

  container.innerHTML = `
    <div class="pagination">
      <button class="page-btn" ${current === 0 ? 'disabled' : ''} data-page="${current - 1}">‹</button>
      ${pages.map(p => p.page === null
        ? `<span class="page-btn" style="cursor:default;opacity:0.5">${p.label}</span>`
        : `<button class="page-btn ${p.page === current ? 'active' : ''}" data-page="${p.page}">${p.label}</button>`
      ).join('')}
      <button class="page-btn" ${current >= totalPages - 1 ? 'disabled' : ''} data-page="${current + 1}">›</button>
    </div>
    <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:6px">
      Page ${current + 1} of ${totalPages} · ${page.totalElements ?? ''} records
    </div>`;

  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(p)) onPageChange(p);
    });
  });
}
