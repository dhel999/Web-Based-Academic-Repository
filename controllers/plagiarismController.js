const supabase = require('../utils/supabase');
const { runLocalPlagiarismCheck, checkSimilarTitles, getResultsByDocument } = require('../services/plagiarismService');
const { analyzeWithOpenAI } = require('../services/openaiService');
const { searchInternetPlagiarism, searchTitleOnline } = require('../services/internetSearchService');
const { splitIntoDisplayParagraphs } = require('../services/fileService');

/**
 * POST /api/check-plagiarism
 * Body: { document_id, use_openai: boolean }
 * Runs TF-IDF local check and optionally OpenAI semantic check.
 */
async function checkPlagiarism(req, res) {
  try {
    const { document_id, use_openai = false } = req.body;

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Fetch the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, extracted_text, user_id')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only the document owner or admin can run analysis
    if (!req.user || (req.user.id !== doc.user_id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Only the document owner can run analysis' });
    }

    // Fetch paragraphs of this document
    const { data: paragraphRows, error: paraError } = await supabase
      .from('paragraphs')
      .select('paragraph_text')
      .eq('document_id', document_id)
      .order('paragraph_index', { ascending: true });

    if (paraError) throw new Error(paraError.message);

    const paragraphs = (paragraphRows || []).map(p => p.paragraph_text);

    // --- Local TF-IDF check ---
    const localResult = await runLocalPlagiarismCheck(doc.id, doc.extracted_text, paragraphs);

    const response = {
      document_id: doc.id,
      title: doc.title,
      local_check: {
        overall_score: localResult.overallScore,
        document_matches: localResult.documentMatches.slice(0, 10),
        paragraph_matches: localResult.paragraphMatches.slice(0, 30),
        all_paragraphs: paragraphs,  // analysis paragraphs
        display_paragraphs: splitIntoDisplayParagraphs(doc.extracted_text || '')
      },
      openai_check: null
    };

    // --- OpenAI semantic check (optional) ---
    if (use_openai) {
      try {
        const aiResult = await analyzeWithOpenAI(doc.id, paragraphs);
        if (aiResult.flaggedParagraphs) {
          aiResult.flaggedParagraphs = aiResult.flaggedParagraphs.map(fp => ({
            ...fp,
            text: paragraphs[fp.paragraph_index] || '',
            score: fp.confidence || (fp.risk === 'high' ? 82 : fp.risk === 'medium' ? 58 : 28)
          }));
        }
        response.openai_check = aiResult;
      } catch (aiErr) {
        response.openai_check = { error: aiErr.message };
      }
    }

    return res.json(response);

  } catch (err) {
    console.error('Plagiarism check error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/check-title
 * Body: { title }
 * Returns documents with similar titles.
 */
async function checkTitle(req, res) {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Local DB search
    const matches = await checkSimilarTitles(title);

    // Internet search for similar titles
    let internetResults = [];
    try {
      internetResults = await searchTitleOnline(title.trim());
    } catch (err) {
      console.error('Internet title search error:', err.message);
    }

    return res.json({ similar_titles: matches, internet_results: internetResults });

  } catch (err) {
    console.error('Title check error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/results/:document_id
 * Returns all plagiarism results for a document.
 */
async function getResults(req, res) {
  try {
    const { document_id } = req.params;

    // Check ownership — only the document owner can see results
    const { data: doc } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', document_id)
      .single();

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const isOwner = req.user && (req.user.id === doc.user_id || req.user.role === 'admin');
    if (!isOwner) {
      return res.json({ results: [] });
    }

    const results = await getResultsByDocument(document_id);
    return res.json({ results });
  } catch (err) {
    console.error('Get results error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/check-internet
 * Body: { document_id }
 * Searches the internet for similar content to the document's paragraphs.
 */
async function checkInternet(req, res) {
  try {
    const { document_id } = req.body;
    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Check ownership
    const { data: doc } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', document_id)
      .single();

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!req.user || (req.user.id !== doc.user_id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Only the document owner can run analysis' });
    }

    // Fetch paragraphs
    const { data: paragraphRows, error: paraError } = await supabase
      .from('paragraphs')
      .select('paragraph_text')
      .eq('document_id', document_id)
      .order('paragraph_index', { ascending: true });

    if (paraError) throw new Error(paraError.message);
    const paragraphs = (paragraphRows || []).map(p => p.paragraph_text);

    if (paragraphs.length === 0) {
      return res.json({ internet_matches: [], message: 'No paragraphs to check' });
    }

    const internetMatches = await searchInternetPlagiarism(paragraphs, 12);

    // Save internet results to plagiarism_results
    for (const match of internetMatches) {
      await supabase.from('plagiarism_results').insert({
        document_id: document_id,
        matched_document_id: null,
        similarity_score: match.similarity_score,
        matched_paragraph: JSON.stringify({
          new_paragraph: match.paragraph_text,
          matched_text: match.matched_snippet,
          source_url: match.source_url,
          source_domain: match.source_domain,
          all_sources: match.all_sources
        }),
        source: 'internet'
      });
    }

    return res.json({
      internet_matches: internetMatches,
      total_checked: Math.min(paragraphs.length, 8),
      total_found: internetMatches.length
    });
  } catch (err) {
    console.error('Internet check error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { checkPlagiarism, checkTitle, getResults, checkInternet };
