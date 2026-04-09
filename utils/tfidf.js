/**
 * TF-IDF + Cosine Similarity utilities
 * Uses the `natural` npm package for TF-IDF vectorization
 */
const natural = require('natural');
const TfIdf = natural.TfIdf;

/**
 * Tokenize and normalize text into a bag-of-words map.
 * @param {string} text
 * @returns {Object} word frequency map
 */
// Common academic stopwords that appear in every thesis — exclude from comparison
const ACADEMIC_STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can','could',
  'of','in','to','for','with','on','at','by','from','as','into','through','during',
  'before','after','above','below','between','under','again','further','then','once',
  'and','but','or','nor','not','so','yet','both','either','neither','each','every',
  'this','that','these','those','it','its','they','them','their','we','our','he','she',
  'which','who','whom','whose','what','where','when','how','why','if','than','because',
  'also','such','very','just','only','more','most','other','some','any','all','no',
  // Common academic filler
  'study','system','data','based','using','used','use','research','paper','proposed',
  'development','design','developed','information','provide','provides','provided',
  'according','result','results','method','approach','process','technology','application',
  'however','therefore','moreover','furthermore','thus','hence','likewise','similarly',
  'conclusion','recommendation','implementation','chapter','section','figure','table',
  // Common CS / tech terms that appear across all CS theses
  'html','css','javascript','php','mysql','python','java','firebase','database','server',
  'web','website','mobile','android','ios','interface','user','users','admin','login',
  'software','hardware','computer','online','offline','cloud','api','framework',
  'frontend','backend','client','responsive','dashboard','page','pages','button',
  'feature','features','module','modules','component','input','output','display',
  'click','form','screen','menu','navigation','search','upload','download',
  'college','university','school','student','students','teacher','faculty','staff',
  'department','course','campus','academic','institution','education','learning'
]);

function tokenize(text) {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const freq = {};
  for (const token of tokens) {
    // Skip stopwords and very short tokens (1-2 chars) and pure numbers
    if (ACADEMIC_STOPWORDS.has(token)) continue;
    if (token.length <= 2) continue;
    if (/^\d+$/.test(token)) continue;
    freq[token] = (freq[token] || 0) + 1;
  }
  return freq;
}

/**
 * Compute Term Frequency for each term in a document.
 * @param {Object} wordFreq - word frequency map
 * @returns {Object} TF map
 */
function computeTF(wordFreq) {
  const tf = {};
  const total = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  for (const [word, count] of Object.entries(wordFreq)) {
    tf[word] = count / total;
  }
  return tf;
}

/**
 * Compute Inverse Document Frequency across a corpus.
 * @param {Array<Object>} docs - array of word frequency maps
 * @returns {Object} IDF map
 */
function computeIDF(docs) {
  const idf = {};
  const N = docs.length;
  const allWords = new Set(docs.flatMap(d => Object.keys(d)));

  for (const word of allWords) {
    const docsWithWord = docs.filter(d => word in d).length;
    idf[word] = Math.log((N + 1) / (docsWithWord + 1)) + 1; // smoothed
  }
  return idf;
}

/**
 * Compute TF-IDF vector for a document.
 * @param {Object} tf
 * @param {Object} idf
 * @returns {Object} tfidf vector
 */
function computeTFIDF(tf, idf) {
  const tfidf = {};
  for (const word of Object.keys(tf)) {
    tfidf[word] = tf[word] * (idf[word] || 1);
  }
  return tfidf;
}

/**
 * Compute cosine similarity between two TF-IDF vectors.
 * @param {Object} vecA
 * @param {Object} vecB
 * @returns {number} similarity score between 0 and 1
 */
function cosineSimilarity(vecA, vecB) {
  const allWords = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const word of allWords) {
    const a = vecA[word] || 0;
    const b = vecB[word] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/**
 * Compare a new document against a list of existing documents.
 * Returns results sorted by similarity descending.
 *
 * @param {string} newText - extracted text of new document
 * @param {Array<{id: string, title: string, extracted_text: string}>} existingDocs
 * @returns {Array<{document_id: string, title: string, similarity_score: number}>}
 */
function compareDocuments(newText, existingDocs) {
  if (!existingDocs || existingDocs.length === 0) return [];

  const allTexts = [newText, ...existingDocs.map(d => d.extracted_text)];
  const allFreqs = allTexts.map(tokenize);
  const idf = computeIDF(allFreqs);

  const newFreq = allFreqs[0];
  const newTF = computeTF(newFreq);
  const newVec = computeTFIDF(newTF, idf);

  const results = [];
  for (let i = 0; i < existingDocs.length; i++) {
    const doc = existingDocs[i];
    const docFreq = allFreqs[i + 1];
    const docTF = computeTF(docFreq);
    const docVec = computeTFIDF(docTF, idf);
    const score = cosineSimilarity(newVec, docVec);

    results.push({
      document_id: doc.id,
      title: doc.title,
      similarity_score: parseFloat((score * 100).toFixed(2))
    });
  }

  return results.sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Extract n-grams (consecutive word sequences) from text.
 * @param {string} text
 * @param {number} n - number of consecutive words
 * @returns {Set<string>} set of n-gram strings
 */
function extractNgrams(text, n) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase()).filter(w => w.length > 2);
  const ngrams = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Check how many n-grams are shared between two texts.
 * Returns the ratio of shared n-grams to the smaller text's total n-grams.
 * @param {string} textA
 * @param {string} textB
 * @param {number} n - n-gram size (default 5)
 * @returns {number} overlap ratio 0-1
 */
function ngramOverlap(textA, textB, n = 5) {
  const ngramsA = extractNgrams(textA, n);
  const ngramsB = extractNgrams(textB, n);
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;
  let shared = 0;
  for (const ng of ngramsA) {
    if (ngramsB.has(ng)) shared++;
  }
  return shared / Math.min(ngramsA.size, ngramsB.size);
}

/**
 * Compare a single paragraph against an array of paragraph texts.
 * Uses TF-IDF cosine similarity + n-gram overlap verification.
 * @param {string} paragraph
 * @param {Array<{id: string, paragraph_text: string, document_id: string}>} existingParagraphs
 * @returns {Array<{paragraph_id: string, document_id: string, similarity_score: number}>}
 */
function compareParagraphs(paragraph, existingParagraphs) {
  if (!existingParagraphs || existingParagraphs.length === 0) return [];

  const allTexts = [paragraph, ...existingParagraphs.map(p => p.paragraph_text)];
  const allFreqs = allTexts.map(tokenize);
  const idf = computeIDF(allFreqs);

  const newFreq = allFreqs[0];
  const newTF = computeTF(newFreq);
  const newVec = computeTFIDF(newTF, idf);

  const results = [];
  for (let i = 0; i < existingParagraphs.length; i++) {
    const para = existingParagraphs[i];
    const paraFreq = allFreqs[i + 1];
    const paraTF = computeTF(paraFreq);
    const paraVec = computeTFIDF(paraTF, idf);
    const score = cosineSimilarity(newVec, paraVec);

    if (score > 0.1) {
      // Secondary check: verify actual phrase overlap using 5-grams
      // This prevents false positives from shared vocabulary (e.g. "HTML, CSS, JavaScript")
      const overlap = ngramOverlap(paragraph, para.paragraph_text, 5);
      
      // Adjust score: if no phrase overlap, heavily penalize the score
      let adjustedScore = score * 100;
      if (overlap < 0.02) {
        // Less than 2% phrase overlap = mostly vocabulary match, not real plagiarism
        adjustedScore = adjustedScore * 0.3; // reduce to 30% of original
      } else if (overlap < 0.05) {
        adjustedScore = adjustedScore * 0.6; // some overlap but not strong
      }
      // Boost if strong phrase overlap
      if (overlap > 0.15) {
        adjustedScore = Math.min(adjustedScore * 1.2, 100);
      }

      if (adjustedScore > 10) {
        results.push({
          paragraph_id: para.id,
          document_id: para.document_id,
          paragraph_text: para.paragraph_text,
          similarity_score: parseFloat(adjustedScore.toFixed(2))
        });
      }
    }
  }

  return results.sort((a, b) => b.similarity_score - a.similarity_score);
}

module.exports = { compareDocuments, compareParagraphs, cosineSimilarity };
