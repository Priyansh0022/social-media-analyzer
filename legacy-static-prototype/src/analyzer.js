// Engagement Suggestions Engine
// Heuristic checks to suggest improvements for social posts.
window.ContentAnalyzer = (function () {
	function countHashtags(text) {
		const matches = text.match(/(^|\s)#\w+/g);
		return matches ? matches.length : 0;
	}
	function countMentions(text) {
		const matches = text.match(/(^|\s)@\w+/g);
		return matches ? matches.length : 0;
	}
	function countUrls(text) {
		const matches = text.match(/https?:\/\/[^\s)]+/gi);
		return matches ? matches.length : 0;
	}
	function hasEmoji(text) {
		// Basic emoji detection
		return /([\u203C-\u3299]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])/.test(text);
	}
	function endsWithCTA(text) {
		return /(follow|share|comment|like|retweet|repost|subscribe|check\s+the\s+link|learn\s+more)[.!?\s]*$/i.test(text.trim());
	}
	function isQuestionIncluded(text) {
		return /(\?|^|\s)(what|how|why|which|who|when|where)\b/i.test(text);
	}
	function sentenceCount(text) {
		const parts = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
		return parts.length;
	}
	function wordCount(text) {
		const words = text.trim().split(/\s+/).filter(Boolean);
		return words.length;
	}
	function hasNumbers(text) {
		return /\b\d+(\.\d+)?%?\b/.test(text);
	}

	function analyze(text) {
		const suggestions = [];
		const words = wordCount(text);
		const sentences = sentenceCount(text);
		const hashtags = countHashtags(text);
		const mentions = countMentions(text);
		const urls = countUrls(text);
		const emoji = hasEmoji(text);
		const question = isQuestionIncluded(text);
		const cta = endsWithCTA(text);
		const numbers = hasNumbers(text);

		// Length heuristics by platform (generic guidance)
		if (words < 12) {
			suggestions.push("Your copy is very short. Add context to increase clarity.");
		} else if (words > 220) {
			suggestions.push("Consider shortening to keep it scannable (aim < 200 words).");
		}
		if (sentences > 6) {
			suggestions.push("Break long paragraphs into shorter sentences for readability.");
		}

		// Hashtags and mentions
		if (hashtags === 0) {
			suggestions.push("Add 1–3 relevant #hashtags to increase discoverability.");
		} else if (hashtags > 6) {
			suggestions.push("Reduce hashtags to avoid spammy appearance (try 1–5).");
		}
		if (mentions === 0) {
			suggestions.push("Tag collaborators or brands using @mentions when relevant.");
		}

		// Links and CTAs
		if (urls === 0) {
			suggestions.push("If referencing resources, include a short link.");
		}
		if (!cta) {
			suggestions.push("End with a clear call-to-action (e.g., “Comment your thoughts”).");
		}

		// Engagement cues
		if (!question) {
			suggestions.push("Ask a question to invite responses and boost engagement.");
		}
		if (!emoji) {
			suggestions.push("Consider 1–2 tasteful emojis to add personality.");
		}
		if (!numbers) {
			suggestions.push("Cite specific numbers, stats, or results to build credibility.");
		}

		// Tone checks
		if (!/[.!?]$/.test(text.trim())) {
			suggestions.push("Finish with punctuation for a polished tone.");
		}

		return {
			metrics: { words, sentences, hashtags, mentions, urls, emoji, question, cta, numbers },
			suggestions
		};
	}

	return { analyze };
})();


