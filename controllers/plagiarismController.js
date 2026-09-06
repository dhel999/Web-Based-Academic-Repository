/**
 * ================================================================
 * PLAGIARISM DETECTION CONTROLLER
 * ================================================================
 * 
 * ENHANCED SIMILARITY DETECTION WITH INTELLIGENT CACHING
 * 
 * This controller implements a smart detection system that:
 * 1. Only runs similarity detection ONCE per document version
 * 2. Saves all results to database (detection_cache + plagiarism_results)
 * 3. Returns cached results on subsequent requests (no credit consumed)
 * 4. Tracks student detection quota usage
 * 
 * HOW IT WORKS:
 * - When a document is analyzed, its content is hashed (SHA-256)
 * - The hash is used to check if this exact version was analyzed before
 * - If cached result exists: return it immediately (no credit used)
 * - If no cache: run detection, save results, consume 1 credit
 * - Results saved to: document_detection_cache (full analysis) + plagiarism_results (matches)
 * 
 * BENEFITS:
 * - Saves API/compute costs by avoiding repeated analysis
 * - Students can view their reports unlimited times without penalty
 * - Quota system prevents abuse while allowing legitimate re-checks
 * - Fast response times for cached results
 * 
 * ================================================================
 */

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
    const { document_id, use_openai = true, use_internet = true } = req.body;

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

    // Return cached results if detection already completed
    if (cached && cached.detection_status === 'completed') {
      console.log(`Returning cached detection result for document ${doc.id}`);
      
      // Get usage stats without consuming credit
      const usage = await getStudentDetectionUsage(studentId);
      
      return res.json({
        document_id: doc.id,
        title: doc.title,
        cached_result: true,
        message: 'Using the saved result for this document version. No additional detection credit consumed.',
        local_check: cached.result_data?.local_check || {
          overall_score: cached.similarity_score || 0,
          document_matches: [],
          paragraph_matches: [],
          all_paragraphs: [],
          display_paragraphs: splitIntoDisplayParagraphs(doc.extracted_text || '')
        },
        openai_check: cached.result_data?.openai_check || null,
        internet_check: cached.result_data?.internet_check || null,
        detection_limit: {
          used_count: usage.used_count,
          remaining_count: usage.remaining_count,
          maximum_allowed: usage.maximum_allowed
        },
        cached_at: cached.detected_at
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

    console.log(`Running new similarity detection for document ${doc.id}`);

    // Decide up front whether the AI call should actually run, so it can
    // start at the same time as the local TF-IDF check instead of waiting
    // for it to finish first — the AI request (a real network call to
    // OpenAI) is the single slowest step, and it doesn't depend on the
    // local check's results, so there's no reason to run them one after
    // the other.
    let aiSettings = null;
    let aiGate = null; // set to a { error, ... } object when AI should NOT actually be called
    if (use_openai) {
      aiSettings = await getSettings();
      if (!aiSettings.ai_scanning_enabled) {
        aiGate = { error: 'AI scanning is currently disabled by the administrator.', disabled: true };
      } else if (aiSettings.max_ai_scans_per_user > 0 && req.user) {
        const { count } = await supabase
          .from('ai_scan_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', req.user.id);
        const used = count || 0;
        if (used >= aiSettings.max_ai_scans_per_user) {
          aiGate = {
            error: `AI scan limit reached. You have used ${used} of ${aiSettings.max_ai_scans_per_user} allowed AI scans. Contact your administrator.`,
            limit_reached: true,
            used,
            limit: aiSettings.max_ai_scans_per_user
          };
        }
      }
    }

    const [localResult, aiOutcome] = await Promise.all([
      runLocalPlagiarismCheck(doc.id, doc.extracted_text, paragraphs),
      (use_openai && !aiGate)
        ? analyzeWithOpenAI(doc.id, paragraphs).then(
            aiResult => ({ aiResult }),
            aiErr => ({ aiErr })
          )
        : Promise.resolve(null)
    ]);

    // Save plagiarism results to database for each match — batched into a
    // single insert instead of one HTTP round-trip per match (previously up
    // to ~35 parallel requests for a document with many matches).
    const resultRows = [];
    if (localResult.documentMatches && localResult.documentMatches.length > 0) {
      for (const match of localResult.documentMatches.slice(0, 15)) {
        if (match.similarity_score > 5) {
          resultRows.push({
            document_id: doc.id,
            matched_document_id: match.document_id,
            similarity_score: match.similarity_score,
            matched_paragraph: null,
            source: 'local'
          });
        }
      }
    }

    // Save paragraph-level matches
    if (localResult.paragraphMatches && localResult.paragraphMatches.length > 0) {
      for (const pmatch of localResult.paragraphMatches.slice(0, 20)) {
        if (pmatch.matched_score > 10) {
          resultRows.push({
            document_id: doc.id,
            matched_document_id: pmatch.matched_doc_id || null,
            similarity_score: pmatch.matched_score,
            matched_paragraph: pmatch.matched_text?.substring(0, 500) || null,
            source: 'local'
          });
        }
      }
    }

    if (resultRows.length > 0) {
      const { error: insertErr } = await supabase.from('plagiarism_results').insert(resultRows);
      if (insertErr) console.error('Failed to save plagiarism results:', insertErr.message);
      else console.log(`Saved ${resultRows.length} plagiarism result records`);
    }

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
      internet_check: null,
      cached_result: false
    };

    if (use_openai) {
      if (aiGate) {
        // Quota/settings blocked the call before it started — nothing to await here.
        response.openai_check = aiGate;
      } else if (aiOutcome?.aiErr) {
        response.openai_check = { error: aiOutcome.aiErr.message };
      } else if (aiOutcome?.aiResult) {
        const aiResult = aiOutcome.aiResult;
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
      }
    }

    // Consume detection credit and mark as completed with local + AI results.
    // Internet search runs AFTER the response is sent (see below) — it's the
    // slowest single step (live web requests, one per paragraph, with a
    // throttling delay between each) and was previously making every upload
    // wait several extra seconds. Similarity and AI results are already
    // saved and shown immediately; internet matches appear a few seconds
    // later once the report page is opened/refreshed.
    const usage = await consumeDetectionCredit(studentId);
    const apiProviderParts = ['local'];
    if (use_openai && response.openai_check && !response.openai_check.error) apiProviderParts.push('openai');
    await markDetectionCompleted(
      studentId,
      doc.id,
      documentHash,
      response,
      response.openai_check?.ai_score || null,
      response.local_check.overall_score,
      apiProviderParts.join('+')
    );

    console.log(`Detection completed for document ${doc.id}. Credit consumed: ${usage.used_count}/${usage.maximum_allowed}`);

    res.json({
      ...response,
      usage,
      detection_limit: {
        used_count: usage.used_count,
        remaining_count: usage.remaining_count,
        maximum_allowed: usage.maximum_allowed
      },
      internet_check: use_internet ? { pending: true } : null,
      message: use_internet
        ? 'Similarity and AI detection completed. Internet search is running in the background and will appear shortly.'
        : 'Similarity detection completed successfully. Results saved to database.'
    });

    // ── Internet search runs after the response has already been sent ──
    if (use_internet) {
      console.log(`Starting background internet search for document ${doc.id} (${paragraphs.length} paragraphs)`);
      searchInternetPlagiarism(paragraphs, 12)
        .then(async (internetMatches) => {
          console.log(`Background internet search finished for document ${doc.id}: ${internetMatches.length} match(es) found`);
          if (internetMatches.length > 0) {
            const internetRows = internetMatches.map(match => ({
              document_id: doc.id,
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
            }));
            const { error: internetInsertErr } = await supabase.from('plagiarism_results').insert(internetRows);
            if (internetInsertErr) console.error('Failed to save internet results:', internetInsertErr.message);
            else console.log(`Saved ${internetRows.length} internet plagiarism result records for document ${doc.id} (background)`);
          }

          // Patch the cached result_data so a later cache hit includes internet results too.
          const internetCheck = {
            matches: internetMatches,
            total_checked: Math.min(paragraphs.length, 12),
            total_found: internetMatches.length
          };
          await markDetectionCompleted(
            studentId,
            doc.id,
            documentHash,
            { ...response, internet_check: internetCheck },
            response.openai_check?.ai_score || null,
            response.local_check.overall_score,
            [...apiProviderParts, 'internet'].join('+')
          );
        })
        .catch(netErr => {
          console.error(`Background internet check failed for document ${doc.id}:`, netErr.message);
        });
    }

    return;

  } catch (err) {
    console.error('Plagiarism check error:', err);
    
    // Mark detection as failed if it was started
    try {
      if (req.user && req.body.document_id) {
        const { data: doc } = await supabase
          .from('documents')
          .select('id, extracted_text')
          .eq('id', req.body.document_id)
          .single();
        
        if (doc) {
          const documentHash = hashDocumentContent(doc.extracted_text || '');
          await markDetectionFailed(req.user.id, doc.id, documentHash);
        }
      }
    } catch (markErr) {
      console.error('Error marking detection as failed:', markErr);
    }
    
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
      .select('user_id, extracted_text')
      .eq('id', document_id)
      .single();

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const isOwner = req.user && (req.user.id === doc.user_id || req.user.role === 'admin');
    if (!isOwner) {
      return res.json({ results: [] });
    }

    const results = await getResultsByDocument(document_id);
    
    // Also fetch cached AI summary data if it exists
    let aiSummary = null;
    if (req.user) {
      const documentHash = hashDocumentContent(doc.extracted_text || '');
      const { data: cached } = await supabase
        .from('document_detection_cache')
        .select('result_data')
        .eq('student_id', req.user.id)
        .eq('document_id', document_id)
        .eq('document_hash', documentHash)
        .eq('detection_status', 'completed')
        .maybeSingle();
      
      if (cached && cached.result_data && cached.result_data.openai_check) {
        aiSummary = cached.result_data.openai_check;
      }
    }
    
    return res.json({ results, ai_summary: aiSummary });
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

    // Save internet results to plagiarism_results in one batched insert
    // instead of one sequential round-trip per match.
    if (internetMatches.length > 0) {
      const internetRows = internetMatches.map(match => ({
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
      }));
      const { error: insertErr } = await supabase.from('plagiarism_results').insert(internetRows);
      if (insertErr) console.error('Failed to save internet results:', insertErr.message);
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
