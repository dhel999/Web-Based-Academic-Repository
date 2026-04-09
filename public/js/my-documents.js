/* ============================================================
   my-documents.js — User's document dashboard
   ============================================================ */
const API = '/api';
let allDocs = [];

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('heroSubtitle').textContent =
    `Welcome, ${AUTH.user.full_name} — your uploaded research papers`;
  await loadMyDocuments();

  document.getElementById('searchInput').addEventListener('input', filterDocs);
  document.getElementById('btnSearch').addEventListener('click', filterDocs);
});

async function loadMyDocuments() {
  try {
    const res = await authFetch(`${API}/documents?mine=true`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    allDocs = data.documents || [];
    renderStats(allDocs);
    renderGrid(allDocs);
  } catch (err) {
    console.error('Failed to load documents:', err);
    document.getElementById('docGrid').innerHTML =
      `<div class="card"><p class="text-danger"><i class="fas fa-triangle-exclamation"></i> Failed to load documents</p></div>`;
  }
}

function renderStats(docs) {
  document.getElementById('statTotal').textContent = docs.length;
  document.getElementById('statClean').textContent = docs.filter(d => (d.similarity_score || 0) < 30).length;
  document.getElementById('statMedium').textContent = docs.filter(d => (d.similarity_score || 0) >= 30 && (d.similarity_score || 0) < 60).length;
  document.getElementById('statHigh').textContent = docs.filter(d => (d.similarity_score || 0) >= 60).length;
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
    const score = doc.similarity_score || 0;
    const riskClass = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
    const riskLabel = score >= 60 ? 'High Risk' : score >= 30 ? 'Medium' : 'Clean';
    const riskColor = score >= 60 ? 'var(--red)' : score >= 30 ? 'var(--yellow)' : 'var(--green)';
    const ext = (doc.original_filename || '').split('.').pop().toUpperCase();
    const icon = ext === 'PDF' ? 'fa-file-pdf' : ext === 'DOCX' ? 'fa-file-word' : 'fa-file-lines';

    return `
      <div class="doc-card">
        <div class="doc-card-header">
          <div class="doc-card-icon"><i class="fas ${icon}"></i></div>
          <div class="doc-card-meta">
            <span class="doc-card-ext">${ext}</span>
            <span class="doc-card-date">${formatDate(doc.created_at)}</span>
          </div>
        </div>
        <h3 class="doc-card-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h3>
        <p class="doc-card-file">${escapeHtml(doc.original_filename)}</p>
        <div class="doc-card-score">
          <div class="score-circle" style="border-color:${riskColor};">
            <span style="color:${riskColor};font-weight:800;">${score}%</span>
          </div>
          <div>
            <span class="risk-badge risk-${riskClass}" style="font-size:.75rem;">${riskLabel}</span>
            <span class="text-muted" style="font-size:.75rem;display:block;">Similarity</span>
          </div>
        </div>
        <div class="doc-card-actions">
          <a href="result.html?id=${doc.id}" class="btn btn-primary btn-sm">
            <i class="fas fa-eye"></i> View Report
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
