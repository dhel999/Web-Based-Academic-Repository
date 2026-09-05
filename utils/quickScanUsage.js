const crypto = require('crypto');
const supabase = require('./supabase');
const { getSettings } = require('./settings');

function getWeekStart(date = new Date()) {
  const value = new Date(date);
  const day = value.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value.toISOString().slice(0, 10);
}

function getSubjectKey(req) {
  if (req.user?.id) return `user:${req.user.id}`;

  const address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const agent = req.get('user-agent') || 'unknown';
  const fingerprint = crypto.createHash('sha256').update(`${address}|${agent}`).digest('hex');
  return `guest:${fingerprint}`;
}

async function getQuickScanUsage(req) {
  const settings = await getSettings();
  const maximumAllowed = Math.max(0, Number(settings.max_quick_scans_per_week ?? 3));
  const subjectKey = getSubjectKey(req);
  const weekStart = getWeekStart();

  const { data, error } = await supabase
    .from('quick_scan_usage')
    .select('used_count')
    .eq('subject_key', subjectKey)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  const usedCount = Number(data?.used_count || 0);
  return {
    used_count: usedCount,
    maximum_allowed: maximumAllowed,
    remaining_count: maximumAllowed > 0 ? Math.max(0, maximumAllowed - usedCount) : null,
    week_start: weekStart
  };
}

async function consumeQuickScan(req) {
  const settings = await getSettings();
  const maximumAllowed = Math.max(0, Number(settings.max_quick_scans_per_week ?? 3));
  const subjectKey = getSubjectKey(req);
  const weekStart = getWeekStart();

  const { data, error } = await supabase.rpc('consume_quick_scan', {
    p_subject_key: subjectKey,
    p_week_start: weekStart,
    p_maximum_allowed: maximumAllowed
  });

  if (error) throw error;

  const usage = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(usage?.allowed),
    used_count: Number(usage?.used_count || 0),
    maximum_allowed: maximumAllowed,
    remaining_count: maximumAllowed > 0 ? Number(usage?.remaining_count || 0) : null,
    week_start: weekStart
  };
}

module.exports = { getQuickScanUsage, consumeQuickScan, getWeekStart };
