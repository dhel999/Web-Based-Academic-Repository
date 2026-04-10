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

let lastRejectionData = null; // stored for PDF export

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

  let html = '';

  if (data.reason === 'exact_title') {
    html = `
      <div style="text-align:center;padding:2rem 1rem;">
        <i class="fas fa-heading fa-3x" style="color:#ef4444;margin-bottom:1rem;"></i>
        <h3 style="color:#ef4444;margin:0 0 .5rem;">Duplicate Title Detected</h3>
        <p style="color:#94a3b8;font-size:.9rem;margin:0 0 1rem;">This document was NOT uploaded.</p>
        <p style="color:#cbd5e1;font-size:.9rem;">${escapeHtml(data.message)}</p>
        ${data.existing_document_id ? `<a href="result.html?id=${data.existing_document_id}" class="btn btn-outline mt-1"><i class="fas fa-eye"></i> View Existing</a>` : ''}
      </div>`;

  } else if (data.reason === 'duplicate_content') {
    html = `
      <div style="text-align:center;padding:2rem 1rem;">
        <i class="fas fa-copy fa-3x" style="color:#ef4444;margin-bottom:1rem;"></i>
        <h3 style="color:#ef4444;margin:0 0 .5rem;">Duplicate Content Detected</h3>
        <p style="color:#94a3b8;font-size:.9rem;margin:0 0 1rem;">This document was NOT uploaded.</p>
        <p style="color:#cbd5e1;font-size:.9rem;">${escapeHtml(data.message)}</p>
        <div style="margin:1rem 0;font-size:2rem;font-weight:800;color:#ef4444;">${data.similarity_score}%</div>
        <p style="color:#94a3b8;font-size:.85rem;margin:0;">Matched: <strong style="color:#e2e8f0;">${escapeHtml(data.matched_title || 'Unknown')}</strong></p>
        ${data.matched_document_id ? `<a href="result.html?id=${data.matched_document_id}" class="btn btn-outline mt-2"><i class="fas fa-eye"></i> View Matching Document</a>` : ''}
      </div>`;

  } else if (data.reason === 'similar_paragraphs') {
    lastRejectionData = data;
    html = buildPaperStyleRejection(data);

  } else {
    html = `
      <div style="text-align:center;padding:2rem 1rem;">
        <i class="fas fa-ban fa-3x" style="color:#ef4444;margin-bottom:1rem;"></i>
        <h3 style="color:#ef4444;">Upload Rejected</h3>
        <p style="color:#cbd5e1;">${escapeHtml(data.error || data.message || 'Unknown reason')}</p>
      </div>`;
  }

  resultsContent.innerHTML = html;
  statusMsg.textContent = `Upload blocked: ${data.reason === 'similar_paragraphs' ? 'Too Many Similar Paragraphs' : data.reason === 'exact_title' ? 'Duplicate Title' : data.reason === 'duplicate_content' ? 'Duplicate Content' : 'Rejected'}`;
  statusMsg.style.color = 'var(--red)';
  resultsPreview.classList.remove('hidden');
  btnViewFull.classList.add('hidden');
}

/* ── Paper-style rejection view for similar paragraphs ──────── */
function buildPaperStyleRejection(data) {
  const s = data.stats || {};
  const avgScore = s.avg_score || 0;
  const maxScore = s.max_score || 0;
  const flaggedCount = data.flagged_count || 0;
  const totalParas = data.total_paragraphs || 0;
  const ratio = data.flagged_ratio || 0;
  const overallColor = avgScore >= 70 ? '#ef4444' : avgScore >= 40 ? '#f59e0b' : '#22c55e';

  // Build paper paragraphs
  const allParas = data.all_paragraphs || [];
  const flaggedParas = data.flagged_paragraphs || [];

  let paperBody = '';

  if (allParas.length > 0) {
    allParas.forEach((p) => {
      const text = String(p.text || '').trim();
      if (!text) return;
      const isFlagged = p.is_flagged;
      const score = parseFloat(p.similarity_score ?? 0);

      if (isFlagged) {
        // Yellow highlighted text — like a marker pen
        paperBody += `
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="padding:0;font-size:13px;line-height:1.8;color:#1a1a1a;font-family:'Times New Roman',Times,serif;">
              <span style="background:rgba(255,235,59,.45);padding:1px 0;">${escapeHtml(text)}</span>
            </td>
          </tr></table>`;
      } else {
        // Normal text
        paperBody += `
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="padding:0;font-size:13px;line-height:1.8;color:#1a1a1a;font-family:'Times New Roman',Times,serif;">
              ${escapeHtml(text)}
            </td>
          </tr></table>`;
      }
    });
  } else {
    // Fallback: only flagged paragraphs
    flaggedParas.forEach((fp) => {
      if (!fp || typeof fp !== 'object') return;
      const snippet = String(fp.paragraph_snippet || fp.paragraph_text || '').trim() || '(No preview)';
      paperBody += `
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="padding:0;font-size:13px;line-height:1.8;color:#1a1a1a;font-family:'Times New Roman',Times,serif;">
            <span style="background:rgba(255,235,59,.45);padding:1px 0;">${escapeHtml(snippet)}</span>
          </td>
        </tr></table>`;
    });
  }

  // Sidebar items — flagged paragraph details with content
  let sidebarItems = '';
  const detailSource = allParas.length > 0 ? allParas.filter(p => p.is_flagged) : flaggedParas;
  detailSource.forEach((fp, i) => {
    const score = parseFloat(fp.similarity_score ?? 0);
    const scoreCol = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e';
    const riskLabel = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
    const title = String(fp.matched_title || 'Unknown').trim();
    const pIdx = fp.index != null ? fp.index + 1 : (fp.paragraph_index != null ? fp.paragraph_index + 1 : i + 1);
    const barWidth = Math.min(score, 100);
    const docId = fp.matched_document_id || '';

    // Get text snippets (truncate to 120 chars for sidebar)
    const yourText = String(fp.text || fp.paragraph_snippet || fp.paragraph_text || '').trim();
    const yourSnippet = yourText.length > 120 ? yourText.slice(0, 120) + '…' : yourText;
    const matchedText = String(fp.matched_snippet || '').trim();
    const matchedSnippet = matchedText.length > 120 ? matchedText.slice(0, 120) + '…' : matchedText;

    sidebarItems += `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #1e293b;border-radius:6px;overflow:hidden;">
        <!-- Header: paragraph number + score -->
        <tr style="background:#0f172a;">
          <td style="padding:7px 10px;font-size:11px;color:#94a3b8;">
            <strong style="color:#e2e8f0;">¶ ${pIdx}</strong>
            <span style="float:right;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;
              background:${score >= 70 ? 'rgba(239,68,68,.15)' : score >= 40 ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)'};
              color:${scoreCol};">${riskLabel} ${score.toFixed(1)}%</span>
          </td>
        </tr>
        <!-- Score bar -->
        <tr><td style="padding:0 10px;">
          <table style="width:100%;height:3px;border-collapse:collapse;"><tr>
            <td style="width:${barWidth}%;background:${scoreCol};height:3px;padding:0;"></td>
            <td style="background:#1e293b;height:3px;padding:0;"></td>
          </tr></table>
        </td></tr>
        <!-- Matched document -->
        <tr>
          <td style="padding:5px 10px;font-size:10px;color:#64748b;border-top:1px solid #1e293b;">
            <i class="fas fa-link" style="margin-right:3px;font-size:9px;"></i>
            Matched: ${docId ? `<a href="result.html?id=${docId}" style="color:#38bdf8;text-decoration:none;">${escapeHtml(title)}</a>` : `<span style="color:#38bdf8;">${escapeHtml(title)}</span>`}
          </td>
        </tr>
        <!-- Your text snippet -->
        ${yourSnippet ? `
        <tr>
          <td style="padding:6px 10px;font-size:10.5px;line-height:1.5;color:#e2e8f0;border-top:1px solid #1e293b;">
            <span style="display:block;font-size:9px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;">
              <i class="fas fa-file-arrow-up" style="margin-right:3px;"></i>Your Text
            </span>
            <span style="background:rgba(255,235,59,.2);padding:1px 2px;">${escapeHtml(yourSnippet)}</span>
          </td>
        </tr>` : ''}
        <!-- Matched text snippet -->
        ${matchedSnippet ? `
        <tr>
          <td style="padding:6px 10px;font-size:10.5px;line-height:1.5;color:#94a3b8;border-top:1px solid #1e293b;">
            <span style="display:block;font-size:9px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;">
              <i class="fas fa-database" style="margin-right:3px;"></i>Repository Match
            </span>
            ${escapeHtml(matchedSnippet)}
          </td>
        </tr>` : ''}
      </table>`;
  });

  return `
    <div style="font-family:inherit;">

      <!-- ═══ REPORT HEADER ═══ -->
      <div style="text-align:center;padding:1.5rem 1rem .5rem;border-bottom:2px solid #1e293b;margin-bottom:1rem;">
        <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:20px;background:rgba(239,68,68,.1);border:1px solid #ef444440;margin-bottom:10px;">
          <i class="fas fa-shield-halved" style="color:#ef4444;"></i>
          <span style="font-size:12px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:1px;">Plagiarism Shield Report</span>
        </div>
        <h2 style="margin:8px 0 4px;font-size:1.2rem;color:#f1f5f9;">Similarity Analysis — Upload Blocked</h2>
        <p style="margin:0;font-size:.82rem;color:#64748b;">Generated on ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})} at ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</p>
      </div>

      <!-- ═══ VERDICT BANNER ═══ -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;border:1px solid ${overallColor}30;border-radius:10px;overflow:hidden;background:${overallColor}08;">
        <tr>
          <td style="padding:14px 18px;text-align:center;width:100px;border-right:1px solid ${overallColor}20;">
            <div style="font-size:2rem;font-weight:900;color:${overallColor};line-height:1;">${avgScore.toFixed(1)}%</div>
            <div style="font-size:10px;color:#64748b;margin-top:4px;text-transform:uppercase;font-weight:600;">Avg Match</div>
          </td>
          <td style="padding:14px 18px;">
            <div style="font-size:13px;font-weight:700;color:${overallColor};margin-bottom:3px;">
              <i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i> Upload Rejected — ${flaggedCount}/${totalParas} paragraphs flagged (${ratio}%)
            </div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.4;">
              Yellow highlighted text below indicates paragraphs detected with high similarity to existing documents in the repository.
            </div>
          </td>
          <td style="padding:14px 12px;text-align:right;vertical-align:middle;white-space:nowrap;">
            <button onclick="downloadReportPDF()" style="background:#0ea5e9;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              <i class="fas fa-file-pdf" style="margin-right:5px;"></i> Download PDF
            </button>
          </td>
        </tr>
      </table>

      <!-- ═══ MAIN LAYOUT: Paper + Sidebar ═══ -->
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <!-- Paper Document -->
          <td style="vertical-align:top;width:65%;padding-right:12px;">
            <div style="background:#ffffff;border:1px solid #d1d5db;border-radius:4px;padding:32px 36px;max-height:600px;overflow-y:auto;box-shadow:0 2px 8px rgba(0,0,0,.15);">
              ${paperBody}
            </div>
          </td>
          <!-- Sidebar: Detected Details -->
          <td style="vertical-align:top;width:35%;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
              <tr><td style="padding:8px 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;background:#0f172a;border:1px solid #1e293b;border-radius:6px 6px 0 0;">
                <i class="fas fa-list-check" style="margin-right:5px;"></i> Detected Paragraphs (${detailSource.length})
              </td></tr>
            </table>
            <div style="max-height:560px;overflow-y:auto;">
              ${sidebarItems}
            </div>

            <!-- Legend -->
            <table style="width:100%;border-collapse:collapse;margin-top:10px;border:1px solid #1e293b;border-radius:6px;overflow:hidden;">
              <tr><td style="padding:8px 10px;font-size:10px;color:#64748b;background:#0f172a;">
                <span style="background:rgba(255,235,59,.45);color:#1a1a1a;padding:1px 6px;border-radius:2px;margin-right:6px;">highlighted</span> = detected similarity
              </td></tr>
              <tr><td style="padding:4px 10px 8px;font-size:10px;color:#64748b;background:#0f172a;">
                <span style="color:#ef4444;">●</span> High ≥70%
                <span style="color:#f59e0b;margin-left:8px;">●</span> Med 40–69%
                <span style="color:#22c55e;margin-left:8px;">●</span> Low 30–39%
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

    </div>`;
}

/* ── Download plagiarism report as printable PDF ──────────────── */
function downloadReportPDF() {
  const data = lastRejectionData;
  if (!data) { alert('No report data available.'); return; }

  const s = data.stats || {};
  const avgScore = (s.avg_score || 0).toFixed(1);
  const flaggedCount = data.flagged_count || 0;
  const totalParas = data.total_paragraphs || 0;
  const ratio = data.flagged_ratio || 0;
  const allParas = data.all_paragraphs || [];
  const flaggedParas = data.flagged_paragraphs || [];
  const detailSource = allParas.length > 0 ? allParas.filter(p => p.is_flagged) : flaggedParas;

  // Build paper body
  const source = allParas.length > 0 ? allParas : flaggedParas;
  let paperRows = '';
  source.forEach(p => {
    const text = String(p.text || p.paragraph_snippet || p.paragraph_text || '').trim();
    if (!text) return;
    const isFlagged = allParas.length > 0 ? p.is_flagged : true;
    const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    paperRows += isFlagged
      ? '<tr><td style="padding:2px 0;"><span style="background:rgba(255,235,59,.45);padding:1px 2px;">' + escaped + '</span></td></tr>'
      : '<tr><td style="padding:2px 0;">' + escaped + '</td></tr>';
  });

  // Build detail rows
  let detailCards = '';
  detailSource.forEach((fp, i) => {
    const score = parseFloat(fp.similarity_score ?? 0);
    const scoreCol = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e';
    const riskLabel = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
    const pIdx = fp.index != null ? fp.index + 1 : (fp.paragraph_index != null ? fp.paragraph_index + 1 : i + 1);
    const title = String(fp.matched_title || 'Unknown').trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const yourText = String(fp.text || fp.paragraph_snippet || fp.paragraph_text || '').trim();
    const yr = (yourText.length > 200 ? yourText.slice(0,200) + '…' : yourText).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const matchedText = String(fp.matched_snippet || '').trim();
    const mr = (matchedText.length > 200 ? matchedText.slice(0,200) + '…' : matchedText).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    detailCards += `
      <div style="border:1px solid #d1d5db;border-radius:6px;margin-bottom:10px;page-break-inside:avoid;overflow:hidden;">
        <div style="background:#f3f4f6;padding:6px 10px;font-size:11px;font-weight:700;border-bottom:1px solid #d1d5db;display:flex;justify-content:space-between;">
          <span>¶ ${pIdx}</span>
          <span style="padding:1px 8px;border-radius:8px;font-size:10px;font-weight:700;color:${scoreCol};background:${scoreCol}15;">${riskLabel} ${score.toFixed(1)}%</span>
        </div>
        <div style="height:3px;background:#e5e7eb;"><div style="width:${Math.min(score,100)}%;height:3px;background:${scoreCol};"></div></div>
        <div style="padding:6px 10px;font-size:10px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Matched: <strong>${title}</strong></div>
        ${yr ? '<div style="padding:6px 10px;font-size:11px;line-height:1.5;color:#1f2937;border-bottom:1px solid #e5e7eb;"><div style="font-size:9px;font-weight:700;color:#ef4444;text-transform:uppercase;margin-bottom:2px;">YOUR TEXT</div><span style="background:rgba(255,235,59,.3);padding:1px 2px;">' + yr + '</span></div>' : ''}
        ${mr ? '<div style="padding:6px 10px;font-size:11px;line-height:1.5;color:#4b5563;"><div style="font-size:9px;font-weight:700;color:#0ea5e9;text-transform:uppercase;margin-bottom:2px;">REPOSITORY MATCH</div>' + mr + '</div>' : ''}
      </div>`;
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const timeStr = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plagiarism Report</title>
<style>
@media print{@page{margin:18mm 14mm;}}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:24px 28px;font-size:12px;}
</style></head><body>

<div style="text-align:center;border-bottom:2px solid #e5e7eb;padding-bottom:14px;margin-bottom:14px;">
  <div style="display:inline-block;padding:3px 14px;border-radius:14px;background:#fef2f2;color:#ef4444;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border:1px solid #fecaca;margin-bottom:8px;">Plagiarism Shield Report</div>
  <h1 style="font-size:18px;color:#1e293b;margin:6px 0 4px;">Similarity Analysis — Upload Blocked</h1>
  <div style="font-size:11px;color:#9ca3af;">Generated on ${dateStr} at ${timeStr}</div>
</div>

<div style="display:flex;align-items:center;gap:16px;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
  <div style="font-size:28px;font-weight:900;color:${parseFloat(avgScore) >= 70 ? '#ef4444' : parseFloat(avgScore) >= 40 ? '#f59e0b' : '#22c55e'};min-width:80px;text-align:center;">${avgScore}%</div>
  <div style="font-size:12px;color:#4b5563;line-height:1.5;">
    <strong style="color:#1e293b;">Upload Rejected</strong> — ${flaggedCount}/${totalParas} paragraphs flagged (${ratio}%)<br>
    Yellow highlighted text indicates paragraphs with high similarity to existing repository documents.
  </div>
</div>

<div style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px;">Document Content</div>
<div style="background:#fff;border:1px solid #d1d5db;border-radius:4px;padding:20px 24px;margin-bottom:20px;font-family:'Times New Roman',Times,serif;font-size:13px;line-height:1.8;">
  <table style="width:100%;border-collapse:collapse;">${paperRows}</table>
</div>

<div style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px;">Detected Paragraphs — Details</div>
${detailCards}

<div style="font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:16px;">
  <span style="background:rgba(255,235,59,.45);padding:1px 5px;">highlighted</span> = detected similarity &nbsp;|&nbsp;
  <span style="color:#ef4444;">●</span> High ≥70% &nbsp;
  <span style="color:#f59e0b;">●</span> Medium 40–69% &nbsp;
  <span style="color:#22c55e;">●</span> Low 30–39%
</div>

</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to download the report.'); return; }
  w.document.write(printHtml);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
}
