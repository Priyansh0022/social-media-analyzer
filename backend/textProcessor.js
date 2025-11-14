// backend/textProcessor.js
const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const { createWorker } = require('tesseract.js');

// Custom stopwords list (expanded for social media context)
const STOPWORDS = [
  "a", "an", "the", "and", "or", "but", "if", "in", "on", "with", "to", "for", "of", "is", "are", "was", "were", "be", "by", "this", "that", "it", "as", "at", "from",
  "i", "you", "he", "she", "we", "they", "me", "my", "your", "his", "her", "our", "their", "us", "them", "what", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
];

// Expanded positive/negative word lists for sentiment analysis
const POSITIVE_WORDS = ['good', 'great', 'excellent', 'happy', 'love', 'like', 'success', 'improve', 'positive', 'best', 'awesome', 'amazing', 'fantastic', 'wonderful', 'brilliant', 'perfect', 'outstanding', 'superb', 'delightful', 'joyful', 'pleased', 'satisfied', 'thrilled', 'excited', 'proud', 'grateful', 'blessed', 'fortunate', 'lucky', 'cheerful'];
const NEGATIVE_WORDS = ['bad', 'poor', 'failed', 'sad', 'hate', 'problem', 'negative', 'worse', 'issue', 'angry', 'terrible', 'awful', 'horrible', 'disgusting', 'annoying', 'frustrating', 'disappointing', 'upset', 'worried', 'stressed', 'depressed', 'miserable', 'unhappy', 'dissatisfied', 'regretful', 'sorry', 'guilty', 'ashamed', 'embarrassed', 'humiliated'];

const TESSERACT_CACHE_DIR = path.join(__dirname, '.tesseract-cache');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Extracts text from PDF files
 * @param {string} filePath - Path to the PDF file
 * @returns {string} Extracted text
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text || '';
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

/**
 * Extracts text from image files using OCR
 * @param {string} filePath - Path to the image file
 * @returns {string} Extracted text
 */
async function extractTextFromImage(filePath) {
  await ensureDir(TESSERACT_CACHE_DIR);
  const worker = createWorker({
    langPath: path.join(__dirname),
    cachePath: TESSERACT_CACHE_DIR
  });
  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(filePath);
    return text || '';
  } catch (error) {
    throw new Error('Failed to extract text from image: ' + error.message);
  } finally {
    if (worker && typeof worker.terminate === 'function') {
      await worker.terminate();
    }
  }
}

/**
 * Analyzes extracted text for social media insights
 * @param {string} text - The text to analyze
 * @returns {object} Analysis results
 */
function analyzeContent(text) {
  const normalized = text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').toLowerCase();
  const tokens = normalized.match(/\b[a-z0-9#@']+\b/g) || [];

  // Word count
  const wordCount = tokens.length;

  // Frequency map excluding stopwords and single characters
  const freq = {};
  tokens.forEach(tok => {
    if (tok.length <= 1) return;
    if (STOPWORDS.includes(tok)) return;
    freq[tok] = (freq[tok] || 0) + 1;
  });

  // Top words
  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Sentiment analysis
  const posCount = tokens.filter(t => POSITIVE_WORDS.includes(t)).length;
  const negCount = tokens.filter(t => NEGATIVE_WORDS.includes(t)).length;
  let sentiment = 'Neutral';
  if (posCount > negCount + 1) sentiment = 'Positive';
  if (negCount > posCount + 1) sentiment = 'Negative';

  // Call-to-action detection
  const ctaWords = ['follow', 'like', 'subscribe', 'comment', 'share', 'dm', 'visit', 'join', 'click', 'buy', 'learn', 'watch'];
  const foundCTAs = ctaWords.filter(c => tokens.includes(c));

  // Hashtag count
  const hashtagCount = tokens.filter(t => t.startsWith('#')).length;

  // Engagement score (simple heuristic)
  const engagementScore = Math.min(100, (foundCTAs.length * 20) + (hashtagCount * 10) + (sentiment === 'Positive' ? 20 : 0) + (wordCount > 50 ? 10 : 0));

  return {
    wordCount,
    topWords: topWords.slice(0, 5),
    sentiment,
    foundCTAs,
    hashtagCount,
    engagementScore
  };
}

/**
 * Main function to process file and analyze content
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimetype - MIME type of the file
 * @returns {object} Processing results
 */
async function processAndEvaluateContent(filePath, mimetype) {
  try {
    let text = '';
    if (mimetype === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      text = await extractTextFromPDF(filePath);
    } else if (mimetype.startsWith('image/') || /\.(png|jpe?g|bmp|tiff)$/i.test(filePath)) {
      text = await extractTextFromImage(filePath);
    } else {
      // For text files, read directly
      text = await fs.readFile(filePath, 'utf8');
    }

    // Perform analysis
    const analysis = analyzeContent(text);

    // Clean up uploaded file
    fs.unlink(filePath).catch(() => {});

    return { text, analysis };
  } catch (err) {
    throw err;
  }
}

module.exports = {
  processAndEvaluateContent
};
