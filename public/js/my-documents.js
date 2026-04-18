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
  grid.innerHTML = docs.map((doc, idx) => {
    const score = doc.similarity_score || 0;
    const riskClass = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
    const riskLabel = score >= 60 ? 'High Risk' : score >= 30 ? 'Medium' : 'Clean';
    const riskColor = score >= 60 ? '#EF4444' : score >= 30 ? '#F59E0B' : '#10B981';
    const riskBg   = score >= 60 ? '#FEF2F2' : score >= 30 ? '#FFFBEB' : '#ECFDF5';
    const riskBorder = score >= 60 ? '#FECACA' : score >= 30 ? '#FDE68A' : '#A7F3D0';
    const ext = (doc.original_filename || '').split('.').pop().toUpperCase();
    const icon = ext === 'PDF' ? 'fa-file-pdf' : ext === 'DOCX' ? 'fa-file-word' : 'fa-file-lines';
    const iconGrad = ext === 'PDF' ? 'linear-gradient(135deg,#EF4444,#B91C1C)' : ext === 'DOCX' ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : 'linear-gradient(135deg,#10B981,#059669)';

    // SVG arc score ring
    const r = 20, circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;

    return `
      <div class="doc-card-enhanced" style="animation-delay:${idx * 0.07}s">
        <div class="doc-card-header" style="background:linear-gradient(135deg,${riskBg} 0%,#F0FDF4 100%);border-bottom:1px solid ${riskBorder};min-height:120px;display:flex;align-items:center;justify-content:space-between;padding:1.4rem 1.5rem;">
          <div class="doc-card-icon-wrap" style="background:${iconGrad};">
            <i class="fas ${icon}"></i>
          </div>
          <div class="doc-score-ring-wrap">
            <svg width="54" height="54" viewBox="0 0 54 54" style="transform:rotate(-90deg)">
              <circle cx="27" cy="27" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="5"/>
              <circle cx="27" cy="27" r="${r}" fill="none" stroke="${riskColor}" stroke-width="5"
                stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
                stroke-linecap="round"/>
            </svg>
            <span class="score-label" style="color:${riskColor};">${score}%</span>
          </div>
        </div>
        <div class="doc-card-meta">
          <h3 class="doc-card-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h3>
          <div class="doc-card-info-row">
            <i class="fas fa-file"></i>
            <span>${escapeHtml(doc.original_filename)}</span>
          </div>
          <div class="doc-card-info-row">
            <i class="fas fa-calendar-alt"></i>
            <span>${formatDate(doc.created_at)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.2rem;">
            <span class="risk-badge risk-${riskClass}" style="font-size:.72rem;padding:.25rem .65rem;">${riskLabel}</span>
            <span style="font-size:.75rem;color:var(--text-muted);">${score}% similarity</span>
          </div>
        </div>
        <div class="doc-card-actions">
          <a href="result.html?id=${doc.id}" class="btn-view-details">
            <i class="fas fa-chart-bar"></i> View Report
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
