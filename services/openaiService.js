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

  // Filter to likely prose paragraphs (less strict to avoid dropping valid student text)
  const substantialParagraphs = (paragraphs || []).filter(p => {
    const text = String(p || '').trim();
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
    : (paragraphs || []).map(p => String(p || '').trim()).filter(p => p.length > 20);

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
    .map((p, i) => `[Paragraph ${i + 1}]: ${p}`)
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

  const plagiarismPercentage = Number(parsed.plagiarism_percentage || parsed.plagiarismPercentage || 0) || 0;
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
      return {
        paragraph_index: idx,
        risk: normalizeRisk(fp?.risk),
        reason: String(fp?.reason || 'Potential AI-assisted or plagiarized writing pattern')
      };
    })
    .filter(Boolean);

  const riskLevel = normalizeRisk(rawRiskLevel);
  const result = {
    plagiarismPercentage: Math.max(0, Math.min(100, plagiarismPercentage)),
    riskLevel,
    explanation: parsed.explanation || '',
    suggestions: parsed.suggestions || '',
    flaggedParagraphs: normalizedFlags
  };

  // Fallback if model returns medium/high risk but no paragraph list
  if (result.flaggedParagraphs.length === 0 && (result.riskLevel === 'medium' || result.riskLevel === 'high')) {
    const fallbackCount = result.riskLevel === 'high' ? 3 : 1;
    result.flaggedParagraphs = sampleParagraphs.slice(0, fallbackCount).map((_, i) => ({
      paragraph_index: i,
      risk: result.riskLevel,
      reason: 'Overall text pattern indicates probable AI-generated or non-original writing.'
    }));
  }

  // Map flagged indices back to actual paragraph text
  // Save top flagged paragraphs to plagiarism_results
  const insertRows = result.flaggedParagraphs
    .filter(fp => fp.risk === 'high' || fp.risk === 'medium')
    .filter(fp => {
      const para = sampleParagraphs[fp.paragraph_index];
      // Double-check: only save flags for substantial paragraphs
      return para && para.split(/\s+/).length >= 20;
    })
    .map(fp => ({
      document_id: documentId,
      matched_document_id: null,
      similarity_score: fp.risk === 'high' ? 80 : 50,
      matched_paragraph: sampleParagraphs[fp.paragraph_index] || null,
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
