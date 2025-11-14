(function () {
	function setStatus(message, type) {
		const el = document.getElementById("status");
		if (!el) return;
		el.innerHTML = "";
		if (!message) return;
		const span = document.createElement("span");
		span.textContent = message;
		if (type) span.className = type;
		el.appendChild(span);
	}
	function setLoading(message) {
		const el = document.getElementById("status");
		if (!el) return;
		el.innerHTML = "";
		const div = document.createElement("div");
		div.className = "spinner";
		const span = document.createElement("span");
		span.textContent = message || "Processing...";
		div.appendChild(span);
		el.appendChild(div);
	}
	function setSuggestions(suggestions) {
		const list = document.getElementById("suggestions");
		if (!list) return;
		list.innerHTML = "";
		if (!suggestions || suggestions.length === 0) {
			const li = document.createElement("li");
			li.textContent = "No suggestions. Looks great!";
			list.appendChild(li);
			return;
		}
		for (const s of suggestions) {
			const li = document.createElement("li");
			li.textContent = s;
			list.appendChild(li);
		}
	}
	function getExtractedText() {
		const ta = document.getElementById("extractedText");
		return ta ? ta.value : "";
	}
	function setExtractedText(text) {
		const ta = document.getElementById("extractedText");
		if (ta) ta.value = text || "";
	}
	function copyExtractedText() {
		const text = getExtractedText();
		if (!text) return;
		navigator.clipboard.writeText(text).then(() => {
			setStatus("Copied text to clipboard", "ok");
			setTimeout(() => setStatus("", ""), 1500);
		}).catch(() => {
			setStatus("Could not copy to clipboard", "err");
		});
	}

	window.UI = {
		setStatus,
		setLoading,
		setSuggestions,
		getExtractedText,
		setExtractedText,
		copyExtractedText
	};
})();


