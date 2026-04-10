/* ============================================================
   quick-scan.js — Quick Scan page logic
   Upload → Scan → Show results (no save)
   ============================================================ */
const API = '/api';

// DOM refs
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const filePreview    = document.getElementById('filePreview');
const fileName       = document.getElementById('fileName');
const removeFile     = document.getElementById('removeFile');
const btnScan        = document.getElementById('btnScan');
const uploadSection  = document.getElementById('uploadSection');
const scanProgress   = document.getElementById('scanProgress');
const scanResults    = document.getElementById('scanResults');
const scanStatusText = document.getElementById('scanStatusText');
const scanSubtext    = document.getElementById('scanSubtext');
const btnScanAgain   = document.getElementById('btnScanAgain');

let selectedFile = null;

// ── File handling ────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) setFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) setFile(fileInput.files[0]);
});

removeFile.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  dropZone.classList.remove('hidden');
  btnScan.disabled = true;
});

function setFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(ext)) {
    alert('Only PDF, DOCX, and TXT files are allowed.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    alert('File size must be under 20 MB.');
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  filePreview.classList.remove('hidden');
  dropZone.classList.add('hidden');
  btnScan.disabled = false;
}

// ── Scan ─────────────────────────────────────────────────────
btnScan.addEventListener('click', runQuickScan);
btnScanAgain.addEventListener('click', () => {
  scanResults.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  dropZone.classList.remove('hidden');
  btnScan.disabled = true;
});

async function runQuickScan() {
  if (!selectedFile) return;

  const useAI = document.getElementById('chkAI').checked;
  const useInternet = document.getElementById('chkInternet').checked;

  // Show progress
  uploadSection.classList.add('hidden');
  scanProgress.classList.remove('hidden');
  scanResults.classList.add('hidden');

  updateStatus('Extracting text from document…', 'Parsing file content');

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('use_openai', useAI);
  formData.append('use_internet', useInternet);

  try {
    updateStatus('Analyzing your document…', 'Running TF-IDF & Cosine Similarity against repository');

    const res = await fetch(`${API}/quick-scan`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');

    scanProgress.classList.add('hidden');
    renderResults(data);

  } catch (err) {
    scanProgress.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    alert('Scan failed: ' + err.message);
  }
}

function updateStatus(title, sub) {
  scanStatusText.textContent = title;
  scanSubtext.textContent = sub;
}

// ── Render Results ───────────────────────────────────────────
function renderResults(data) {
  scanResults.classList.remove('hidden');

  // Score gauge
  const score = data.overall_score || 0;
  const circumference = 251.2;
  const half = circumference / 2;
  const offset = half - (score / 100) * half;
  const gaugeFill = document.getElementById('scanGaugeFill');
  gaugeFill.style.strokeDashoffset = offset;

  if (score >= 70) {
    gaugeFill.style.stroke = 'var(--red)';
    document.getElementById('scanRiskBadge').textContent = 'High Risk';
    document.getElementById('scanRiskBadge').className = 'risk-badge risk-high';
  } else if (score >= 40) {
    gaugeFill.style.stroke = 'var(--yellow)';
    document.getElementById('scanRiskBadge').textContent = 'Medium Risk';
    document.getElementById('scanRiskBadge').className = 'risk-badge risk-medium';
  } else {
    gaugeFill.style.stroke = 'var(--green)';
    document.getElementById('scanRiskBadge').textContent = 'Low Risk';
    document.getElementById('scanRiskBadge').className = 'risk-badge risk-low';
  }
  document.getElementById('scanScoreNum').textContent = score + '%';
  document.getElementById('scanFileName').textContent = data.filename || 'Document';

  // Pills
  const local = data.local_check || {};
  const ai = data.ai_check;
  const internet = data.internet_check || {};
  const pills = document.getElementById('scanPills');
  pills.innerHTML = `
    <span class="pill"><i class="fas fa-database"></i> ${(local.document_matches || []).length} similar docs</span>
    <span class="pill"><i class="fas fa-paragraph"></i> ${local.flagged_paragraphs || 0}/${local.total_paragraphs || 0} paragraphs flagged</span>
    ${ai && !ai.error ? `<span class="pill" style="color:#e74c3c;"><i class="fas fa-robot"></i> AI: ${ai.plagiarismPercentage || 0}%</span>` : ''}
    ${(internet.matches || []).length > 0 ? `<span class="pill" style="color:#74b9ff;"><i class="fas fa-globe"></i> ${internet.total_found} web sources</span>` : ''}
    <span class="pill" style="color:${score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)'};">
      ${score}% overall similarity
    </span>
  `;

  // Local document matches
  renderLocalMatches(local.document_matches || []);

  // Paragraph matches
  renderParagraphMatches(local.paragraph_matches || []);

  // AI
  if (ai && !ai.error) {
    document.getElementById('aiSection').classList.remove('hidden');
    renderAIResults(ai);
  }

  // Internet
  if ((internet.matches || []).length > 0) {
    document.getElementById('internetSection').classList.remove('hidden');
    renderInternetResults(internet.matches);
  }
}

function renderLocalMatches(matches) {
  const el = document.getElementById('localMatchList');
  if (matches.length === 0) {
    el.innerHTML = `<p class="text-muted"><i class="fas fa-circle-check" style="color:var(--green);"></i> No similar documents found in repository.</p>`;
    return;
  }
  el.innerHTML = matches.map(m => {
    const sc = m.similarity_score;
    const cls = sc >= 70 ? 'high' : sc >= 40 ? 'medium' : 'low';
    const col = sc >= 70 ? 'var(--red)' : sc >= 40 ? 'var(--yellow)' : 'var(--green)';
    return `
      <div class="match-item">
        <div class="match-score-bar-wrap">
          <span class="match-title">${esc(m.title)}</span>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.min(sc,100)}%"></div></div>
        </div>
        <span class="match-score-badge" style="color:${col};">${sc.toFixed(1)}%</span>
      </div>`;
  }).join('');
}

function renderParagraphMatches(matches) {
  const el = document.getElementById('paraMatchList');
  if (matches.length === 0) {
    el.innerHTML = `<p class="text-muted"><i class="fas fa-circle-check" style="color:var(--green);"></i> No flagged paragraphs.</p>`;
    return;
  }
  el.innerHTML = matches.map((m, i) => {
    const sc = m.matched_score;
    const cls = sc >= 70 ? 'high' : sc >= 40 ? 'medium' : 'low';
    const col = sc >= 70 ? 'var(--red)' : sc >= 40 ? 'var(--yellow)' : 'var(--green)';
    return `
      <div class="scan-para-match">
        <div class="scan-para-header">
          <span class="scan-para-num">¶${m.paragraph_index + 1}</span>
          <span class="scan-para-score" style="color:${col};">${sc.toFixed(1)}% match</span>
        </div>
        <div class="scan-para-text">${esc(m.paragraph_text.slice(0, 300))}${m.paragraph_text.length > 300 ? '…' : ''}</div>
        <div class="scan-para-source">
          <i class="fas fa-arrow-right"></i>
          <strong>Matches:</strong> "${esc(m.matched_title)}"
          <br><em style="color:rgba(255,255,255,.5);font-size:.8rem;">"${esc((m.matched_text || '').slice(0, 200))}${(m.matched_text || '').length > 200 ? '…' : ''}"</em>
        </div>
      </div>`;
  }).join('');
}

function renderAIResults(ai) {
  const el = document.getElementById('aiResultContent');
  const flagged = ai.flaggedParagraphs || [];
  const pct = ai.plagiarismPercentage || 0;
  const col = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--yellow)' : 'var(--green)';

  let html = `
    <div class="scan-ai-summary">
      <div class="scan-ai-score" style="color:${col};">${pct}%</div>
      <div>
        <strong>AI Plagiarism Estimate</strong>
        <p class="text-muted" style="font-size:.85rem;">${esc(ai.explanation || '')}</p>
      </div>
    </div>`;

  if (flagged.length > 0) {
    html += `<div class="scan-ai-flags">`;
    for (const f of flagged) {
      html += `
        <div class="scan-ai-flag-item">
          <span class="scan-ai-flag-badge">${f.plagiarism_score || f.score || 0}%</span>
          <div>
            <p style="margin:0;">${esc((f.text || f.paragraph || '').slice(0, 200))}…</p>
            <p class="text-muted" style="font-size:.8rem;margin:.25rem 0 0;">${esc(f.reason || f.type || '')}</p>
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  if (ai.suggestions) {
    html += `<div class="scan-ai-suggestion"><i class="fas fa-lightbulb"></i> ${esc(ai.suggestions)}</div>`;
  }

  el.innerHTML = html;
}

function renderInternetResults(matches) {
  const el = document.getElementById('internetResultList');
  if (matches.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = matches.map(m => {
    const sc = m.similarity_score || 0;
    const col = sc >= 70 ? 'var(--red)' : sc >= 40 ? 'var(--yellow)' : 'var(--green)';
    let parsed = {};
    try { parsed = JSON.parse(m.matched_paragraph || '{}'); } catch {}

    const url = parsed.source_url || '';
    const domain = parsed.source_domain || '';
    const snippet = parsed.matched_text || '';
    const allSources = parsed.all_sources || [];
    const paraText = parsed.new_paragraph || '';

    return `
      <div class="scan-internet-card">
        <div class="scan-internet-header">
          <span class="scan-internet-score" style="color:${col};">${sc.toFixed(1)}%</span>
          <div style="flex:1;">
            ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="scan-internet-url"><i class="fas fa-external-link-alt"></i> ${esc(domain || url)}</a>` : ''}
            ${allSources.length > 1 ? `<div class="scan-internet-sources">${allSources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.domain)}</a>`).join(' · ')}</div>` : ''}
          </div>
        </div>
        ${paraText ? `<div class="scan-internet-para"><i class="fas fa-quote-left"></i> ${esc(paraText.slice(0, 200))}…</div>` : ''}
        ${snippet ? `<div class="scan-internet-snippet"><strong>Web match:</strong> "${esc(snippet.slice(0, 250))}"</div>` : ''}
      </div>`;
  }).join('');
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
