const supabase = require('../utils/supabase');
const { runLocalPlagiarismCheck, checkSimilarTitles, getResultsByDocument } = require('../services/plagiarismService');
const { analyzeWithOpenAI } = require('../services/openaiService');
const { searchInternetPlagiarism, searchTitleOnline } = require('../services/internetSearchService');
const { splitIntoDisplayParagraphs } = require('../services/fileService');
const { getSettings } = require('../utils/settings');
const {
  hashDocumentContent,
  checkDetectionQuota,
  consumeDetectionCredit,
  getCachedDetection,
  saveDetectionCacheRecord,
  markDetectionCompleted,
  markDetectionFailed
} = require('../utils/detectionCache');

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

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to run document detection.' });
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, extracted_text, user_id, content_hash, version')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.id !== doc.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the document owner can run analysis' });
    }

    const studentId = req.user.id;
    const documentHash = hashDocumentContent(doc.extracted_text || '');
    const cached = await getCachedDetection(studentId, doc.id, documentHash);

    if (cached && cached.detection_status === 'completed') {
      return res.json({
        document_id: doc.id,
        title: doc.title,
        cached_result: true,
        message: 'Using the saved result for this document version.',
        local_check: cached.result_data?.local_check || {
          overall_score: cached.similarity_score || 0,
          document_matches: [],
          paragraph_matches: [],
          all_paragraphs: [],
          display_paragraphs: splitIntoDisplayParagraphs(doc.extracted_text || '')
        },
        openai_check: cached.result_data?.openai_check || null
      });
    }

    if (cached && cached.detection_status === 'processing') {
      return res.status(202).json({
        document_id: doc.id,
        title: doc.title,
        cached_result: false,
        message: 'Detection is already in progress for this document version.',
        status: 'processing'
      });
    }

    const quota = await checkDetectionQuota(studentId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.message,
        limit_reached: true,
        remaining_count: quota.usage.remaining_count,
        used_count: quota.usage.used_count,
        maximum_allowed: quota.usage.maximum_allowed
      });
    }

    await saveDetectionCacheRecord(studentId, doc.id, documentHash, {
      detection_status: 'processing',
      result_data: null,
      api_provider: null,
      ai_score: null,
      similarity_score: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const { data: paragraphRows, error: paraError } = await supabase
      .from('paragraphs')
      .select('paragraph_text')
      .eq('document_id', document_id)
      .order('paragraph_index', { ascending: true });

    if (paraError) throw new Error(paraError.message);

    const paragraphs = (paragraphRows || []).map(p => p.paragraph_text);

    const localResult = await runLocalPlagiarismCheck(doc.id, doc.extracted_text, paragraphs);

    const response = {
      document_id: doc.id,
      title: doc.title,
      local_check: {
        overall_score: localResult.overallScore,
        document_matches: localResult.documentMatches.slice(0, 10),
        paragraph_matches: localResult.paragraphMatches.slice(0, 30),
        all_paragraphs: paragraphs,
        display_paragraphs: splitIntoDisplayParagraphs(doc.extracted_text || '')
      },
      openai_check: null,
      cached_result: false
    };

    if (use_openai) {
      const aiSettings = await getSettings();

      if (!aiSettings.ai_scanning_enabled) {
        response.openai_check = {
          error: 'AI scanning is currently disabled by the administrator.',
          disabled: true
        };
      } else if (aiSettings.max_ai_scans_per_user > 0 && req.user) {
        const { count } = await supabase
          .from('ai_scan_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', req.user.id);
        const used = count || 0;
        if (used >= aiSettings.max_ai_scans_per_user) {
          response.openai_check = {
            error: `AI scan limit reached. You have used ${used} of ${aiSettings.max_ai_scans_per_user} allowed AI scans. Contact your administrator.`,
            limit_reached: true,
            used,
            limit: aiSettings.max_ai_scans_per_user
          };
        } else {
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
            if (req.user) {
              supabase.from('ai_scan_log').insert({ user_id: req.user.id, document_id: doc.id }).then(() => {}).catch(() => {});
            }
          } catch (aiErr) {
            response.openai_check = { error: aiErr.message };
          }
        }
      }
    }

    const usage = await consumeDetectionCredit(studentId);
    await markDetectionCompleted(studentId, doc.id, documentHash, response, response.local_check.overall_score, response.local_check.overall_score, 'local');

    return res.json({
      ...response,
      usage,
      detection_limit: {
        used_count: usage.used_count,
        remaining_count: usage.remaining_count,
        maximum_allowed: usage.maximum_allowed
      }
    });

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
