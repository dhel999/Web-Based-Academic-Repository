/**
 * Internet Plagiarism Search Service
 * Searches the web for similar text snippets using Google search.
 * Compares search result snippets against document paragraphs using TF-IDF.
 */
const https = require('https');
const http = require('http');
const { compareParagraphs } = require('../utils/tfidf');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch a URL and return body text
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Extract key phrases from a paragraph for search query
 */
function extractSearchQuery(paragraph) {
  // Common academic stopwords to skip
  const stopwords = new Set(['this','that','these','those','with','from','have','been','were','will','also',
    'which','their','there','they','them','then','than','would','could','should','about','into',
    'more','some','such','only','other','each','most','both','does','being','very','just','made']);
  // Extract the most distinctive words from the paragraph
  const words = paragraph.replace(/[^\w\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w.toLowerCase()));
  // Use content-rich words from the first half of the paragraph
  const query = words.slice(0, 15).join(' ');
  return query.length > 15 ? query : paragraph.slice(0, 120);
}

/**
 * Search Google and parse result snippets & URLs
 */
async function searchGoogle(query) {
  const encoded = encodeURIComponent(`"${query}"`);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

  try {
    const html = await fetchUrl(url);
    const results = [];

    // Parse DuckDuckGo HTML results
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="[^"]*uddg=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    const links = [];
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const cleanUrl = decodeURIComponent(match[1]);
        if (cleanUrl.startsWith('http') && !cleanUrl.includes('duckduckgo.com/y.js') && !cleanUrl.includes('bing.com/aclick')) {
          links.push(cleanUrl);
        }
      } catch (e) { /* skip */ }
    }

    // Extract text snippets
    const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/[a-z]/g;
    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ').trim();
      if (text.length > 30) snippets.push(text);
    }

    // Combine links with snippets
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      results.push({
        url: links[i],
        snippet: snippets[i] || '',
        title: extractDomain(links[i])
      });
    }

    return results;
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

/**
 * Extract domain name from URL
 */
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url.slice(0, 50);
  }
}

/**
 * Run internet plagiarism check on selected paragraphs.
 * Only checks paragraphs that are likely to have matches (longer ones).
 * 
 * @param {string[]} paragraphs - Array of paragraph texts
 * @param {number} maxParagraphs - Max paragraphs to check (to avoid rate limits)
 * @returns {Promise<Array>} Array of internet match results
 */
async function searchInternetPlagiarism(paragraphs, maxParagraphs = 12) {
  const results = [];

  // Select paragraphs to check: only real prose paragraphs
  const candidates = paragraphs
    .map((text, index) => ({ text, index, wordCount: text.split(/\s+/).length }))
    .filter(p => {
      if (p.wordCount < 20) return false;        // skip short lines
      if (p.text.length < 100) return false;      // skip very short text
      if (!/[a-z]/.test(p.text)) return false;    // skip ALL CAPS
      if (/^\d+\.\s/.test(p.text) && p.wordCount < 30) return false; // numbered items
      return true;
    })
    .sort((a, b) => b.wordCount - a.wordCount)  // Prioritize longer ones
    .slice(0, maxParagraphs);

  for (const candidate of candidates) {
    try {
      const query = extractSearchQuery(candidate.text);
      const searchResults = await searchGoogle(query);

      if (searchResults.length > 0) {
        // Compare the paragraph against search snippets using TF-IDF
        const snippetCorpus = searchResults
          .filter(r => r.snippet && r.snippet.length > 30)
          .map((r, i) => ({
            id: `web-${i}`,
            document_id: `web-${i}`,
            paragraph_text: r.snippet
          }));

        if (snippetCorpus.length > 0) {
          const matches = compareParagraphs(candidate.text, snippetCorpus);
          const bestMatch = matches.length > 0 ? matches[0] : null;

          // Also do a simple substring match check
          let substringMatch = false;
          let bestUrl = searchResults[0]?.url || '';
          let bestSnippet = searchResults[0]?.snippet || '';

          // Check if significant phrases from the paragraph appear in snippets
          const paraWords = candidate.text.toLowerCase().split(/\s+/);
          for (const sr of searchResults) {
            if (!sr.snippet) continue;
            const snipLower = sr.snippet.toLowerCase();
            // Check 5-word sequences
            let phraseHits = 0;
            for (let w = 0; w <= paraWords.length - 5; w++) {
              const phrase = paraWords.slice(w, w + 5).join(' ');
              if (snipLower.includes(phrase)) phraseHits++;
            }
            if (phraseHits >= 2) {
              substringMatch = true;
              bestUrl = sr.url;
              bestSnippet = sr.snippet;
              break;
            }
          }

          const similarity = bestMatch ? bestMatch.similarity_score : 0;

          if (similarity >= 20 || substringMatch) {
            results.push({
              paragraph_index: candidate.index,
              paragraph_text: candidate.text,
              similarity_score: Math.max(similarity, substringMatch ? 35 : 0),
              matched_snippet: bestSnippet || (bestMatch ? bestMatch.paragraph_text : ''),
              source_url: bestUrl,
              source_domain: extractDomain(bestUrl),
              all_sources: searchResults.map(r => ({ url: r.url, domain: extractDomain(r.url) }))
            });
          }
        }
      }

      // Rate limit: wait between searches
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`Internet search error for paragraph ${candidate.index}:`, err.message);
    }
  }

  return results;
}

/**
 * Search the internet for a similar research title using DuckDuckGo.
 * Returns an array of { title, url, domain, snippet }.
 */
async function searchTitleOnline(title) {
  const results = [];
  try {
    const encoded = encodeURIComponent(title);
    const url = `https://html.duckduckgo.com/html/?q=${encoded}`;
    const html = await fetchUrl(url);

    // Parse result links — match <a> tags with both result__a class and uddg param
    // Handle any attribute order (rel, class, href can be in any order)
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="[^"]*uddg=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const resultUrl = decodeURIComponent(match[1]);
        const linkTitle = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (resultUrl.startsWith('http') && linkTitle.length > 5) {
          if (resultUrl.includes('duckduckgo.com/y.js') || resultUrl.includes('bing.com/aclick')) continue;
          const domain = new URL(resultUrl).hostname.replace('www.', '');
          results.push({ title: linkTitle, url: resultUrl, domain, snippet: '' });
        }
      } catch (e) { /* skip bad URLs */ }
    }

    // Fallback: if class comes after href
    if (results.length === 0) {
      const linkRegex2 = /<a[^>]*href="[^"]*uddg=([^&"]+)[^"]*"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
      while ((match = linkRegex2.exec(html)) !== null) {
        try {
          const resultUrl = decodeURIComponent(match[1]);
          const linkTitle = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
          if (resultUrl.startsWith('http') && linkTitle.length > 5) {
            if (resultUrl.includes('duckduckgo.com/y.js') || resultUrl.includes('bing.com/aclick')) continue;
            const domain = new URL(resultUrl).hostname.replace('www.', '');
            results.push({ title: linkTitle, url: resultUrl, domain, snippet: '' });
          }
        } catch (e) { /* skip */ }
      }
    }

    // Parse snippets
    const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/[a-z]/g;
    let si = 0;
    while ((match = snippetRegex.exec(html)) !== null && si < results.length) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (text.length > 20) {
        results[si].snippet = text;
      }
      si++;
    }
  } catch (err) {
    console.error('Title internet search error:', err.message);
  }
  // Deduplicate by domain
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.domain)) return false;
    seen.add(r.domain);
    return true;
  }).slice(0, 6);
}

module.exports = { searchInternetPlagiarism, searchTitleOnline };
