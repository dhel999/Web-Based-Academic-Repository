const supabase = require('../utils/supabase');

/**
 * GET /api/admin/documents — list all documents with uploader info
 */
async function listAllDocuments(req, res) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, original_filename, thumbnail_url, created_at, user_id')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch plagiarism scores for each document
    const docIds = (data || []).map(d => d.id);
    let scoresMap = {};
    if (docIds.length > 0) {
      const { data: results } = await supabase
        .from('plagiarism_results')
        .select('document_id, similarity_score, source')
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

    // Fetch unique user IDs and their names
    const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);
      if (users) {
        for (const u of users) {
          usersMap[u.id] = u;
        }
      }
    }

    const documents = (data || []).map(d => ({
      ...d,
      similarity_score: scoresMap[d.id] || 0,
      uploader: usersMap[d.user_id] || null
    }));

    res.json({ documents });
  } catch (err) {
    console.error('Admin list documents error:', err.message);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

/**
 * DELETE /api/admin/documents/:id — delete a document and all related data
 */
async function deleteDocument(req, res) {
  const { id } = req.params;
  try {
    // Delete cascades to paragraphs + plagiarism_results via FK
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Delete document error:', err.message);
    res.status(500).json({ error: 'Failed to delete document' });
  }
}

/**
 * GET /api/admin/users — list all users
 */
async function listUsers(req, res) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Count documents per user
    const { data: docs } = await supabase
      .from('documents')
      .select('user_id');

    const countMap = {};
    (docs || []).forEach(d => {
      if (d.user_id) countMap[d.user_id] = (countMap[d.user_id] || 0) + 1;
    });

    const result = (users || []).map(u => ({
      ...u,
      document_count: countMap[u.id] || 0
    }));

    res.json({ users: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * DELETE /api/admin/users/:id — delete a user
 */
async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    // Prevent deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

/**
 * GET /api/admin/stats — dashboard statistics
 */
async function getStats(req, res) {
  try {
    const [docCount, userCount, paraCount] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('paragraphs').select('id', { count: 'exact', head: true })
    ]);

    res.json({
      total_documents: docCount.count || 0,
      total_users: userCount.count || 0,
      total_paragraphs: paraCount.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = { listAllDocuments, deleteDocument, listUsers, deleteUser, getStats };
