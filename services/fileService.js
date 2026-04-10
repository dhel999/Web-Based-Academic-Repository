const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract plain text from an uploaded file based on its MIME type / extension.
 * @param {string} filePath - absolute path to the uploaded file
 * @param {string} originalName - original filename (used to detect extension)
 * @returns {Promise<string>} extracted text
 */
async function extractText(filePathOrBuffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  // Support both file path (string) and buffer (from memoryStorage)
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.readFileSync(filePathOrBuffer);

  if (ext === '.pdf') {
    return extractFromPDF(buffer);
  } else if (ext === '.docx') {
    return extractFromDOCX(buffer);
  } else if (ext === '.txt') {
    return extractFromTXT(buffer);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Allowed: .pdf, .docx, .txt`);
  }
}

/**
 * Extract text from a PDF file.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractFromPDF(buffer) {
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}

/**
 * Extract text from a DOCX file using mammoth.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractFromDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

/**
 * Read plain text from a TXT file.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractFromTXT(buffer) {
  const content = buffer.toString('utf-8');
  return cleanText(content);
}

/**
 * Normalize whitespace and strip control characters.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')  // collapse spaces/tabs but keep newlines
    .replace(/\n{3,}/g, '\n\n') // reduce excessive blank lines
    .trim();
}

/**
 * Split extracted text into non-empty paragraphs.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoParagraphs(text) {
  // Patterns that identify thesis headers / non-content lines
  const headerPatterns = [
    /^chapter\s+[ivxlcdm\d]+/i,
    /^appendix\s*[a-z]?\b/i,
    /^(abstract|acknowledgement|acknowledgment|dedication|table\s+of\s+contents|list\s+of\s+(tables|figures|abbreviations)|bibliography|references|glossary|foreword|preface|declaration)\b/i,
    /^(introduction|methodology|review\s+of\s+related|results?\s+and\s+discussion|summary\s+and\s+recommendations?|conclusion|recommendations?|scope\s+and\s+(limitation|delimitation)|statement\s+of\s+the\s+problem|significance|definition\s+of\s+terms|conceptual\s+framework|theoretical\s+framework|research\s+design|software\s+(and\s+hardware\s+)?requirement|software\s+requirement)/i,
    /^figure\s+\d/i,
    /^table\s+\d/i,
  ];

  const isHeader = (line) => {
    const stripped = line.replace(/\d+\s*$/, '').trim();  // remove trailing page numbers
    if (stripped.length < 10) return true;
    // ALL CAPS line under 150 chars = heading
    if (stripped.length < 150 && stripped === stripped.toUpperCase()) return true;
    if (headerPatterns.some(rx => rx.test(stripped))) return true;
    // Heading with trailing page number e.g. "Software Requirement and Development 22"
    if (/^\D+\s+\d{1,3}\s*$/.test(line) && line.length < 120) return true;
    return false;
  };

  // Detect bibliography / reference entries
  const isReference = (p) => {
    // Typical citation format: Author, A. (2021). Title. Journal...
    if (/^[A-Z][a-z]+,\s*[A-Z]\./.test(p)) return true;
    // Starts with (Author, year) or [1] [2] etc.
    if (/^\[\d+\]/.test(p) || /^\(\d{4}\)/.test(p)) return true;
    // Heavy year-parenthetical density = reference list
    const yearMatches = (p.match(/\(\d{4}\)/g) || []).length;
    const wordCount = p.split(/\s+/).length;
    if (yearMatches >= 3 && yearMatches / wordCount > 0.05) return true;
    // Contains DOI, ISBN, ISSN, URL patterns typical of references
    if (/\bdoi[:\s]/i.test(p) || /\bISBN\b/i.test(p) || /\bISSN\b/i.test(p)) return true;
    if (/https?:\/\//i.test(p) && wordCount < 40) return true;
    // Lines with "Retrieved from", "Available at", "Accessed"
    if (/\b(retrieved from|available at|accessed on|accessed \d)\b/i.test(p)) return true;
    // Looks like a stacked reference: short + ends with page numbers like pp. 101-117
    if (/pp\.\s*\d+/i.test(p) && wordCount < 50) return true;
    // Journal-style: Vol/Issue pattern
    if (/\bVol\.?\s*\d+/i.test(p) && /Issue\s*\d+|No\.\s*\d+/i.test(p) && wordCount < 60) return true;
    return false;
  };

  // A real paragraph must be multi-sentence prose, not a single definition line
  const isRealParagraph = (p) => {
    if (!/[a-z]/.test(p)) return false;             // all caps = heading
    const wordCount = p.split(/\s+/).length;
    if (wordCount < 20) return false;                // need at least 20 words
    if (p.length < 120) return false;                // need at least 120 chars
    if (isReference(p)) return false;                // skip bibliography entries
    return true;
  };

  return text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => !isHeader(p))
    .filter(p => isRealParagraph(p));
}

/**
 * Split extracted text into display blocks for document-style viewing.
 * Unlike splitIntoParagraphs(), this preserves headings and shorter blocks.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoDisplayParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(block => block.length > 0);
}

/**
 * Delete a file from disk (used to clean up temp uploads).
 * @param {string} filePath
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to delete temp file:', err.message);
  }
}

module.exports = { extractText, splitIntoParagraphs, splitIntoDisplayParagraphs, deleteFile };
