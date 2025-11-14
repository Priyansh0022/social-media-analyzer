(function () {
	const dropzone = document.getElementById("dropzone");
	const fileInput = document.getElementById("fileInput");
	const fileButton = document.getElementById("fileButton");
	const analyzeBtn = document.getElementById("analyzeBtn");
	const copyTextBtn = document.getElementById("copyTextBtn");

	// Setup pdf.js worker if available
	if (window["pdfjsLib"]) {
		// Explicitly set workerSrc to avoid network errors when CDN path inference fails
		try {
			if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
				pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js";
			}
		} catch (_) {}
	}

	function isPdf(file) {
		return file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
	}
	function isImage(file) {
		return file && /^image\//.test(file.type);
	}

	function bindDropzone() {
		const onDrop = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.remove("dragover");
			const files = e.dataTransfer?.files;
			if (!files || files.length === 0) return;
			await handleFile(files[0]);
		};
		const onDragOver = (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.add("dragover");
		};
		const onDragLeave = (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.remove("dragover");
		};
		dropzone.addEventListener("drop", onDrop);
		dropzone.addEventListener("dragover", onDragOver);
		dropzone.addEventListener("dragleave", onDragLeave);
		dropzone.addEventListener("dragend", onDragLeave);
		// Keyboard activation
		dropzone.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") fileInput.click();
		});
	}

	function bindPicker() {
		fileButton.addEventListener("click", () => fileInput.click());
		fileInput.addEventListener("change", async (e) => {
			const files = e.target.files;
			if (!files || files.length === 0) return;
			await handleFile(files[0]);
			fileInput.value = "";
		});
	}

	function bindActions() {
		analyzeBtn.addEventListener("click", () => {
			const text = UI.getExtractedText();
			const res = window.ContentAnalyzer.analyze(text || "");
			UI.setSuggestions(res.suggestions);
		});
		copyTextBtn.addEventListener("click", () => {
			UI.copyExtractedText();
		});
	}

	async function handleFile(file) {
		try {
			if (!file) return;
			if (!(isPdf(file) || isImage(file))) {
				UI.setStatus("Unsupported file. Please upload a PDF or image.", "err");
				return;
			}
			UI.setLoading("Analyzing file...");
			UI.setExtractedText("");
			UI.setSuggestions([]);

			let text = "";
			if (isPdf(file)) {
				text = await extractTextFromPdf(file);
			} else {
				text = await extractTextFromImage(file);
			}
			text = normalizeWhitespace(text);
			UI.setExtractedText(text);

			const res = window.ContentAnalyzer.analyze(text || "");
			UI.setSuggestions(res.suggestions);
			UI.setStatus("Analysis complete.", "ok");
		} catch (err) {
			console.error(err);
			const msg = (err && err.message) ? err.message : "Processing failed.";
			// Common friendly hints
			const hint =
				isPdf(file)
					? "PDF parse error. If the PDF is encrypted or corrupted, text may not extract."
					: "OCR error. Check your connection in case the OCR model download failed.";
			UI.setStatus(`${msg} ${hint}`, "err");
		}
	}

	function normalizeWhitespace(text) {
		return (text || "")
			.replace(/\r/g, "")
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}

	async function extractTextFromPdf(file) {
		const arrayBuf = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
		const maxPages = Math.min(pdf.numPages, 50);
		let fullText = "";
		for (let p = 1; p <= maxPages; p++) {
			const page = await pdf.getPage(p);
			const content = await page.getTextContent();
			const strings = content.items.map((it) => (typeof it.str === "string" ? it.str : "")).filter(Boolean);
			const pageText = strings.join(" ").replace(/\s{2,}/g, " ").trim();
			if (pageText) {
				fullText += (fullText ? "\n\n" : "") + pageText;
			}
		}
		return fullText;
	}

	async function extractTextFromImage(file) {
		const { createWorker } = Tesseract;
		// Try primary tessdata host, then fall back to a reliable mirror if it fails
		const langCode = "eng";
		const langSources = [
			"https://tessdata.projectnaptha.com/5", // primary
			"https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/5" // fallback mirror
		];
		let lastError = null;
		for (const langPath of langSources) {
			let worker;
			try {
				worker = await createWorker({
					langPath
				});
				await worker.loadLanguage(langCode);
				await worker.initialize(langCode);
				const ret = await worker.recognize(file);
				return ret?.data?.text || "";
			} catch (err) {
				lastError = err;
				// Try next mirror
			} finally {
				if (worker) {
					try { await worker.terminate(); } catch (_) {}
				}
			}
		}
		throw lastError || new Error("OCR failed");
	}

	// init
	bindDropzone();
	bindPicker();
	bindActions();
})();


