/* ============================================================
   utils/overallScore.js — Canonical "overall similarity" formula
   ============================================================
   A document's plagiarism_results rows carry three independent
   sources of evidence: local TF-IDF matches, AI semantic flags, and
   internet matches. Multiple parts of the app (the report page, the
   document card, the admin list) each need a single "how similar is
   this document" percentage, and previously each computed it with a
   slightly different formula — which meant the SAME document could
   show different percentages depending on which screen you were on.

   This is the one formula every caller should use, so the number
   showed to a student/admin is consistent everywhere. It mirrors the
   blended calculation that used to live only in the browser
   (public/js/result.js renderResultsFromDB).
============================================================ */

/**
 * Compute the canonical overall similarity score (0-100) for a document
 * from its plagiarism_results rows.
 *
 * @param {Array} results - rows from plagiarism_results for one document
 * @param {number} paragraphCount - total paragraph count for the document
 * @returns {number} overall score, 0-100, rounded to 1 decimal
 */
function computeOverallScore(results, paragraphCount) {
  const localResults    = results.filter(r => r.source === 'local');
  const aiResults       = results.filter(r => r.source === 'openai');
  const internetResults = results.filter(r => r.source === 'internet');

  const paragraphResults = localResults.filter(r => r.matched_paragraph);
  const docLevelResults  = localResults.filter(r => !r.matched_paragraph);

  let localScore = 0;
  if (paragraphResults.length > 0 && paragraphCount > 0) {
    const totalParaScore = paragraphResults.reduce((sum, r) => sum + r.similarity_score, 0);
    localScore = totalParaScore / paragraphCount;
  } else if (docLevelResults.length > 0) {
    const topDocs = docLevelResults.slice(0, 3);
    localScore = (topDocs.reduce((s, r) => s + r.similarity_score, 0) / topDocs.length) * 0.3;
  }

  let aiScore = 0;
  if (aiResults.length > 0 && paragraphCount > 0) {
    const avgAiConf = aiResults.reduce((s, r) => s + (r.similarity_score || 80), 0) / aiResults.length;
    aiScore = (aiResults.length / paragraphCount) * avgAiConf;
  }

  let internetScore = 0;
  if (internetResults.length > 0 && paragraphCount > 0) {
    const avgIntConf = internetResults.reduce((s, r) => s + r.similarity_score, 0) / internetResults.length;
    internetScore = (internetResults.length / paragraphCount) * avgIntConf;
  }

  const overall = Math.max(localScore, aiScore, internetScore);
  return parseFloat(Math.min(overall, 100).toFixed(1));
}

module.exports = { computeOverallScore };
