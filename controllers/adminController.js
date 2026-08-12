const supabase = require('../utils/supabase');

/**
 * GET /api/admin/documents — list all documents with uploader info
 */
async function listAllDocuments(req, res) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, original_filename, thumbnail_url, created_at, user_id, authors, course, year')
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

/**
 * PATCH /api/admin/users/:id/role — toggle user role between 'admin' and 'user'
 */
async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin or user.' });
  }
  if (req.user.id === id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }
  try {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id);
    if (error) throw new Error(error.message);
    res.json({ message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
}

/**
 * GET /api/admin/settings — fetch system settings + usage
 */
async function getAdminSettings(req, res) {
  try {
    const { getSettings } = require('../utils/settings');
    const settings = await getSettings();

    const [docCount, userCount, aiScansCount] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('ai_scan_log').select('id', { count: 'exact', head: true })
    ]);

    res.json({
      settings,
      usage: {
        total_documents:  docCount.count  || 0,
        total_users:      userCount.count  || 0,
        total_ai_scans:   aiScansCount.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

/**
 * PUT /api/admin/settings — update system settings
 */
async function updateAdminSettings(req, res) {
  try {
    const {
      max_uploads_per_user,
      max_ai_scans_per_user,
      max_document_detections_per_student,
      ai_scanning_enabled,
      max_file_size_mb,
      allow_pdf,
      allow_docx,
      allow_txt
    } = req.body;

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        id: 1,
        max_uploads_per_user:                 Math.max(0, parseInt(max_uploads_per_user)  || 0),
        max_ai_scans_per_user:                Math.max(0, parseInt(max_ai_scans_per_user) || 0),
        max_document_detections_per_student:  Math.max(0, parseInt(max_document_detections_per_student) || 3),
        ai_scanning_enabled:                  Boolean(ai_scanning_enabled),
        max_file_size_mb:                     Math.max(1, parseInt(max_file_size_mb) || 20),
        allow_pdf:                            Boolean(allow_pdf),
        allow_docx:                           Boolean(allow_docx),
        allow_txt:                            Boolean(allow_txt),
        updated_at:                           new Date().toISOString()
      });

    if (error) throw new Error(error.message);
    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
}

/**
 * GET /api/admin/cache-stats — detection cache statistics
 */
async function getCacheStats(req, res) {
  try {
    // Get total detections from cache table
    const { data: cacheData, error: cacheError } = await supabase
      .from('document_detection_cache')
      .select('detection_status');
    
    if (cacheError) throw new Error(cacheError.message);
    
    const totalDetections = (cacheData || []).length;
    const completedDetections = (cacheData || []).filter(d => d.detection_status === 'completed').length;
    const cachedDetections = completedDetections; // Cached results are completed detections
    
    res.json({
      total_detections: totalDetections,
      cached_detections: cachedDetections,
      cache_hit_rate: totalDetections > 0 ? Math.round((cachedDetections / totalDetections) * 100) : 0
    });
  } catch (err) {
    console.error('Cache stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
}

/**
 * GET /api/admin/detection-usage — detection credits usage statistics
 */
async function getDetectionUsage(req, res) {
  try {
    // Get total students and their credit usage
    const { data: usageData, error: usageError } = await supabase
      .from('student_detection_usage')
      .select('used_count');
    
    if (usageError) throw new Error(usageError.message);
    
    const totalStudents = (usageData || []).length;
    const totalCreditsUsed = (usageData || []).reduce((sum, u) => sum + (u.used_count || 0), 0);
    
    res.json({
      total_students: totalStudents,
      total_credits_used: totalCreditsUsed,
      avg_credits_per_student: totalStudents > 0 ? Math.round(totalCreditsUsed / totalStudents) : 0
    });
  } catch (err) {
    console.error('Detection usage error:', err.message);
    res.status(500).json({ error: 'Failed to fetch detection usage' });
  }
}

module.exports = { 
  listAllDocuments, 
  deleteDocument, 
  listUsers, 
  deleteUser, 
  updateUserRole, 
  getStats, 
  getAdminSettings, 
  updateAdminSettings,
  getCacheStats,
  getDetectionUsage 
};
