const supabase = require('../utils/supabase');
const { splitIntoDisplayParagraphs } = require('../services/fileService');
const { computeOverallScore } = require('../utils/overallScore');

/**
 * GET /api/documents
 * Returns all documents, optionally filtered by title query.
 */
async function listDocuments(req, res) {
  try {
    const { search, mine, approved } = req.query;
    let query = supabase
      .from('documents')
      .select('id, title, original_filename, created_at, user_id, thumbnail_url, authors, course, year, abstract')
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

    // Fetch similarity scores and user names
    const docIds = (data || []).map(d => d.id);
    const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];

    let scoresMap = {};
    let usersMap = {};

    if (docIds.length > 0) {
      const [{ data: results }, { data: paraCounts }] = await Promise.all([
        supabase
          .from('plagiarism_results')
          .select('document_id, similarity_score, source, matched_paragraph')
          .in('document_id', docIds),
        supabase
          .from('paragraphs')
          .select('document_id')
          .in('document_id', docIds)
      ]);

      // Count paragraphs per document (used by the shared scoring formula)
      const paragraphCountMap = {};
      for (const p of (paraCounts || [])) {
        paragraphCountMap[p.document_id] = (paragraphCountMap[p.document_id] || 0) + 1;
      }

      // Group results per document, then apply the same formula used everywhere else
      const resultsByDoc = {};
      for (const r of (results || [])) {
        if (!resultsByDoc[r.document_id]) resultsByDoc[r.document_id] = [];
        resultsByDoc[r.document_id].push(r);
      }
      for (const docId of Object.keys(resultsByDoc)) {
        scoresMap[docId] = computeOverallScore(resultsByDoc[docId], paragraphCountMap[docId] || 0);
      }
    }

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds);

      if (users) {
        for (const u of users) {
          usersMap[u.id] = u.full_name;
        }
      }
    }

    let documents = (data || []).map(d => ({
      ...d,
      uploaded_by: usersMap[d.user_id] || 'Unknown',
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
 * Guests (no auth) get limited data — no full text, no paragraphs.
 */
async function getDocument(req, res) {
  try {
    const { id } = req.params;
    const isAuthenticated = !!req.user;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, original_filename, extracted_text, created_at, authors, course, year, abstract, user_id')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Fetch uploader name
    let uploaderName = 'Unknown';
    if (doc.user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', doc.user_id)
        .single();
      if (user) uploaderName = user.full_name;
    }

    // Fetch similarity score using the same formula the report page uses,
    // so a document doesn't show one percentage on its card and another
    // once you open its full report.
    const [{ data: simResults }, { count: paragraphCount }] = await Promise.all([
      supabase
        .from('plagiarism_results')
        .select('similarity_score, source, matched_paragraph')
        .eq('document_id', id),
      supabase
        .from('paragraphs')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', id)
    ]);

    const similarityScore = computeOverallScore(simResults || [], paragraphCount || 0);

    // Only the document OWNER or ADMIN sees full analysis
    const isAdmin = isAuthenticated && req.user.role === 'admin';
    const isOwner = isAuthenticated && req.user.id === doc.user_id;

    if (!isOwner && !isAdmin) {
      const limitedDoc = {
        id: doc.id,
        title: doc.title,
        original_filename: doc.original_filename,
        created_at: doc.created_at,
        authors: doc.authors,
        course: doc.course,
        year: doc.year,
        abstract: doc.abstract,
        uploaded_by: uploaderName,
        similarity_score: similarityScore
      };
      return res.json({
        document: limitedDoc,
        paragraphs: [],
        guest: !isAuthenticated,
        restricted: isAuthenticated   // logged in but not owner
      });
    }

    // Owner — full data
    doc.uploaded_by = uploaderName;
    doc.similarity_score = similarityScore;

    const { data: paragraphs, error: paraError } = await supabase
      .from('paragraphs')
      .select('id, paragraph_text, paragraph_index')
      .eq('document_id', id)
      .order('paragraph_index', { ascending: true });

    if (paraError) console.error('Paragraph fetch error:', paraError.message);

    return res.json({
      document: doc,
      paragraphs: paragraphs || [],
      display_paragraphs: splitIntoDisplayParagraphs(doc.extracted_text || '')
    });
  } catch (err) {
    console.error('Get document error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listDocuments, getDocument };
