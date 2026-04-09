const supabase = require('../utils/supabase');

/**
 * GET /api/documents
 * Returns all documents, optionally filtered by title query.
 */
async function listDocuments(req, res) {
  try {
    const { search, mine, approved } = req.query;
    let query = supabase
      .from('documents')
      .select('id, title, original_filename, created_at, user_id, thumbnail_url')
      .order('created_at', { ascending: false });

    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    // If mine=true and user is authenticated, filter by user
    if (mine === 'true' && req.user) {
      query = query.eq('user_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Fetch similarity scores for each document
    const docIds = (data || []).map(d => d.id);
    let scoresMap = {};
    if (docIds.length > 0) {
      const { data: results } = await supabase
        .from('plagiarism_results')
        .select('document_id, similarity_score')
        .in('document_id', docIds)
        .eq('source', 'local')
        .is('matched_paragraph', null);

      if (results) {
        for (const r of results) {
          if (!scoresMap[r.document_id] || r.similarity_score > scoresMap[r.document_id]) {
            scoresMap[r.document_id] = r.similarity_score;
          }
        }
      }
    }

    let documents = (data || []).map(d => ({
      ...d,
      similarity_score: scoresMap[d.id] || 0
    }));

    // For public client view: only show documents with < 20% similarity
    if (approved === 'true') {
      documents = documents.filter(d => d.similarity_score < 20);
    }

    return res.json({ documents });
  } catch (err) {
    console.error('List documents error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/documents/:id
 * Returns a single document with its paragraphs.
 */
async function getDocument(req, res) {
  try {
    const { id } = req.params;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, original_filename, extracted_text, created_at')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { data: paragraphs, error: paraError } = await supabase
      .from('paragraphs')
      .select('id, paragraph_text, paragraph_index')
      .eq('document_id', id)
      .order('paragraph_index', { ascending: true });

    if (paraError) console.error('Paragraph fetch error:', paraError.message);

    return res.json({ document: doc, paragraphs: paragraphs || [] });
  } catch (err) {
    console.error('Get document error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listDocuments, getDocument };
