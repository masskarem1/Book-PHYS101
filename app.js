// =======================
// Flipbook App - Full JS
// Merged Version
// =======================

// --- Global Variables ---
let currentPage = 1; // 1-based indexing
let totalPages = (typeof config !== 'undefined' && config.totalPages) ? config.totalPages : 1;
let isDrawing = false;
let isDrawModeOn = false; // Toggles the whole draw UI
let toolType = "highlight"; // highlight | pen | eraser
let currentHighlightColor = 'rgba(255, 255, 0, 0.2)';
let currentBrushSize = 40;
let lastX = 0, lastY = 0;

// --- Data & Config ---
let ALLOWED_IDS = [];
let bookTextData = {};
const imagePath = (typeof config !== 'undefined' && config.imagePath) ? config.imagePath : './images/Book_PHYS101_';
const thumbPath = (typeof config !== 'undefined' && config.thumbPath) ? config.thumbPath : './thumbs/Book_PHYS101_';
const images = Array.from({ length: totalPages }, (_, i) => `${imagePath}${i}.png`);
const thumbs = Array.from({ length: totalPages }, (_, i) => `${thumbPath}${i}.jpg`);
const APPS_SCRIPT_PROXY_URL = (typeof config !== 'undefined' && config.appsScriptProxyUrl) ? config.appsScriptProxyUrl : '';

// --- DOM Elements ---
let flipbook, thumbbar, counter, pageInput, footer, indexToggle, indexMenu, indexSidebar, bookContainer;
let phetModal, phetBtn, phetCloseBtn, phetFrame, videoModal, videoBtn, videoCloseBtn, videoFrame;
let toggleDrawModeBtn, highlightSettingsBtn, highlightPopup, colorSwatchesContainer, penToolBtnPopup, highlightToolBtn, eraserToolBtnPopup, brushSizeSliderPopup, clearHighlightsBtnPopup;
let searchBtn, searchContainer, searchInput, searchCloseBtn, searchResults;
let aiModal, aiHelperToggle, aiCloseBtn, aiResponseEl, aiLoadingEl, aiChapterTitleEl;
let highlightCanvas, ctx;

// --- State Variables ---
let hammerManager = null;
let currentScale = 1, currentOffsetX = 0, currentOffsetY = 0, pinchStartScale = 1, isPinching = false;
let pageInputTimer = null;

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    console.log("📘 Flipbook app initializing...");

    // Assign all DOM elements
    assignDOMElements();

    // Start async setup
    initApp();

    // Setup all interactive components
    setupLogin();
    setupToolbar();
    setupSidebarToggle(); // Use new simple sidebar
    setupModals();
    setupAIHelper();
    setupHighlightTools();
    setupSearch();
    setupGlobalListeners();
});

/**
 * Assigns all global DOM element variables
 */
function assignDOMElements() {
    flipbook = document.getElementById("flipbook");
    thumbbar = document.getElementById("thumbbar");
    counter = document.getElementById("pageCounter");
    pageInput = document.getElementById("pageInput");
    footer = document.getElementById("footer");
    indexToggle = document.getElementById("indexToggle");
    indexMenu = document.getElementById("indexMenu");
    indexSidebar = document.getElementById('indexSidebar');
    bookContainer = document.querySelector('.book-container');

    phetModal = document.getElementById('phetModal');
    phetBtn = document.getElementById('phetBtn');
    phetCloseBtn = document.getElementById('phetCloseBtn');
    phetFrame = document.getElementById('phetFrame');
    videoModal = document.getElementById('videoModal');
    videoBtn = document.getElementById('videoBtn');
    videoCloseBtn = document.getElementById('videoCloseBtn');
    videoFrame = document.getElementById('videoFrame');

    toggleDrawModeBtn = document.getElementById('toggle-draw-mode-btn');
    highlightSettingsBtn = document.getElementById('highlight-settings-btn');
    highlightPopup = document.getElementById('highlight-popup');
    colorSwatchesContainer = document.querySelector('.color-swatches');
    penToolBtnPopup = document.getElementById('pen-tool-btn-popup');
    highlightToolBtn = document.getElementById('highlight-tool-btn');
    eraserToolBtnPopup = document.getElementById('eraser-tool-btn-popup');
    brushSizeSliderPopup = document.getElementById('brush-size-popup');
    clearHighlightsBtnPopup = document.getElementById('clear-highlights-btn-popup');

    searchBtn = document.getElementById('searchBtn');
    searchContainer = document.getElementById('searchContainer');
    searchInput = document.getElementById('searchInput');
    searchCloseBtn = document.getElementById('searchCloseBtn');
    searchResults = document.getElementById('searchResults');

    aiModal = document.getElementById("aiHelperModal");
    aiHelperToggle = document.getElementById("aiHelperToggle");
    aiCloseBtn = document.getElementById("aiCloseBtn");
    aiResponseEl = document.getElementById("aiResponse");
    aiLoadingEl = document.getElementById("aiLoading");
    aiChapterTitleEl = document.getElementById("aiChapterTitle");
}

/**
 * Main async app setup
 */
async function initApp() {
    loadPreferences();
    
    // Await critical data
    await loadBookText();
    await loadChapters(); // Loads into config.chapters
    
    // Render dynamic content
    renderIndex();
    renderThumbs();
    renderPage(); // Render the loaded page

    // Update UI with loaded data/prefs
    if (counter) counter.textContent = `Page ${currentPage} / ${totalPages}`;
    if (pageInput) { pageInput.max = totalPages; pageInput.value = currentPage; }
    if (brushSizeSliderPopup) brushSizeSliderPopup.value = currentBrushSize;
    
    let savedColor = localStorage.getItem('flipbook-lastColor');
    let activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${savedColor}"]`);
    if (!activeSwatch && colorSwatchesContainer) {
        activeSwatch = colorSwatchesContainer.querySelector('.color-swatch'); // Fallback to first
    }
    setActiveColorSwatch(activeSwatch);
    setDrawMode(toolType);
}

// --- Login System ---
function setupLogin() {
    if (typeof config !== 'undefined' && config.requireLogin === true) {
        loadIDs();
        const lockScreen = document.getElementById('lockScreen');
        if (lockScreen) lockScreen.style.display = 'flex';
    }

    const unlockBtn = document.getElementById('unlockBtn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            const idInput = document.getElementById("idInput");
            const entered = idInput ? idInput.value.trim() : "";
            const idError = document.getElementById("idError");
            if (!idError) return;
            idError.style.display = 'none';
            if (!entered) {
                idError.textContent = 'Please enter an ID';
                idError.style.display = 'block';
                return;
            }
            if (ALLOWED_IDS.includes(entered)) {
                const lockScreen = document.getElementById("lockScreen");
                if (lockScreen) lockScreen.style.display = "none";
            } else {
                idError.textContent = 'Invalid ID';
                idError.style.display = 'block';
            }
        });
    }
}

async function loadIDs() {
    try {
        const res = await fetch("./students.json");
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();
        ALLOWED_IDS = Array.isArray(data) ? data : (Array.isArray(data.allowed) ? data.allowed : []);
    } catch (err) {
        console.error("Could not load student IDs:", err);
        ALLOWED_IDS = [];
    }
}

// --- Data Loading ---
async function loadBookText() {
    try {
        const res = await fetch("./book-text.json");
        if (!res.ok) throw new Error("book-text.json not found");
        bookTextData = await res.json();
        console.log("Book text loaded successfully.");
        if (searchBtn) searchBtn.disabled = false;
    } catch (err) {
        console.error("Could not load book text:", err);
        if (searchBtn) searchBtn.disabled = true;
    }
}

async function loadChapters() {
    try {
        const res = await fetch("./chapters.json"); 
        if (!res.ok) throw new Error("chapters.json not found");
        config.chapters = await res.json();
        console.log("Chapters loaded successfully.");
    } catch (err) {
        console.error("Could not load chapters:", err);
        config.chapters = [];
    }
}

// --- Page Rendering ---
function renderPage() {
    if (!flipbook) return;
    flipbook.innerHTML = "";
    const pageIndex = currentPage - 1; // Convert 1-based to 0-based
    
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.id = "page-wrap-" + pageIndex;
    resetZoomPan(wrap);
    
    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    canvas.id = "highlight-canvas";
    highlightCanvas = canvas;
    
    img.className = "page-image";
    if (images[pageIndex]) {
        img.src = images[pageIndex];
    } else {
        console.error(`Image not found for page index: ${pageIndex}`);
        img.src = ""; // Set to empty to trigger onerror
    }
    img.alt = `Page ${currentPage}`;
    img.loading = "eager";
    img.crossOrigin = "anonymous";
    
    img.onerror = () => { img.alt = "Image not available"; img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='24' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E"; };
    img.onload = () => {
        sizeCanvasToImage(img, canvas);
        ctx = canvas.getContext('2d');
        setupDrawingListeners(canvas);
        loadHighlights(pageIndex);
        updateCursor();
        setupHammer(wrap);
    };
    
    wrap.appendChild(img);
    wrap.appendChild(canvas);
    flipbook.appendChild(wrap);
    
    if (counter) counter.textContent = `Page ${currentPage} / ${totalPages}`;
    if (pageInput) pageInput.value = currentPage;
    
    highlightThumb();
    
    // Show/hide PhET/Video buttons
    const simConfig = config.simulations && config.simulations.find(s => s.page === currentPage);
    if (phetBtn) phetBtn.style.display = simConfig ? 'inline-block' : 'none';
    const videoConfig = config.videos && config.videos.find(v => v.page === currentPage);
    if (videoBtn) videoBtn.style.display = videoConfig ? 'inline-block' : 'none';
    
    closeSearchBox();
    closeHighlightPopup();
    preloadImages();
    
    try { localStorage.setItem('flipbook-lastPage', pageIndex.toString()); }
    catch (e) { console.warn("Could not save last page:", e); }
}

function renderThumbs() {
    if (!thumbbar) return;
    thumbbar.innerHTML = "";
    thumbs.forEach((src, i) => {
        const t = document.createElement("img");
        t.src = src; t.alt = `Thumb ${i + 1}`; t.loading = "lazy";
        t.addEventListener("click", () => {
            goToPage(i + 1); // Use 1-based index
        });
        t.onerror = () => { t.alt = "Thumb N/A"; t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E"; };
        thumbbar.appendChild(t);
    });
}

function renderIndex() {
    if (!indexMenu) { console.error("Index menu element not found!"); return; }
    indexMenu.innerHTML = "";
    if (!config.chapters || config.chapters.length === 0) {
        indexMenu.innerHTML = "<div class='chapter'><span>No chapters loaded.</span></div>";
        return;
    }

    config.chapters.forEach((chapter) => {
        const chapterDiv = document.createElement("div");
        chapterDiv.className = "chapter";
        const chapterHeader = document.createElement("div");
        chapterHeader.className = "chapter-header";
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "toggle-btn"; toggleBtn.textContent = "▸";
        const titleSpan = document.createElement("span");
        titleSpan.textContent = chapter.title;
        
        chapterHeader.appendChild(toggleBtn);
        chapterHeader.appendChild(titleSpan);
        chapterDiv.appendChild(chapterHeader);

        const subsectionsList = document.createElement("div");
        subsectionsList.className = "subsections-list";

        if (chapter.subsections && chapter.subsections.length > 0) {
            chapter.subsections.forEach((sub) => {
                const subDiv = document.createElement("div");
                subDiv.className = "subsection";
                subDiv.textContent = sub.title;
                subDiv.onclick = () => {
                    goToPage(sub.page);
                    closeSidebar();
                };
                subsectionsList.appendChild(subDiv);
            });
            chapterDiv.appendChild(subsectionsList);
        }

        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const list = chapterDiv.querySelector(".subsections-list");
            if (!list) return;
            const isVisible = list.classList.toggle("visible");
            toggleBtn.textContent = isVisible ? "▾" : "▸";
        };

        titleSpan.onclick = () => {
            goToPage(chapter.page || 1);
            closeSidebar();
        };
        indexMenu.appendChild(chapterDiv);
    });
}

function preloadImages() {
    const nextPageIndex = currentPage; // currentPage is 1-based, so index is currentPage
    const prevPageIndex = currentPage - 2;
    if (nextPageIndex < images.length) (new Image).src = images[nextPageIndex];
    if (prevPageIndex >= 0) (new Image).src = images[prevPageIndex];
}

function highlightThumb() {
    if (!thumbbar) return;
    let activeThumb = null;
    thumbbar.querySelectorAll("img").forEach((im, i) => {
        const isActive = (i === (currentPage - 1)); // Compare 0-index to 1-based
        im.classList.toggle("active", isActive);
        if (isActive) activeThumb = im;
    });
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// --- Page Navigation ---
function firstPage() { goToPage(1); }
function lastPage() { goToPage(totalPages); }
function prevPage() { goToPage(Math.max(1, currentPage - 1)); }
function nextPage() { goToPage(Math.min(totalPages, currentPage + 1)); }

function goToPage(pageNum) {
    if (!pageNum || isNaN(pageNum)) {
        console.warn(`Invalid page number: ${pageNum}`);
        return;
    }
    const newPage = Math.max(1, Math.min(parseInt(pageNum, 10), totalPages));
    if (newPage !== currentPage) {
        currentPage = newPage;
        renderPage();
    } else {
        // If the number is the same, just update the input box
        if(pageInput) pageInput.value = newPage;
    }
}

function jumpToPage() {
    if (pageInputTimer) { clearTimeout(pageInputTimer); pageInputTimer = null; }
    if (!pageInput) return;
    const v = parseInt(pageInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages) {
        goToPage(v);
    } else {
        pageInput.value = currentPage; // Reset to current page
    }
}

// --- Toolbar Setup ---
function setupToolbar() {
    // Navigation buttons are wired globally by HTML onclick
    pageInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { jumpToPage(); e.preventDefault(); pageInput.blur(); }
    });
    pageInput?.addEventListener('keyup', (e) => {
        if (e.key >= "0" && e.key <= "9") resetPageInputTimer();
    });
    
    // Fullscreen and Share are wired globally by HTML onclick
}

// --- Sidebar Slide Logic ---
function setupSidebarToggle() {
    if (!indexToggle || !indexSidebar || !bookContainer) {
        console.error("Sidebar elements not found in DOM.");
        return;
    }

    // Ensure sidebar starts hidden
    indexSidebar.classList.remove("open");
    bookContainer.classList.remove("shifted");
    indexToggle.setAttribute("aria-expanded", "false");

    indexToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = indexSidebar.classList.toggle("open");
        indexToggle.setAttribute("aria-expanded", isOpen);
        bookContainer.classList.toggle("shifted", isOpen);
    });
}

function openSidebar() {
    if (indexSidebar && !indexSidebar.classList.contains("open")) {
        indexSidebar.classList.add("open");
        if (indexToggle) indexToggle.setAttribute("aria-expanded", "true");
        if (bookContainer) bookContainer.classList.add("shifted");
    }
}

function closeSidebar() {
    if (indexSidebar && indexSidebar.classList.contains("open")) {
        indexSidebar.classList.remove("open");
        if (indexToggle) indexToggle.setAttribute("aria-expanded", "false");
        if (bookContainer) bookContainer.classList.remove("shifted");
    }
}
// --- End Sidebar Logic ---

// --- Modals (PhET, Video) ---
function setupModals() {
    if (phetBtn) phetBtn.addEventListener("click", openPhetModal);
    if (phetCloseBtn) phetCloseBtn.addEventListener("click", closePhetModal);
    if (phetModal) phetModal.addEventListener("click", e => { if (e.target === phetModal) closePhetModal() });

    if (videoBtn) videoBtn.addEventListener("click", openVideoModal);
    if (videoCloseBtn) videoCloseBtn.addEventListener("click", closeVideoModal);
    if (videoModal) videoModal.addEventListener("click", e => { if (e.target === videoModal) closeVideoModal() });
}

function openPhetModal() {
    const sim = config.simulations && config.simulations.find(e => e.page === currentPage);
    if (sim && sim.url) {
        if (phetFrame) phetFrame.src = sim.url;
        if (phetModal) phetModal.style.display = "flex";
    } else {
        alert("No simulation found for this page.");
    }
}
function closePhetModal() {
    if (phetModal) phetModal.style.display = "none";
    if (phetFrame) phetFrame.src = "about:blank";
}
function openVideoModal() {
    const vid = config.videos && config.videos.find(e => e.page === currentPage);
    if (vid && vid.url) {
        if (videoFrame) videoFrame.src = getYoutubeEmbedUrl(vid.url);
        if (videoModal) videoModal.style.display = "flex";
    } else {
        alert("No video found for this page.");
    }
}
function closeVideoModal() {
    if (videoModal) videoModal.style.display = "none";
    if (videoFrame) videoFrame.src = "about:blank";
}

// --- AI Helper Modal ---
function setupAIHelper() {
    aiHelperToggle?.addEventListener("click", () => {
        const chapter = getCurrentChapter();
        if (aiChapterTitleEl) aiChapterTitleEl.textContent = chapter ? chapter.title : "Current Page";
        if (aiResponseEl) { aiResponseEl.innerHTML = ""; aiResponseEl.classList.remove('rtl-text'); }
        if (aiModal) aiModal.style.display = "flex";
    });
    aiCloseBtn?.addEventListener("click", () => { if (aiModal) aiModal.style.display = "none" });
    aiModal?.addEventListener("click", e => { if (e.target === aiModal) aiModal.style.display = "none" });
}

async function getAiHelp(type) {
    if (!APPS_SCRIPT_PROXY_URL) {
        if (aiResponseEl) aiResponseEl.textContent = "AI Helper not configured: Proxy URL missing.";
        return;
    }
    if (!aiLoadingEl || !aiResponseEl) return;
    aiLoadingEl.style.display = "block";
    aiResponseEl.innerHTML = "";
    aiResponseEl.classList.remove('rtl-text');

    let requestBody;
    const chapter = getCurrentChapter();
    const chapterTitle = chapter ? chapter.title : "this page";

    try {
        if (type === "analyze_page") {
            let imgBase64 = await getImageAsBase64FromCanvas();
            if (!imgBase64) {
                aiResponseEl.textContent = "Could not process page image.";
                aiLoadingEl.style.display = "none";
                return;
            }
            requestBody = { contents: [{ parts: [{ text: `Analyze this physics page (from chapter "${chapterTitle}"). Summarize concepts,explain formulas/diagrams,and give a takeaway for a life science student.` }, { inline_data: { mime_type: "image/png", data: imgBase64 } }] }] };
        } else {let promptText;
            switch (type) {
                case "explain":
                    const concept = window.prompt(`Concept from "${chapterTitle}" to explain?`, "Pascal's Principle");
                    if (!concept) { aiLoadingEl.style.display = "none"; return; }
                    promptText = `Explain "${concept}" from "${chapterTitle}" simply for life science students.`;
                    break;
                case "quiz":
                    promptText = `Generate 2 multiple-choice questions on "${chapterTitle}". Explain the correct answer (bold it).`;
                    break;
                case "relate":
                    promptText = `Provide 2 examples of how "${chapterTitle}" applies to biology or medicine.`;
                    break;
                default:
                    aiLoadingEl.style.display = "none"; return;
            }
            requestBody = { contents: [{ parts: [{ text: promptText }] }] };
        }

        const fetchOptions = { method: "POST", body: JSON.stringify(requestBody), headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        const response = await fetchWithRetry(APPS_SCRIPT_PROXY_URL, fetchOptions);

        if (!response.ok) {
            let errorMsg = `Proxy Error (${response.status}): ${response.statusText}`;
            try { const errorData = await response.json(); errorMsg = (errorData.error && errorData.error.message) ? `API Error via Proxy: ${errorData.error.message}` : errorMsg; } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        const responseData = await response.json();
        if (responseData.error && responseData.error.message) { throw new Error(`API Error via Proxy: ${responseData.error.message}`); }
        
        const resultText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) {
            "undefined" != typeof marked ? aiResponseEl.innerHTML = marked.parse(resultText) : aiResponseEl.innerText = resultText;
            window.MathJax && MathJax.typesetPromise([aiResponseEl]).catch(e => console.error("MathJax error:", e));
        } else {
            let reason = responseData.candidates?.[0]?.finishReason || "Unknown";
            console.warn("AI response missing content. Reason:", reason, responseData);
            aiResponseEl.textContent = `Response was blocked or empty. Reason: ${reason}.`;
        }
    } catch (err) {
        console.error("AI Helper Error:", err);
        aiResponseEl.textContent = `Error: ${err.message}`;
    } finally {
        aiLoadingEl.style.display = "none";
    }
}

// --- Highlight / Draw Tools ---
function setupHighlightTools() {
    toggleDrawModeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        isDrawModeOn = !isDrawModeOn;
        document.body.classList.toggle("highlight-mode", isDrawModeOn);
        toggleDrawModeBtn.classList.toggle("active", isDrawModeOn);
        if (!isDrawModeOn) closeHighlightPopup();
        updateCursor();
    });

    highlightSettingsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = highlightPopup?.classList.toggle("visible");
        highlightSettingsBtn.classList.toggle("active", isVisible);
        if (isVisible && !isDrawModeOn) {
            // If opening settings, turn on draw mode
            isDrawModeOn = true;
            document.body.classList.add("highlight-mode");
            toggleDrawModeBtn.classList.add("active");
            updateCursor();
        }
    });

    // Color selection
    colorSwatchesContainer?.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            setActiveColorSwatch(swatch);
            if (toolType === 'eraser') setDrawMode('pen'); // Switch from eraser to pen on color select
            else updateCurrentColor();
            closeHighlightPopup();
        }
    });

    // Tool selection
    penToolBtnPopup?.addEventListener("click", () => { setDrawMode("pen"); closeHighlightPopup(); });
    highlightToolBtn?.addEventListener("click", () => { setDrawMode("highlight"); closeHighlightPopup(); });
    eraserToolBtnPopup?.addEventListener("click", () => { setDrawMode("eraser"); closeHighlightPopup(); });

    // Brush size
    brushSizeSliderPopup?.addEventListener("input", (e) => {
        currentBrushSize = e.target.value;
    });
    brushSizeSliderPopup?.addEventListener("change", () => {
        // Save only when they release the slider
        localStorage.setItem('flipbook-lastBrushSize', currentBrushSize);
    });


    // Clear button
    clearHighlightsBtnPopup?.addEventListener("click", () => {
        clearCurrentHighlights();
        closeHighlightPopup();
    });
}

function closeHighlightPopup() {
    highlightPopup?.classList.remove('visible');
    highlightSettingsBtn?.classList.remove('active');
}

function setActiveColorSwatch(swatchElement) {
    if (!swatchElement || !colorSwatchesContainer) return;
    colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
    swatchElement.classList.add('active');
    updateCurrentColor();
    try { localStorage.setItem('flipbook-lastColor', swatchElement.dataset.penColor); }
    catch (e) { console.warn("Could not save color pref:", e); }
}

function setDrawMode(mode) {
    toolType = mode;
    [penToolBtnPopup, highlightToolBtn, eraserToolBtnPopup].forEach(btn => btn?.classList.remove('active'));
    colorSwatchesContainer?.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
    
    let savedColor = localStorage.getItem('flipbook-lastColor');
    const activeSwatch = colorSwatchesContainer && (colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${savedColor}"]`) || colorSwatchesContainer.querySelector('.color-swatch'));

    if (mode === 'highlight') {
        highlightToolBtn?.classList.add('active');
        if (activeSwatch) activeSwatch.classList.add('active');
    } else if (mode === 'pen') {
        penToolBtnPopup?.classList.add('active');
        if (activeSwatch) activeSwatch.classList.add('active');
    } else { // Eraser
        eraserToolBtnPopup?.classList.add('active');
    }
    updateCurrentColor();
    updateCursor();
    try { localStorage.setItem('flipbook-lastDrawMode', toolType); }
    catch (e) { console.warn("Could not save draw mode:", e); }
}

function updateCurrentColor() {
    const activeSwatch = colorSwatchesContainer?.querySelector('.color-swatch.active');
    if (!activeSwatch) {
        // Fallback if no color is active for some reason
        const firstSwatch = colorSwatchesContainer?.querySelector('.color-swatch');
        if(firstSwatch) {
            setActiveColorSwatch(firstSwatch);
        }
        return;
    };
    if (toolType === 'pen') { currentHighlightColor = activeSwatch.dataset.penColor; }
    else if (toolType === 'highlight') { currentHighlightColor = activeSwatch.dataset.highlightColor; }
}

function updateCursor() {
    if (!highlightCanvas) return;
    highlightCanvas.classList.remove("highlight-cursor", "eraser-cursor");
    if (isDrawModeOn) {
        if (toolType === 'highlight') {
            highlightCanvas.style.cursor = "";
            highlightCanvas.classList.add("highlight-cursor");
        } else if (toolType === 'pen') {
            highlightCanvas.style.cursor = "crosshair";
        } else { // Eraser
            highlightCanvas.style.cursor = "";
            highlightCanvas.classList.add("eraser-cursor");
        }
    } else {
        highlightCanvas.style.cursor = "default";
    }
}

// --- Canvas Drawing Core ---
function sizeCanvasToImage(img, canvas) {
    if (!img || !canvas) return;
    const rect = img.getBoundingClientRect();
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.top = `0px`;
    canvas.style.left = `0px`;
    // Re-apply context settings if it exists
    if (ctx) {
        ctx = canvas.getContext('2d');
        // Re-apply settings after resize
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
}

function getDrawPosition(e, canvas) {
    if (!canvas) return { x: 0, y: 0 };
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }
    else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: (clientX - canvasRect.left) * scaleX,
        y: (clientY - canvasRect.top) * scaleY
    };
}

function startDrawing(e) {
    if (!isDrawModeOn || !ctx || e.target !== highlightCanvas || (e.touches && e.touches.length > 1)) return;
    if (hammerManager) {
        hammerManager.get("pinch").set({ enable: false });
        hammerManager.get("pan").set({ enable: false });
    }
    if (e.touches) e.preventDefault();
    isDrawing = true;
    const pos = getDrawPosition(e, highlightCanvas);
    [lastX, lastY] = [pos.x, pos.y];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (toolType === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = currentBrushSize;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
    } else if (toolType === "pen") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentHighlightColor;
        ctx.lineWidth = currentBrushSize / 10; // Pen is thinner than highlighter
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
    }
}

function draw(e) {
    if (!isDrawing || !ctx) return;
    if (e.touches) e.preventDefault();
    const pos = getDrawPosition(e, highlightCanvas);
    if (toolType === "eraser" || toolType === "pen") {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    const pos = getDrawPosition(e, highlightCanvas);

    if (toolType === "highlight") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = currentHighlightColor;
        const rectX = Math.min(lastX, pos.x);
        const rectY = Math.min(lastY, pos.y) - (currentBrushSize / 2); // Center line
        const rectWidth = Math.abs(pos.x - lastX);
        const rectHeight = currentBrushSize;
        // Use the single-line draw for highlighter
        ctx.fillRect(rectX, pos.y - (currentBrushSize / 2), rectWidth, rectHeight);
    } else if (toolType === "pen" || toolType === "eraser") {
        ctx.closePath();
    }

    saveHighlights(currentPage - 1); // Save with 0-based index
    if (hammerManager) {
        hammerManager.get("pinch").set({ enable: true });
        hammerManager.get("pan").set({ enable: true });
    }
}

function setupDrawingListeners(canvas) {
    if (!canvas) return;
    // Remove old listeners first to be safe
    canvas.removeEventListener("mousedown", startDrawing);
    canvas.removeEventListener("mousemove", draw);
    canvas.removeEventListener("mouseup", stopDrawing);
    canvas.removeEventListener("mouseleave", stopDrawing);
    canvas.removeEventListener("touchstart", startDrawing);
    canvas.removeEventListener("touchmove", draw);
    canvas.removeEventListener("touchend", stopDrawing);
    canvas.removeEventListener("touchcancel", stopDrawing);
    // Add new listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);
}

// --- Highlight Storage ---
function saveHighlights(pageIndex) {
    if (!highlightCanvas) return;
    requestAnimationFrame(() => {
        try { localStorage.setItem(`flipbook-highlights-page-${pageIndex}`, highlightCanvas.toDataURL()); }
        catch (e) { console.error("Save highlights error:", e); }
    });
}

function loadHighlights(pageIndex) {
    if (!highlightCanvas || !ctx) return;
    const dataUrl = localStorage.getItem(`flipbook-highlights-page-${pageIndex}`);
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => {
            if(ctx) { // Ensure context is still valid
                ctx.drawImage(img, 0, 0);
            }
        };
        img.onerror = () => { localStorage.removeItem(`flipbook-highlights-page-${pageIndex}`); };
        img.src = dataUrl;
    }
}

function clearCurrentHighlights() {
    if (!ctx) return;
    if (confirm("Erase all highlights on this page?")) {
        const pageIndex = currentPage - 1;
        ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        localStorage.removeItem(`flipbook-highlights-page-${pageIndex}`);
    }
}

// --- Search ---
function setupSearch() {
    searchBtn?.addEventListener('click', toggleSearchBox);
    searchCloseBtn?.addEventListener('click', closeSearchBox);
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { performSearch(); e.preventDefault(); }
        if (e.key === 'Escape') { closeSearchBox(); e.preventDefault(); }
    });
}
function toggleSearchBox() {
    if (!searchContainer) return;
    if (searchContainer.style.display !== 'none') {
        closeSearchBox();
    } else {
        searchContainer.style.display = 'flex';
        searchInput?.focus();
        if (searchResults) searchResults.innerHTML = "";
    }
}
function closeSearchBox() {
    if (searchContainer) searchContainer.style.display = "none";
    if (searchInput) searchInput.value = "";
    if (searchResults) searchResults.innerHTML = "";
}
function performSearch() {
    if (!searchInput || !searchResults || Object.keys(bookTextData).length === 0) return;
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";
    if (query.length < 2) {
        searchResults.innerHTML = `<div class="no-results">Please enter at least 2 characters.</div>`;
        return;
    }
    const results = [];
    // Use bookTextData (which is 0-indexed)
    for (const pageIndex in bookTextData) {
        const text = bookTextData[pageIndex];
        if (text && text.toLowerCase().includes(query)) {
            results.push(parseInt(pageIndex, 10));
        }
    }
    if (results.length > 0) {
        results.sort((a, b) => a - b).forEach(pageIndex => {
            const div = document.createElement("div");
            div.textContent = `Page ${pageIndex + 1}`; // Display as 1-based
            div.onclick = () => {
                goToPage(pageIndex + 1); // Navigate to 1-based
                closeSearchBox();
            };
            searchResults.appendChild(div);
        });
    } else {
        searchResults.innerHTML = `<div class="no-results">No results found.</div>`;
    }
}

// --- Zoom / Pan (Hammer.js) ---
function setupHammer(element) {
    if (!element || typeof Hammer === 'undefined') {
        console.warn("Hammer.js not found or element missing.");
        return;
    }
    if (hammerManager) { hammerManager.destroy(); hammerManager = null; }
    hammerManager = new Hammer.Manager(element);
    const pinch = new Hammer.Pinch();
    const pan = new Hammer.Pan({ direction: Hammer.DIRECTION_ALL });
    hammerManager.add([pinch, pan]);
    let initialOffsetX = 0, initialOffsetY = 0;

    hammerManager.on('pinchstart', () => {
        if (isDrawing) return;
        isPinching = true;
        pinchStartScale = currentScale;
        element.style.transition = 'none';
    });
    hammerManager.on('pinchmove', (e) => {
        if (isDrawing || !isPinching) return;
        currentScale = Math.max(1, Math.min(pinchStartScale * e.scale, 5));
        applyTransform(element);
    });
    hammerManager.on('pinchend pinchcancel', () => {
        if (isDrawing) return;
        isPinching = false;
        element.style.transition = '';
        adjustPanLimits(element);
        applyTransform(element);
    });
    hammerManager.on('panstart', (e) => {
        // Do not pan if drawing OR if scale is 1 (to allow page scroll)
        if (isDrawing || (currentScale === 1 && e.pointers.length === 1)) return;
        initialOffsetX = currentOffsetX;
        initialOffsetY = currentOffsetY;
        element.style.transition = 'none';
    });
    hammerManager.on('panmove', (e) => {
        if (isDrawing || (currentScale === 1 && e.pointers.length === 1)) return;
        currentOffsetX = initialOffsetX + e.deltaX;
        currentOffsetY = initialOffsetY + e.deltaY;
        adjustPanLimits(element);
        applyTransform(element);
    });
    hammerManager.on('panend pancancel', (e) => {
        if (isDrawing) return;
        element.style.transition = '';
    });
}
function resetZoomPan(element) {
    currentScale = 1; currentOffsetX = 0; currentOffsetY = 0; pinchStartScale = 1;
    if (element) element.style.transform = "scale(1) translate(0px, 0px)";
}
function adjustPanLimits(element) {
    if (!element || !flipbook || currentScale <= 1) { currentOffsetX = 0; currentOffsetY = 0; return; }
    const parentRect = flipbook.getBoundingClientRect();
    const maxMoveX = Math.max(0, (element.offsetWidth * currentScale - parentRect.width) / 2);
    const maxMoveY = Math.max(0, (element.offsetHeight * currentScale - parentRect.height) / 2);
    currentOffsetX = Math.max(-maxMoveX, Math.min(currentOffsetX, maxMoveX));
    currentOffsetY = Math.max(-maxMoveY, Math.min(currentOffsetY, maxMoveY));
}
function applyTransform(element) {
    if (!element) return;
    element.style.transform = `scale(${currentScale}) translate(${currentOffsetX}px, ${currentOffsetY}px)`;
}

// --- Global Listeners & Helpers ---
function setupGlobalListeners() {
    // Swipe navigation
    flipbook?.addEventListener("touchstart", handleTouchStartSwipe, { passive: true });
    flipbook?.addEventListener("touchend", handleTouchEndSwipe, { passive: true });

    // Keyboard shortcuts
    document.addEventListener("keydown", handleGlobalKeys);

    // Resize handler
    window.addEventListener('resize', () => {
        const img = document.querySelector('.page-image');
        if (img && highlightCanvas) {
            setTimeout(() => {
                sizeCanvasToImage(img, highlightCanvas);
                loadHighlights(currentPage - 1); // 0-based index
            }, 150);
        }
        closeHighlightPopup();
    });

    // Global click listener for closing popups
    document.addEventListener("click", e => {
        // Close sidebar
        if (indexSidebar?.classList.contains('open')) {
            const t = e.target;
            if (indexSidebar && !indexSidebar.contains(t) && t !== indexToggle && !indexToggle.contains(t)) {
                closeSidebar();
            }
        }
        // Close search
        if (searchContainer?.style.display !== 'none' && !searchContainer.contains(e.target) && e.target !== searchBtn) {
            closeSearchBox();
        }
        // Close highlight popup
        if (highlightPopup?.classList.contains('visible') && !highlightPopup.contains(e.target) && e.target !== highlightSettingsBtn && e.target !== toggleDrawModeBtn) {
            closeHighlightPopup();
        }
    });
}

let touchStartX = 0, touchEndX = 0; const swipeThreshold = 50;
function handleTouchStartSwipe(e) { if (isDrawModeOn || isPinching || e.touches.length > 1) { touchStartX = 0; return; } touchStartX = e.touches[0].clientX; }
function handleTouchEndSwipe(e) { if (isDrawModeOn || isPinching || touchStartX === 0 || e.touches.length > 0) return; touchEndX = e.changedTouches[0].clientX; handleSwipeGesture(); }
function handleSwipeGesture() { if(touchStartX === 0) return; const diff = touchEndX - touchStartX; if (Math.abs(diff) > swipeThreshold) { if (diff > 0) prevPage(); else nextPage(); } touchStartX = 0; }

function handleGlobalKeys(e) {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    if (e.key === "Escape") {
        e.preventDefault();
        if (aiModal?.style.display !== 'none') aiModal.style.display = 'none';
        else if (phetModal?.style.display !== 'none') closePhetModal();
        else if (videoModal?.style.display !== 'none') closeVideoModal();
        else if (indexSidebar?.classList.contains('open')) closeSidebar();
        else if (searchContainer?.style.display !== 'none') closeSearchBox();
        else if (highlightPopup?.classList.contains('visible')) closeHighlightPopup();
        else if (isInputFocused) activeEl.blur();
        return;
    }

    if (isInputFocused && activeEl !== pageInput) return; // Ignore keys if in search, etc.
    
    const modalIsOpen = (aiModal?.style.display !== 'none') || (phetModal?.style.display !== 'none') || (videoModal?.style.display !== 'none');
    if (modalIsOpen) return;

    switch (e.key) {
        case "ArrowLeft": 
            if (!isInputFocused) { e.preventDefault(); prevPage(); }
            break;
        case "ArrowRight": 
            if (!isInputFocused) { e.preventDefault(); nextPage(); }
            break;
        case "Enter":
            if (pageInputTimer) { clearTimeout(pageInputTimer); pageInputTimer = null; }
            if (isInputFocused && activeEl === pageInput) { jumpToPage(); pageInput.blur(); }
            break;
        case "d": case "D": 
            if (!isInputFocused) { e.preventDefault(); toggleDrawModeBtn?.click(); }
            break;
        case "s": case "S": 
            if (!isInputFocused) { e.preventDefault(); if (searchBtn && !searchBtn.disabled) toggleSearchBox(); }
            break;
        case "a": case "A": 
            if (!isInputFocused) { e.preventDefault(); aiHelperToggle?.click(); }
            break;
        case "Delete": case "Backspace":
            if (!isInputFocused) { e.preventDefault(); if (isDrawModeOn) clearCurrentHighlights(); }
            break;
        default:
            // Handle numeric input for page jump
            if (e.key >= "0" && e.key <= "9") {
                if (!isInputFocused) {
                    e.preventDefault();
                    if (pageInput) {
                        pageInput.value = e.key; 
                        pageInput.focus();
                        resetPageInputTimer();
                    }
                } else if (activeEl === pageInput) {
                    // This is handled by the 'keyup' listener on pageInput, but we reset the timer
                    resetPageInputTimer();
                }
            }
    }
}


function resetPageInputTimer() {
    if (pageInputTimer) clearTimeout(pageInputTimer);
    pageInputTimer = setTimeout(() => {
        if (pageInput && document.activeElement === pageInput) {
            jumpToPage();
            pageInput.blur();
        } else if (pageInput) {
            pageInput.value = currentPage;
        }
        pageInputTimer = null;
    }, 1500);
}

// --- Local Storage ---
function loadPreferences() {
    try {
        const savedPage = localStorage.getItem('flipbook-lastPage'); // 0-based
        if (savedPage) {
            let pageNum = parseInt(savedPage, 10);
            if (!isNaN(pageNum) && pageNum >= 0 && pageNum < totalPages) {
                currentPage = pageNum + 1; // Convert to 1-based
            }
        }
        
        const savedMode = localStorage.getItem('flipbook-lastDrawMode');
        if (savedMode) toolType = savedMode;

        const savedSize = localStorage.getItem('flipbook-lastBrushSize');
        if (savedSize) currentBrushSize = savedSize;
        
        // Color is set during initApp after DOM is ready
    } catch (e) {
        console.warn("Could not load preferences:", e);
    }
}

// --- Utility Functions ---
function getYoutubeEmbedUrl(url) {
    try {
        const urlObj = new URL(url);
        let videoId = null;
        if (urlObj.hostname === 'youtu.be') { videoId = urlObj.pathname.slice(1); }
        else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') { videoId = urlObj.searchParams.get('v'); }
        else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) { urlObj.searchParams.set('autoplay', '1'); urlObj.searchParams.set('rel', '0'); urlObj.hostname = 'www.youtube-nocookie.com'; return urlObj.toString(); }
        else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/shorts/')) { videoId = urlObj.pathname.split('/shorts/')[1]; }
        if (videoId) { return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`; }
    } catch (e) { console.error("Invalid video URL:", url, e); }
    return url; // Fallback
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
    let attempt = 0; let currentDelay = initialDelay;
    while (attempt <= maxRetries) {
        try {
            const response = await fetch(url, options);
            if ([503, 429].includes(response.status) && attempt < maxRetries) {
                console.warn(`Retrying... attempt ${attempt + 1}`);
                await delay(currentDelay); attempt++; currentDelay *= 2; continue;
            }
      S       return response;
        } catch (error) {
            console.error(`Fetch attempt ${attempt + 1} failed:`, error);
s          if (attempt < maxRetries) {
                await delay(currentDelay); attempt++; currentDelay *= 2;
            } else { throw error; }
        }
    }
    throw new Error("Fetch failed after multiple retries.");
}

async function getImageAsBase64FromCanvas() {
    const img = document.querySelector(".page-image");
    if (!img || !img.complete || img.naturalWidth === 0) {
        console.error("Page image not ready for AI analysis.");
        return null;
    }
    try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const tempCtx = canvas.getContext("2d");
        if (!tempCtx) return null;
        tempCtx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
    } catch (e) { console.error("Canvas error:", e); return null; }
}

function getCurrentChapter() {
    if (!config.chapters || config.chapters.length === 0) return null;
    let currentChapter = config.chapters[0];
    // Find the last chapter that starts *before* or *on* the current page
    for (let i = config.chapters.length - 1; i >= 0; i--) {
        if (currentPage >= config.chapters[i].page) { // 1-based vs 1-based
            currentChapter = config.chapters[i];
            break;
        }
    }
    return currentChapter;
}

// --- Make functions globally accessible for inline HTML `onclick` attributes ---
window.firstPage = firstPage;
window.prevPage = prevPage;
window.jumpToPage = jumpToPage;
window.nextPage = nextPage;
window.lastPage = lastPage;
window.toggleFullScreen = toggleFullScreen;
window.shareBook = shareBook;
window.getAiHelp = getAiHelp;

// --- Fullscreen & Share ---
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
        document.exitFullscreen();
    }
}

function shareBook() {
    if (navigator.share) {
        navigator.share({ title: "PHYS101 Flipbook", url: window.location.href })
          .catch((err) => console.log("Share failed:", err));
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert("Link copied to clipboard!");
        }).catch(err => {
            console.error('Fallback copy failed', err);
            alert('Failed to copy link.');
        });
    } else {
        alert("Sharing not supported on this browser.");
    }
}

// --- End of File ---
