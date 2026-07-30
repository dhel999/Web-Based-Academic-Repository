/* ============================================================
   my-documents.js — User's document dashboard (Pro Design)
   ============================================================ */
const API = '/api';
let allDocs = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('heroSubtitle').textContent =
    `Welcome, ${AUTH.user.full_name} — your uploaded research papers`;

  await loadMyDocuments();

  // Text search
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('btnSearch').addEventListener('click', applyFilters);

  // Filter pills
  document.querySelectorAll('.fpill[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fpill').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });
});

async function loadMyDocuments() {
  try {
    const res  = await authFetch(`${API}/documents?mine=true`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    allDocs = data.documents || [];
    renderStats(allDocs);
    renderGrid(allDocs);
  } catch (err) {
    console.error('Failed to load documents:', err);
    document.getElementById('docGrid').innerHTML =
      `<div class="pro-loading"><i class="fas fa-circle-exclamation" style="color:#DC2626;opacity:1;"></i><p>Failed to load documents. Please refresh.</p></div>`;
  }
}

function renderStats(docs) {
  document.getElementById('statTotal').textContent  = docs.length;
  document.getElementById('statClean').textContent  = docs.filter(d => (d.similarity_score || 0) < 30).length;
  document.getElementById('statMedium').textContent = docs.filter(d => { const s = d.similarity_score || 0; return s >= 30 && s < 60; }).length;
  document.getElementById('statHigh').textContent   = docs.filter(d => (d.similarity_score || 0) >= 60).length;
}

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = allDocs;

  if (q) filtered = filtered.filter(d => d.title.toLowerCase().includes(q));

  if (activeFilter === 'clean')  filtered = filtered.filter(d => (d.similarity_score || 0) < 30);
  if (activeFilter === 'medium') filtered = filtered.filter(d => { const s = d.similarity_score || 0; return s >= 30 && s < 60; });
  if (activeFilter === 'high')   filtered = filtered.filter(d => (d.similarity_score || 0) >= 60);

  renderGrid(filtered);
}

function renderGrid(docs) {
  const grid       = document.getElementById('docGrid');
  const emptyState = document.getElementById('emptyState');
  const countEl    = document.getElementById('docCount');

  if (countEl) countEl.textContent = `${docs.length} paper${docs.length !== 1 ? 's' : ''}`;

  if (docs.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  grid.innerHTML = docs.map(doc => {
    const score = doc.similarity_score || 0;
    const cls   = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'clean';
    const label = score >= 60 ? 'High Risk' : score >= 30 ? 'Medium' : 'Clean';
    const ext   = (doc.original_filename || '').split('.').pop().toLowerCase();
    const iconCls = ext === 'pdf' ? 'i-pdf' : ext === 'docx' || ext === 'doc' ? 'i-docx' : ext === 'txt' ? 'i-txt' : 'i-def';
    const iconFa  = ext === 'pdf' ? 'fa-file-pdf' : ext === 'docx' || ext === 'doc' ? 'fa-file-word' : 'fa-file-lines';

    return `
      <div class="dcard">
        <div class="dcard-stripe s-${cls}"></div>
        <div class="dcard-body">
          <div class="dcard-top">
            <div class="dcard-icon ${iconCls}"><i class="fas ${iconFa}"></i></div>
            <div class="dcard-titles">
              <div class="dcard-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</div>
              <div class="dcard-fname">${escapeHtml(doc.original_filename || '')}</div>
            </div>
            <span class="score-badge s-${cls}">${score}%</span>
          </div>
          <div class="dcard-meta">
            <span class="mtag"><i class="fas fa-calendar-alt"></i> ${formatDate(doc.created_at)}</span>
            <span class="mtag"><i class="fas fa-tag"></i> ${label}</span>
            ${doc.course ? `<span class="mtag"><i class="fas fa-graduation-cap"></i> ${escapeHtml(doc.course)}</span>` : ''}
            ${doc.year   ? `<span class="mtag"><i class="fas fa-clock"></i> ${escapeHtml(doc.year)}</span>` : ''}
          </div>
          <div class="score-bar-track">
            <div class="score-bar-fill s-${cls}" style="width:${Math.min(score, 100)}%;"></div>
          </div>
        </div>
        <div class="dcard-actions">
          <a href="result.html?id=${doc.id}" class="dact view">
            <i class="fas fa-chart-bar"></i> View Report
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Legacy alias (kept for any inline callers)
function filterDocs() { applyFilters(); }
