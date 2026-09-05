/* ============================================================
   utils/settings.js — Shared system settings helper
   Reads from system_settings table (singleton row id=1).
   Falls back to safe defaults if the table doesn't exist yet.
============================================================ */
const supabase = require('./supabase');

const DEFAULTS = {
  max_uploads_per_user:                  0,
  max_ai_scans_per_user:                 0,
  max_quick_scans_per_week:              3,
  max_document_detections_per_student:   3,
  ai_scanning_enabled:                   true,
  max_file_size_mb:                      20,
  allow_pdf:                             true,
  allow_docx:                            true,
  allow_txt:                             true
};

async function getSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error || !data) return { ...DEFAULTS };
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

module.exports = { getSettings, DEFAULTS };
