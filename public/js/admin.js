/* ============================================================
   admin.js — Admin Dashboard (Enhanced)
   ============================================================ */
const API = '/api';

// Guard — admin only
if (!AUTH.user || AUTH.user.role !== 'admin') {
  alert('Admin access required');
  window.location.href = 'my-documents.html';
}

let allDocuments  = [];
let allUsers      = [];
let docRiskFilter = 'all';
let userRoleFilter= 'all';

let pendingDelete = null; // { type, id }
let pendingRole   = null; // { id, newRole, name }

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Populate sidebar user info
  const name = AUTH.user.full_name || 'Admin';
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarInitials').textContent = name.charAt(0).toUpperCase();

  // Sidebar nav
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Modals
  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
  document.getElementById('btnCancelRole').addEventListener('click', closeRoleModal);
  document.getElementById('btnConfirmRole').addEventListener('click', confirmRoleChange);

  // Doc search
  document.getElementById('docSearch').addEventListener('input', e => {
    renderDocuments(applyDocFilters(e.target.value));
  });

  // User search
  document.getElementById('userSearch').addEventListener('input', e => {
    renderUsers(applyUserFilters(e.target.value));
  });

  await refreshAll();
});

/* ─────────────────────────────────────────────
   REFRESH / LOAD ALL
───────────────────────────────────────────── */
async function refreshAll() {
  const icon = document.getElementById('refreshIcon');
  icon.classList.add('spin');
  try {
    await Promise.all([loadStats(), loadDocuments(), loadUsers()]);
  } finally {
    icon.classList.remove('spin');
  }
}
window.refreshAll = refreshAll;

/* ─────────────────────────────────────────────
   TAB NAVIGATION
───────────────────────────────────────────── */
function switchTab(tabName) {
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(b => b.classList.remove('active'));
  const active = document.querySelector(`.sidebar-link[data-tab="${tabName}"]`);
  if (active) active.classList.add('active');

  document.querySelectorAll('.admin-tab-content').forEach(s => s.classList.remove('active'));
  const section = document.getElementById(`tab-${tabName}`);
  if (section) section.classList.add('active');

  const labels = { overview:'Overview', documents:'Documents', users:'Users', system:'System Info' };
  document.getElementById('topbarPage').textContent = labels[tabName] || tabName;

  // Close mobile sidebar
  document.getElementById('adminSidebar').classList.remove('open');
}
window.switchTab = switchTab;

/* ─────────────────────────────────────────────
   LOAD STATS
───────────────────────────────────────────── */
async function loadStats() {
  try {
    const res  = await authFetch(`${API}/admin/stats`);
    const data = await res.json();
    const total = data.total_documents || 0;
    const users = data.total_users     || 0;
    const paras = data.total_paragraphs|| 0;

    document.getElementById('kpiDocs').textContent  = total;
    document.getElementById('kpiUsers').textContent = users;
    document.getElementById('kpiParas').textContent = paras;

    // System tab mirrors
    document.getElementById('sysStatDocs').textContent  = total;
    document.getElementById('sysStatParas').textContent = paras;
    document.getElementById('sysStatUsers').textContent = users;

    // Sidebar badges
    document.getElementById('sidebarDocCount').textContent  = total;
    document.getElementById('sidebarUserCount').textContent = users;
  } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────
   LOAD DOCUMENTS
───────────────────────────────────────────── */
async function loadDocuments() {
  try {
    const res  = await authFetch(`${API}/admin/documents`);
    const data = await res.json();
    allDocuments = data.documents || [];
    updateDocStats();
    renderDocuments(applyDocFilters(document.getElementById('docSearch').value));
    renderRecentList();
  } catch {
    document.getElementById('docTableBody').innerHTML =
      `<tr><td colspan="9"><div class="table-empty"><i class="fas fa-circle-exclamation"></i><p>Failed to load documents</p></div></td></tr>`;
  }
}

/* ─────────────────────────────────────────────
   LOAD USERS
───────────────────────────────────────────── */
async function loadUsers() {
  try {
    const res  = await authFetch(`${API}/admin/users`);
    const data = await res.json();
    allUsers = data.users || [];
    updateUserStats();
    renderUsers(applyUserFilters(document.getElementById('userSearch').value));
  } catch {
    document.getElementById('usersTableBody').innerHTML =
      `<tr><td colspan="6"><div class="table-empty"><i class="fas fa-circle-exclamation"></i><p>Failed to load users</p></div></td></tr>`;
  }
}

/* ─────────────────────────────────────────────
   COMPUTED STATS
───────────────────────────────────────────── */
function updateDocStats() {
  const total = allDocuments.length;
  const low   = allDocuments.filter(d => (d.similarity_score||0) < 30).length;
  const med   = allDocuments.filter(d => { const s=d.similarity_score||0; return s>=30&&s<60; }).length;
  const high  = allDocuments.filter(d => (d.similarity_score||0) >= 60).length;
  const avg   = total ? Math.round(allDocuments.reduce((a,d)=>a+(d.similarity_score||0),0)/total) : 0;

  document.getElementById('kpiAvg').textContent   = avg + '%';
  document.getElementById('qsClean').textContent  = low;
  document.getElementById('qsHigh').textContent   = high;
  document.getElementById('filterAllCount').textContent = total;
  document.getElementById('distTotal').textContent = total + ' docs';
  document.getElementById('countLow').textContent  = low;
  document.getElementById('countMed').textContent  = med;
  document.getElementById('countHigh').textContent = high;
  document.getElementById('sysStatAvg').textContent= avg + '%';
  document.getElementById('sysStatClean').textContent = low;

  const kpiParas = parseInt(document.getElementById('kpiParas').textContent)||0;
  document.getElementById('qsAvgPara').textContent = total ? Math.round(kpiParas/total) : 0;

  // Animate bars (after paint)
  requestAnimationFrame(() => {
    document.getElementById('barLow').style.width  = total ? (low/total*100)+'%'  : '0%';
    document.getElementById('barMed').style.width  = total ? (med/total*100)+'%'  : '0%';
    document.getElementById('barHigh').style.width = total ? (high/total*100)+'%' : '0%';
  });
}

function updateUserStats() {
  const admins = allUsers.filter(u=>u.role==='admin').length;
  document.getElementById('qsAdmins').textContent    = admins;
  document.getElementById('sysStatAdmins').textContent = admins;
}

/* ─────────────────────────────────────────────
   RECENT UPLOADS LIST
───────────────────────────────────────────── */
function renderRecentList() {
  const container = document.getElementById('recentList');
  const recent    = [...allDocuments].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);

  if (!recent.length) {
    container.innerHTML = `<div class="recent-empty"><i class="fas fa-inbox"></i> No documents yet</div>`;
    return;
  }

  container.innerHTML = recent.map(doc => {
    const s    = doc.similarity_score || 0;
    const cls  = s >= 60 ? 'high' : s >= 30 ? 'medium' : 'low';
    const name = doc.uploader ? doc.uploader.full_name : 'Unknown';
    return `
      <div class="recent-item">
        <div class="recent-file-icon"><i class="fas fa-file-lines"></i></div>
        <div class="recent-meta">
          <div class="recent-title">${escapeHtml(doc.title)}</div>
          <div class="recent-sub">by ${escapeHtml(name)} &nbsp;·&nbsp; ${formatDate(doc.created_at)}</div>
        </div>
        <span class="recent-score ${cls}">${s}%</span>
      </div>
    `;
  }).join('');
}

/* ─────────────────────────────────────────────
   DOCUMENT TABLE
───────────────────────────────────────────── */
function applyDocFilters(searchVal = '') {
  const q = searchVal.toLowerCase().trim();
  return allDocuments.filter(doc => {
    const matchRisk = docRiskFilter === 'all'
      || (docRiskFilter === 'low'    && (doc.similarity_score||0) < 30)
      || (docRiskFilter === 'medium' && (doc.similarity_score||0) >= 30 && (doc.similarity_score||0) < 60)
      || (docRiskFilter === 'high'   && (doc.similarity_score||0) >= 60);
    const matchSearch = !q
      || (doc.title||'').toLowerCase().includes(q)
      || (doc.authors||'').toLowerCase().includes(q)
      || (doc.course||'').toLowerCase().includes(q)
      || (doc.uploader?.full_name||'').toLowerCase().includes(q);
    return matchRisk && matchSearch;
  });
}

function renderDocuments(docs) {
  const tbody = document.getElementById('docTableBody');
  document.getElementById('docTableInfo').textContent = `Showing ${docs.length} of ${allDocuments.length} documents`;

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="table-empty"><i class="fas fa-folder-open"></i><p>No documents match your filter</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map((doc, i) => {
    const s    = doc.similarity_score || 0;
    const cls  = s >= 60 ? 'high' : s >= 30 ? 'medium' : 'low';
    const name = doc.uploader ? doc.uploader.full_name : '—';
    const initials = name !== '—' ? name.charAt(0).toUpperCase() : '?';
    return `
      <tr>
        <td style="color:#9CA3AF;font-size:.78rem;">${i+1}</td>
        <td>
          <div class="doc-title-wrap">
            <strong>${escapeHtml(doc.title)}</strong>
            <small>${escapeHtml(doc.original_filename || '')}</small>
          </div>
        </td>
        <td style="font-size:.8rem;">${escapeHtml(doc.authors || '—')}</td>
        <td style="font-size:.8rem;">${escapeHtml(doc.course || '—')}</td>
        <td style="font-size:.8rem;">${doc.year || '—'}</td>
        <td>
          <div class="user-cell">
            <div class="user-avatar" style="width:26px;height:26px;font-size:.62rem;">${initials}</div>
            <span style="font-size:.8rem;">${escapeHtml(name)}</span>
          </div>
        </td>
        <td><span class="sim-pill ${cls}">${s}%</span></td>
        <td style="font-size:.78rem;color:#6B7280;white-space:nowrap;">${formatDate(doc.created_at)}</td>
        <td>
          <div class="action-group">
            <a href="result.html?id=${doc.id}" class="act-btn view" title="View Report"><i class="fas fa-eye"></i></a>
            <button class="act-btn del" onclick="openDeleteModal('document','${doc.id}','${escapeHtml(doc.title).replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDocs(btn, risk) {
  docRiskFilter = risk;
  document.querySelectorAll('.filter-btn').forEach(b => {
    if (b.closest('#tab-documents')) b.classList.remove('active');
  });
  btn.classList.add('active');
  renderDocuments(applyDocFilters(document.getElementById('docSearch').value));
}
window.filterDocs = filterDocs;

/* ─────────────────────────────────────────────
   USERS TABLE
───────────────────────────────────────────── */
function applyUserFilters(searchVal = '') {
  const q = searchVal.toLowerCase().trim();
  return allUsers.filter(u => {
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchSearch = !q
      || (u.full_name||'').toLowerCase().includes(q)
      || (u.email||'').toLowerCase().includes(q);
    return matchRole && matchSearch;
  });
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  document.getElementById('userTableInfo').textContent = `Showing ${users.length} of ${allUsers.length} users`;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><i class="fas fa-users-slash"></i><p>No users match your filter</p></div></td></tr>`;
    return;
  }

  const currentId = AUTH.user.id;
  tbody.innerHTML = users.map(u => {
    const isSelf    = u.id === currentId;
    const isAdmin   = u.role === 'admin';
    const initials  = (u.full_name||'?').charAt(0).toUpperCase();
    const roleLabel = isAdmin ? 'admin' : 'user';

    const roleBtn = isSelf ? '' : isAdmin
      ? `<button class="act-btn demote" title="Demote to User" onclick="openRoleModal('${u.id}','user','${escapeHtml(u.full_name).replace(/'/g,"\\'")}')"><i class="fas fa-arrow-down"></i></button>`
      : `<button class="act-btn promote" title="Promote to Admin" onclick="openRoleModal('${u.id}','admin','${escapeHtml(u.full_name).replace(/'/g,"\\'")}')"><i class="fas fa-shield"></i></button>`;

    const delBtn = isSelf ? '' :
      `<button class="act-btn del" onclick="openDeleteModal('user','${u.id}','${escapeHtml(u.full_name).replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>`;

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${initials}</div>
            <div>
              <div class="user-name">${escapeHtml(u.full_name)}${isSelf ? ' <span style="font-size:.65rem;color:#059669;font-weight:700;">(you)</span>' : ''}</div>
            </div>
          </div>
        </td>
        <td style="font-size:.8rem;color:#6B7280;">${escapeHtml(u.email)}</td>
        <td><span class="role-pill ${roleLabel}"><i class="fas fa-${isAdmin?'shield-halved':'user'}"></i> ${roleLabel}</span></td>
        <td style="font-weight:700;">${u.document_count || 0}</td>
        <td style="font-size:.78rem;color:#6B7280;white-space:nowrap;">${formatDate(u.created_at)}</td>
        <td>
          <div class="action-group">
            ${roleBtn}
            ${delBtn}
            ${isSelf ? '<span style="font-size:.72rem;color:#9CA3AF;">—</span>' : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers(btn, role) {
  userRoleFilter = role;
  document.querySelectorAll('#tab-users .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderUsers(applyUserFilters(document.getElementById('userSearch').value));
}
window.filterUsers = filterUsers;

/* ─────────────────────────────────────────────
   DELETE MODAL
───────────────────────────────────────────── */
function openDeleteModal(type, id, name) {
  pendingDelete = { type, id };
  const noun = type === 'document' ? 'document' : 'user account';
  document.getElementById('deleteMessage').textContent =
    `Are you sure you want to permanently delete the ${noun} "${name}"? This cannot be undone.`;
  document.getElementById('deleteModal').classList.remove('hidden');
}
window.openDeleteModal = openDeleteModal;

function closeDeleteModal() {
  pendingDelete = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const btn = document.getElementById('btnConfirmDelete');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';
  try {
    const url = pendingDelete.type === 'document'
      ? `${API}/admin/documents/${pendingDelete.id}`
      : `${API}/admin/users/${pendingDelete.id}`;
    const res = await authFetch(url, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error||'Delete failed'); }
    closeDeleteModal();
    showToast('Deleted successfully', 'success');
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
  }
}

/* ─────────────────────────────────────────────
   ROLE MODAL
───────────────────────────────────────────── */
function openRoleModal(id, newRole, name) {
  pendingRole = { id, newRole, name };
  const action = newRole === 'admin' ? 'promote to Admin' : 'demote to User';
  document.getElementById('roleModalTitle').innerHTML =
    `<i class="fas fa-user-gear" style="color:#1565C0;"></i> ${newRole==='admin'?'Promote':'Demote'} User`;
  document.getElementById('roleModalMessage').textContent =
    `Are you sure you want to ${action} "${name}"?`;
  document.getElementById('roleModal').classList.remove('hidden');
}
window.openRoleModal = openRoleModal;

function closeRoleModal() {
  pendingRole = null;
  document.getElementById('roleModal').classList.add('hidden');
}

async function confirmRoleChange() {
  if (!pendingRole) return;
  const btn = document.getElementById('btnConfirmRole');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  try {
    const res = await authFetch(`${API}/admin/users/${pendingRole.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: pendingRole.newRole })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error||'Update failed'); }
    closeRoleModal();
    showToast(`Role updated to "${pendingRole.newRole}"`, 'success');
    await loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Confirm';
  }
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type = 'info') {
  const el   = document.getElementById('adminToast');
  const icon = document.getElementById('toastIcon');
  document.getElementById('toastMsg').textContent = msg;
  el.className = `admin-toast ${type}`;
  icon.className = type === 'success' ? 'fas fa-circle-check'
    : type === 'error' ? 'fas fa-circle-xmark' : 'fas fa-circle-info';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

