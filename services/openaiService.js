const OpenAI = require('openai');
const supabase = require('../utils/supabase');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  // Filter to only substantial paragraphs (real prose, not headers/short lines)
  const substantialParagraphs = paragraphs.filter(p => {
    const words = p.split(/\s+/).length;
    if (words < 20) return false;          // skip short lines
    if (p.length < 100) return false;       // skip very short text
    if (!/[a-z]/.test(p)) return false;     // skip ALL CAPS headers
    if (/^\d+\.\s/.test(p) && words < 30) return false; // skip numbered list items
    return true;
  });

  // Limit to first 12 substantial paragraphs to stay within token budget
  const sampleParagraphs = substantialParagraphs.slice(0, 12);
  const combinedText = sampleParagraphs
    .map((p, i) => `[Paragraph ${i + 1}]: ${p}`)
    .join('\n\n');

  const systemPrompt = `You are an expert academic plagiarism detection assistant. 
Analyze the provided academic text paragraphs for:
1. Direct plagiarism (copy-pasted content)
2. Paraphrased plagiarism (same ideas with different wording)
3. Mosaic plagiarism (mixing original and copied text)

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

  const result = {
    plagiarismPercentage: parsed.plagiarism_percentage || 0,
    riskLevel: parsed.risk_level || 'low',
    explanation: parsed.explanation || '',
    suggestions: parsed.suggestions || '',
    flaggedParagraphs: parsed.flagged_paragraphs || []
  };

  // Map flagged indices back to actual paragraph text
  // Save top flagged paragraphs to plagiarism_results
  const insertRows = result.flaggedParagraphs
    .filter(fp => fp.risk === 'high' || fp.risk === 'medium')
    .filter(fp => {
      const para = sampleParagraphs[fp.paragraph_index - 1];
      // Double-check: only save flags for substantial paragraphs
      return para && para.split(/\s+/).length >= 20;
    })
    .map(fp => ({
      document_id: documentId,
      matched_document_id: null,
      similarity_score: fp.risk === 'high' ? 80 : 50,
      matched_paragraph: sampleParagraphs[fp.paragraph_index - 1] || null,
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
