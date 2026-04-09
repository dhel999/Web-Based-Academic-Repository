/* ============================================================
   client-browse.js — Public browsing page
   Shows only approved documents (similarity < 20%)
   ============================================================ */
const API = '/api';
let allDocs = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Update hero upload button destination if logged in
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const heroBtn = document.getElementById('heroUploadBtn');
  if (token && user) {
    heroBtn.href = 'my-documents.html';
  } else {
    heroBtn.href = 'login.html';
  }

  await loadPublicDocuments();
  document.getElementById('searchInput').addEventListener('input', filterDocs);
});

async function loadPublicDocuments() {
  try {
    const res = await fetch(`${API}/documents?approved=true`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    allDocs = data.documents || [];
    renderGrid(allDocs);
  } catch (err) {
    document.getElementById('docGrid').innerHTML =
      `<div class="card"><p class="text-danger"><i class="fas fa-triangle-exclamation"></i> Failed to load documents</p></div>`;
  }
}

function renderGrid(docs) {
  const grid = document.getElementById('docGrid');
  const emptyState = document.getElementById('emptyState');

  if (docs.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = docs.map(doc => {
    const ext = (doc.original_filename || '').split('.').pop().toUpperCase();
    const icon = ext === 'PDF' ? 'fa-file-pdf' : ext === 'DOCX' ? 'fa-file-word' : 'fa-file-lines';

    return `
      <div class="doc-card">
        <div class="doc-card-header">
          <i class="fas ${icon} doc-card-icon"></i>
        </div>
        <div class="doc-card-meta">
          <h3 class="doc-card-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h3>
          <p class="doc-card-file">${escapeHtml(doc.original_filename)}</p>
          <p class="doc-card-file"><i class="fas fa-user"></i> ${escapeHtml(doc.uploaded_by || 'Unknown')}</p>
          <p class="doc-card-file"><i class="fas fa-calendar"></i> ${formatDate(doc.created_at)}</p>
        </div>
        <div class="doc-card-actions">
          <a href="result.html?id=${doc.id}" class="btn btn-primary btn-sm" style="flex:1;justify-content:center;">
            <i class="fas fa-eye"></i> View Details
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function filterDocs() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = q ? allDocs.filter(d => d.title.toLowerCase().includes(q)) : allDocs;
  renderGrid(filtered);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
