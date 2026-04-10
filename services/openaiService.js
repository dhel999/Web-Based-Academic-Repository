const OpenAI = require('openai');
const supabase = require('../utils/supabase');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeRisk(risk) {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
}

function inferRiskFromPercentage(percent) {
  if (percent >= 70) return 'high';
  if (percent >= 40) return 'medium';
  return 'low';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeHeuristicSignals(paragraphs) {
  const text = (paragraphs || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    return {
      aiLikelihood: 0,
      summary: 'No text available for heuristic AI signal analysis.',
      topIndices: []
    };
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  const uniqueWords = new Set(words);
  const lexicalDiversity = words.length ? uniqueWords.size / words.length : 0;

  const sentenceWordCounts = sentences.map(s => (s.match(/[a-z']+/gi) || []).length).filter(n => n > 0);
  const avgSentence = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
    : 0;
  const variance = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((sum, n) => sum + Math.pow(n - avgSentence, 2), 0) / sentenceWordCounts.length
    : 0;
  const stdevSentence = Math.sqrt(variance);

  const connectors = [
    'moreover', 'furthermore', 'in addition', 'therefore', 'thus', 'in conclusion',
    'additionally', 'consequently', 'notably', 'significantly', 'overall', 'however'
  ];
  const connectorHits = connectors.reduce((acc, phrase) => {
    const re = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi');
    const m = text.match(re);
    return acc + (m ? m.length : 0);
  }, 0);

  const templatedPhrases = [
    'this study aims to',
    'based on observations',
    'in many academic institutions',
    'digital transformation',
    'maintaining quality education',
    'preventing intellectual dishonesty'
  ];
  const templatedHits = templatedPhrases.reduce((acc, phrase) => {
    const re = new RegExp(phrase.replace(/ /g, '\\s+'), 'gi');
    const m = text.match(re);
    return acc + (m ? m.length : 0);
  }, 0);

  const starters = sentences
    .map(s => s.trim().toLowerCase().split(/\s+/).slice(0, 2).join(' '))
    .filter(Boolean);
  const freq = new Map();
  for (const st of starters) freq.set(st, (freq.get(st) || 0) + 1);
  const maxStarterFreq = starters.length ? Math.max(...freq.values()) : 0;
  const repeatedStarterRatio = starters.length ? maxStarterFreq / starters.length : 0;

  let score = 0;
  if (avgSentence >= 16 && avgSentence <= 36) score += 15;
  if (stdevSentence > 0 && stdevSentence < 9) score += 15;
  if (lexicalDiversity >= 0.30 && lexicalDiversity <= 0.58) score += 12;
  if (connectorHits >= 4) score += 20;
  if (templatedHits >= 2) score += 20;
  if (repeatedStarterRatio >= 0.22) score += 18;

  const paraScores = (paragraphs || []).map((p, i) => {
    const t = String(p || '').toLowerCase();
    let s = 0;
    if ((t.match(/\b(moreover|furthermore|additionally|therefore|thus|overall)\b/g) || []).length >= 1) s += 20;
    if ((t.match(/\b(this study|this system|this research)\b/g) || []).length >= 1) s += 20;
    const wc = (t.match(/[a-z']+/g) || []).length;
    if (wc >= 60) s += 20;
    if (wc >= 100) s += 10;
    if ((t.match(/\b(quality education|digital transformation|academic integrity|intellectual dishonesty)\b/g) || []).length >= 1) s += 20;
    return { index: i, score: clamp(s, 0, 100) };
  }).sort((a, b) => b.score - a.score);

  return {
    aiLikelihood: clamp(score, 0, 95),
    summary: `Heuristic AI-style signals: avg sentence=${avgSentence.toFixed(1)} words, connector hits=${connectorHits}, repeated starters=${(repeatedStarterRatio * 100).toFixed(0)}%.`,
    topIndices: paraScores.filter(p => p.score >= 40).slice(0, 5).map(p => p.index)
  };
}

/**
 * Analyze paragraphs for plagiarism using OpenAI GPT.
 *
 * @param {string} documentId - UUID of the document being checked
 * @param {string[]} paragraphs - array of paragraph strings
 * @returns {Promise<{plagiarismPercentage: number, explanation: string, suggestions: string, flaggedParagraphs: Array}>}
 */
async function analyzeWithOpenAI(documentId, paragraphs) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  // Keep original indices so AI flags can be mapped back to full document paragraphs
  const paragraphEntries = (paragraphs || []).map((p, index) => ({
    text: String(p || '').trim(),
    index
  }));

  // Filter to likely prose paragraphs (less strict to avoid dropping valid student text)
  const substantialParagraphs = paragraphEntries.filter(entry => {
    const text = entry.text;
    if (!text) return false;
    const words = text.split(/\s+/).length;
    if (words < 8) return false;
    if (text.length < 40) return false;
    if (!/[a-z]/i.test(text)) return false;
    return true;
  });

  // Fallback: if extraction produced short chunks, still analyze available text
  const sourceParagraphs = substantialParagraphs.length > 0
    ? substantialParagraphs
    : paragraphEntries.filter(entry => entry.text.length > 20);

  // Spread-sample paragraphs (not just first N) to improve detection across long files
  const maxSamples = 20;
  const sampleParagraphs = [];
  if (sourceParagraphs.length <= maxSamples) {
    sampleParagraphs.push(...sourceParagraphs);
  } else {
    const step = sourceParagraphs.length / maxSamples;
    for (let i = 0; i < maxSamples; i++) {
      sampleParagraphs.push(sourceParagraphs[Math.floor(i * step)]);
    }
  }

  if (sampleParagraphs.length === 0) {
    return {
      plagiarismPercentage: 0,
      riskLevel: 'low',
      explanation: 'No substantial paragraph content was available for AI analysis.',
      suggestions: 'Upload a document with readable paragraph text to run AI analysis.',
      flaggedParagraphs: []
    };
  }

  const combinedText = sampleParagraphs
    .map((entry, i) => `[Paragraph ${i + 1}]: ${entry.text}`)
    .join('\n\n');

  const systemPrompt = `You are an expert academic plagiarism detection assistant. 
Analyze the provided academic text paragraphs for:
1. Direct plagiarism (copy-pasted content)
2. Paraphrased plagiarism (same ideas with different wording)
3. Mosaic plagiarism (mixing original and copied text)
4. Likely AI-generated writing patterns (LLM-style structure, repetitive transitions, generic high-probability phrasing)

Important guidance:
- Be sensitive to AI-generated or AI-assisted text even when external sources are unavailable.
- If many paragraphs are likely AI-generated, raise plagiarism_percentage and risk_level accordingly.
- paragraph_index must reference the numbered paragraph in the input list.

Respond ONLY with a valid JSON object (no markdown, no explanation outside JSON) with this structure:
{
  "plagiarism_percentage": <number 0-100>,
  "risk_level": "<low|medium|high>",
  "explanation": "<detailed explanation of findings>",
  "suggestions": "<specific suggestions to improve originality>",
  "flagged_paragraphs": [
    {
      "paragraph_index": <number>,
      "risk": "<low|medium|high>",
      "reason": "<why this paragraph is flagged>"
    }
  ]
}`;

  const userPrompt = `Analyze the following academic document paragraphs for plagiarism:\n\n${combinedText}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1500
  });

  const rawContent = response.choices[0].message.content.trim();

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Attempt to extract JSON block if GPT wrapped it in markdown
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('OpenAI returned non-JSON response');
    }
  }

  const modelPlagiarismPercentage = Number(parsed.plagiarism_percentage || parsed.plagiarismPercentage || 0) || 0;
  const modelAiProbability = Number(parsed.ai_generated_probability || parsed.aiGeneratedProbability || 0) || 0;
  const heuristic = computeHeuristicSignals(paragraphs || []);
  const blendedAiProbability = clamp(
    Math.max(modelAiProbability, heuristic.aiLikelihood, modelPlagiarismPercentage),
    0,
    100
  );

  const plagiarismPercentage = blendedAiProbability;
  const rawRiskLevel = parsed.risk_level || parsed.riskLevel || inferRiskFromPercentage(plagiarismPercentage);
  const rawFlags = Array.isArray(parsed.flagged_paragraphs)
    ? parsed.flagged_paragraphs
    : (Array.isArray(parsed.flaggedParagraphs) ? parsed.flaggedParagraphs : []);

  // Normalize indexes to 0-based for frontend consistency
  const hasZeroIndex = rawFlags.some(fp => Number(fp?.paragraph_index) === 0);
  const normalizedFlags = rawFlags
    .map(fp => {
      let idx = Number(fp?.paragraph_index);
      if (!Number.isFinite(idx)) return null;
      if (!hasZeroIndex && idx > 0) idx -= 1;
      if (idx < 0 || idx >= sampleParagraphs.length) return null;
      const mapped = sampleParagraphs[idx];
      if (!mapped) return null;
      return {
        paragraph_index: mapped.index,
        risk: normalizeRisk(fp?.risk),
        reason: String(fp?.reason || 'Potential AI-assisted or plagiarized writing pattern')
      };
    })
    .filter(Boolean);

  const riskLevel = normalizeRisk(rawRiskLevel);
  const result = {
    plagiarismPercentage: Math.max(0, Math.min(100, plagiarismPercentage)),
    riskLevel,
    explanation: [parsed.explanation || '', heuristic.summary].filter(Boolean).join(' '),
    suggestions: parsed.suggestions || 'Revise heavily templated phrasing, add personal analysis, cite sources, and rewrite sections in your own voice.',
    flaggedParagraphs: normalizedFlags
  };

  // Fallback if model returns medium/high risk but no paragraph list
  if (result.flaggedParagraphs.length === 0 && (result.riskLevel === 'medium' || result.riskLevel === 'high')) {
    const fallbackCount = result.riskLevel === 'high' ? 3 : 1;
    const fallbackIndices = heuristic.topIndices.length > 0
      ? heuristic.topIndices.slice(0, fallbackCount)
      : sampleParagraphs.slice(0, fallbackCount).map(entry => entry.index);

    result.flaggedParagraphs = fallbackIndices.map(idx => ({
      paragraph_index: idx,
      risk: result.riskLevel,
      reason: 'Overall text pattern indicates probable AI-generated or non-original writing.'
    }));
  }

  // Map flagged indices back to actual paragraph text
  // Save top flagged paragraphs to plagiarism_results
  const insertRows = result.flaggedParagraphs
    .filter(fp => fp.risk === 'high' || fp.risk === 'medium')
    .filter(fp => {
      const para = paragraphEntries[fp.paragraph_index]?.text;
      // Double-check: only save flags for substantial paragraphs
      return para && para.split(/\s+/).length >= 20;
    })
    .map(fp => ({
      document_id: documentId,
      matched_document_id: null,
      similarity_score: fp.risk === 'high' ? 80 : 50,
      matched_paragraph: paragraphEntries[fp.paragraph_index]?.text || null,
      source: 'openai'
    }));

  if (insertRows.length > 0) {
    const { error } = await supabase
      .from('plagiarism_results')
      .insert(insertRows);
    if (error) console.error('Failed to save OpenAI results:', error.message);
  }

  return result;
}

/**
 * Generate semantic embeddings for a text using OpenAI embeddings API.
 * Used for semantic similarity search (bonus feature).
 *
 * @param {string} text
 * @returns {Promise<number[]>} embedding vector
 */
async function generateEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000) // truncate to stay within context window
  });

  return response.data[0].embedding;
}

/**
 * Compute dot-product cosine similarity between two embedding vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function embeddingSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = { analyzeWithOpenAI, generateEmbedding, embeddingSimilarity };
