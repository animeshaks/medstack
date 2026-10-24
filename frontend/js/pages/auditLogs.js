// js/pages/auditLogs.js
import { auditService } from '../services/auditService.js';
import { showToast } from '../components/toast.js';
import { debounce } from '../utils.js';
import { getToken } from '../auth.js';

export default async function renderAuditLogs(container) {
  let state = {
    page: 0,
    size: 20,
    outcome: 'ALL',
    username: '',
    search: '',
    autoRefresh: true,
    timer: null,
    loading: false
  };

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="margin:0 0 4px 0;display:flex;align-items:center;gap:8px">
          <span>📜</span> System Activity &amp; Audit Logs
        </h2>
        <p style="margin:0;color:var(--text-secondary);font-size:0.875rem">
          Comprehensive traceability of all user actions, system operations, and error capturing.
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);user-select:none">
          <input type="checkbox" id="auditAutoRefreshToggle" checked />
          <span>Live Auto-Refresh (5s)</span>
        </label>
        <button id="refreshAuditBtn" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:6px">
          <span>🔄</span> Refresh
        </button>
        <button id="downloadAuditBtn" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px">
          <span>📥</span> Download Audit Log
        </button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div id="auditKpiContainer" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:16px;margin-bottom:20px">
      <div class="card" style="padding:16px;border-left:4px solid var(--accent)">
        <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">Today's Activities</div>
        <div id="kpiTotalToday" style="font-size:1.6rem;font-weight:700">--</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">All logged actions today</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid var(--success)">
        <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">Successful Actions</div>
        <div id="kpiSuccessToday" style="font-size:1.6rem;font-weight:700;color:var(--success)">--</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Completed with 2xx status</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid var(--danger)">
        <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">Errors &amp; Failures</div>
        <div id="kpiFailureToday" style="font-size:1.6rem;font-weight:700;color:var(--danger)">--</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Validation / auth / server errors</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid #8b5cf6">
        <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">Retention &amp; Log File</div>
        <div id="kpiRetention" style="font-size:1.1rem;font-weight:700;margin-top:4px">--</div>
        <div id="kpiFileSize" style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">--</div>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="card" style="padding:16px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;align-items:end">
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.8rem">Search Activity / Details</label>
          <input type="text" id="auditSearchInput" class="form-control" placeholder="Search action, error, URI, req ID..." />
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.8rem">Filter by Outcome</label>
          <select id="auditOutcomeSelect" class="form-control">
            <option value="ALL">All Outcomes (Success &amp; Failure)</option>
            <option value="SUCCESS">✅ Success Only</option>
            <option value="FAILURE">❌ Errors / Failures Only</option>
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.8rem">Filter by Username</label>
          <input type="text" id="auditUserInput" class="form-control" placeholder="e.g. admin, owner, staff..." />
        </div>
        <div style="display:flex;gap:8px">
          <button id="auditClearFilterBtn" class="btn btn-secondary" style="flex:1">
            Reset Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Audit Logs Data Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-responsive" style="max-height:650px;overflow-y:auto">
        <table class="table" style="margin:0;width:100%;border-collapse:collapse;font-size:0.85rem">
          <thead style="position:sticky;top:0;background:var(--bg-secondary);z-index:2;box-shadow:0 1px 2px rgba(0,0,0,0.1)">
            <tr>
              <th style="padding:10px 14px;text-align:left;min-width:170px">Timestamp (Local)</th>
              <th style="padding:10px 14px;text-align:left">User</th>
              <th style="padding:10px 14px;text-align:left">Action</th>
              <th style="padding:10px 14px;text-align:center">Outcome</th>
              <th style="padding:10px 14px;text-align:right">Duration</th>
              <th style="padding:10px 14px;text-align:left">Client IP</th>
              <th style="padding:10px 14px;text-align:left;min-width:260px">Details / Error Message</th>
            </tr>
          </thead>
          <tbody id="auditTableBody">
            <tr>
              <td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">
                Loading audit logs...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div id="auditPagination" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-secondary);font-size:0.85rem">
        <span id="auditPageInfo" style="color:var(--text-secondary)">Showing 0 of 0</span>
        <div style="display:flex;gap:6px">
          <button id="auditPrevBtn" class="btn btn-sm btn-secondary" disabled>&larr; Prev</button>
          <button id="auditNextBtn" class="btn btn-sm btn-secondary" disabled>Next &rarr;</button>
        </div>
      </div>
    </div>
  `;

  // ── Functions ─────────────────────────────────────────────────────────────

  async function loadSummary() {
    try {
      const resp = await auditService.getSummary();
      if (resp && resp.data) {
        const s = resp.data;
        const totalEl = document.getElementById('kpiTotalToday');
        const successEl = document.getElementById('kpiSuccessToday');
        const failureEl = document.getElementById('kpiFailureToday');
        const retEl = document.getElementById('kpiRetention');
        const sizeEl = document.getElementById('kpiFileSize');

        if (totalEl) totalEl.textContent = s.totalEventsToday.toLocaleString();
        if (successEl) successEl.textContent = s.successCountToday.toLocaleString();
        if (failureEl) failureEl.textContent = s.failureCountToday.toLocaleString();
        if (retEl) retEl.textContent = `${s.retentionDays} Days Retention`;
        if (sizeEl) sizeEl.textContent = `Log Size: ${s.formattedFileSize || '0 B'}`;
      }
    } catch (e) {
      console.warn('Failed to load audit summary:', e);
    }
  }

  async function loadLogs() {
    if (state.loading) return;
    state.loading = true;

    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    try {
      const resp = await auditService.getLogs({
        page: state.page,
        size: state.size,
        outcome: state.outcome,
        username: state.username,
        search: state.search
      });

      if (!resp || !resp.data) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No logs available</td></tr>`;
        return;
      }

      const pageData = resp.data;
      const events = pageData.content || [];
      const totalElements = pageData.totalElements || 0;
      const totalPages = pageData.totalPages || 0;

      // Update Pagination info
      const pageInfo = document.getElementById('auditPageInfo');
      const prevBtn = document.getElementById('auditPrevBtn');
      const nextBtn = document.getElementById('auditNextBtn');

      if (pageInfo) {
        const start = totalElements === 0 ? 0 : state.page * state.size + 1;
        const end = Math.min((state.page + 1) * state.size, totalElements);
        pageInfo.textContent = `Showing ${start}-${end} of ${totalElements} entries`;
      }
      if (prevBtn) prevBtn.disabled = state.page <= 0;
      if (nextBtn) nextBtn.disabled = state.page >= totalPages - 1;

      if (events.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:36px;color:var(--text-muted)">
              <div style="font-size:2rem;margin-bottom:8px">📜</div>
              <div>No audit log events match your filter criteria.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = events.map(e => {
        const isSuccess = 'SUCCESS'.equalsIgnoreCase(e.outcome);
        const outcomeBadge = isSuccess
          ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;background:rgba(34,197,94,0.15);color:#16a34a">SUCCESS (${e.statusCode || 200})</span>`
          : `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;background:rgba(239,68,68,0.15);color:#dc2626">FAILURE (${e.statusCode || 400})</span>`;

        const roleColor = e.role === 'ADMIN' ? '#8b5cf6' : (e.role === 'OWNER' ? 'var(--accent)' : 'var(--text-secondary)');
        const roleBadge = `<span style="display:inline-block;font-size:0.7rem;padding:1px 6px;border-radius:4px;background:var(--bg-tertiary);color:${roleColor};font-weight:bold">${e.role || 'USER'}</span>`;

        let detailsHtml = '';
        if (e.errorMessage) {
          detailsHtml = `<div style="color:var(--danger);font-weight:500;margin-bottom:2px">⚠️ ${escapeHtml(e.errorMessage)}</div>`;
        }
        if (e.details) {
          detailsHtml += `<div style="color:var(--text-secondary);font-size:0.75rem;word-break:break-all">${escapeHtml(e.details)}</div>`;
        }
        if (e.requestId) {
          detailsHtml += `<div style="color:var(--text-muted);font-size:0.7rem;margin-top:2px">Req: <code>${escapeHtml(e.requestId)}</code></div>`;
        }

        return `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 14px;white-space:nowrap;font-family:monospace;font-size:0.8rem">
              ${escapeHtml(e.timestamp || '')}
            </td>
            <td style="padding:10px 14px;white-space:nowrap">
              <div style="font-weight:600">${escapeHtml(e.username || 'ANONYMOUS')}</div>
              <div style="margin-top:2px">${roleBadge}</div>
            </td>
            <td style="padding:10px 14px">
              <span style="font-weight:600;display:inline-block;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.8rem">
                ${escapeHtml(e.action || '')}
              </span>
            </td>
            <td style="padding:10px 14px;text-align:center;white-space:nowrap">
              ${outcomeBadge}
            </td>
            <td style="padding:10px 14px;text-align:right;white-space:nowrap;font-family:monospace">
              ${e.durationMs}ms
            </td>
            <td style="padding:10px 14px;white-space:nowrap;font-family:monospace;font-size:0.75rem;color:var(--text-secondary)">
              ${escapeHtml(e.clientIp || '-')}
            </td>
            <td style="padding:10px 14px">
              ${detailsHtml || '<span style="color:var(--text-muted)">-</span>'}
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load audit logs:', err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">Failed to load audit logs: ${escapeHtml(err.message || 'Error')}</td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    state.timer = setInterval(() => {
      if (state.autoRefresh && document.getElementById('auditTableBody')) {
        loadLogs();
        loadSummary();
      }
    }, 5000);
  }

  function stopAutoRefresh() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  const searchInput = document.getElementById('auditSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      state.search = e.target.value;
      state.page = 0;
      loadLogs();
    }, 300));
  }

  const outcomeSelect = document.getElementById('auditOutcomeSelect');
  if (outcomeSelect) {
    outcomeSelect.addEventListener('change', (e) => {
      state.outcome = e.target.value;
      state.page = 0;
      loadLogs();
    });
  }

  const userInput = document.getElementById('auditUserInput');
  if (userInput) {
    userInput.addEventListener('input', debounce((e) => {
      state.username = e.target.value;
      state.page = 0;
      loadLogs();
    }, 300));
  }

  const clearBtn = document.getElementById('auditClearFilterBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (outcomeSelect) outcomeSelect.value = 'ALL';
      if (userInput) userInput.value = '';
      state.search = '';
      state.outcome = 'ALL';
      state.username = '';
      state.page = 0;
      loadLogs();
    });
  }

  const refreshBtn = document.getElementById('refreshAuditBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadLogs();
      loadSummary();
      showToast('Audit logs refreshed', 'info');
    });
  }

  const autoToggle = document.getElementById('auditAutoRefreshToggle');
  if (autoToggle) {
    autoToggle.addEventListener('change', (e) => {
      state.autoRefresh = e.target.checked;
      if (state.autoRefresh) {
        startAutoRefresh();
        showToast('Live auto-refresh enabled (5s)', 'info');
      } else {
        stopAutoRefresh();
        showToast('Live auto-refresh paused', 'info');
      }
    });
  }

  const prevBtn = document.getElementById('auditPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.page > 0) {
        state.page--;
        loadLogs();
      }
    });
  }

  const nextBtn = document.getElementById('auditNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.page++;
      loadLogs();
    });
  }

  // Download raw audit log file via authenticated fetch
  const downloadBtn = document.getElementById('downloadAuditBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';

        const token = getToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const isProxied = window.location.port === '3000' || window.location.port === '80' || window.location.port === '8088';
        const apiBase = isProxied ? '/api/v1' : 'http://localhost:8080/api/v1';

        const resp = await fetch(`${apiBase}/audit/download`, { headers });
        if (!resp.ok) {
          throw new Error(`Download failed with status ${resp.status}`);
        }

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-audit-${new Date().toISOString().slice(0, 10)}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Audit log file downloaded successfully', 'success');
      } catch (err) {
        showToast('Failed to download audit log: ' + err.message, 'error');
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span>📥</span> Download Audit Log';
      }
    });
  }

  // Initial Load
  loadSummary();
  loadLogs();
  startAutoRefresh();

  // Helper string case-insensitive equality
  function equalsIgnoreCase(a, b) {
    return (a || '').toLowerCase() === (b || '').toLowerCase();
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
