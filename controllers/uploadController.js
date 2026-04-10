const { v4: uuidv4 } = require('uuid');
const path = require('path');
const supabase = require('../utils/supabase');
const { extractText, splitIntoParagraphs, deleteFile } = require('../services/fileService');
const { compareDocuments, compareParagraphs } = require('../utils/tfidf');

// ── Thresholds ────────────────────────────────────────────────
const TITLE_EXACT_BLOCK     = true;   // block exact (case-insensitive) title matches
const CONTENT_BLOCK_PCT     = 85;     // block if overall document similarity ≥ this %
const PARAGRAPH_BLOCK_PCT   = 30;     // flag paragraphs above this %
const PARAGRAPH_BLOCK_RATIO = 0.50;   // block if ≥ 50 % of paragraphs are flagged

/**
 * POST /api/upload
 * 1. Extracts text from file
 * 2. Checks for duplicate title, near-duplicate content, and similar paragraphs
 * 3. ONLY saves the document if all checks pass
 */
async function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const title = (req.body.title || '').trim();
  if (!title) {
    deleteFile(req.file.path);
    return res.status(400).json({ error: 'Document title is required' });
  }

  const authors  = (req.body.authors || '').trim();
  const course   = (req.body.course || '').trim();
  const year     = (req.body.year || '').trim();
  const abstract = (req.body.abstract || '').trim();

  const filePath = req.file.path;
  const originalFilename = req.file.originalname;

  try {
    // ── 1. Extract text ─────────────────────────────────────────
    const extractedText = await extractText(filePath, originalFilename);

    if (!extractedText || extractedText.length < 20) {
      return res.status(422).json({ error: 'Could not extract meaningful text from file' });
    }

    const paragraphs = splitIntoParagraphs(extractedText);

    // ── 2. Check for EXACT duplicate title ──────────────────────
    if (TITLE_EXACT_BLOCK) {
      const { data: titleHits } = await supabase
        .from('documents')
        .select('id, title')
        .ilike('title', title);

      if (titleHits && titleHits.length > 0) {
        return res.status(409).json({
          error: 'Upload rejected — duplicate title',
          reason: 'exact_title',
          message: `A document with the exact same title already exists: "${titleHits[0].title}"`,
          existing_document_id: titleHits[0].id
        });
      }
    }

    // ── 3. Check overall content similarity (TF-IDF) ────────────
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id, title, extracted_text');

    if (existingDocs && existingDocs.length > 0) {
      const docMatches = compareDocuments(extractedText, existingDocs);
      const topMatch   = docMatches.length > 0 ? docMatches[0] : null;

      if (topMatch && topMatch.similarity_score >= CONTENT_BLOCK_PCT) {
        return res.status(409).json({
          error: 'Upload rejected — duplicate content detected',
          reason: 'duplicate_content',
          message: `This document is ${topMatch.similarity_score}% similar to "${topMatch.title}". Documents with ≥${CONTENT_BLOCK_PCT}% match are not allowed.`,
          similarity_score: topMatch.similarity_score,
          matched_document_id: topMatch.document_id,
          matched_title: topMatch.title
        });
      }
    }

    // ── 4. Check paragraph-level similarity ──────────────────────
    const { data: existingParagraphs } = await supabase
      .from('paragraphs')
      .select('id, document_id, paragraph_text');

    let flaggedCount = 0;
    const flaggedDetails = [];

    if (existingParagraphs && existingParagraphs.length > 0 && paragraphs.length > 0) {
      for (const para of paragraphs) {
        const matches = compareParagraphs(para, existingParagraphs);
        if (matches.length > 0 && matches[0].similarity_score >= PARAGRAPH_BLOCK_PCT) {
          flaggedCount++;
          flaggedDetails.push({
            paragraph_snippet: para.slice(0, 200) + (para.length > 200 ? '…' : ''),
            similarity_score: matches[0].similarity_score,
            matched_document_id: matches[0].document_id
          });
        }
      }

      const flaggedRatio = flaggedCount / paragraphs.length;

      if (flaggedRatio >= PARAGRAPH_BLOCK_RATIO) {
        // Resolve matched document titles for the response
        const matchedIds = [...new Set(flaggedDetails.map(f => f.matched_document_id))];
        const { data: matchedDocs } = await supabase
          .from('documents')
          .select('id, title')
          .in('id', matchedIds);
        const titleMap = {};
        (matchedDocs || []).forEach(d => { titleMap[d.id] = d.title; });

        return res.status(409).json({
          error: 'Upload rejected — too many similar paragraphs',
          reason: 'similar_paragraphs',
          message: `${flaggedCount} out of ${paragraphs.length} paragraphs (${(flaggedRatio * 100).toFixed(0)}%) have ≥${PARAGRAPH_BLOCK_PCT}% similarity to existing documents. Uploads with ≥${(PARAGRAPH_BLOCK_RATIO * 100).toFixed(0)}% flagged paragraphs are blocked.`,
          flagged_count: flaggedCount,
          total_paragraphs: paragraphs.length,
          flagged_ratio: parseFloat((flaggedRatio * 100).toFixed(1)),
          flagged_paragraphs: flaggedDetails.slice(0, 10).map(f => ({
            ...f,
            matched_title: titleMap[f.matched_document_id] || 'Unknown'
          }))
        });
      }
    }

    // ── 5. All checks passed — save document ────────────────────
    const documentId = uuidv4();
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        user_id: req.user.id,
        title,
        original_filename: originalFilename,
        extracted_text: extractedText,
        authors: authors || null,
        course: course || null,
        year: year || null,
        abstract: abstract || null
      })
      .select()
      .single();

    if (docError) throw new Error(`Database insert failed: ${docError.message}`);

    // Save paragraphs
    const paragraphRows = paragraphs.map((text, index) => ({
      id: uuidv4(),
      document_id: documentId,
      paragraph_text: text,
      paragraph_index: index
    }));

    if (paragraphRows.length > 0) {
      const { error: paraError } = await supabase
        .from('paragraphs')
        .insert(paragraphRows);
      if (paraError) console.error('Paragraph insert error:', paraError.message);
    }

    return res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: documentId,
        title,
        original_filename: originalFilename,
        paragraph_count: paragraphRows.length
      },
      warnings: flaggedCount > 0
        ? `${flaggedCount} paragraph(s) have partial similarity to existing documents (below block threshold).`
        : null
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    deleteFile(filePath);
  }
}

module.exports = { uploadDocument };
