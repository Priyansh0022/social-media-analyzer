// frontend/src/components/AnalysisDisplay.js
import React from 'react';

export default function AnalysisDisplay({ data }) {
  if (!data) return null;
  const { text, analysis } = data;
  const safeAnalysis = analysis || {};
  const topWords = Array.isArray(safeAnalysis.topWords) ? safeAnalysis.topWords : [];
  const foundCTAs = Array.isArray(safeAnalysis.foundCTAs) ? safeAnalysis.foundCTAs : [];

  const getEngagementLevel = (score) => {
    if (score >= 80) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };

  const getSuggestions = (analysis) => {
    const suggestions = [];
    if (foundCTAs.length === 0) {
      suggestions.push('Add call-to-action words like "follow", "like", "subscribe", or "comment" to encourage engagement.');
    }
    if (!analysis || analysis.hashtagCount === 0) {
      suggestions.push('Include relevant hashtags to increase visibility.');
    }
    if (analysis && analysis.sentiment === 'Negative') {
      suggestions.push('Consider revising content to convey a more positive tone.');
    }
    if (!analysis || analysis.wordCount < 50) {
      suggestions.push('Expand your content for better engagement potential.');
    }
    return suggestions;
  };

  return (
    <div className="analysis-results">
      <h2>Content Analysis Results</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Word Count</h3>
          <div className="metric-value">{analysis?.wordCount ?? '—'}</div>
        </div>

        <div className="metric-card">
          <h3>Engagement Score</h3>
          <div className="metric-value">{analysis?.engagementScore ?? '—'}/100</div>
          <div className="metric-label">{getEngagementLevel(analysis?.engagementScore ?? 0)}</div>
        </div>

        <div className="metric-card">
          <h3>Sentiment</h3>
          <div className={`metric-value sentiment-${(analysis?.sentiment || 'unknown').toLowerCase()}`}>
            {analysis?.sentiment || 'Unknown'}
          </div>
        </div>

        <div className="metric-card">
          <h3>Hashtags</h3>
          <div className="metric-value">{analysis?.hashtagCount ?? '—'}</div>
        </div>
      </div>

      <div className="analysis-section">
        <h3>Top Keywords</h3>
        <div className="keyword-list">
          {topWords.length > 0 ? topWords.map((item) => (
            <span key={item.word} className="keyword-tag">
              {item.word} ({item.count})
            </span>
          )) : <span className="keyword-tag empty">No keywords detected yet.</span>}
        </div>
      </div>

      <div className="analysis-section">
        <h3>Call-to-Actions Detected</h3>
        {foundCTAs.length > 0 ? (
          <div className="cta-list">
            {foundCTAs.map(cta => (
              <span key={cta} className="cta-tag">{cta}</span>
            ))}
          </div>
        ) : (
          <p className="no-cta">No call-to-action words detected.</p>
        )}
      </div>

      <div className="analysis-section">
        <h3>Improvement Suggestions</h3>
        <ul className="suggestions-list">
          {getSuggestions(analysis).map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      </div>

      <div className="analysis-section">
        <h3>Extracted Text Preview</h3>
        <div className="text-preview">
          {text ? text.slice(0, 2000) + (text.length > 2000 ? '...' : '') : 'No text could be extracted from the file.'}
        </div>
      </div>
    </div>
  );
}
