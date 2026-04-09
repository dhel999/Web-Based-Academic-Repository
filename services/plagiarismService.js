const supabase = require('../utils/supabase');
const { compareDocuments, compareParagraphs } = require('../utils/tfidf');

/**
 * Run TF-IDF + Cosine Similarity plagiarism check for a newly uploaded document.
 *
 * @param {string} newDocumentId - UUID of the new document
 * @param {string} newText - extracted text of the new document
 * @param {string[]} newParagraphs - array of paragraph strings from the new document
 * @returns {Promise<{documentMatches: Array, paragraphMatches: Array, overallScore: number}>}
 */
async function runLocalPlagiarismCheck(newDocumentId, newText, newParagraphs) {
  // Fetch all existing documents (excluding the new one)
  // Only fetch title + text (not full content for large DBs)
  const { data: existingDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, extracted_text')
    .neq('id', newDocumentId);

  if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

  // Document-level comparison first to find relevant documents
  const rawDocumentMatches = existingDocs && existingDocs.length > 0
    ? compareDocuments(newText, existingDocs)
    : [];

  // Deduplicate: keep only the highest-scoring match per unique title
  const seenTitles = new Map();
  for (const m of rawDocumentMatches) {
    const key = m.title.trim().toLowerCase();
    if (!seenTitles.has(key) || m.similarity_score > seenTitles.get(key).similarity_score) {
      seenTitles.set(key, m);
    }
  }
  const documentMatches = [...seenTitles.values()].sort((a, b) => b.similarity_score - a.similarity_score);

  // Only fetch paragraphs from the TOP matching documents (max 10) for efficiency
  // This scales well: instead of loading ALL paragraphs from ALL documents,
  // we only compare against documents that are already flagged at document level
  const topDocIds = documentMatches
    .filter(m => m.similarity_score > 10)
    .slice(0, 10)
    .map(m => m.document_id);

  let existingParagraphs = [];
  if (topDocIds.length > 0) {
    const { data: paraData, error: parasError } = await supabase
      .from('paragraphs')
      .select('id, document_id, paragraph_text')
      .in('document_id', topDocIds);

    if (parasError) console.error('Failed to fetch paragraphs:', parasError.message);
    else existingParagraphs = paraData || [];
  }

  // Paragraph-level comparison (threshold 30% to reduce false positives)
  const paragraphMatches = [];
  if (existingParagraphs && existingParagraphs.length > 0) {
    for (let idx = 0; idx < newParagraphs.length; idx++) {
      const para = newParagraphs[idx];
      const matches = compareParagraphs(para, existingParagraphs);
      if (matches.length > 0 && matches[0].similarity_score > 30) {
        // Resolve the matched document title
        let matchedTitle = 'Unknown';
        const matchedDocId = matches[0].document_id;
        if (matchedDocId) {
          const doc = existingDocs ? existingDocs.find(d => d.id === matchedDocId) : null;
          if (doc) matchedTitle = doc.title;
        }
        paragraphMatches.push({
          paragraph_index: idx,
          new_paragraph: para,
          best_match: { ...matches[0], matched_title: matchedTitle }
        });
      }
    }
  }

  // Calculate overall plagiarism score
  // Use paragraph-based scoring: % of paragraphs that are flagged, weighted by their match score
  let overallScore = 0;
  if (newParagraphs.length > 0 && paragraphMatches.length > 0) {
    // Weighted: sum of flagged paragraph scores / total paragraphs
    const totalParaScore = paragraphMatches.reduce((sum, pm) => sum + pm.best_match.similarity_score, 0);
    overallScore = totalParaScore / newParagraphs.length;
    overallScore = parseFloat(Math.min(overallScore, 100).toFixed(2));
  } else if (documentMatches.length > 0) {
    // Fallback to document-level but cap at 30% if no paragraph matches
    const topMatches = documentMatches.slice(0, 3);
    const docScore = topMatches.reduce((sum, m) => sum + m.similarity_score, 0) / topMatches.length;
    overallScore = parseFloat(Math.min(docScore * 0.3, 30).toFixed(2));
  }

  // Save results to plagiarism_results table
  const insertRows = documentMatches
    .filter(m => m.similarity_score > 5)
    .map(m => ({
      document_id: newDocumentId,
      matched_document_id: m.document_id,
      similarity_score: m.similarity_score,
      matched_paragraph: null,
      source: 'local'
    }));

  // Also save top paragraph matches (only those above 25%)
  for (const pm of paragraphMatches.filter(m => m.best_match.similarity_score >= 25)) {
    insertRows.push({
      document_id: newDocumentId,
      matched_document_id: pm.best_match.document_id,
      similarity_score: pm.best_match.similarity_score,
      matched_paragraph: JSON.stringify({
        new_paragraph: pm.new_paragraph,
        matched_text: pm.best_match.paragraph_text,
        matched_title: pm.best_match.matched_title || 'Unknown'
      }),
      source: 'local'
    });
  }

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase
      .from('plagiarism_results')
      .insert(insertRows);
    if (insertError) console.error('Failed to save plagiarism results:', insertError.message);
  }

  // ── Reverse update: update existing documents' scores against the new doc ──
  // This ensures the first-uploaded document gets a score once later docs arrive
  await updateReverseScores(newDocumentId, newText, newParagraphs, existingDocs);

  return { documentMatches, paragraphMatches, overallScore };
}

/**
 * Search for similar titles in the database.
 * @param {string} title
 * @returns {Promise<Array<{id: string, title: string}>>}
 */
async function checkSimilarTitles(title) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, created_at')
    .ilike('title', `%${title.trim()}%`);

  if (error) throw new Error(`Title search failed: ${error.message}`);
  return data || [];
}

/**
 * Retrieve all plagiarism results for a given document.
 * @param {string} documentId
 * @returns {Promise<Array>}
 */
async function getResultsByDocument(documentId) {
  const { data, error } = await supabase
    .from('plagiarism_results')
    .select(`
      id,
      similarity_score,
      matched_paragraph,
      source,
      created_at,
      matched_document_id
    `)
    .eq('document_id', documentId)
    .order('similarity_score', { ascending: false });

  if (error) throw new Error(`Failed to fetch results: ${error.message}`);

  // Resolve matched document titles
  const results = [];
  for (const row of data || []) {
    let matchedTitle = 'Unknown';
    if (row.matched_document_id) {
      const { data: matchedDoc } = await supabase
        .from('documents')
        .select('title')
        .eq('id', row.matched_document_id)
        .single();
      if (matchedDoc) matchedTitle = matchedDoc.title;
    }
    results.push({ ...row, matched_document_title: matchedTitle });
  }

  return results;
}

/**
 * Reverse update: for each existing document that matched with the new doc,
 * compute that existing document's score against the new doc and upsert results.
 * This ensures the first-uploaded document gets updated scores when new docs arrive.
 */
async function updateReverseScores(newDocumentId, newText, newParagraphs, existingDocs) {
  try {
    if (!existingDocs || existingDocs.length === 0) return;

    // The new document as a "corpus" entry for comparison
    const newDocAsCorpus = [{ id: newDocumentId, title: '', extracted_text: newText }];

    for (const existingDoc of existingDocs) {
      // Document-level: compare existing doc text against [newDoc]
      const docMatches = compareDocuments(existingDoc.extracted_text, newDocAsCorpus);
      const topMatch = docMatches.length > 0 ? docMatches[0] : null;

      if (!topMatch || topMatch.similarity_score <= 5) continue;

      // Check if a result already exists for this pair
      const { data: existing } = await supabase
        .from('plagiarism_results')
        .select('id, similarity_score')
        .eq('document_id', existingDoc.id)
        .eq('matched_document_id', newDocumentId)
        .is('matched_paragraph', null)
        .eq('source', 'local')
        .maybeSingle();

      if (existing) {
        // Update only if the new score is higher
        if (topMatch.similarity_score > existing.similarity_score) {
          await supabase
            .from('plagiarism_results')
            .update({ similarity_score: topMatch.similarity_score })
            .eq('id', existing.id);
        }
      } else {
        // Insert new reverse result
        await supabase
          .from('plagiarism_results')
          .insert({
            document_id: existingDoc.id,
            matched_document_id: newDocumentId,
            similarity_score: topMatch.similarity_score,
            matched_paragraph: null,
            source: 'local'
          });
      }

      // Paragraph-level reverse: compare existing doc's paragraphs against new doc's paragraphs
      const { data: existingParas } = await supabase
        .from('paragraphs')
        .select('id, document_id, paragraph_text')
        .eq('document_id', existingDoc.id);

      if (existingParas && existingParas.length > 0) {
        // Build the new doc's paragraphs as the corpus
        const newParasAsCorpus = newParagraphs.map((text, i) => ({
          id: `new-${i}`,
          document_id: newDocumentId,
          paragraph_text: text
        }));

        for (const ePara of existingParas) {
          const matches = compareParagraphs(ePara.paragraph_text, newParasAsCorpus);
          if (matches.length > 0 && matches[0].similarity_score >= 25) {
            await supabase
              .from('plagiarism_results')
              .insert({
                document_id: existingDoc.id,
                matched_document_id: newDocumentId,
                similarity_score: matches[0].similarity_score,
                matched_paragraph: JSON.stringify({
                  new_paragraph: ePara.paragraph_text,
                  matched_text: matches[0].paragraph_text,
                  matched_title: 'Newly uploaded document'
                }),
                source: 'local'
              });
          }
        }
      }
    }
  } catch (err) {
    console.error('Reverse score update error:', err.message);
    // Don't throw — this is a background enhancement, not critical
  }
}

module.exports = { runLocalPlagiarismCheck, checkSimilarTitles, getResultsByDocument };
