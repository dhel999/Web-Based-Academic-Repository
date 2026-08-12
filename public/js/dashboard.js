/* ============================================================
   dashboard.js — Dashboard Page logic
   ============================================================ */
const API = '/api';

let allDocs = [];

// Hamburger
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// DOM refs
const searchInput  = document.getElementById('searchInput');
const docTable     = document.getElementById('docTable');
const docTableBody = document.getElementById('docTableBody');
const loadingDocs  = document.getElementById('loadingDocs');
const emptyState   = document.getElementById('emptyState');
const totalDocsEl  = document.getElementById('totalDocs');

// ── Initialise ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadDocuments();
  searchInput.addEventListener('input', () => filterDocuments(searchInput.value));
});

async function loadDocuments() {
  try {
    const res = await fetch(`${API}/documents`);
    const data = await res.json();
    allDocs = data.documents || [];
    totalDocsEl.textContent = allDocs.length;
    renderTable(allDocs);
  } catch (err) {
    loadingDocs.innerHTML = `<i class="fas fa-triangle-exclamation fa-2x text-danger"></i><p>Failed to load documents: ${escapeHtml(err.message)}</p>`;
  }
}

function filterDocuments(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allDocs.filter(d => d.title.toLowerCase().includes(q))
    : allDocs;
  renderTable(filtered);
}

function renderTable(docs) {
  loadingDocs.classList.add('hidden');

  if (docs.length === 0) {
    docTable.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  docTable.classList.remove('hidden');

  docTableBody.innerHTML = docs.map((doc, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="doc-title-cell">${escapeHtml(doc.title)}</td>
      <td class="doc-filename-cell">${escapeHtml(doc.original_filename)}</td>
      <td>${formatDate(doc.created_at)}</td>
      <td>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <a href="result.html?id=${doc.id}" class="btn btn-primary" style="padding:.35rem .75rem;font-size:.8rem;">
            <i class="fas fa-shield-halved"></i> Report
          </a>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Utilities ─────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
