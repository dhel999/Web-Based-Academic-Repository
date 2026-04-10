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
const qsDocPaper     = document.getElementById('qsDocPaper');

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

  // Reset progress steps
  document.querySelectorAll('.qs-pstep').forEach(el => { el.classList.remove('active','done'); });
  setStep(1);

  updateStatus('Extracting text from document…', 'Parsing file content');

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('use_openai', useAI);
  formData.append('use_internet', useInternet);

  try {
    setStep(2);
    updateStatus('Analyzing your document…', 'Running TF-IDF & Cosine Similarity against repository');

    const res = await fetch(`${API}/quick-scan`, {
      method: 'POST',
      body: formData
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw && raw.startsWith('<!DOCTYPE')
        ? `Server returned HTML error (HTTP ${res.status}).`
        : `Unexpected server response (HTTP ${res.status}).` };
    }
    if (!res.ok) throw new Error(data.error || `Scan failed (HTTP ${res.status})`);

    // Mark remaining steps done
    if (useAI) setStep(3);
    if (useInternet) setStep(4);
    document.querySelectorAll('.qs-pstep').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });

    scanProgress.classList.add('hidden');
    renderResults(data);

  } catch (err) {
    scanProgress.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    alert('Scan failed: ' + err.message);
  }
}

function setStep(n) {
  for (let i = 1; i < n; i++) {
    const el = document.getElementById('pstep' + i);
    if (el) { el.classList.remove('active'); el.classList.add('done'); }
  }
  const cur = document.getElementById('pstep' + n);
  if (cur) { cur.classList.add('active'); cur.classList.remove('done'); }
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
    ${ai && ai.error ? `<span class="pill" style="color:var(--red);border-color:var(--red);"><i class="fas fa-triangle-exclamation"></i> AI Error: ${esc(ai.error)}</span>` : ''}
    ${(internet.matches || []).length > 0 ? `<span class="pill" style="color:#74b9ff;"><i class="fas fa-globe"></i> ${internet.total_found} web sources</span>` : ''}
    <span class="pill" style="color:${score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)'};">
      ${score}% overall similarity
    </span>
  `;

  // Local document matches
  renderLocalMatches(local.document_matches || []);

  // Paragraph matches
  renderParagraphMatches(local.paragraph_matches || []);

  // Document-style highlight view
  renderDocumentStyleView(local, ai, internet);

  // AI
  if (ai && !ai.error) {
    document.getElementById('aiSection').classList.remove('hidden');
    renderAIResults(ai);
  } else if (ai && ai.error) {
    document.getElementById('aiSection').classList.remove('hidden');
    document.getElementById('aiResultContent').innerHTML = `<p class="text-danger"><i class="fas fa-triangle-exclamation"></i> AI analysis failed: ${esc(ai.error)}</p>`;
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
          <span class="scan-ai-flag-badge">${f.score || 0}%</span>
          <div>
            <p style="margin:0;">${esc((f.text || '').slice(0, 200))}${(f.text || '').length > 200 ? '…' : ''}</p>
            <p class="text-muted" style="font-size:.8rem;margin:.25rem 0 0;"><strong>${esc(f.risk || '')}</strong> — ${esc(f.reason || '')}</p>
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

function renderDocumentStyleView(local, ai, internet) {
  const paragraphs = Array.isArray(local.all_paragraphs) ? local.all_paragraphs : [];
  if (!qsDocPaper) return;

  if (paragraphs.length === 0) {
    qsDocPaper.innerHTML = `<p style="color:#666;text-align:center;padding:2rem;"><i class="fas fa-circle-info"></i> No extracted document text available for inline view.</p>`;
    return;
  }

  const localMap = new Map();
  for (const m of (local.paragraph_matches || [])) {
    const idx = Number(m.paragraph_index);
    if (!Number.isFinite(idx)) continue;
    const old = localMap.get(idx);
    if (!old || (m.matched_score || 0) > old.score) {
      localMap.set(idx, {
        score: m.matched_score || 0,
        title: m.matched_title || 'Unknown'
      });
    }
  }

  const aiMap = new Map();
  for (const f of (ai?.flaggedParagraphs || [])) {
    const idx = Number(f.paragraph_index);
    if (!Number.isFinite(idx)) continue;
    aiMap.set(idx, {
      score: f.score || (f.risk === 'high' ? 80 : f.risk === 'medium' ? 50 : 20),
      risk: f.risk || 'low',
      reason: f.reason || 'AI flagged this paragraph.'
    });
  }

  const internetMap = new Map();
  for (const m of (internet.matches || [])) {
    const idx = Number(m.paragraph_index);
    if (!Number.isFinite(idx)) continue;
    const old = internetMap.get(idx);
    const score = m.similarity_score || 0;
    if (!old || score > old.score) {
      internetMap.set(idx, {
        score,
        domain: m.source_domain || '',
        url: m.source_url || ''
      });
    }
  }

  let html = '';
  for (let i = 0; i < paragraphs.length; i++) {
    const text = String(paragraphs[i] || '').trim();
    if (!text) continue;

    const localHit = localMap.get(i);
    const aiHit = aiMap.get(i);
    const webHit = internetMap.get(i);

    let cls = 'paper-paragraph';
    if (localHit) cls += ' match-local';
    if (aiHit) cls += ' match-ai';
    if (webHit) cls += ' match-internet';
    if (!localHit && !aiHit && !webHit) cls += ' original';

    let badges = '';
    if (localHit) badges += `<span class="paper-para-badge badge-local">${(localHit.score || 0).toFixed(1)}% Local</span>`;
    if (aiHit) badges += `<span class="paper-para-badge badge-ai">${Math.round(aiHit.score || 0)}% AI</span>`;
    if (webHit) badges += `<span class="paper-para-badge badge-internet">${(webHit.score || 0).toFixed(1)}% Web</span>`;

    let sourceInfo = '';
    if (localHit) {
      sourceInfo += `<div class="paper-source-info source-local"><strong><i class="fas fa-database"></i> Local Match:</strong> ${esc(localHit.title)} (${(localHit.score || 0).toFixed(1)}%)</div>`;
    }
    if (aiHit) {
      sourceInfo += `<div class="paper-source-info source-ai"><strong><i class="fas fa-robot"></i> AI Flag:</strong> ${esc(aiHit.risk)} risk — ${esc(aiHit.reason)}</div>`;
    }
    if (webHit) {
      const webSource = webHit.url
        ? `<a href="${esc(webHit.url)}" target="_blank" rel="noopener">${esc(webHit.domain || webHit.url)}</a>`
        : esc(webHit.domain || 'Web source');
      sourceInfo += `<div class="paper-source-info source-internet"><strong><i class="fas fa-globe"></i> Internet Match:</strong> ${(webHit.score || 0).toFixed(1)}% from ${webSource}</div>`;
    }

    html += `<div class="${cls}">${esc(text)}${badges}</div>${sourceInfo}`;
  }

  qsDocPaper.innerHTML = html || `<p style="color:#666;text-align:center;padding:2rem;"><i class="fas fa-circle-info"></i> No paragraph content to display.</p>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
