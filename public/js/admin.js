/* ============================================================
   admin.js — Admin Dashboard logic
   ============================================================ */
const API = '/api';

// Check admin role
if (AUTH.user.role !== 'admin') {
  alert('Admin access required');
  window.location.href = 'my-documents.html';
}

let allDocuments = [];
let allUsers = [];
let pendingDelete = null; // { type: 'document'|'user', id: string }

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadStats(), loadDocuments(), loadUsers()]);

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      const targetId = tab.dataset.tab === 'documents' ? 'documentsTab' : 'usersTab';
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Document search
  document.getElementById('docSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = q ? allDocuments.filter(d => d.title.toLowerCase().includes(q)) : allDocuments;
    renderDocuments(filtered);
  });

  // Delete modal
  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
});

async function loadStats() {
  try {
    const res = await authFetch(`${API}/admin/stats`);
    const data = await res.json();
    document.getElementById('statDocs').textContent = data.total_documents || 0;
    document.getElementById('statUsers').textContent = data.total_users || 0;
    document.getElementById('statParas').textContent = data.total_paragraphs || 0;
  } catch { /* ignore */ }
}

async function loadDocuments() {
  try {
    const res = await authFetch(`${API}/admin/documents`);
    const data = await res.json();
    allDocuments = data.documents || [];
    renderDocuments(allDocuments);
  } catch (err) {
    document.getElementById('docTableBody').innerHTML =
      `<tr><td colspan="5" class="text-danger">Failed to load</td></tr>`;
  }
}

async function loadUsers() {
  try {
    const res = await authFetch(`${API}/admin/users`);
    const data = await res.json();
    allUsers = data.users || [];
    renderUsers(allUsers);
  } catch (err) {
    document.getElementById('usersTableBody').innerHTML =
      `<tr><td colspan="6" class="text-danger">Failed to load</td></tr>`;
  }
}

function renderDocuments(docs) {
  const tbody = document.getElementById('docTableBody');
  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">No documents found</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(doc => {
    const score = doc.similarity_score || 0;
    const riskColor = score >= 60 ? 'var(--red)' : score >= 30 ? 'var(--yellow)' : 'var(--green)';
    const uploaderName = doc.uploader ? doc.uploader.full_name : 'Unknown';
    return `
      <tr>
        <td>
          <div class="doc-title-cell">
            <strong>${escapeHtml(doc.title)}</strong>
            <small class="text-muted">${escapeHtml(doc.original_filename)}</small>
          </div>
        </td>
        <td>${escapeHtml(uploaderName)}</td>
        <td><span style="color:${riskColor};font-weight:700;">${score}%</span></td>
        <td>${formatDate(doc.created_at)}</td>
        <td>
          <div class="action-btns">
            <a href="result.html?id=${doc.id}" class="btn btn-outline btn-sm" title="View Report">
              <i class="fas fa-eye"></i>
            </a>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal('document','${doc.id}','${escapeHtml(doc.title)}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;">No users</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isAdmin = u.role === 'admin';
    return `
      <tr>
        <td><strong>${escapeHtml(u.full_name)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td>
        <td>${u.document_count}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          ${isAdmin ? '<span class="text-muted" style="font-size:.8rem;">Protected</span>' : `
          <button class="btn btn-danger btn-sm" onclick="openDeleteModal('user','${u.id}','${escapeHtml(u.full_name)}')" title="Delete User">
            <i class="fas fa-trash"></i>
          </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function openDeleteModal(type, id, name) {
  pendingDelete = { type, id };
  document.getElementById('deleteMessage').textContent =
    `Are you sure you want to delete ${type === 'document' ? 'the document' : 'user'} "${name}"? This action cannot be undone.`;
  document.getElementById('deleteModal').classList.remove('hidden');
}

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
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }

    closeDeleteModal();
    await Promise.all([loadStats(), loadDocuments(), loadUsers()]);
  } catch (err) {
    alert('Delete failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
