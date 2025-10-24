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
    img.src = images[pageIndex];
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
    const newPage = Math.max(1, Math.min(pageNum, totalPages));
    if (newPage !== currentPage) {
        currentPage = newPage;
        renderPage();
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
    // Navigation buttons are wired globally
    pageInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { jumpToPage(); e.preventDefault(); pageInput.blur(); }
    });
    pageInput?.addEventListener('keyup', (e) => {
        if (e.key >= "0" && e.key <= "9") resetPageInputTimer();
    });
    
    // Fullscreen and Share are wired globally
}

// --- NEW Sidebar Slide Logic (from user's 'idea' file) ---
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
    if (!indexSidebar.classList.contains("open")) {
        indexSidebar.classList.add("open");
        indexToggle.setAttribute("aria-expanded", "true");
        bookContainer.classList.add("shifted");
    }
}

function closeSidebar() {
    if (indexSidebar.classList.contains("open")) {
        indexSidebar.classList.remove("open");
        indexToggle.setAttribute("aria-expanded", "false");
        bookContainer.classList.remove("shifted");
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
        } else {
            let promptText;
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
            try { const errorData = await response.json(); errorMsg = (errorData.error && errorData.error.message) ? `API Error via Proxy: ${errorData.error.message}` : errorMsg; } catch (e) { }
            throw new Error(errorMsg);
        }
        const responseData = await response.json();
        if (responseData.error && responseData.error.message) { throw new Error(`API Error via Proxy: ${responseData.error.message}`); }
        
        const resultText = responseData.candidates?.[0]?.content?.parts?
