// ---------- Student IDs (robust loading) ----------
let ALLOWED_IDS = [];
async function loadIDs() {
    try {
        const res = await fetch("./students.json");
        if (!res.ok) throw new Error("File not found or inaccessible");
        const data = await res.json();
        ALLOWED_IDS = Array.isArray(data) ? data : (Array.isArray(data.allowed) ? data.allowed : []);
    } catch (err) {
        console.error("Could not load student IDs:", err);
        ALLOWED_IDS = [];
    }
}

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

// ---------- Load Pre-extracted Book Text ----------
let bookTextData = {};
async function loadBookText() {
    try {
        const res = await fetch("./book-text.json");
        if (!res.ok) throw new Error("book-text.json not found");
        bookTextData = await res.json();
        console.log("Book text loaded successfully.");
         const searchBtn = document.getElementById('searchBtn');
         if (searchBtn) searchBtn.disabled = false;
    } catch (err) {
        console.error("Could not load book text:", err);
         const searchBtn = document.getElementById('searchBtn');
         if (searchBtn) searchBtn.disabled = true;
    }
}

// --- NEW: Function to load chapters from JSON ---
async function loadChapters() {
    try {
        const res = await fetch("./chapters.json");
        if (!res.ok) throw new Error("chapters.json not found");
        config.chapters = await res.json(); // Load data directly into the config object
        console.log("Chapters loaded successfully.");
    } catch (err) {
        console.error("Could not load chapters:", err);
        config.chapters = []; // Default to empty array on failure
    }
}


// ---------- Flipbook data ----------
const totalPages = (typeof config !== 'undefined' && config.totalPages) ? config.totalPages : 1;
const imagePath = (typeof config !== 'undefined' && config.imagePath) ? config.imagePath : './images/page_';
const thumbPath = (typeof config !== 'undefined' && config.thumbPath) ? config.thumbPath : './thumbs/thumb_';

const images = Array.from({ length: totalPages }, (_, i) => `${imagePath}${i}.png`);
const thumbs = Array.from({ length: totalPages }, (_, i) => `${thumbPath}${i}.jpg`);
let currentPage = 0; // Will be updated by loadPreferences
const flipbook = document.getElementById("flipbook");
const thumbbar = document.getElementById("thumbbar");
const counter = document.getElementById("pageCounter");
const pageInput = document.getElementById("pageInput");
const footer = document.getElementById("footer");
const indexToggle = document.getElementById("indexToggle");
const indexMenu = document.getElementById("indexMenu");
const phetModal = document.getElementById('phetModal');
const phetBtn = document.getElementById('phetBtn');
const phetCloseBtn = document.getElementById('phetCloseBtn');
const phetFrame = document.getElementById('phetFrame');
const videoModal = document.getElementById('videoModal');
const videoBtn = document.getElementById('videoBtn');
const videoCloseBtn = document.getElementById('videoCloseBtn');
const videoFrame = document.getElementById('videoFrame');

// --- HIGHLIGHTING VARIABLES ---
const toggleDrawModeBtn = document.getElementById('toggle-draw-mode-btn');
const highlightSettingsBtn = document.getElementById('highlight-settings-btn');
const highlightPopup = document.getElementById('highlight-popup');
const colorSwatchesContainer = document.querySelector('.color-swatches');
const penToolBtnPopup = document.getElementById('pen-tool-btn-popup');
const highlightToolBtn = document.getElementById('highlight-tool-btn');
const eraserToolBtnPopup = document.getElementById('eraser-tool-btn-popup');
const brushSizeSliderPopup = document.getElementById('brush-size-popup');
const clearHighlightsBtnPopup = document.getElementById('clear-highlights-btn-popup');
let currentHighlightColor = 'rgba(255, 255, 0, 0.2)'; // Default
let currentBrushSize = 40; // Default
let highlightCanvas, ctx, isDrawing = false, drawMode = 'highlight', lastX = 0, lastY = 0; // Defaults

// --- ZOOM/PAN VARIABLES ---
let hammerManager = null;
let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;
let pinchStartScale = 1;
let isPinching = false;

// --- SEARCH VARIABLES ---
const searchBtn = document.getElementById('searchBtn');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const searchResults = document.getElementById('searchResults');
if (searchBtn) searchBtn.disabled = true;

// --- AI HELPER VARIABLES ---
const aiModal = document.getElementById("aiHelperModal");
const aiHelperToggle = document.getElementById("aiHelperToggle");
const aiCloseBtn = document.getElementById("aiCloseBtn");
const aiResponseEl = document.getElementById("aiResponse");
const aiLoadingEl = document.getElementById("aiLoading");
const aiChapterTitleEl = document.getElementById("aiChapterTitle");
const translateAnalysisBtn = document.getElementById("translate-analysis-btn");

// --- KEYBOARD SHORTCUT VARIABLES ---
let pageInputTimer = null;

// --- Get Apps Script Proxy URL from config.js ---
const APPS_SCRIPT_PROXY_URL = (typeof config !== 'undefined' && config.appsScriptProxyUrl) ? config.appsScriptProxyUrl : '';

// --- Utility Functions ---
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
    let attempt = 0;
    let currentDelay = initialDelay;
    while (attempt <= maxRetries) {
        try {
            const response = await fetch(url, options);
            if ([503, 429].includes(response.status) && attempt < maxRetries) {
                console.warn(`API request via proxy failed with status ${response.status}. Retrying in ${currentDelay / 1000}s...`);
                await delay(currentDelay);
                attempt++;
                currentDelay *= 2;
                continue;
            }
            return response;
        } catch (error) {
            console.error(`Fetch error on attempt ${attempt + 1}:`, error);
            if (attempt < maxRetries) {
                console.warn(`Network error during fetch. Retrying in ${currentDelay / 1000}s...`);
                await delay(currentDelay);
                attempt++;
                currentDelay *= 2;
            } else {
                 console.error("Fetch failed after multiple retries.");
                 throw error;
            }
        }
    }
     throw new Error("API request failed after multiple retries.");
}

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
    return url;
}

// ---------- Render page ----------
function renderPage() {
    if (!flipbook) return;
    flipbook.innerHTML = "";
    const wrap = document.createElement("div"); wrap.className = "page-wrap"; wrap.id = "page-wrap-" + currentPage;
    resetZoomPan(wrap);
    const img = document.createElement("img"); const canvas = document.createElement("canvas"); canvas.id = "highlight-canvas"; highlightCanvas = canvas;
    img.className = "page-image"; img.src = images[currentPage]; img.alt = `Page ${currentPage + 1}`; img.loading = "eager"; img.crossOrigin = "anonymous";
    img.onerror = () => { img.alt = "Image not available"; img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='24' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E"; };
    img.onload = () => { sizeCanvasToImage(img, canvas); ctx = canvas.getContext('2d'); setupDrawingListeners(canvas); loadHighlights(currentPage); updateCursor(); setupHammer(wrap); };
    wrap.appendChild(img); wrap.appendChild(canvas);
    
    // Get overlay from HTML instead of creating it
    const overlay = document.getElementById("translationOverlay");
    if (overlay) {
        wrap.appendChild(overlay); // Move the existing overlay into the wrap
    }

    flipbook.appendChild(wrap);
    if (counter) counter.textContent = `Page ${currentPage + 1} / ${totalPages}`; if (pageInput) pageInput.value = currentPage + 1;
    highlightThumb();
    if (typeof config !== 'undefined') { const simConfig = config.simulations && config.simulations.find(s => s.page === (currentPage + 1)); if (phetBtn) phetBtn.style.display = simConfig ? 'inline-block' : 'none'; const videoConfig = config.videos && config.videos.find(v => v.page === (currentPage + 1)); if (videoBtn) videoBtn.style.display = videoConfig ? 'inline-block' : 'none'; }
    
    // Hide overlay on page turn
    if (overlay) overlay.style.display = 'none';

    closeSearchBox(); closeHighlightPopup(); preloadImages();
    try { localStorage.setItem('flipbook-lastPage', currentPage.toString()); } catch (e) { console.warn("Could not save last page:", e); }
}

function resetZoomPan(element) { currentScale=1; currentOffsetX=0; currentOffsetY=0; pinchStartScale=1; if (element) element.style.transform="scale(1) translate(0px, 0px)"; const t=document.getElementById("flipbook"); if (t && hammerManager) hammerManager.get("pan").set({enable:true, direction:Hammer.DIRECTION_ALL}); }
function preloadImages() { if (currentPage<images.length-1) (new Image).src=images[currentPage+1]; if (currentPage>0) (new Image).src=images[currentPage-1]; }
function renderThumbs() { if(!thumbbar)return; thumbbar.innerHTML=""; thumbs.forEach((src, i) => { const t = document.createElement("img"); t.src = src; t.alt = `Thumb ${i + 1}`; t.loading = "lazy"; t.addEventListener("click", () => { if (currentPage !== i) { currentPage = i; renderPage(); } }); t.onerror = () => { t.alt = "Thumb N/A"; t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E"; }; thumbbar.appendChild(t); }); }
function highlightThumb() { if(!thumbbar)return; let activeThumb = null; thumbbar.querySelectorAll("img").forEach((im, i) => { const isActive = i === currentPage; im.classList.toggle("active", isActive); if (isActive) activeThumb = im; }); if (activeThumb) { const rect = activeThumb.getBoundingClientRect(), parentRect = thumbbar.getBoundingClientRect(); if (rect.left < parentRect.left || rect.right > parentRect.right) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } }
function renderIndex() { if(!indexMenu || !indexToggle)return; indexMenu.innerHTML=""; if (typeof config !== 'undefined' && config.chapters && config.chapters.length > 0) { config.chapters.forEach(chapter => { const button = document.createElement("button"); button.textContent = chapter.title; button.onclick = () => goToPage(chapter.page - 1); indexMenu.appendChild(button); }); indexToggle.style.display = 'inline-block'; } else { indexToggle.style.display = 'none'; } }
function nextPage() { if (currentPage < images.length - 1) { currentPage++; renderPage(); } }
function prevPage() { if (currentPage > 0) { currentPage--; renderPage(); } }
function firstPage() { if (currentPage !== 0) { currentPage = 0; renderPage(); } }
function lastPage() { if (currentPage !== images.length - 1) { currentPage = images.length - 1; renderPage(); } }

function jumpToPage() {
    if (pageInputTimer) { clearTimeout(pageInputTimer); pageInputTimer = null; }
    if (!pageInput) return;
    const v = parseInt(pageInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages) { currentPage = v - 1; renderPage(); }
    else { pageInput.value = currentPage + 1; }
}
if (pageInput) {
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { jumpToPage(); e.preventDefault(); pageInput.blur(); } });
    pageInput.addEventListener('keyup', (e) => { if (e.key >= "0" && e.key <= "9") { resetPageInputTimer(); } });
}

function toggleFullScreen() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`)); }
function shareBook(){ const shareData = { title: "PHYS101 Flipbook", url: window.location.href }; if (navigator.share) { navigator.share(shareData).catch((err) => console.log("Share failed:", err)); } else if (navigator.clipboard) { const textArea = document.createElement("textarea"); textArea.value = window.location.href; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); alert("Link copied to clipboard!"); } catch (err) { console.error('Fallback copy failed', err); alert('Failed to copy link.'); } document.body.removeChild(textArea); } else alert("Sharing/Copying not supported."); }
function openIndexMenu() { if (!indexToggle || !footer || !indexMenu) return; const rect = indexToggle.getBoundingClientRect(), footerRect = footer.getBoundingClientRect(); indexMenu.style.left = `${rect.left - footerRect.left}px`; indexMenu.style.bottom = `${footerRect.height}px`; indexMenu.style.top = "auto"; indexMenu.style.display = "flex"; indexMenu.setAttribute("aria-hidden","false"); indexToggle.setAttribute("aria-expanded","true"); }
function closeIndexMenu(){ if (!indexMenu || !indexToggle) return; indexMenu.style.display="none"; indexMenu.setAttribute("aria-hidden","true"); indexToggle.setAttribute("aria-expanded","false"); }
if (indexToggle) indexToggle.addEventListener("click", e=>{ e.stopPropagation(); indexMenu.style.display === "flex" ? closeIndexMenu() : openIndexMenu(); });
if (indexMenu) indexMenu.addEventListener("click", e => e.stopPropagation());

document.addEventListener("click", e => {
    if (indexMenu && indexToggle && indexMenu.style.display === "flex" && !indexMenu.contains(e.target) && !indexToggle.contains(e.target)) closeIndexMenu();
    if (searchContainer && searchContainer.style.display !== 'none' && !searchContainer.contains(e.target) && e.target !== searchBtn) closeSearchBox();
    if (highlightPopup && highlightSettingsBtn && highlightPopup.classList.contains('visible') && !highlightPopup.contains(e.target) && e.target !== highlightSettingsBtn && e.target !== toggleDrawModeBtn) closeHighlightPopup();
});
function goToPage(page){ if (page >= 0 && page < images.length){ currentPage = page; renderPage(); closeIndexMenu(); } }
window.goToPage = goToPage;

// ---------- Input & touch (For SWIPING ONLY - Modified) ----------
let touchStartX = 0, touchEndX = 0; const swipeThreshold = 50;
function handleTouchStartSwipe(e){ if (document.body.classList.contains('highlight-mode') || isPinching || e.touches.length > 1) { touchStartX = null; return; } touchStartX = e.touches[0].clientX; }
function handleTouchEndSwipe(e){ if (document.body.classList.contains('highlight-mode') || isPinching || touchStartX === null || e.touches.length > 0) { touchStartX = null; return; } touchEndX = e.changedTouches[0].clientX; handleSwipeGesture(); }
function handleSwipeGesture(){ if (touchStartX === null) return; const diff = touchEndX - touchStartX; if (Math.abs(diff) > swipeThreshold){ if(diff > 0){ prevPage(); } else { nextPage(); } } touchStartX = null; }

// ---------- Modals (PhET, Video) ----------
function openPhetModal(){ const a=typeof config!="undefined"&&config.simulations&&config.simulations.find(e=>e.page===currentPage+1);a&&a.url?(phetFrame&&(phetFrame.src=a.url),phetModal&&(phetModal.style.display="flex")):alert("No simulation found for this page.") }
function closePhetModal(){ phetModal&&(phetModal.style.display="none"),phetFrame&&(phetFrame.src="about:blank") }
if(phetBtn)phetBtn.addEventListener("click",openPhetModal);
if(phetCloseBtn)phetCloseBtn.addEventListener("click",closePhetModal);
if(phetModal)phetModal.addEventListener("click",e=>{e.target===phetModal&&closePhetModal()});
function openVideoModal(){ const a=typeof config!="undefined"&&config.videos&&config.videos.find(e=>e.page===currentPage+1);a&&a.url?(videoFrame&&(videoFrame.src=getYoutubeEmbedUrl(a.url)),videoModal&&(videoModal.style.display="flex")):alert("No video found for this page.") }
function closeVideoModal(){ videoModal&&(videoModal.style.display="none"),videoFrame&&(videoFrame.src="about:blank") }
if(videoBtn)videoBtn.addEventListener("click",openVideoModal);
if(videoCloseBtn)videoCloseBtn.addEventListener("click",closeVideoModal);
if(videoModal)videoModal.addEventListener("click",e=>{e.target===videoModal&&closeVideoModal()});


// --- HAMMER.JS SETUP (Updated for Scrolling) ---
function setupHammer(element) {
    if (!element || typeof Hammer === 'undefined') { console.warn("Hammer.js not found or element missing."); return; }
    if (hammerManager) { hammerManager.destroy(); hammerManager = null; }
    hammerManager = new Hammer.Manager(element);
    const pinch = new Hammer.Pinch({ pointers: 2 }); const pan = new Hammer.Pan({ pointers: 0, direction: Hammer.DIRECTION_ALL });
    pinch.recognizeWith(pan); hammerManager.add([pinch, pan]);
    let initialOffsetX = currentOffsetX, initialOffsetY = currentOffsetY;
    hammerManager.on('pinchstart', (e) => { if (isDrawing) return; isPinching = true; pinchStartScale = currentScale; element.style.transition = 'none'; });
    hammerManager.on('pinchmove', (e) => { if (isDrawing || !isPinching) return; currentScale = Math.max(1, Math.min(pinchStartScale * e.scale, 5)); applyTransform(element); });
    hammerManager.on('pinchend pinchcancel', (e) => { if (isDrawing) return; isPinching = false; element.style.transition = ''; adjustPanLimits(element); applyTransform(element); });
    hammerManager.on('panstart', (e) => { if (isDrawing || (currentScale > 1 && e.pointers.length < 2) || (currentScale === 1 && e.pointers.length === 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX))) return; initialOffsetX = currentOffsetX; initialOffsetY = currentOffsetY; element.style.transition = 'none'; });
    hammerManager.on('panmove', (e) => { if (isDrawing || (currentScale > 1 && e.pointers.length < 2) || (currentScale === 1 && e.pointers.length === 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX))) return; if (currentScale === 1 && e.pointers.length === 1 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; let newOffsetX = initialOffsetX + e.deltaX; let newOffsetY = initialOffsetY + e.deltaY; adjustPanLimits(element); const rect = element.getBoundingClientRect(), parentRect = flipbook.getBoundingClientRect(); const maxMoveX = Math.max(0, (rect.width - parentRect.width) / 2); const maxMoveY = Math.max(0, (rect.height - parentRect.height) / 2); currentOffsetX = Math.max(-maxMoveX, Math.min(newOffsetX, maxMoveX)); currentOffsetY = Math.max(-maxMoveY, Math.min(newOffsetY, maxMoveY)); applyTransform(element); });
    hammerManager.on('panend pancancel', (e) => { if (isDrawing) return; element.style.transition = ''; initialOffsetX = currentOffsetX; initialOffsetY = currentOffsetY; });
}
function adjustPanLimits(element) { if (!element || currentScale <= 1) { currentOffsetX = 0; currentOffsetY = 0; return; } const parentRect = flipbook.getBoundingClientRect(); const maxMoveX = Math.max(0, (element.offsetWidth * currentScale - parentRect.width) / 2); const maxMoveY = Math.max(0, (element.offsetHeight * currentScale - parentRect.height) / 2); currentOffsetX = Math.max(-maxMoveX, Math.min(currentOffsetX, maxMoveX)); currentOffsetY = Math.max(-maxMoveY, Math.min(currentOffsetY, maxMoveY)); }
function applyTransform(element) { if (!element) return; element.style.transform = `scale(${currentScale}) translate(${currentOffsetX}px, ${currentOffsetY}px)`; }

// --- HIGHLIGHTING LOGIC ---
function sizeCanvasToImage(img, canvas) { if (!img || !canvas) return; const rect = img.getBoundingClientRect(); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; canvas.style.top = `0px`; canvas.style.left = `0px`; if (ctx) ctx = canvas.getContext('2d'); }
function getDrawPosition(e, canvas) { if (!canvas) return { x: 0, y: 0 }; const pageWrap = canvas.closest('.page-wrap'); if (!pageWrap) return { x: 0, y: 0 }; const canvasRect = canvas.getBoundingClientRect(); const scaleXCanvas = canvas.width / canvasRect.width; const scaleYCanvas = canvas.height / canvasRect.height; let clientX, clientY; if (e.touches && e.touches.length > 0) { clientX = e.touches[0].pageX - window.scrollX; clientY = e.touches[0].pageY - window.scrollY; } else if (e.changedTouches && e.changedTouches.length > 0) { clientX = e.changedTouches[0].pageX - window.scrollX; clientY = e.changedTouches[0].pageY - window.scrollY; } else { clientX = e.clientX; clientY = e.clientY; } const screenX = clientX - canvasRect.left; const screenY = clientY - canvasRect.top; return { x: screenX * scaleXCanvas, y: screenY * scaleYCanvas }; }
function startDrawing(e) { if (!highlightCanvas || !ctx || !document.body.classList.contains("highlight-mode") || e.target !== highlightCanvas || (e.touches && e.touches.length > 1)) return; if (hammerManager) { hammerManager.get("pinch").set({ enable: !1 }); hammerManager.get("pan").set({ enable: !1 }); } e.touches && e.preventDefault(); isDrawing = true; const t = getDrawPosition(e, highlightCanvas); [lastX, lastY] = [t.x, t.y]; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if ("eraser" === drawMode) { ctx.beginPath(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,1)"; ctx.arc(t.x, t.y, currentBrushSize / 2, 0, 2 * Math.PI); ctx.fill(); } else if ("pen" === drawMode) { ctx.beginPath(); ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = currentHighlightColor; ctx.lineWidth = currentBrushSize / 10; ctx.moveTo(lastX, lastY); } }
function draw(e) { if (!isDrawing || !ctx) return; e.touches && e.preventDefault(); const t = getDrawPosition(e, highlightCanvas); if ("eraser" === drawMode) { ctx.beginPath(); ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = currentBrushSize; ctx.moveTo(lastX, lastY); ctx.lineTo(t.x, t.y); ctx.stroke(); [lastX, lastY] = [t.x, t.y]; } else if ("pen" === drawMode) { ctx.beginPath(); ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = currentHighlightColor; ctx.lineWidth = currentBrushSize / 10; ctx.moveTo(lastX, lastY); ctx.lineTo(t.x, t.y); ctx.stroke(); [lastX, lastY] = [t.x, t.y]; } }
function stopDrawing(e) { if (!isDrawing) return; isDrawing = false; let t = getDrawPosition(e, highlightCanvas); if ("highlight" === drawMode) { ctx.beginPath(); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = currentHighlightColor; const rectX = Math.min(lastX, t.x); const rectWidth = Math.abs(t.x - lastX); const rectY = lastY - (currentBrushSize / 2); const rectHeight = currentBrushSize; ctx.fillRect(rectX, rectY, rectWidth, rectHeight); } saveHighlights(currentPage); if (hammerManager) { hammerManager.get("pinch").set({ enable: true }); hammerManager.get("pan").set({ enable: true }); } }
function setupDrawingListeners(canvas) { if (!canvas) return; canvas.removeEventListener("mousedown", startDrawing); canvas.removeEventListener("mousemove", draw); canvas.removeEventListener("mouseup", stopDrawing); canvas.removeEventListener("mouseleave", stopDrawing); canvas.removeEventListener("touchstart", startDrawing); canvas.removeEventListener("touchmove", draw); canvas.removeEventListener("touchend", stopDrawing); canvas.removeEventListener("touchcancel", stopDrawing); canvas.addEventListener("mousedown", startDrawing); canvas.addEventListener("mousemove", draw); canvas.addEventListener("mouseup", stopDrawing); canvas.addEventListener("mouseleave", stopDrawing); canvas.addEventListener("touchstart", startDrawing, { passive: !1 }); canvas.addEventListener("touchmove", draw, { passive: !1 }); canvas.addEventListener("touchend", stopDrawing); canvas.addEventListener("touchcancel", stopDrawing); }
function saveHighlights(pageNumber) { if (!highlightCanvas) return; requestAnimationFrame(() => { try { localStorage.setItem(`flipbook-highlights-page-${pageNumber}`, highlightCanvas.toDataURL()); } catch (e) { console.error("Save highlights error:", e); if (e.name === "QuotaExceededError") alert("Storage full."); } }); }
function loadHighlights(pageNumber) {
    if (!highlightCanvas || !ctx) return;
    const dataUrl = localStorage.getItem(`flipbook-highlights-page-${pageNumber}`);
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); };
        img.onerror = () => { console.error("Failed load highlight image for page", pageNumber); localStorage.removeItem(`flipbook-highlights-page-${pageNumber}`); };
        img.src = dataUrl;
    }
}
function clearCurrentHighlights() { if (!ctx) return; if (confirm("Erase all highlights on this page?")) { ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height); localStorage.removeItem(`flipbook-highlights-page-${currentPage}`); } }
function updateCursor() { if (!highlightCanvas) return; const e = document.body.classList.contains("highlight-mode"); if (e) { if (drawMode === 'highlight') { highlightCanvas.style.cursor = ""; highlightCanvas.classList.add("highlight-cursor"); } else if (drawMode === 'pen') { highlightCanvas.style.cursor = "crosshair"; highlightCanvas.classList.remove("highlight-cursor"); } else { highlightCanvas.style.cursor = "cell"; highlightCanvas.classList.remove("highlight-cursor"); } } else { highlightCanvas.style.cursor = "default"; highlightCanvas.classList.remove("highlight-cursor"); } }

// --- Event Listeners for Highlight Buttons ---
if (toggleDrawModeBtn) { toggleDrawModeBtn.addEventListener('click', (e) => { e.stopPropagation(); const t = document.body.classList.contains("highlight-mode"); t ? (document.body.classList.remove("highlight-mode"), toggleDrawModeBtn.classList.remove("active"), highlightSettingsBtn && highlightSettingsBtn.classList.remove("active"), closeHighlightPopup()) : (document.body.classList.add("highlight-mode"), toggleDrawModeBtn.classList.add("active"), setDrawMode(drawMode), setActiveColorSwatch(colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${localStorage.getItem('flipbook-lastColor')}"]`) || colorSwatchesContainer.querySelector('.color-swatch'))); updateCursor(); }); }
if (highlightSettingsBtn) { highlightSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); const t = highlightPopup && highlightPopup.classList.contains("visible"); t ? closeHighlightPopup() : openHighlightPopup(); }); }
function openHighlightPopup() { if(highlightPopup) highlightPopup.classList.add('visible'); if(highlightSettingsBtn) highlightSettingsBtn.classList.add('active'); }
function closeHighlightPopup() { if(highlightPopup) highlightPopup.classList.remove('visible'); if(highlightSettingsBtn) highlightSettingsBtn.classList.remove('active'); }
if (colorSwatchesContainer) { colorSwatchesContainer.addEventListener('click', (e) => { const swatch = e.target.closest('.color-swatch'); if (swatch) { setActiveColorSwatch(swatch); if (drawMode === 'eraser') setDrawMode('pen'); else updateCurrentColor(); closeHighlightPopup(); } }); }
function setActiveColorSwatch(swatchElement) { if (!swatchElement || !colorSwatchesContainer) return; colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active')); swatchElement.classList.add('active'); updateCurrentColor(); try { localStorage.setItem('flipbook-lastColor', swatchElement.dataset.penColor); } catch(e) { console.warn("Could not save color pref:", e); } }
if (penToolBtnPopup) { penToolBtnPopup.addEventListener('click', () => { setDrawMode('pen'); closeHighlightPopup(); }); }
if (highlightToolBtn) { highlightToolBtn.addEventListener('click', () => { setDrawMode('highlight'); closeHighlightPopup(); }); }
if (eraserToolBtnPopup) { eraserToolBtnPopup.addEventListener('click', () => { setDrawMode('eraser'); closeHighlightPopup(); }); }

function setDrawMode(mode) {
    drawMode = mode;
    if (penToolBtnPopup) penToolBtnPopup.classList.remove('active');
    if (eraserToolBtnPopup) eraserToolBtnPopup.classList.remove('active');
    if (highlightToolBtn) highlightToolBtn.classList.remove('active');
    
    if (colorSwatchesContainer) colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
    
    let savedColor = localStorage.getItem('flipbook-lastColor');
    const activeSwatch = colorSwatchesContainer && (colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${savedColor}"]`) || colorSwatchesContainer.querySelector('.color-swatch'));

    if (mode === 'highlight') {
        if (highlightToolBtn) highlightToolBtn.classList.add('active');
        if (activeSwatch) activeSwatch.classList.add('active');
    } else if (mode === 'pen') {
        if (penToolBtnPopup) penToolBtnPopup.classList.add('active');
        if (activeSwatch) activeSwatch.classList.add('active');
    } else { // Eraser
        if (eraserToolBtnPopup) eraserToolBtnPopup.classList.add('active');
    }
    updateCurrentColor(); updateCursor();
    try { localStorage.setItem('flipbook-lastDrawMode', drawMode); } catch(e) { console.warn("Could not save draw mode:", e); }
}

function updateCurrentColor() {
    const activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch.active');
    if (!activeSwatch) {
         const firstSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch');
         if (firstSwatch) {
             setActiveColorSwatch(firstSwatch);
             return;
         }
         return;
    }
    if (drawMode === 'pen') { currentHighlightColor = activeSwatch.dataset.penColor; }
    else if (drawMode === 'highlight') { currentHighlightColor = activeSwatch.dataset.highlightColor; }
}

if (brushSizeSliderPopup) {
    brushSizeSliderPopup.addEventListener('input', (e) => { currentBrushSize = e.target.value; });
    brushSizeSliderPopup.addEventListener('mouseup', () => { try { localStorage.setItem('flipbook-lastBrushSize', currentBrushSize); } catch(e) { console.warn("Could not save brush size:", e); } });
    brushSizeSliderPopup.addEventListener('touchend', () => { try { localStorage.setItem('flipbook-lastBrushSize', currentBrushSize); } catch(e) { console.warn("Could not save brush size:", e); } });
}
if (clearHighlightsBtnPopup) { clearHighlightsBtnPopup.addEventListener('click', () => { clearCurrentHighlights(); closeHighlightPopup(); }); }

window.addEventListener('resize', () => { const img = document.querySelector('.page-image'); if (img && highlightCanvas) { setTimeout(() => { sizeCanvasToImage(img, highlightCanvas); loadHighlights(currentPage); }, 150); } closeHighlightPopup(); });

// --- SEARCH LOGIC ---
function toggleSearchBox() { if(!searchContainer)return;"none"!==searchContainer.style.display?closeSearchBox():(searchContainer.style.display="flex",searchInput&&searchInput.focus(),searchResults&&(searchResults.innerHTML="")) }
function closeSearchBox() { searchContainer&&(searchContainer.style.display="none"),searchInput&&(searchInput.value=""),searchResults&&(searchResults.innerHTML="") }
function performSearch() { if(!searchInput||!searchResults||0===Object.keys(bookTextData).length)return;const e=searchInput.value.trim().toLowerCase();if(searchResults.innerHTML="",e.length<2){const t=document.createElement("div");return t.classList.add("no-results"),t.textContent="Please enter at least 2 characters.",void searchResults.appendChild(t)}const n=[];for(const o in bookTextData){const a=bookTextData[o];a&&a.toLowerCase().includes(e)&&n.push(parseInt(o,10))}if(n.length>0){n.sort((e,t)=>e-t),n.forEach(e=>{const t=document.createElement("div");t.textContent=`Page ${e+1}`,t.onclick=()=>{goToPage(e),closeSearchBox()},searchResults.appendChild(t)})}else{const l=document.createElement("div");l.classList.add("no-results"),l.textContent="No results found.",searchResults.appendChild(l)} }
if (searchBtn) searchBtn.addEventListener('click', toggleSearchBox);
if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearchBox);
if (searchInput) { searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { performSearch(); e.preventDefault(); } if (e.key === 'Escape') { closeSearchBox(); e.preventDefault(); } }); }

// --- AI HELPER ---
async function getImageAsBase64FromCanvas(){ const e=document.querySelector(".page-image");if(!e||!e.complete||0===e.naturalWidth)return console.error("Image not ready"),null;try{const t=document.createElement("canvas");t.width=e.naturalWidth,t.height=e.naturalHeight;return t.getContext("2d").drawImage(e,0,0),t.toDataURL("image/png").split(",")[1]}catch(o){return console.error("Canvas error:",o),null}}
if(aiHelperToggle)aiHelperToggle.addEventListener("click",()=>{const e=getCurrentChapter();if(aiChapterTitleEl)aiChapterTitleEl.textContent=e?e.title:"Current Page";if(aiResponseEl){aiResponseEl.innerHTML=""; aiResponseEl.classList.remove('rtl-text');} if(translateAnalysisBtn) translateAnalysisBtn.style.display = 'none'; if(aiModal)aiModal.style.display="flex"});
if(aiCloseBtn)aiCloseBtn.addEventListener("click",()=>{if(aiModal)aiModal.style.display="none"});
if(aiModal)aiModal.addEventListener("click",e=>{if(e.target===aiModal)aiModal.style.display="none"});
function getCurrentChapter(){ if(!config.chapters||0===config.chapters.length)return null;let e=config.chapters[0];for(let t=config.chapters.length-1;t>=0;t--)if(currentPage>=config.chapters[t].page-1){e=config.chapters[t];break}return e}

async function getAiHelp(e){
    if(!APPS_SCRIPT_PROXY_URL) { if(aiResponseEl) aiResponseEl.textContent="AI Helper not configured: Proxy URL missing."; return; }
    if(!aiLoadingEl||!aiResponseEl)return;
    aiLoadingEl.style.display="block"; aiResponseEl.innerHTML=""; aiResponseEl.classList.remove('rtl-text'); if(translateAnalysisBtn) translateAnalysisBtn.style.display = 'none';
    let originalRequestBody; const n=getCurrentChapter(),o=n?n.title:"this page";
    try{
        let apiUrl = APPS_SCRIPT_PROXY_URL;
        if("analyze_page"===e){
             let a=await getImageAsBase64FromCanvas();
             if(!a) { aiResponseEl.textContent="Could not process page image."; aiLoadingEl.style.display="none"; return; }
             originalRequestBody={contents:[{parts:[{text:`Analyze this physics page (from chapter "${o}"). Summarize concepts,explain formulas/diagrams,and give a takeaway for a life science student.`},{inline_data:{mime_type:"image/png",data:a}}]}]};
        } else {
             let r;
             switch(e){
                 case"explain":{const i=window.prompt(`Concept from "${o}" to explain?`,"Pascal's Principle");if(!i){aiLoadingEl.style.display="none"; return;} r=`Explain "${i}" from "${o}" simply for life science students.`;}break;
                 case"quiz":r=`Generate 2 multiple-choice questions on "${o}". Explain the correct answer (bold it).`;break;
                 case"relate":r=`Provide 2 examples of how "${o}" applies to biology or medicine.`;break;
                 default:aiLoadingEl.style.display="none"; return;
             }
             originalRequestBody={contents:[{parts:[{text:r}]}]};
        }

        const fetchOptions = { method: "POST", body: JSON.stringify(originalRequestBody), headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        const response = await fetchWithRetry(apiUrl, fetchOptions);

        if(!response.ok){ let p= `Proxy Error (${response.status}): ${response.statusText}`; try { const errorData = await response.json(); p = (errorData.error && errorData.error.message) ? `API Error via Proxy: ${errorData.error.message}` : p; } catch(g){} throw new Error(p); }
        const responseData = await response.json();
        if (responseData.error && responseData.error.message) { throw new Error(`API Error via Proxy: ${responseData.error.message}`); }
        if(!responseData.candidates || responseData.candidates.length === 0 || !responseData.candidates[0].content || !responseData.candidates[0].content.parts || responseData.candidates[0].content.parts.length === 0){ let f="Unknown"; if(responseData.candidates && responseData.candidates[0]) f=responseData.candidates[0].finishReason; console.warn("AI response missing content. Reason:",f,responseData); aiResponseEl.textContent=`Response was blocked or empty. Reason: ${f}.`;}
        else{
            const resultText = responseData.candidates[0].content.parts[0].text;
            "undefined"!=typeof marked ? aiResponseEl.innerHTML = marked.parse(resultText) : aiResponseEl.innerText = resultText;
            if(translateAnalysisBtn && aiResponseEl.innerText.trim()) translateAnalysisBtn.style.display = 'block';
            window.MathJax && MathJax.typesetPromise([aiResponseEl]).catch(b=>console.error("MathJax error:",b));
        }
    }catch(w){ console.error("AI Helper Error:",w); aiResponseEl.textContent=`Error: ${w.message}` }
    finally{aiLoadingEl.style.display="none"}
}


// --- Translation Helper Function ---
async function callTranslationAPI(textToTranslate) {
    if (!APPS_SCRIPT_PROXY_URL) return { success: false, message: "AI proxy URL not configured." };
    if (!textToTranslate || !textToTranslate.trim()) return { success: false, message: "No text provided for translation." };
    try {
        const originalRequestBody = { contents: [{ parts: [{ text:`Translate the following English text accurately into clear, educational Arabic suitable for university-level students. Preserve specific terminology and equations where appropriate. Focus only on translation.\n\n---START---\n${textToTranslate}\n---END---` }] }] };
        const fetchOptions = { method: 'POST', body: JSON.stringify(originalRequestBody), headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        const resp = await fetchWithRetry(APPS_SCRIPT_PROXY_URL, fetchOptions);
        if (!resp.ok) { let errorText = `Proxy Error (${resp.status}): ${resp.statusText}`; try { const errorData = await resp.json(); errorText = (errorData.error && errorData.error.message) ? `API Error via Proxy: ${errorData.error.message}` : errorText; } catch (e) {} throw new Error(errorText); }
        const data = await resp.json();
        if (data.error && data.error.message) { throw new Error(`API Error via Proxy: ${data.error.message}`); }
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) { let reason = data.candidates?.[0]?.finishReason || "Unknown reason"; console.warn("Translate response missing. Reason:", reason, data); return { success: false, message: `Translation failed. Reason: ${reason}.` }; }
        return { success: true, translatedText: data.candidates[0].content.parts[0].text };
    } catch (err) { console.error("Translate API error:", err); return { success: false, message: `Translation Error: ${err.message}` }; }
}

// --- Translate Page (from AI Modal) ---
async function translateCurrentPage() {
    if(aiModal) aiModal.style.display = 'none';
    const overlay = document.getElementById("translationOverlay"); if (!overlay) return;
    const content = document.getElementById("translationContent"); if (!content) return;
    
    overlay.style.display = 'block'; content.textContent = '🔄 Loading text...';
    const pageKey = String(currentPage); const englishText = bookTextData[pageKey];
    if (englishText === undefined) { content.textContent = '⚠️ Text data unavailable.'; return; }
    if (!englishText || !englishText.trim()) { content.textContent = 'ℹ️ No translatable text found.'; return; }
    
    content.textContent = '🌐 Translating to Arabic...';
    const result = await callTranslationAPI(englishText);
    
    if (result.success) {
        content.innerText = result.translatedText; // Use innerText for safety
        if (window.MathJax) MathJax.typesetPromise([content]).catch(p => console.error("MathJax translate error:", p));
    } else {
        content.textContent = result.message;
    }
}

// --- Translate Analysis Results (from AI Modal) ---
async function translateAnalysisResults() {
    if (!aiResponseEl || !aiLoadingEl) return;
    const englishText = aiResponseEl.innerText;
    if (!englishText || !englishText.trim() || englishText.endsWith("(Translated)")) {
        alert("Already translated or no text to translate.");
        return;
    }

    aiLoadingEl.style.display = 'block';
    if (translateAnalysisBtn) translateAnalysisBtn.style.display = 'none';
    const result = await callTranslationAPI(englishText);
    if (result.success) {
        aiResponseEl.innerText = result.translatedText + "\n\n(Translated)";
        aiResponseEl.classList.add('rtl-text'); // Add RTL class
        if (window.MathJax) MathJax.typesetPromise([aiResponseEl]).catch(b=>console.error("MathJax error:",b));
    } else {
        alert(result.message);
         aiResponseEl.classList.remove('rtl-text'); // Ensure LTR if failed
        if (translateAnalysisBtn) translateAnalysisBtn.style.display = 'block';
    }
    aiLoadingEl.style.display = 'none';
}
if (translateAnalysisBtn) {
    translateAnalysisBtn.addEventListener('click', translateAnalysisResults);
}

// --- Preference Loader ---
function loadPreferences() {
    try {
        const savedPage = localStorage.getItem('flipbook-lastPage');
        if (savedPage) {
            let pageNum = parseInt(savedPage, 10);
            if (!isNaN(pageNum) && pageNum >= 0 && pageNum < totalPages) {
                currentPage = pageNum;
            }
        }
        
        const savedColor = localStorage.getItem('flipbook-lastColor'); // This is the PEN color
        const savedMode = localStorage.getItem('flipbook-lastDrawMode');
        if (savedMode) drawMode = savedMode;

        if (savedColor && colorSwatchesContainer) {
             const matchingSwatch = colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${savedColor}"]`);
             if (matchingSwatch) {
                 if (drawMode === 'pen') {
                    currentHighlightColor = matchingSwatch.dataset.penColor;
                 } else { // Default to highlight
                    currentHighlightColor = matchingSwatch.dataset.highlightColor;
                 }
             }
        }

        const savedSize = localStorage.getItem('flipbook-lastBrushSize');
        if (savedSize) currentBrushSize = savedSize;
        
    } catch (e) {
        console.warn("Could not load preferences from localStorage:", e);
    }
}

// --- Initial Setup & Global Key Listener ---
function resetPageInputTimer() {
    if (pageInputTimer) clearTimeout(pageInputTimer);
    pageInputTimer = setTimeout(() => {
        if (pageInput && document.activeElement !== pageInput) {
             pageInput.value = currentPage + 1;
        } else if (pageInput && document.activeElement === pageInput && pageInput.value.length > 0) {
             jumpToPage();
             pageInput.blur();
        } else if (pageInput) {
             pageInput.value = currentPage + 1;
        }
        pageInputTimer = null;
    }, 1500);
}

function handleGlobalKeys(e) {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    if (e.key === "Escape") {
        e.preventDefault(); 
        if (aiModal && aiModal.style.display !== 'none') aiModal.style.display = 'none';
        else if (phetModal && phetModal.style.display !== 'none') closePhetModal();
        else if (videoModal && videoModal.style.display !== 'none') closeVideoModal();
        else if (indexMenu && indexMenu.style.display !== 'none') closeIndexMenu();
        else if (searchContainer && searchContainer.style.display !== 'none') closeSearchBox();
        else if (highlightPopup && highlightPopup.classList.contains('visible')) closeHighlightPopup();
        else if (isInputFocused) activeEl.blur();
        return;
    }

    if (isInputFocused) {
        if (activeEl === pageInput && e.key === 'Enter') {
             jumpToPage();
             activeEl.blur();
        }
        return;
    }
    
    const modalIsOpen = (aiModal && aiModal.style.display !== 'none') ||
                        (phetModal && phetModal.style.display !== 'none') ||
                        (videoModal && videoModal.style.display !== 'none');
    if (modalIsOpen) return;


    if (e.key === "ArrowLeft") {
        e.preventDefault(); prevPage();
    } else if (e.key === "ArrowRight") {
        e.preventDefault(); nextPage();
    } else if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        if (pageInput) {
            if (document.activeElement !== pageInput || !pageInputTimer) { pageInput.value = e.key; }
            else { pageInput.value += e.key; }
            pageInput.focus();
            resetPageInputTimer();
        }
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (pageInput && document.activeElement === pageInput && pageInput.value !== (currentPage + 1).toString()) { jumpToPage(); }
        if (pageInput) pageInput.blur();
        if (pageInputTimer) { clearTimeout(pageInputTimer); pageInputTimer = null; }
    } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (toggleDrawModeBtn) toggleDrawModeBtn.click();
    } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (searchBtn && !searchBtn.disabled) toggleSearchBox();
    } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (aiHelperToggle) aiHelperToggle.click();
    } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (document.body.classList.contains("highlight-mode")) {
            clearCurrentHighlights();
        }
    }
}

// Add click listener for the static translation close button
const staticTranslationCloseBtn = document.getElementById('translationCloseBtn');
if (staticTranslationCloseBtn) {
    staticTranslationCloseBtn.addEventListener('click', () => {
        const overlay = document.getElementById('translationOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    loadPreferences();
    
    // Await critical data
    await loadBookText();
    await loadChapters();
    
    const flipbookElement = document.getElementById('flipbook');
    if (flipbookElement) {
        flipbookElement.addEventListener("touchstart", handleTouchStartSwipe, { passive: true });
        flipbookElement.addEventListener("touchend", handleTouchEndSwipe, { passive: true });
    }
    const pageCounterEl = document.getElementById('pageCounter');
    const pageInputEl = document.getElementById('pageInput');
    if (pageCounterEl) pageCounterEl.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInputEl) { pageInputEl.max = totalPages; pageInputEl.value = currentPage + 1; }
    
    document.addEventListener("keydown", handleGlobalKeys);

    // Apply loaded preferences to UI
    if (brushSizeSliderPopup) brushSizeSliderPopup.value = currentBrushSize;
    
    let savedColor = localStorage.getItem('flipbook-lastColor'); // This is the base/pen color
    let activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector(`.color-swatch[data-pen-color="${savedColor}"]`);
    if (!activeSwatch && colorSwatchesContainer) {
        activeSwatch = colorSwatchesContainer.querySelector('.color-swatch'); // Fallback to first
    }
    setActiveColorSwatch(activeSwatch);
    setDrawMode(drawMode); // Set the initial tool (which also sets the correct color)

    renderThumbs();
    renderIndex(); // Now runs after chapters are loaded
    renderPage(); // Render the loaded page
});

