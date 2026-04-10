const supabase = require('../utils/supabase');
const { extractText, splitIntoParagraphs, deleteFile } = require('../services/fileService');
const { compareDocuments, compareParagraphs } = require('../utils/tfidf');
const { analyzeWithOpenAI } = require('../services/openaiService');
const { searchInternetPlagiarism } = require('../services/internetSearchService');

function normalizeAiResult(aiResult, paragraphs) {
  if (!aiResult || aiResult.error) return aiResult;
  if (aiResult.flaggedParagraphs) {
    aiResult.flaggedParagraphs = aiResult.flaggedParagraphs.map(fp => ({
      ...fp,
      text: paragraphs[fp.paragraph_index] || '',
      score: fp.risk === 'high' ? 80 : fp.risk === 'medium' ? 50 : 20
    }));
  }
  return aiResult;
}

/**
 * POST /api/quick-scan
 * Temporarily uploads a file, runs all plagiarism checks, returns results, deletes file.
 * Does NOT save to the database.
 */
async function quickScan(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalFilename = req.file.originalname;
  try {
    // 1. Extract text
    const extractedText = await extractText(filePath, originalFilename);
    if (!extractedText || extractedText.length < 20) {
      deleteFile(filePath);
      return res.status(422).json({ error: 'Could not extract meaningful text from file' });
    }

    const paragraphs = splitIntoParagraphs(extractedText);

    // 2. Local TF-IDF check against all existing documents
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id, title, extracted_text');

    let documentMatches = [];
    let paragraphMatches = [];
    let overallScore = 0;

    if (existingDocs && existingDocs.length > 0) {
      const rawDocMatches = compareDocuments(extractedText, existingDocs);

      // Deduplicate by title
      const seenTitles = new Map();
      for (const m of rawDocMatches) {
        const key = m.title.trim().toLowerCase();
        if (!seenTitles.has(key) || m.similarity_score > seenTitles.get(key).similarity_score) {
          seenTitles.set(key, m);
        }
      }
      documentMatches = [...seenTitles.values()]
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 15);

      // Paragraph-level check against top matching docs
      const topDocIds = documentMatches
        .filter(m => m.similarity_score > 3)
        .slice(0, 15)
        .map(m => m.document_id);

      if (topDocIds.length > 0) {
        const { data: existingParas } = await supabase
          .from('paragraphs')
          .select('id, document_id, paragraph_text')
          .in('document_id', topDocIds);

        if (existingParas && existingParas.length > 0) {
          for (let idx = 0; idx < paragraphs.length; idx++) {
            const para = paragraphs[idx];
            const matches = compareParagraphs(para, existingParas);
            if (matches.length > 0 && matches[0].similarity_score > 10) {
              let matchedTitle = 'Unknown';
              const matchedDoc = existingDocs.find(d => d.id === matches[0].document_id);
              if (matchedDoc) matchedTitle = matchedDoc.title;

              paragraphMatches.push({
                paragraph_index: idx,
                paragraph_text: para,
                matched_score: matches[0].similarity_score,
                matched_text: matches[0].paragraph_text,
                matched_title: matchedTitle
              });
            }
          }
        }
      }

      // Calculate overall score
      if (paragraphMatches.length > 0 && paragraphs.length > 0) {
        const totalParaScore = paragraphMatches.reduce((sum, pm) => sum + pm.matched_score, 0);
        overallScore = parseFloat(Math.min(totalParaScore / paragraphs.length, 100).toFixed(2));
      } else if (documentMatches.length > 0) {
        const topDocs = documentMatches.slice(0, 3);
        const docScore = topDocs.reduce((s, m) => s + m.similarity_score, 0) / topDocs.length;
        overallScore = parseFloat(Math.min(docScore * 0.3, 30).toFixed(2));
      }
    }

    // Clean up — delete temp file
    deleteFile(filePath);

    // Build response
    return res.json({
      filename: originalFilename,
      total_paragraphs: paragraphs.length,
      overall_score: overallScore,
      local_check: {
        document_matches: documentMatches.filter(m => m.similarity_score > 3),
        paragraph_matches: paragraphMatches.slice(0, 30),
        flagged_paragraphs: paragraphMatches.length,
        total_paragraphs: paragraphs.length,
        all_paragraphs: paragraphs
      },
      ai_check: null,
      internet_check: {
        matches: [],
        total_found: 0
      }
    });

  } catch (err) {
    deleteFile(filePath);
    console.error('Quick scan error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function quickScanAI(req, res) {
  try {
    const paragraphs = Array.isArray(req.body?.paragraphs) ? req.body.paragraphs : [];
    if (paragraphs.length === 0) {
      return res.status(400).json({ error: 'paragraphs are required' });
    }

    const aiResult = await analyzeWithOpenAI('quick-scan', paragraphs);
    return res.json({ ai_check: normalizeAiResult(aiResult, paragraphs) });
  } catch (err) {
    console.error('Quick scan AI error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function quickScanInternet(req, res) {
  try {
    const paragraphs = Array.isArray(req.body?.paragraphs) ? req.body.paragraphs : [];
    if (paragraphs.length === 0) {
      return res.status(400).json({ error: 'paragraphs are required' });
    }

    const matches = await searchInternetPlagiarism(paragraphs, 4);
    return res.json({
      internet_check: {
        matches,
        total_found: matches.length
      }
    });
  } catch (err) {
    console.error('Quick scan internet error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { quickScan, quickScanAI, quickScanInternet };
