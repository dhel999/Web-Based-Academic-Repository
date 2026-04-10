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

  // Generate floating particles
  createParticles();

  await loadPublicDocuments();
  document.getElementById('searchInput').addEventListener('input', filterDocs);

  // Ctrl+K shortcut to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});

function createParticles() {
  const container = document.getElementById('heroParticles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'hero-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (6 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 6) + 's';
    p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
    container.appendChild(p);
  }
}

async function loadPublicDocuments() {
  try {
    const res = await fetch(`${API}/documents?approved=true`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    allDocs = data.documents || [];

    // Update hero stat counter
    const statEl = document.querySelector('#heroStatDocs .hero-stat-num');
    if (statEl) statEl.textContent = allDocs.length;

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
    const extLabel = ext === 'DOCX' ? 'DOCX' : ext === 'PDF' ? 'PDF' : 'TXT';
    const score = doc.similarity_score || 0;
    const scoreColor = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

    return `
      <div class="doc-card-enhanced">
        <div class="doc-card-header">
          <span class="doc-type-badge">${extLabel}</span>
          <div class="doc-card-icon-wrap">
            <i class="fas ${icon}"></i>
          </div>
        </div>
        <div class="doc-card-meta">
          <h3 class="doc-card-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h3>
          <div class="doc-card-info-row">
            <i class="fas fa-file-alt"></i>
            <span>${escapeHtml(doc.original_filename)}</span>
          </div>
          <div class="doc-card-info-row">
            <i class="fas fa-user"></i>
            <span>${escapeHtml(doc.uploaded_by || 'Unknown')}</span>
          </div>
          <div class="doc-card-info-row">
            <i class="fas fa-calendar"></i>
            <span>${formatDate(doc.created_at)}</span>
          </div>
          <div class="doc-card-similarity">
            <div class="doc-sim-label">
              <i class="fas fa-shield-halved"></i> Similarity
            </div>
            <div class="doc-sim-bar-wrap">
              <div class="bar-track" style="height:6px;flex:1;">
                <div class="bar-fill ${scoreColor}" style="width:${Math.min(score, 100)}%;"></div>
              </div>
              <span class="doc-sim-score ${scoreColor}">${score.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div class="doc-card-actions">
          <a href="result.html?id=${doc.id}" class="btn-view-details">
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
