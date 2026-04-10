/* ============================================================
   upload.js — Upload Page logic
   ============================================================ */
const API = '/api';

// ── DOM refs ─────────────────────────────────────────────────
const uploadForm    = document.getElementById('uploadForm');
const fileInput     = document.getElementById('fileInput');
const dropZone      = document.getElementById('dropZone');
const dropPrompt    = document.getElementById('dropPrompt');
const filePreview   = document.getElementById('filePreview');
const fileNameSpan  = document.getElementById('fileName');
const clearFileBtn  = document.getElementById('clearFile');
const uploadStatus  = document.getElementById('uploadStatus');
const progressBar   = document.getElementById('progressBar');
const statusMsg     = document.getElementById('statusMessage');
const resultsPreview= document.getElementById('resultsPreview');
const resultsContent= document.getElementById('resultsContent');
const btnViewFull   = document.getElementById('btnViewFull');
const runOpenAI     = document.getElementById('runOpenAI');

// Title check
const titleCheckInput   = document.getElementById('titleCheckInput');
const btnCheckTitle     = document.getElementById('btnCheckTitle');
const titleCheckResults = document.getElementById('titleCheckResults');

// Hamburger
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// ── Drop Zone ─────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
clearFileBtn.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

function setFile(file) {
  const allowed = ['.pdf', '.docx', '.txt'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    showStatus('Only PDF, DOCX, and TXT files are supported.', 'error');
    return;
  }
  fileNameSpan.textContent = file.name;
  dropPrompt.classList.add('hidden');
  filePreview.classList.remove('hidden');

  // Transfer to file input (create new DataTransfer)
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
}

function clearFile() {
  fileInput.value = '';
  dropPrompt.classList.remove('hidden');
  filePreview.classList.add('hidden');
  fileNameSpan.textContent = '';
}

// ── Title Check ───────────────────────────────────────────────
btnCheckTitle.addEventListener('click', checkTitle);
titleCheckInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkTitle(); });

async function checkTitle() {
  const title = titleCheckInput.value.trim();
  if (!title) return;

  btnCheckTitle.disabled = true;
  btnCheckTitle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking…';
  titleCheckResults.classList.add('hidden');
  titleCheckResults.innerHTML = '';

  try {
    const res = await fetch(`${API}/check-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    renderTitleResults(data.similar_titles || [], data.internet_results || []);
  } catch (err) {
    titleCheckResults.innerHTML = `<p class="text-danger"><i class="fas fa-triangle-exclamation"></i> ${err.message}</p>`;
    titleCheckResults.classList.remove('hidden');
  } finally {
    btnCheckTitle.disabled = false;
    btnCheckTitle.innerHTML = '<i class="fas fa-magnifying-glass"></i> Check Title';
  }
}

function renderTitleResults(matches, internetResults) {
  titleCheckResults.classList.remove('hidden');

  let html = '';

  /* ── Local Repository Results ── */
  html += `<div class="title-section-header"><i class="fas fa-database"></i> Repository Check</div>`;
  if (matches.length > 0) {
    html += `
      <div class="title-result-box title-result-warning">
        <p style="font-size:.88rem;margin-bottom:.6rem;color:#f39c12;font-weight:600;">
          <i class="fas fa-triangle-exclamation"></i> ${matches.length} similar title(s) found in repository:
        </p>
        ${matches.map(m => `
          <div class="title-match-item">
            <div class="title-match-icon"><i class="fas fa-file-alt"></i></div>
            <span class="title-match-text">${escapeHtml(m.title)}</span>
            <a href="result.html?id=${m.id}" class="btn btn-outline btn-sm">
              <i class="fas fa-eye"></i> View
            </a>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    html += `<div class="title-result-box title-result-success"><i class="fas fa-circle-check"></i> No similar titles found in repository. This title appears unique.</div>`;
  }

  /* ── Internet Results ── */
  html += `<div class="title-section-header" style="margin-top:1rem;"><i class="fas fa-globe"></i> Internet Check</div>`;
  if (internetResults.length > 0) {
    html += `
      <div class="title-result-box title-result-internet">
        <p style="font-size:.88rem;margin-bottom:.6rem;color:#74b9ff;font-weight:600;">
          <i class="fas fa-search"></i> ${internetResults.length} similar result(s) found online:
        </p>
        ${internetResults.map(r => `
          <div class="internet-title-card">
            <div class="internet-title-card-body">
              <div class="internet-title-name">${escapeHtml(r.title)}</div>
              <div class="internet-title-domain"><i class="fas fa-link"></i> ${escapeHtml(r.domain)}</div>
              ${r.snippet ? `<div class="internet-title-snippet">${escapeHtml(r.snippet).slice(0, 200)}</div>` : ''}
            </div>
            <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-internet-visit">
              <i class="fas fa-external-link-alt"></i> Visit
            </a>
          </div>
        `).join('')}
        <div class="internet-info-note"><i class="fas fa-info-circle"></i> Internet results are for reference only — they do not block your upload.</div>
      </div>
    `;
  } else {
    html += `<div class="title-result-box title-result-success"><i class="fas fa-circle-check"></i> No similar results found online. Your title seems original!</div>`;
  }

  titleCheckResults.innerHTML = html;
}

// ── Upload Form ───────────────────────────────────────────────
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('docTitle').value.trim();
  const file  = fileInput.files[0];

  if (!title) { showStatus('Please enter a document title.', 'error'); return; }
  if (!file)  { showStatus('Please select a file to upload.', 'error'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);
  formData.append('authors', (document.getElementById('docAuthors')?.value || '').trim());
  formData.append('course', (document.getElementById('docCourse')?.value || '').trim());
  formData.append('year', (document.getElementById('docYear')?.value || '').trim());
  formData.append('abstract', (document.getElementById('docAbstract')?.value || '').trim());

  uploadStatus.classList.remove('hidden');
  updateProgress(10, 'Uploading file…');
  resultsPreview.classList.add('hidden');

  let documentId;

  try {
    // Step 1: Upload (server now pre-checks for duplicates)
    updateProgress(25, 'Extracting text & checking for duplicates…');
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const uploadRes = await fetch(`${API}/upload`, { method: 'POST', body: formData, headers });
    const uploadData = await uploadRes.json();

    // Handle duplicate/rejection responses (HTTP 409)
    if (uploadRes.status === 409) {
      updateProgress(0);
      renderRejection(uploadData);
      return;
    }
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

    documentId = uploadData.document.id;

    // Show warning if partial matches were found but allowed
    if (uploadData.warnings) {
      console.log('Upload warning:', uploadData.warnings);
    }

    updateProgress(55, 'Running TF-IDF plagiarism analysis…');

    // Step 2: Check plagiarism
    const useAI = runOpenAI.checked;
    const checkHeaders = { 'Content-Type': 'application/json' };
    if (token) checkHeaders['Authorization'] = `Bearer ${token}`;
    const checkRes = await fetch(`${API}/check-plagiarism`, {
      method: 'POST',
      headers: checkHeaders,
      body: JSON.stringify({ document_id: documentId, use_openai: useAI })
    });
    const checkData = await checkRes.json();
    if (!checkRes.ok) throw new Error(checkData.error || 'Plagiarism check failed');

    updateProgress(100, 'Analysis complete!');

    // Show results preview
    renderResultsPreview(checkData, documentId);
    uploadForm.reset();
    clearFile();

  } catch (err) {
    updateProgress(0);
    showStatus(`Error: ${err.message}`, 'error');
  }
});

function updateProgress(pct, message) {
  progressBar.style.width = pct + '%';
  if (message) statusMsg.textContent = message;
  statusMsg.style.color = pct === 0 ? 'var(--red)' : 'var(--text-muted)';
}

function showStatus(msg, type = 'info') {
  uploadStatus.classList.remove('hidden');
  progressBar.style.width = type === 'error' ? '100%' : '0%';
  progressBar.style.background = type === 'error' ? 'var(--red)' : '';
  statusMsg.textContent = msg;
  statusMsg.style.color = type === 'error' ? 'var(--red)' : 'var(--text-muted)';
}

function renderResultsPreview(data, documentId) {
  const score = data.local_check?.overall_score || 0;
  const color = score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)';
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';
  const matchCount = data.local_check?.document_matches?.length || 0;
  const paraCount  = data.local_check?.paragraph_matches?.length || 0;

  resultsContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;margin-bottom:1rem;">
      <div class="score-mini" style="color:${color};">${score}%</div>
      <div>
        <div style="font-size:.8rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Overall Similarity</div>
        <div style="font-weight:700;color:${color};">${label}</div>
      </div>
    </div>
    <div class="score-pills">
      <span class="pill">${matchCount} matched document${matchCount !== 1 ? 's' : ''}</span>
      <span class="pill">${paraCount} flagged paragraph${paraCount !== 1 ? 's' : ''}</span>
      ${data.openai_check && !data.openai_check.error ? `<span class="pill"><i class="fas fa-robot"></i> AI: ${data.openai_check.plagiarismPercentage}%</span>` : ''}
      ${data.openai_check?.error ? `<span class="pill" style="border-color:var(--red);color:var(--red);"><i class="fas fa-triangle-exclamation"></i> AI Error: ${escapeHtml(data.openai_check.error)}</span>` : ''}
    </div>
  `;

  btnViewFull.href = `result.html?id=${documentId}`;
  btnViewFull.classList.remove('hidden');
  resultsPreview.classList.remove('hidden');
}

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function normalizeFlaggedParagraph(fp, idx) {
  if (fp == null) return null;

  // Handle plain string responses
  if (typeof fp === 'string') {
    const text = fp.trim();
    if (!text) return null;
    return {
      label: `Paragraph ${idx + 1}`,
      title: 'Unknown',
      score: null,
      snippet: text
    };
  }

  // Handle array payloads: [snippet, score, title]
  if (Array.isArray(fp)) {
    const snippet = String(fp[0] ?? '').trim();
    const scoreNum = Number(fp[1]);
    const title = String(fp[2] ?? 'Unknown').trim() || 'Unknown';
    if (!snippet) return null;
    return {
      label: `Paragraph ${idx + 1}`,
      title,
      score: Number.isFinite(scoreNum) ? scoreNum : null,
      snippet
    };
  }

  // Object payloads from backend
  if (typeof fp === 'object') {
    const snippetRaw =
      fp.paragraph_snippet ?? fp.paragraph_text ?? fp.snippet ?? fp.text ?? fp.content ?? '';
    const snippet = String(snippetRaw ?? '').trim();

    const scoreNum = Number(
      fp.similarity_score ?? fp.score ?? fp.similarity ?? fp.match_score ?? NaN
    );

    const titleRaw =
      fp.matched_title ?? fp.title ?? fp.matched_document_title ?? fp.document_title ?? 'Unknown';
    const title = String(titleRaw ?? 'Unknown').trim() || 'Unknown';

    const paraIndexNum = Number(fp.paragraph_index ?? fp.index ?? NaN);
    const label = Number.isFinite(paraIndexNum)
      ? `Paragraph ${paraIndexNum + 1}`
      : `Paragraph ${idx + 1}`;

    if (!snippet) {
      // Last-resort diagnostic preview to avoid blank rows.
      const rawPreview = JSON.stringify(fp);
      if (!rawPreview || rawPreview === '{}' || rawPreview === '[]') return null;
      return {
        label,
        title,
        score: Number.isFinite(scoreNum) ? scoreNum : null,
        snippet: rawPreview.slice(0, 220)
      };
    }

    return {
      label,
      title,
      score: Number.isFinite(scoreNum) ? scoreNum : null,
      snippet
    };
  }

  return null;
}

/**
 * Render a rejection notice when the server blocks an upload (HTTP 409).
 */
function renderRejection(data) {
  uploadStatus.classList.remove('hidden');
  progressBar.style.width = '100%';
  progressBar.style.background = 'var(--red)';

  let icon, heading, details = '';

  switch (data.reason) {
    case 'exact_title':
      icon = 'fa-heading';
      heading = 'Duplicate Title Detected';
      details = `<p>${escapeHtml(data.message)}</p>`;
      if (data.existing_document_id) {
        details += `<a href="result.html?id=${data.existing_document_id}" class="btn btn-outline mt-1">
          <i class="fas fa-eye"></i> View Existing Document
        </a>`;
      }
      break;

    case 'duplicate_content':
      icon = 'fa-copy';
      heading = 'Duplicate Content Detected';
      details = `<p>${escapeHtml(data.message)}</p>
        <div style="margin-top:.75rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--red);">${data.similarity_score}%</div>
          <div>
            <div style="font-size:.8rem;color:var(--text-muted);">Similarity with:</div>
            <div style="font-weight:600;">${escapeHtml(data.matched_title || 'Unknown')}</div>
          </div>
        </div>`;
      if (data.matched_document_id) {
        details += `<a href="result.html?id=${data.matched_document_id}" class="btn btn-outline mt-1">
          <i class="fas fa-eye"></i> View Matching Document
        </a>`;
      }
      break;

    case 'similar_paragraphs':
      icon = 'fa-paragraph';
      heading = 'Too Many Similar Paragraphs';
      details = `<p>${escapeHtml(data.message)}</p>
        <div style="margin:.75rem 0;">
          <strong style="color:#ef4444;">${data.flagged_count} / ${data.total_paragraphs}</strong>
          <span style="color:#94a3b8;"> paragraphs flagged (${data.flagged_ratio}%)</span>
        </div>`;

      // Debug: log payload so we can verify data shape
      console.log('[rejection] flagged_paragraphs payload:', JSON.stringify(data.flagged_paragraphs));

      if (Array.isArray(data.flagged_paragraphs) && data.flagged_paragraphs.length > 0) {
        details += `<div style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">`;
        data.flagged_paragraphs.forEach((fp, i) => {
          // Extract fields with broad fallbacks
          let snippet = '';
          let title = 'Unknown';
          let score = NaN;

          if (fp && typeof fp === 'object' && !Array.isArray(fp)) {
            snippet = String(fp.paragraph_snippet || fp.paragraph_text || fp.snippet || fp.text || fp.content || '').trim();
            title = String(fp.matched_title || fp.title || fp.matched_document_title || 'Unknown').trim() || 'Unknown';
            score = parseFloat(fp.similarity_score ?? fp.score ?? NaN);
          } else if (typeof fp === 'string') {
            snippet = fp.trim();
          }

          // Fallback: show raw JSON if snippet is still empty
          if (!snippet && fp != null) {
            snippet = JSON.stringify(fp).slice(0, 200);
          }
          if (!snippet) snippet = '(No preview available)';

          const hasScore = Number.isFinite(score);
          const scoreColor = hasScore ? (score >= 70 ? '#ef4444' : '#f59e0b') : '#94a3b8';
          const scoreText = hasScore ? score.toFixed(1) + '%' : 'N/A';

          details += `
            <div style="border:1px solid #334155;border-radius:8px;overflow:hidden;margin-bottom:2px;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0f172a;font-size:13px;color:#cbd5e1;">
                <span style="color:#e2e8f0;">Paragraph ${i + 1} — matched "<span style="color:#38bdf8;">${escapeHtml(title)}</span>"</span>
                <span style="color:${scoreColor};font-weight:700;white-space:nowrap;margin-left:8px;">${scoreText}</span>
              </div>
              <div style="padding:10px 12px;font-size:13px;line-height:1.55;color:#e2e8f0;background:rgba(239,68,68,.06);border-left:3px solid #ef4444;">
                ${escapeHtml(snippet)}
              </div>
            </div>`;
        });
        details += `</div>`;
      }
      break;

    default:
      icon = 'fa-ban';
      heading = 'Upload Rejected';
      details = `<p>${escapeHtml(data.error || data.message || 'Unknown reason')}</p>`;
  }

  resultsContent.innerHTML = `
    <div class="rejection-banner">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
        <i class="fas ${icon} fa-2x" style="color:var(--red);"></i>
        <div>
          <h3 style="color:var(--red);margin:0;font-size:1.1rem;">${heading}</h3>
          <p style="margin:0;font-size:.82rem;color:var(--text-muted);">This document was NOT uploaded.</p>
        </div>
      </div>
      ${details}
    </div>
  `;

  statusMsg.textContent = `Upload blocked: ${heading}`;
  statusMsg.style.color = 'var(--red)';
  resultsPreview.classList.remove('hidden');
  btnViewFull.classList.add('hidden');
}
