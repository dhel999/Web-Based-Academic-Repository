/* ============================================================
   result.js — Plagiarism Report Page logic
   ============================================================ */
const API = '/api';

// Parse document ID from query string
const params     = new URLSearchParams(window.location.search);
const documentId = params.get('id');

// DOM refs
const loadingState      = document.getElementById('loadingState');
const errorState        = document.getElementById('errorState');
const reportContent     = document.getElementById('reportContent');
const docTitleHero      = document.getElementById('docTitleHero');
const docSubtitle       = document.getElementById('docSubtitle');
const reportDocTitle    = document.getElementById('reportDocTitle');
const reportFilename    = document.getElementById('reportFilename');
const gaugeFill         = document.getElementById('gaugeFill');
const gaugeText         = document.getElementById('gaugeText');
const riskBadge         = document.getElementById('riskBadge');
const scorePills        = document.getElementById('scorePills');
const localMatchList    = document.getElementById('localMatchList');
const paragraphMatchList= document.getElementById('paragraphMatchList');
const aiContent         = document.getElementById('aiContent');
const aiAnalysisSection = document.getElementById('aiAnalysisSection');
const internetMatchList = document.getElementById('internetMatchList');
const btnRecheck        = document.getElementById('btnRecheck');
const btnRecheckAI      = document.getElementById('btnRecheckAI');
const btnInternet       = document.getElementById('btnInternet');
const btnPrint          = document.getElementById('btnPrint');

// Hamburger
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// ── Initialise ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!documentId) { showError(); return; }
  await loadReport();

  btnRecheck.addEventListener('click', () => runAnalysis(false));
  btnRecheckAI.addEventListener('click', () => runAnalysis(true));
  btnInternet.addEventListener('click', () => runInternetSearch());
  btnPrint.addEventListener('click', () => window.print());
});

// Store document data globally for re-use
let currentDoc = null;
let currentParagraphs = [];
let currentDisplayParagraphs = [];
let fullExtractedText = '';
let localMatchMap = new Map();    // paragraph_index -> { score, matched_text, matched_title }
let aiMatchMap = new Map();       // paragraph_index -> { score, reason }
let internetMatchMap = new Map(); // paragraph_index -> { score, snippet, url, domain, all_sources }
let aiTextHints = [];

// ── Load existing results + document info ─────────────────────
async function loadReport() {
  try {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const [docRes, resultsRes] = await Promise.all([
      fetch(`${API}/documents/${documentId}`, { headers }),
      fetch(`${API}/results/${documentId}`, { headers })
    ]);

    const docData    = await docRes.json();
    const resultData = await resultsRes.json();

    if (!docRes.ok || !docData.document) { showError(); return; }

    // Non-owner view — show limited info (guest or logged-in non-owner)
    if (docData.guest || docData.restricted) {
      loadingState.classList.add('hidden');
      renderGuestView(docData.document, docData.restricted);
      return;
    }

    currentDoc        = docData.document;
    currentParagraphs = (docData.paragraphs || []).map(p => p.paragraph_text);
    fullExtractedText = currentDoc.extracted_text || '';
    currentDisplayParagraphs = Array.isArray(docData.display_paragraphs) ? docData.display_paragraphs : [];
    const results     = resultData.results || [];

    renderDocumentInfo(currentDoc);
    renderResultsFromDB(results);

    loadingState.classList.add('hidden');
    reportContent.classList.remove('hidden');

    // Auto-run local analysis if no paragraph-level results exist yet
    const hasParaResults = results.some(r => r.matched_paragraph);
    if (!hasParaResults) {
      await runAnalysis(false);
    }

  } catch (err) {
    showError();
  }
}

function renderGuestView(doc, isRestricted) {
  // Hide full report, show limited detail view
  reportContent.classList.add('hidden');

  const score = doc.similarity_score || 0;
  const color = score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)';
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';

  // Prompt section differs: guest sees login button, non-owner sees info message
  const promptSection = isRestricted
    ? `<div class="guest-login-prompt restricted">
        <i class="fas fa-user-lock"></i>
        <div>
          <strong>Owner Access Only</strong>
          <p>Only the document owner can view the full plagiarism analysis, highlighted matches, and detailed paragraph comparisons.</p>
        </div>
        <a href="index.html" class="btn btn-primary"><i class="fas fa-home"></i> Back to Home</a>
      </div>`
    : `<div class="guest-login-prompt">
        <i class="fas fa-lock"></i>
        <div>
          <strong>Full report requires login</strong>
          <p>Sign in to view the complete plagiarism analysis, highlighted matches, and detailed paragraph comparisons.</p>
        </div>
        <a href="login.html" class="btn btn-primary"><i class="fas fa-sign-in-alt"></i> Login to View Full Report</a>
      </div>`;

  const guestDiv = document.createElement('div');
  guestDiv.className = 'guest-detail-view';
  guestDiv.innerHTML = `
    <div class="card guest-detail-card">
      <div class="guest-detail-header">
        <div class="guest-detail-icon-wrap">
          <i class="fas fa-file-alt"></i>
        </div>
        <div>
          <h2 class="guest-detail-title">${escapeHtml(doc.title)}</h2>
          <p class="text-muted" style="font-size:.88rem;">${escapeHtml(doc.original_filename)}</p>
        </div>
      </div>

      <div class="guest-detail-meta-grid">
        ${doc.authors ? `<div class="guest-meta-item"><i class="fas fa-users"></i><div><span class="guest-meta-label">Author(s)</span><span>${escapeHtml(doc.authors)}</span></div></div>` : ''}
        ${doc.course ? `<div class="guest-meta-item"><i class="fas fa-graduation-cap"></i><div><span class="guest-meta-label">Course</span><span>${escapeHtml(doc.course)}</span></div></div>` : ''}
        ${doc.year ? `<div class="guest-meta-item"><i class="fas fa-calendar-alt"></i><div><span class="guest-meta-label">Year</span><span>${escapeHtml(doc.year)}</span></div></div>` : ''}
        ${doc.uploaded_by ? `<div class="guest-meta-item"><i class="fas fa-user"></i><div><span class="guest-meta-label">Uploaded by</span><span>${escapeHtml(doc.uploaded_by)}</span></div></div>` : ''}
        <div class="guest-meta-item"><i class="fas fa-clock"></i><div><span class="guest-meta-label">Date</span><span>${formatDate(doc.created_at)}</span></div></div>
      </div>

      <div class="guest-similarity-bar">
        <div class="guest-sim-header">
          <span><i class="fas fa-shield-halved"></i> Plagiarism Similarity</span>
          <span style="color:${color};font-weight:800;font-size:1.3rem;">${score.toFixed(1)}%</span>
        </div>
        <div class="bar-track" style="height:10px;">
          <div class="bar-fill ${score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'}" style="width:${Math.min(score, 100)}%;"></div>
        </div>
        <span style="font-size:.82rem;font-weight:600;color:${color};">${label}</span>
      </div>

      ${doc.abstract ? `
        <div class="guest-abstract">
          <h3><i class="fas fa-align-left"></i> Abstract</h3>
          <p>${escapeHtml(doc.abstract)}</p>
        </div>
      ` : ''}

      ${promptSection}
    </div>
  `;

  document.querySelector('.container').appendChild(guestDiv);
}

function renderDocumentInfo(doc) {
  docTitleHero.innerHTML  = `<i class="fas fa-shield-halved"></i> ${escapeHtml(doc.title)}`;
  docSubtitle.textContent = `Uploaded: ${formatDate(doc.created_at)} | ${doc.original_filename}`;
  reportDocTitle.textContent  = doc.title;
  reportFilename.textContent  = doc.original_filename;
}

function renderResultsFromDB(results) {
  const localResults    = results.filter(r => r.source === 'local');
  const aiResults       = results.filter(r => r.source === 'openai');
  const internetResults = results.filter(r => r.source === 'internet');

  // Compute overall score: combine local, AI, and internet scores
  let localScore = 0;
  const paragraphResults = localResults.filter(r => r.matched_paragraph);
  const docLevelResults  = localResults.filter(r => !r.matched_paragraph);
  if (paragraphResults.length > 0 && currentParagraphs.length > 0) {
    const totalParaScore = paragraphResults.reduce((sum, r) => sum + r.similarity_score, 0);
    localScore = totalParaScore / currentParagraphs.length;
  } else if (docLevelResults.length > 0) {
    const topDocs = docLevelResults.slice(0, 3);
    localScore = topDocs.reduce((s, r) => s + r.similarity_score, 0) / topDocs.length * 0.3;
  }

  // AI score: ratio of AI-flagged paragraphs × average AI confidence
  let aiScore = 0;
  if (aiResults.length > 0 && currentParagraphs.length > 0) {
    const avgAiConf = aiResults.reduce((s, r) => s + (r.similarity_score || 80), 0) / aiResults.length;
    aiScore = (aiResults.length / currentParagraphs.length) * avgAiConf;
  }

  // Internet score: ratio of internet-matched paragraphs × average score
  let internetScore = 0;
  if (internetResults.length > 0 && currentParagraphs.length > 0) {
    const avgIntConf = internetResults.reduce((s, r) => s + r.similarity_score, 0) / internetResults.length;
    internetScore = (internetResults.length / currentParagraphs.length) * avgIntConf;
  }

  // Combined: take the highest signal among all sources
  let overallScore = Math.max(localScore, aiScore, internetScore);
  overallScore = parseFloat(Math.min(overallScore, 100).toFixed(1));

  renderGauge(overallScore);
  renderScorePills(localResults.length, aiResults.length, internetResults.length, overallScore);

  // Deduplicate document-level matches: keep highest score per matched title
  const docLevelRaw = localResults.filter(r => !r.matched_paragraph);
  const seenTitles = new Map();
  for (const r of docLevelRaw) {
    const key = (r.matched_document_title || '').trim().toLowerCase();
    if (!seenTitles.has(key) || r.similarity_score > seenTitles.get(key).similarity_score) {
      seenTitles.set(key, r);
    }
  }
  renderLocalMatches([...seenTitles.values()].sort((a, b) => b.similarity_score - a.similarity_score));

  // Build local match map
  localMatchMap = new Map();
  for (const r of localResults.filter(r => r.matched_paragraph)) {
    let parsed = null;
    try { parsed = JSON.parse(r.matched_paragraph); } catch { continue; }
    if (parsed && parsed.new_paragraph) {
      const idx = currentParagraphs.findIndex(p => p === parsed.new_paragraph);
      if (idx >= 0 && (!localMatchMap.has(idx) || r.similarity_score > localMatchMap.get(idx).score)) {
        localMatchMap.set(idx, {
          score: r.similarity_score,
          matched_text: parsed.matched_text || '',
          matched_title: parsed.matched_title || r.matched_document_title || 'Unknown',
          matched_document_id: r.matched_document_id
        });
      }
    }
  }

  // Build internet match map
  internetMatchMap = new Map();
  for (const r of internetResults) {
    let parsed = null;
    try { parsed = JSON.parse(r.matched_paragraph); } catch { continue; }
    if (parsed && parsed.new_paragraph) {
      const idx = currentParagraphs.findIndex(p => p === parsed.new_paragraph);
      if (idx >= 0 && (!internetMatchMap.has(idx) || r.similarity_score > internetMatchMap.get(idx).score)) {
        internetMatchMap.set(idx, {
          score: r.similarity_score,
          snippet: parsed.matched_text || '',
          url: parsed.source_url || '',
          domain: parsed.source_domain || '',
          all_sources: parsed.all_sources || []
        });
      }
    }
  }

  // Build AI match map — integrate into paper view (skip short paragraphs)
  aiMatchMap = new Map();
  for (const r of aiResults) {
    let paraText = r.matched_paragraph || '';
    // Try to find which paragraph this AI result matches
    for (let idx = 0; idx < currentParagraphs.length; idx++) {
      const p = currentParagraphs[idx];
      // Skip short paragraphs — headers, titles, numbered items
      if (p.split(/\s+/).length < 8 || p.length < 40) continue;
      if (paraText.includes(p.slice(0, 60)) || p.includes(paraText.slice(0, 60))) {
        if (!aiMatchMap.has(idx) || r.similarity_score > aiMatchMap.get(idx).score) {
          aiMatchMap.set(idx, {
            score: r.similarity_score,
            reason: paraText
          });
        }
        break;
      }
    }
  }

  // Render the unified paper view with ALL content
  renderPaperView();

  if (aiResults.length > 0) {
    // Show AI summary section
    aiAnalysisSection.classList.remove('hidden');
    aiContent.innerHTML = `
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <span class="pill" style="color:#e74c3c;"><i class="fas fa-robot"></i> ${aiResults.length} paragraph(s) flagged by AI</span>
        <span class="text-muted" style="font-size:.85rem;">AI-flagged paragraphs are highlighted in <strong style="color:#e74c3c;">red</strong> in the document above.</span>
      </div>`;
  }

  if (internetResults.length > 0) {
    renderInternetSources(internetResults);
  }
}

function renderGauge(score) {
  const circumference = 251.2; // πd for r=80 semicircle ≈ 251.2
  const half = circumference / 2;
  const offset = half - (score / 100) * half;
  gaugeFill.style.strokeDashoffset = offset;

  if (score >= 70) {
    gaugeFill.style.stroke = 'var(--red)';
    riskBadge.textContent  = 'High Risk';
    riskBadge.className    = 'risk-badge risk-high';
  } else if (score >= 40) {
    gaugeFill.style.stroke = 'var(--yellow)';
    riskBadge.textContent  = 'Medium Risk';
    riskBadge.className    = 'risk-badge risk-medium';
  } else {
    gaugeFill.style.stroke = 'var(--green)';
    riskBadge.textContent  = 'Low Risk';
    riskBadge.className    = 'risk-badge risk-low';
  }
  gaugeText.textContent = score + '%';
}

function renderScorePills(localCount, aiCount, internetCount, score) {
  scorePills.innerHTML = `
    <span class="pill"><i class="fas fa-database"></i> ${localCount} local match${localCount !== 1 ? 'es' : ''}</span>
    ${aiCount > 0 ? `<span class="pill"><i class="fas fa-robot"></i> ${aiCount} AI flags</span>` : ''}
    ${internetCount > 0 ? `<span class="pill" style="color:#74b9ff;"><i class="fas fa-globe"></i> ${internetCount} web match${internetCount !== 1 ? 'es' : ''}</span>` : ''}
    <span class="pill" style="color:${score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)'};">
      ${score}% similarity
    </span>
  `;
}

function renderLocalMatches(results) {
  if (results.length === 0) {
    localMatchList.innerHTML = `<p class="text-muted" style="font-size:.9rem;"><i class="fas fa-circle-check"></i> No matching documents found in repository.</p>`;
    return;
  }

  localMatchList.innerHTML = results.map(r => {
    const sc   = r.similarity_score;
    const cls  = sc >= 70 ? 'high' : sc >= 40 ? 'medium' : 'low';
    const col  = sc >= 70 ? 'var(--red)' : sc >= 40 ? 'var(--yellow)' : 'var(--green)';
    return `
      <div class="match-item">
        <div class="match-score-bar-wrap">
          <span class="match-title">${escapeHtml(r.matched_document_title || 'Unknown Document')}</span>
          <div class="bar-track">
            <div class="bar-fill ${cls}" style="width:${Math.min(sc,100)}%"></div>
          </div>
        </div>
        <span class="match-score-badge" style="color:${col};">${sc}%</span>
        ${r.matched_document_id ? `
        <a href="result.html?id=${r.matched_document_id}" class="btn btn-outline" style="padding:.3rem .65rem;font-size:.78rem;">
          <i class="fas fa-eye"></i>
        </a>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Render the full document in a white MS Word-style paper view.
 * Shows ALL extracted text. Matched paragraphs are highlighted inline
 * with color coding: Yellow=local, Red=AI, Blue=Internet
 */
function renderPaperView() {
  if (!fullExtractedText && currentParagraphs.length === 0) {
    paragraphMatchList.innerHTML = `<p style="color:#999;text-align:center;padding:2rem;"><i class="fas fa-circle-check"></i> No content to display.</p>`;
    return;
  }

  // Prefer explicit display paragraphs from backend; fallback to extracted text split.
  const textBlocks = currentDisplayParagraphs.length > 0
    ? currentDisplayParagraphs
    : (fullExtractedText
      ? fullExtractedText.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0)
      : currentParagraphs);

  // For each text block, check if it matches any tracked paragraph
  let html = '';

  for (const block of textBlocks) {
    // Skip highlighting for short blocks (headers, titles, numbered items)
    const wordCount = block.split(/\s+/).length;
    const isShort = wordCount < 8 || block.length < 40;

    // Try to match this block against our paragraph list
    const matchIdx = (!isShort && findParagraphIndex(block) >= 0) ? findParagraphIndex(block) : -1;

    const local = matchIdx >= 0 ? localMatchMap.get(matchIdx) : null;
    let ai = matchIdx >= 0 ? aiMatchMap.get(matchIdx) : null;
    if (!ai && aiTextHints.length > 0) {
      const blockNorm = block.replace(/\s+/g, ' ').trim().toLowerCase();
      const matchedHint = aiTextHints.find(h => blockNorm.includes(h) || h.includes(blockNorm.slice(0, Math.min(100, blockNorm.length))));
      if (matchedHint) {
        ai = { score: 50, reason: 'AI flagged by semantic text match' };
      }
    }
    const internet = matchIdx >= 0 ? internetMatchMap.get(matchIdx) : null;

    let classes = 'paper-paragraph';
    let badges = '';
    let sourceInfos = '';

    // Priority: show all match types
    if (local) {
      classes += ' match-local';
      badges += `<span class="paper-para-badge badge-local">${local.score}% Local</span>`;
      sourceInfos += `
        <div class="paper-source-info source-local">
          <strong><i class="fas fa-database"></i> Repository Match:</strong> "${escapeHtml(local.matched_title)}" — ${local.score}% similar
          ${local.matched_text ? `<br><em>"${escapeHtml(local.matched_text.slice(0, 250))}${local.matched_text.length > 250 ? '…' : ''}"</em>` : ''}
        </div>`;
    }

    if (ai) {
      classes += ' match-ai';
      badges += `<span class="paper-para-badge badge-ai">${ai.score}% AI</span>`;
      sourceInfos += `
        <div class="paper-source-info source-ai">
          <strong><i class="fas fa-robot"></i> AI Flagged:</strong> Potential paraphrased content — ${ai.score}% risk
        </div>`;
    }

    if (internet) {
      classes += ' match-internet';
      badges += `<span class="paper-para-badge badge-internet">${internet.score}% Web</span>`;
      const sourcesHtml = internet.all_sources && internet.all_sources.length > 0
        ? internet.all_sources.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.domain)}</a>`).join(', ')
        : internet.url ? `<a href="${escapeHtml(internet.url)}" target="_blank" rel="noopener">${escapeHtml(internet.domain)}</a>` : '';
      sourceInfos += `
        <div class="paper-source-info source-internet">
          <strong><i class="fas fa-globe"></i> Internet Match:</strong> ${internet.score}% similar
          ${sourcesHtml ? `<br><i class="fas fa-link"></i> Sources: ${sourcesHtml}` : ''}
          ${internet.snippet ? `<br><em>"${escapeHtml(internet.snippet.slice(0, 250))}${internet.snippet.length > 250 ? '…' : ''}"</em>` : ''}
        </div>`;
    }

    if (!local && !ai && !internet) {
      classes += ' original';
    }

    // Render block with inner line breaks preserved
    const displayText = escapeHtml(block).replace(/\n/g, '<br>');
    html += `<div class="${classes}">${displayText}${badges}</div>${sourceInfos}`;
  }

  paragraphMatchList.innerHTML = html;
}

/**
 * Find the index of a text block in the currentParagraphs array.
 * Uses fuzzy matching: compares the first 80 chars.
 */
function findParagraphIndex(block) {
  const blockClean = block.replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase();
  for (let i = 0; i < currentParagraphs.length; i++) {
    const paraClean = currentParagraphs[i].replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase();
    if (blockClean === paraClean || blockClean.includes(paraClean) || paraClean.includes(blockClean)) {
      return i;
    }
  }
  return -1;
}

/**
 * Render internet source cards in the Internet section
 */
function renderInternetSources(results) {
  const internetResults = results || [];
  const parsed = [];
  for (const r of internetResults) {
    let data = null;
    try { data = JSON.parse(r.matched_paragraph); } catch { continue; }
    if (data) {
      parsed.push({
        score: r.similarity_score,
        snippet: data.matched_text || '',
        url: data.source_url || '',
        domain: data.source_domain || '',
        paragraph_text: data.new_paragraph || '',
        all_sources: data.all_sources || []
      });
    }
  }

  if (parsed.length === 0) {
    internetMatchList.innerHTML = `
      <div class="internet-placeholder">
        <i class="fas fa-circle-check fa-2x" style="color:var(--green);"></i>
        <p>No matching internet sources found.</p>
      </div>`;
    return;
  }

  internetMatchList.innerHTML = parsed.map(m => `
    <div class="internet-source-card">
      <div class="internet-source-header">
        <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="internet-source-url">
          <i class="fas fa-external-link-alt"></i> ${escapeHtml(m.url)}
        </a>
        <span class="internet-source-badge">${m.score}% match</span>
      </div>
      ${m.snippet ? `<div class="internet-source-snippet">${escapeHtml(m.snippet)}</div>` : ''}
      ${m.paragraph_text ? `<div class="internet-source-para"><i class="fas fa-quote-left"></i> "${escapeHtml(m.paragraph_text.slice(0, 150))}${m.paragraph_text.length > 150 ? '…' : ''}"</div>` : ''}
    </div>
  `).join('');
}

// renderAIFromDB is no longer needed — AI results are merged in renderResultsFromDB

// ── Run new analysis ──────────────────────────────────────────
async function runAnalysis(useAI) {
  const btn = useAI ? btnRecheckAI : btnRecheck;
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing…';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/check-plagiarism`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ document_id: documentId, use_openai: useAI })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    // Render fresh results
    const localCheck = data.local_check || {};
    const docMatches  = localCheck.document_matches || [];
    const paraMatches = localCheck.paragraph_matches || [];
    const score       = localCheck.overall_score || 0;

    renderGauge(score);
    renderScorePills(docMatches.length, 0, internetMatchMap.size, score);

    // Render document matches
    localMatchList.innerHTML = docMatches.length === 0
      ? `<p class="text-muted"><i class="fas fa-circle-check"></i> No matching documents found.</p>`
      : docMatches.slice(0, 15).map(m => {
          const sc  = m.similarity_score;
          const cls = sc >= 70 ? 'high' : sc >= 40 ? 'medium' : 'low';
          const col = sc >= 70 ? 'var(--red)' : sc >= 40 ? 'var(--yellow)' : 'var(--green)';
          return `
            <div class="match-item">
              <div class="match-score-bar-wrap">
                <span class="match-title">${escapeHtml(m.title)}</span>
                <div class="bar-track">
                  <div class="bar-fill ${cls}" style="width:${Math.min(sc,100)}%"></div>
                </div>
              </div>
              <span class="match-score-badge" style="color:${col};">${sc}%</span>
              <a href="result.html?id=${m.document_id}" class="btn btn-outline" style="padding:.3rem .65rem;font-size:.78rem;">
                <i class="fas fa-eye"></i>
              </a>
            </div>
          `;
        }).join('');

    // Render paragraph matches — show all paragraphs with highlights
    if (Array.isArray(localCheck.display_paragraphs) && localCheck.display_paragraphs.length > 0) {
      currentDisplayParagraphs = localCheck.display_paragraphs;
    }
    renderParagraphsLive(paraMatches, localCheck.all_paragraphs || []);

    // Render AI results — merged into paper view
    if (useAI && data.openai_check && !data.openai_check.error) {
      renderAIAnalysis(data.openai_check);
    } else if (useAI && data.openai_check?.error) {
      aiAnalysisSection.classList.remove('hidden');
      aiContent.innerHTML = `<p class="text-danger"><i class="fas fa-triangle-exclamation"></i> AI Error: ${escapeHtml(data.openai_check.error)}</p>`;
    }

  } catch (err) {
    alert('Analysis failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function renderAIAnalysis(ai) {
  // Merge AI flagged paragraphs into the aiMatchMap
  aiTextHints = [];
  const flagged = ai.flaggedParagraphs || [];
  for (const fp of flagged) {
    let idx = fp.paragraph_index != null ? fp.paragraph_index : -1;
    if ((idx == null || idx < 0 || idx >= currentParagraphs.length) && fp.text) {
      idx = findParagraphIndex(fp.text);
    }
    if (idx >= 0) {
      const score = fp.risk === 'high' ? 85 : fp.risk === 'medium' ? 55 : 30;
      aiMatchMap.set(idx, {
        score: score,
        reason: fp.reason || 'AI flagged'
      });
    }
    if (fp.text) {
      const hint = String(fp.text).replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
      if (hint) aiTextHints.push(hint);
    }
  }

  // Re-render paper view with AI highlights integrated
  renderPaperView();

  // Show AI summary section
  aiAnalysisSection.classList.remove('hidden');
  aiContent.innerHTML = `
    <div class="ai-result">
      <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;">
        <div style="font-size:2rem;font-weight:800;color:${ai.plagiarismPercentage >= 70 ? '#e74c3c' : ai.plagiarismPercentage >= 40 ? '#f0c000' : 'var(--green)'};">${ai.plagiarismPercentage}%</div>
        <div>
          <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">AI Plagiarism Estimate</div>
          <div class="risk-badge risk-${ai.riskLevel}" style="display:inline-block;margin-top:.25rem;">${ai.riskLevel.toUpperCase()} RISK</div>
        </div>
      </div>
      <p style="font-size:.85rem;color:var(--text-muted);">${escapeHtml(ai.explanation || '')}</p>
      <p style="font-size:.85rem;color:var(--text-muted);margin-top:.5rem;"><strong>Suggestions:</strong> ${escapeHtml(ai.suggestions || '')}</p>
      <p style="font-size:.85rem;color:#e74c3c;margin-top:.5rem;"><i class="fas fa-info-circle"></i> ${flagged.length} paragraph(s) highlighted in <strong>red</strong> in the document above.</p>
    </div>
  `;
}

// ── Render paragraphs from live analysis ──────────────────────
function renderParagraphsLive(paraMatches, allParagraphs) {
  // Build match map from live paragraph_matches
  localMatchMap = new Map();
  for (const pm of paraMatches) {
    const idx = pm.paragraph_index != null ? pm.paragraph_index : pm.index;
    const bm  = pm.best_match || {};
    const sc  = bm.similarity_score || 0;
    if (idx != null && sc > 0 && (!localMatchMap.has(idx) || sc > localMatchMap.get(idx).score)) {
      localMatchMap.set(idx, {
        score: sc,
        matched_text: bm.paragraph_text || '',
        matched_title: bm.matched_title || bm.title || 'Unknown'
      });
    }
  }

  if (allParagraphs.length > 0) currentParagraphs = allParagraphs;

  renderPaperView();
}

// ── Run internet plagiarism search ────────────────────────────
async function runInternetSearch() {
  const orig = btnInternet.innerHTML;
  btnInternet.disabled = true;
  btnInternet.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching Internet…';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/check-internet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ document_id: documentId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Internet search failed');

    const matches = data.internet_matches || [];

    // Update internet match map
    for (const m of matches) {
      const idx = m.paragraph_index;
      if (idx != null && (!internetMatchMap.has(idx) || m.similarity_score > internetMatchMap.get(idx).score)) {
        internetMatchMap.set(idx, {
          score: m.similarity_score,
          snippet: m.matched_snippet || '',
          url: m.source_url || '',
          domain: m.source_domain || '',
          all_sources: m.all_sources || []
        });
      }
    }

    // Re-render the paper view with internet highlights
    renderPaperView();

    // Render internet source cards
    if (matches.length > 0) {
      internetMatchList.innerHTML = matches.map(m => `
        <div class="internet-source-card">
          <div class="internet-source-header">
            <a href="${escapeHtml(m.source_url)}" target="_blank" rel="noopener" class="internet-source-url">
              <i class="fas fa-external-link-alt"></i> ${escapeHtml(m.source_url)}
            </a>
            <span class="internet-source-badge">${m.similarity_score}% match</span>
          </div>
          ${m.matched_snippet ? `<div class="internet-source-snippet">${escapeHtml(m.matched_snippet)}</div>` : ''}
          <div class="internet-source-para"><i class="fas fa-quote-left"></i> Paragraph ${m.paragraph_index + 1}: "${escapeHtml(m.paragraph_text.slice(0, 150))}${m.paragraph_text.length > 150 ? '…' : ''}"</div>
        </div>
      `).join('');
    } else {
      internetMatchList.innerHTML = `
        <div class="internet-placeholder">
          <i class="fas fa-circle-check fa-2x" style="color:var(--green);"></i>
          <p>No matching internet sources found. Checked ${data.total_checked || 0} paragraphs.</p>
        </div>`;
    }

    // Update pills
    const localCount = localMatchMap.size;
    const aiCount = aiMatchMap.size;
    const internetCount = internetMatchMap.size;
    const currentScore = parseFloat(gaugeText.textContent) || 0;
    renderScorePills(localCount, aiCount, internetCount, currentScore);

  } catch (err) {
    alert('Internet search failed: ' + err.message);
  } finally {
    btnInternet.disabled = false;
    btnInternet.innerHTML = orig;
  }
}

// ── Utilities ─────────────────────────────────────────────────
function showError() {
  loadingState.classList.add('hidden');
  errorState.classList.remove('hidden');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
