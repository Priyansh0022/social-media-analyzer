// frontend/src/components/FileUploader.js
import React, { useState, useRef, useCallback } from 'react';
import AnalysisDisplay from './AnalysisDisplay';

export default function FileUploader() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  // Utilities ---------------------------------------------------------------
  const isPdf = (f) => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const isImage = (f) => f && /^image\//.test(f.type);

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.type = 'text/javascript';
      s.crossOrigin = 'anonymous';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });

  async function ensurePdfJs() {
    const sources = [
      {
        version: '4.4.168',
        script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.js',
        worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js'
      },
      {
        version: '3.11.174',
        script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      },
      {
        version: '2.16.105',
        script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
        worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
      }
    ];
    if (!window.pdfjsLib) {
      let lastErr = null;
      for (const s of sources) {
        try {
          await loadScript(s.script);
          // success
          try {
            if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = s.worker;
            }
          } catch (_) {}
          return window.pdfjsLib;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('Failed to load pdf.js');
    } else {
      // Already present; ensure worker
      try {
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            sources[0].worker;
        }
      } catch (_) {}
      return window.pdfjsLib;
    }
  }

  let tesseractConfig = null;
  async function ensureTesseract() {
    const sources = [
      {
        version: '4.0.2',
        script: 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js',
        worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/worker.min.js',
        coreJs: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4.0.2/tesseract-core-simd.wasm.js',
        wasm: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4.0.2/tesseract-core-simd.wasm'
      },
      {
        version: '3.0.2',
        script: 'https://cdn.jsdelivr.net/npm/tesseract.js@3.0.2/dist/tesseract.min.js',
        worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@3.0.2/dist/worker.min.js',
        coreJs: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@3.0.1/tesseract-core.wasm.js',
        wasm: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@3.0.1/tesseract-core.wasm'
      }
    ];
    if (!window.Tesseract) {
      let lastErr = null;
      for (const cfg of sources) {
        try {
          await loadScript(cfg.script);
          tesseractConfig = cfg;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!window.Tesseract) {
        throw lastErr || new Error('Failed to load OCR library');
      }
    }
    if (!tesseractConfig) {
      tesseractConfig = sources.find((cfg) => cfg.version && cfg.worker) || sources[0];
    }
    return { Tesseract: window.Tesseract, config: tesseractConfig };
  }

  async function extractTextFromPdf(f) {
    const pdfjsLib = await ensurePdfJs();
    const buf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const maxPages = Math.min(pdf.numPages, 50);
    let fullText = '';
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map((it) => (typeof it.str === 'string' ? it.str : '')).filter(Boolean);
      const pageText = strings.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (pageText) fullText += (fullText ? '\n\n' : '') + pageText;
    }
    return fullText;
  }

  async function extractTextFromImage(f) {
    const { Tesseract, config } = await ensureTesseract();
    const { createWorker } = Tesseract;
    const langCode = 'eng';
    const langSources = [
      'https://tessdata.projectnaptha.com/5',
      'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/5',
      'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0',
      'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main'
    ];
    let lastErr = null;
    for (const langPath of langSources) {
      let worker;
      try {
        const workerOptions = {
          workerPath: config.worker,
          corePath: config.coreJs,
          langPath
        };
        if (config.wasm) {
          workerOptions.wasmPath = config.wasm;
        }
        worker = await createWorker(workerOptions);
        await worker.loadLanguage(langCode);
        await worker.initialize(langCode);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
          reader.readAsDataURL(f);
        });
        const ret = await worker.recognize(dataUrl);
        return ret?.data?.text || '';
      } catch (e) {
        lastErr = e;
      } finally {
        if (worker) { try { await worker.terminate(); } catch (_) {} }
      }
    }
    throw lastErr || new Error('OCR failed. Unable to download language data.');
  }

  function normalizeWhitespace(text) {
    return (text || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function analyzeText(text) {
    const t = text || '';
    const words = t.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const hashtagCount = (t.match(/(^|\s)#\w+/g) || []).length;
    const ctas = ['follow','share','comment','like','subscribe','retweet','repost','learn more','check the link'];
    const foundCTAs = ctas.filter(c => new RegExp(`\\b${c.replace(' ', '\\s+')}\\b`, 'i').test(t));
    const freq = new Map();
    const stop = new Set(['the','a','an','and','or','for','to','of','in','on','with','is','are','it','this','that','be','as','at','by','from','we','you','our','your']);
    for (const w of words.map(w => w.toLowerCase().replace(/[^\w#@]/g,''))) {
      if (!w || stop.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    const topWords = Array.from(freq.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    const pos = ['great','good','love','awesome','win','happy','success','best','improve'];
    const neg = ['bad','fail','hate','problem','sad','issue','worst','bug'];
    const posHits = pos.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(t)).length;
    const negHits = neg.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(t)).length;
    const sentiment = posHits >= negHits ? 'Positive' : 'Negative';
    let engagementScore = 50;
    if (hashtagCount > 0) engagementScore += 10;
    if (foundCTAs.length > 0) engagementScore += 15;
    if (wordCount >= 50 && wordCount <= 220) engagementScore += 10;
    engagementScore = Math.max(0, Math.min(100, engagementScore));
    return {
      text: t,
      analysis: {
        wordCount,
        engagementScore,
        sentiment,
        hashtagCount,
        topWords,
        foundCTAs
      }
    };
  }

  const handleFileChange = useCallback((e) => {
    setError('');
    setResult(null);
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setError('');
      setResult(null);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let text = '';
      if (isPdf(file)) {
        text = await extractTextFromPdf(file);
      } else if (isImage(file)) {
        text = await extractTextFromImage(file);
      } else {
        throw new Error('Unsupported file. Please upload a PDF or image.');
      }
      text = normalizeWhitespace(text);
      const data = analyzeText(text);
      setResult(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError((err && err.message) ? err.message : 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = null;
  };

  return (
    <div className="upload-container">
      <form onSubmit={handleSubmit}>
        <label
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className="drop-zone-content">
            <div className="drop-icon">📁</div>
            <div className="drop-text">
              <strong>Drag & drop</strong> your file here or <span className="click-text">click to browse</span>
            </div>
            <div className="file-types">Supported: PDF, PNG, JPG, JPEG</div>
            {file && <div className="selected-file">Selected: {file.name}</div>}
          </div>
        </label>

        <div className="action-buttons">
          <button type="submit" disabled={loading || !file} className="upload-btn">
            {loading ? 'Analyzing...' : 'Upload & Analyze'}
          </button>
          <button type="button" onClick={clearAll} className="clear-btn">Clear</button>
        </div>
      </form>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Processing your file... This may take a moment for images.</p>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
      {result && <AnalysisDisplay data={result} />}
    </div>
  );
}
