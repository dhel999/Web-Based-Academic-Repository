const crypto = require('crypto');
const supabase = require('./supabase');
const { getSettings } = require('./settings');

function normalizeForHash(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function hashDocumentContent(text) {
  return crypto.createHash('sha256').update(normalizeForHash(text)).digest('hex');
}

async function getStudentDetectionUsage(studentId) {
  const settings = await getSettings();
  const maxAllowed = Math.max(0, Number(settings.max_document_detections_per_student || 0));

  const { data, error } = await supabase
    .from('student_detection_usage')
    .select('*')
    .eq('student_id', studentId)
    .eq('period', 'lifetime')
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const existing = data || {
    student_id: studentId,
    used_count: 0,
    maximum_allowed: maxAllowed,
    remaining_count: maxAllowed,
    period: 'lifetime'
  };

  const usedCount = Number(existing.used_count || 0);
  const maximum = Number(existing.maximum_allowed || maxAllowed || 0);
  const remaining = maxAllowed > 0 ? Math.max(0, maximum - usedCount) : 0;

  return {
    used_count: usedCount,
    maximum_allowed: maximum,
    remaining_count: remaining,
    max_allowed_setting: maxAllowed
  };
}

async function ensureStudentUsageRecord(studentId) {
  const settings = await getSettings();
  const maxAllowed = Math.max(0, Number(settings.max_document_detections_per_student || 0));

  const { data: existing } = await supabase
    .from('student_detection_usage')
    .select('*')
    .eq('student_id', studentId)
    .eq('period', 'lifetime')
    .maybeSingle();

  if (existing) {
    const usedCount = Number(existing.used_count || 0);
    const maximum = Number(existing.maximum_allowed || maxAllowed || 0);
    const remaining = maxAllowed > 0 ? Math.max(0, maximum - usedCount) : 0;
    return {
      used_count: usedCount,
      maximum_allowed: maximum,
      remaining_count: remaining,
      max_allowed_setting: maxAllowed
    };
  }

  const row = {
    student_id: studentId,
    used_count: 0,
    maximum_allowed: maxAllowed,
    remaining_count: maxAllowed,
    period: 'lifetime',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('student_detection_usage')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;

  return {
    used_count: Number(data.used_count || 0),
    maximum_allowed: Number(data.maximum_allowed || maxAllowed || 0),
    remaining_count: Number(data.remaining_count || maxAllowed || 0),
    max_allowed_setting: maxAllowed
  };
}

async function checkDetectionQuota(studentId) {
  const settings = await getSettings();
  const maxAllowed = Number(settings.max_document_detections_per_student || 0);
  const usage = await ensureStudentUsageRecord(studentId);

  if (maxAllowed > 0 && usage.used_count >= maxAllowed) {
    return {
      allowed: false,
      message: 'Detection limit reached. You have used all available document detections.',
      usage
    };
  }

  return {
    allowed: true,
    message: 'Quota available',
    usage
  };
}

async function consumeDetectionCredit(studentId) {
  const settings = await getSettings();
  const maxAllowed = Number(settings.max_document_detections_per_student || 0);

  const { data: row } = await supabase
    .from('student_detection_usage')
    .select('*')
    .eq('student_id', studentId)
    .eq('period', 'lifetime')
    .maybeSingle();

  const current = row || {
    student_id: studentId,
    used_count: 0,
    maximum_allowed: maxAllowed,
    remaining_count: maxAllowed,
    period: 'lifetime'
  };

  const nextUsed = Number(current.used_count || 0) + 1;
  const nextMaximum = Number(current.maximum_allowed || maxAllowed || 0);
  const nextRemaining = maxAllowed > 0 ? Math.max(0, nextMaximum - nextUsed) : 0;

  const payload = {
    student_id: studentId,
    used_count: nextUsed,
    maximum_allowed: nextMaximum,
    remaining_count: nextRemaining,
    period: 'lifetime',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('student_detection_usage')
    .upsert(payload, { onConflict: 'student_id,period' })
    .select('*')
    .single();

  if (error) throw error;

  return {
    used_count: Number(data.used_count || 0),
    maximum_allowed: Number(data.maximum_allowed || nextMaximum),
    remaining_count: Number(data.remaining_count || nextRemaining),
    max_allowed_setting: maxAllowed
  };
}

async function getCachedDetection(studentId, documentId, documentHash) {
  const { data, error } = await supabase
    .from('document_detection_cache')
    .select('*')
    .eq('student_id', studentId)
    .eq('document_id', documentId)
    .eq('document_hash', documentHash)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
}

async function saveDetectionCacheRecord(studentId, documentId, documentHash, override = {}) {
  const payload = {
    student_id: studentId,
    document_id: documentId,
    document_hash: documentHash,
    detection_status: 'processing',
    api_provider: null,
    result_data: null,
    ai_score: null,
    similarity_score: null,
    detected_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...override
  };

  const { data, error } = await supabase
    .from('document_detection_cache')
    .upsert(payload, { onConflict: 'student_id,document_id,document_hash' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function markDetectionCompleted(studentId, documentId, documentHash, resultData, aiScore, similarityScore, apiProvider = 'local') {
  const { data, error } = await supabase
    .from('document_detection_cache')
    .update({
      detection_status: 'completed',
      ai_score: aiScore ?? null,
      similarity_score: similarityScore ?? null,
      result_data: resultData || null,
      api_provider: apiProvider,
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('student_id', studentId)
    .eq('document_id', documentId)
    .eq('document_hash', documentHash)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function markDetectionFailed(studentId, documentId, documentHash) {
  const { data, error } = await supabase
    .from('document_detection_cache')
    .update({
      detection_status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('student_id', studentId)
    .eq('document_id', documentId)
    .eq('document_hash', documentHash)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getAllDetectionsByStudent(studentId) {
  const { data, error } = await supabase
    .from('document_detection_cache')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getDocumentDetectionHistory(documentId) {
  const { data, error } = await supabase
    .from('document_detection_cache')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

module.exports = {
  hashDocumentContent,
  getStudentDetectionUsage,
  ensureStudentUsageRecord,
  checkDetectionQuota,
  consumeDetectionCredit,
  getCachedDetection,
  saveDetectionCacheRecord,
  markDetectionCompleted,
  markDetectionFailed,
  getAllDetectionsByStudent,
  getDocumentDetectionHistory
};
