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
        const translateBtn = document.getElementById('translateBtn');
        if (translateBtn) {
            translateBtn.disabled = true;
            translateBtn.title = "Translation unavailable";
            translateBtn.textContent = "🌐 Text Unavailable";
            translateBtn.style.backgroundColor = '#aaa';
            translateBtn.style.cursor = 'not-allowed';
        }
         const searchBtn = document.getElementById('searchBtn');
         if (searchBtn) searchBtn.disabled = true;
    }
}

// ---------- Flipbook data ----------
const totalPages = (typeof config !== 'undefined' && config.totalPages) ? config.totalPages : 1;
const imagePath = (typeof config !== 'undefined' && config.imagePath) ? config.imagePath : './images/page_';
const thumbPath = (typeof config !== 'undefined' && config.thumbPath) ? config.thumbPath : './thumbs/thumb_';

const images = Array.from({ length: totalPages }, (_, i) => `${imagePath}${i}.png`);
const thumbs = Array.from({ length: totalPages }, (_, i) => `${thumbPath}${i}.jpg`);
let currentPage = 0;
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
const highlightPopup = document.getElementById('highlight-popup');
const colorSwatchesContainer = document.querySelector('.color-swatches');
const eraserToolBtnPopup = document.getElementById('eraser-tool-btn-popup');
const brushSizeSliderPopup = document.getElementById('brush-size-popup');
const clearHighlightsBtnPopup = document.getElementById('clear-highlights-btn-popup');
let currentHighlightColor = 'rgba(255, 255, 0, 0.2)'; // Default highlight color
let currentBrushSize = 40; // Default brush size
let highlightCanvas, ctx, isDrawing = false, drawMode = 'highlight', lastX = 0, lastY = 0;

// --- ZOOM/PAN VARIABLES ---
let hammerManager = null; // To store Hammer instance
let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;
let pinchStartScale = 1; // Store scale at the beginning of a pinch


// --- SEARCH VARIABLES ---
const searchBtn = document.getElementById('searchBtn');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const searchResults = document.getElementById('searchResults');
if (searchBtn) searchBtn.disabled = true; // Disable initially until book text loads

function getYoutubeEmbedUrl(url) {
    try {
        const urlObj = new URL(url);
        let videoId = null;
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
            videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
            urlObj.searchParams.set('autoplay', '1');
            urlObj.searchParams.set('rel', '0');
            urlObj.hostname = 'www.youtube-nocookie.com';
            return urlObj.toString();
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/shorts/')) {
            videoId = urlObj.pathname.split('/shorts/')[1];
        }

        if (videoId) {
            return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
        }
    } catch (e) {
        console.error("Invalid video URL:", url, e);
    }
    return url;
}

// ---------- Render page ----------
function renderPage() {
    if (!flipbook) return;
    flipbook.innerHTML = ""; // Clear previous content, including old wrap/hammer instance
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.id = "page-wrap-" + currentPage; // Give unique ID for Hammer

    // Reset transformations
    resetZoomPan(wrap);

    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    canvas.id = "highlight-canvas";
    highlightCanvas = canvas;

    img.className = "page-image";
    img.src = images[currentPage];
    img.alt = `Page ${currentPage + 1}`;
    img.loading = "eager";
    img.crossOrigin = "anonymous";
    img.onerror = () => {
        img.alt = "Image not available";
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='24' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E";
    };

    img.onload = () => {
        sizeCanvasToImage(img, canvas);
        ctx = canvas.getContext('2d');
        setupDrawingListeners(canvas); // Setup listeners AFTER sizing and context
        loadHighlights(currentPage); // Load highlights AFTER sizing and context
        updateCursor(); // Apply initial cursor state based on draw mode
        // Initialize Hammer.js *after* image and canvas are loaded and sized
        setupHammer(wrap);
    };

    wrap.appendChild(img);
    wrap.appendChild(canvas);

    const overlay = document.createElement("div");
    overlay.className = "overlay-translation";
    overlay.id = "overlay-translation";
    wrap.appendChild(overlay);
    flipbook.appendChild(wrap);

    if (counter) counter.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInput) pageInput.value = currentPage + 1;
    highlightThumb();

    if (typeof config !== 'undefined') {
        const simConfig = config.simulations && config.simulations.find(s => s.page === (currentPage + 1));
        if (phetBtn) phetBtn.style.display = simConfig ? 'inline-block' : 'none';
        const videoConfig = config.videos && config.videos.find(v => v.page === (currentPage + 1));
        if (videoBtn) videoBtn.style.display = videoConfig ? 'inline-block' : 'none';
    }

    const currentOverlay = document.getElementById('overlay-translation');
    if (currentOverlay) currentOverlay.style.display = 'none';
    const hideBtn = document.getElementById('hideTranslateBtn');
    if (hideBtn) hideBtn.style.display = 'none';

    closeSearchBox();
    closeHighlightPopup(); // Close drawing popup when changing pages
    preloadImages();
}

function resetZoomPan(element) {
    currentScale = 1;
    currentOffsetX = 0;
    currentOffsetY = 0;
    pinchStartScale = 1;
    if (element) {
        element.style.transform = 'scale(1) translate(0px, 0px)';
    }
}


function preloadImages() {
    if (currentPage < images.length - 1) { (new Image()).src = images[currentPage + 1]; }
    if (currentPage > 0) { (new Image()).src = images[currentPage - 1]; }
}

function renderThumbs() {
    if (!thumbbar) return;
    thumbbar.innerHTML = "";
    thumbs.forEach((src, i) => {
        const t = document.createElement("img");
        t.src = src;
        t.alt = `Thumb ${i + 1}`;
        t.loading = "lazy";
        t.addEventListener("click", () => { if (currentPage !== i) { currentPage = i; renderPage(); } });
        t.onerror = () => { t.alt = "Thumb N/A"; t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E"; };
        thumbbar.appendChild(t);
    });
}

function highlightThumb() {
    if (!thumbbar) return;
    let activeThumb = null;
    thumbbar.querySelectorAll("img").forEach((im, i) => {
        const isActive = i === currentPage;
        im.classList.toggle("active", isActive);
        if (isActive) activeThumb = im;
    });
    if (activeThumb) {
        const rect = activeThumb.getBoundingClientRect();
        const parentRect = thumbbar.getBoundingClientRect();
        if (rect.left < parentRect.left || rect.right > parentRect.right) {
             activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

function renderIndex() {
    if (!indexMenu || !indexToggle) return;
    indexMenu.innerHTML = "";
    if (typeof config !== 'undefined' && config.chapters && config.chapters.length > 0) {
        config.chapters.forEach(chapter => { const button = document.createElement("button"); button.textContent = chapter.title; button.onclick = () => goToPage(chapter.page - 1); indexMenu.appendChild(button); });
        indexToggle.style.display = 'inline-block';
    } else {
        indexToggle.style.display = 'none';
    }
}

function nextPage() { if (currentPage < images.length - 1) { currentPage++; renderPage(); } }
function prevPage() { if (currentPage > 0) { currentPage--; renderPage(); } }
function firstPage() { if (currentPage !== 0) { currentPage = 0; renderPage(); } }
function lastPage() { if (currentPage !== images.length - 1) { currentPage = images.length - 1; renderPage(); } }

function jumpToPage() {
    if (!pageInput) return;
    const v = parseInt(pageInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages && (v - 1) !== currentPage) {
        currentPage = v - 1;
        renderPage();
    } else {
        pageInput.value = currentPage + 1;
    }
}
if (pageInput) {
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { jumpToPage(); e.preventDefault(); } });
}

function toggleFullScreen() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`)); }
function shareBook(){ const shareData = { title: "PHYS101 Flipbook", url: window.location.href }; if (navigator.share) { navigator.share(shareData).catch((err) => console.log("Share failed:", err)); } else if (navigator.clipboard) { const textArea = document.createElement("textarea"); textArea.value = window.location.href; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); alert("Link copied to clipboard!"); } catch (err) { console.error('Fallback copy failed', err); alert('Failed to copy link.'); } document.body.removeChild(textArea); } else { alert("Sharing/Copying not supported."); } }
function openIndexMenu() { if (!indexToggle || !footer || !indexMenu) return; const rect = indexToggle.getBoundingClientRect(); const footerRect = footer.getBoundingClientRect(); indexMenu.style.left = `${rect.left - footerRect.left}px`; indexMenu.style.bottom = `${footerRect.height}px`; indexMenu.style.top = "auto"; indexMenu.style.display = "flex"; indexMenu.setAttribute("aria-hidden","false"); indexToggle.setAttribute("aria-expanded","true"); }
function closeIndexMenu(){ if (!indexMenu || !indexToggle) return; indexMenu.style.display="none"; indexMenu.setAttribute("aria-hidden","true"); indexToggle.setAttribute("aria-expanded","false"); }
if (indexToggle) indexToggle.addEventListener("click", e=>{ e.stopPropagation(); indexMenu.style.display === "flex" ? closeIndexMenu() : openIndexMenu(); });
if (indexMenu) indexMenu.addEventListener("click", e => e.stopPropagation());

// Global click listener to close popups
document.addEventListener("click", e => {
    // Close Index Menu
    if (indexMenu && indexToggle && indexMenu.style.display === "flex" && !indexMenu.contains(e.target) && !indexToggle.contains(e.target)) {
        closeIndexMenu();
    }
    // Close Search Box
    if (searchContainer && searchContainer.style.display !== 'none' && !searchContainer.contains(e.target) && e.target !== searchBtn) {
        closeSearchBox();
    }
    // Close Highlight Popup (only if click is outside popup AND outside toggle button)
    if (highlightPopup && toggleDrawModeBtn && highlightPopup.classList.contains('visible') && !highlightPopup.contains(e.target) && e.target !== toggleDrawModeBtn) {
        closeHighlightPopup();
        // Keep draw mode active even if popup closes via outside click
    }
});

function goToPage(page){ if (page >= 0 && page < images.length){ currentPage = page; renderPage(); closeIndexMenu(); } }
window.goToPage = goToPage;

// ---------- Input & touch (For SWIPING ONLY - Modified) ----------
let touchStartX = 0, touchEndX = 0;
const swipeThreshold = 50;
let isPinching = false; // Flag to track if pinch is active

function handleTouchStartSwipe(e){
    if (document.body.classList.contains('highlight-mode') || isPinching || e.touches.length > 1) { touchStartX = null; return; }
    touchStartX = e.touches[0].clientX;
}
function handleTouchEndSwipe(e){
    if (document.body.classList.contains('highlight-mode') || isPinching || touchStartX === null || e.touches.length > 0) { touchStartX = null; return; }
    touchEndX = e.changedTouches[0].clientX;
    handleSwipeGesture();
}
function handleSwipeGesture(){
    if (touchStartX === null) return;
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > swipeThreshold){ if(diff > 0){ prevPage(); } else { nextPage(); } }
    touchStartX = null;
}

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


// --- HAMMER.JS SETUP ---
function setupHammer(element) {
    if (!element || typeof Hammer === 'undefined') return;
    if (hammerManager) { hammerManager.destroy(); hammerManager = null; }

    hammerManager = new Hammer.Manager(element);
    const pinch = new Hammer.Pinch();
    const pan = new Hammer.Pan({ pointers: 2 });
    pinch.recognizeWith(pan);
    hammerManager.add([pinch, pan]);

    let initialOffsetX = currentOffsetX, initialOffsetY = currentOffsetY;

    hammerManager.on('pinchstart', (e) => { if (isDrawing) return; isPinching = true; pinchStartScale = currentScale; element.style.transition = 'none'; });
    hammerManager.on('pinchmove', (e) => { if (isDrawing || !isPinching) return; currentScale = Math.max(1, Math.min(pinchStartScale * e.scale, 5)); applyTransform(element); });
    hammerManager.on('pinchend pinchcancel', (e) => { if (isDrawing) return; isPinching = false; element.style.transition = ''; });
    hammerManager.on('panstart', (e) => { if (currentScale <= 1 || isDrawing || e.pointers.length < 2) { /* hammerManager.stop(true); */ return; } initialOffsetX = currentOffsetX; initialOffsetY = currentOffsetY; element.style.transition = 'none'; });
    hammerManager.on('panmove', (e) => {
        if (currentScale <= 1 || isDrawing || e.pointers.length < 2) return;
        const rect = element.getBoundingClientRect();
        const parentRect = flipbook.getBoundingClientRect();
        const maxMoveX = Math.max(0, (rect.width - parentRect.width) / 2);
        const maxMoveY = Math.max(0, (rect.height - parentRect.height) / 2);
        currentOffsetX = initialOffsetX + e.deltaX;
        currentOffsetY = initialOffsetY + e.deltaY;
        currentOffsetX = Math.max(-maxMoveX, Math.min(currentOffsetX, maxMoveX));
        currentOffsetY = Math.max(-maxMoveY, Math.min(currentOffsetY, maxMoveY));
        applyTransform(element);
    });
    hammerManager.on('panend pancancel', (e) => { if (currentScale <= 1 || isDrawing) return; element.style.transition = ''; });
}

function applyTransform(element) { if (!element) return; element.style.transform = `scale(${currentScale}) translate(${currentOffsetX}px, ${currentOffsetY}px)`; }

// --- HIGHLIGHTING LOGIC ---
function sizeCanvasToImage(img, canvas) { if (!img || !canvas) return; const rect = img.getBoundingClientRect(); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; canvas.style.top = `0px`; canvas.style.left = `0px`; if (ctx) ctx = canvas.getContext('2d'); }

function getDrawPosition(e, canvas) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleXCanvas = canvas.width / rect.width;
    const scaleYCanvas = canvas.height / rect.height;
    // Use pageX/Y if available for touch, adjust for scroll, fallback to clientX/Y
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].pageX - window.scrollX;
        clientY = e.touches[0].pageY - window.scrollY;
    } else if (e.changedTouches && e.changedTouches.length > 0) { // For touchend
         clientX = e.changedTouches[0].pageX - window.scrollX;
         clientY = e.changedTouches[0].pageY - window.scrollY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const canvasXUnscaled = screenX * scaleXCanvas;
    const canvasYUnscaled = screenY * scaleYCanvas;
    return { x: canvasXUnscaled, y: canvasYUnscaled };
}


function startDrawing(e) {
    if (!highlightCanvas || !ctx || !document.body.classList.contains('highlight-mode') || e.target !== highlightCanvas) return;
    if (e.touches && e.touches.length > 1) return;
    if (hammerManager) { hammerManager.get('pinch').set({ enable: false }); hammerManager.get('pan').set({ enable: false }); }
    if (e.touches) e.preventDefault();
    isDrawing = true;
    const pos = getDrawPosition(e, highlightCanvas);
    [lastX, lastY] = [pos.x, pos.y];
    if (drawMode === 'eraser') { ctx.beginPath(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.arc(pos.x, pos.y, currentBrushSize / 2, 0, Math.PI * 2); ctx.fill(); }
}

function draw(e) {
    if (!isDrawing || !ctx) return;
    if (e.touches) e.preventDefault();
    if (drawMode === 'eraser') { const pos = getDrawPosition(e, highlightCanvas); ctx.beginPath(); ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = currentBrushSize; ctx.moveTo(lastX, lastY); ctx.lineTo(pos.x, pos.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); [lastX, lastY] = [pos.x, pos.y]; }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    let pos = getDrawPosition(e, highlightCanvas); // Use getDrawPosition for consistency

    if (drawMode === 'highlight') {
        ctx.beginPath();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentHighlightColor;
        ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'butt'; // Use flat ends
        ctx.moveTo(lastX, lastY); // Start point
        ctx.lineTo(pos.x, lastY); // End point (same Y coordinate)
        ctx.stroke();
    }
    saveHighlights(currentPage);
    if (hammerManager) { hammerManager.get('pinch').set({ enable: true }); hammerManager.get('pan').set({ enable: true }); }
}

function setupDrawingListeners(canvas) {
    if (!canvas) return;
    canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mouseleave', stopDrawing); canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', stopDrawing); canvas.removeEventListener('touchcancel', stopDrawing);
    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseleave', stopDrawing); canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDrawing); canvas.addEventListener('touchcancel', stopDrawing);
}

function saveHighlights(pageNumber) { if (!highlightCanvas) return; requestAnimationFrame(() => { try { localStorage.setItem(`flipbook-highlights-page-${pageNumber}`, highlightCanvas.toDataURL()); } catch (e) { console.error("Save highlights error:", e); if (e.name === 'QuotaExceededError') alert('Storage full.'); } }); }

function loadHighlights(pageNumber) {
    if (!highlightCanvas || !ctx) return;
    const dataUrl = localStorage.getItem(`flipbook-highlights-page-${pageNumber}`);
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); };
        img.onerror = () => { console.error("Failed load highlight", pageNumber); localStorage.removeItem(`flipbook-highlights-page-${pageNumber}`); };
        img.src = dataUrl;
    }
}

function clearCurrentHighlights() { if (!ctx) return; if (confirm("Erase all highlights on this page?")) { ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height); localStorage.removeItem(`flipbook-highlights-page-${currentPage}`); } }
function updateCursor() { if (!highlightCanvas) return; const e = document.body.classList.contains("highlight-mode"); e ? "highlight" === drawMode ? (highlightCanvas.style.cursor = "", highlightCanvas.classList.add("highlight-cursor")) : (highlightCanvas.style.cursor = "cell", highlightCanvas.classList.remove("highlight-cursor")) : (highlightCanvas.style.cursor = "default", highlightCanvas.classList.remove("highlight-cursor")) }

// --- Event Listeners for Highlight Pop-up (Updated) ---
if (toggleDrawModeBtn) {
    toggleDrawModeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent this click from immediately closing the popup via the document listener
        if (highlightPopup) {
            const isVisible = highlightPopup.classList.contains('visible');
            if (isVisible) {
                // If popup is visible, clicking button turns everything off
                closeHighlightPopup();
                document.body.classList.remove('highlight-mode');
                toggleDrawModeBtn.classList.remove('active');
                updateCursor();
            } else {
                // If popup is hidden, clicking button turns mode on and shows popup
                openHighlightPopup();
                document.body.classList.add('highlight-mode');
                toggleDrawModeBtn.classList.add('active');
                // Ensure a tool is selected visually and logically
                let activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch.active');
                if (!activeSwatch && colorSwatchesContainer) activeSwatch = colorSwatchesContainer.querySelector('.color-swatch'); // Default to first color
                setActiveColorSwatch(activeSwatch); // Set color internally
                setDrawMode('highlight'); // Set mode and update buttons/cursor
            }
        }
    });
}

function openHighlightPopup() { if(highlightPopup) highlightPopup.classList.add('visible'); }
function closeHighlightPopup() { if(highlightPopup) highlightPopup.classList.remove('visible'); }

// Handle clicks on color swatches - CLOSE POPUP
if (colorSwatchesContainer) {
    colorSwatchesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            setActiveColorSwatch(e.target);
            setDrawMode('highlight');
            closeHighlightPopup(); // Close after selection
        }
    });
}
function setActiveColorSwatch(swatchElement) { if (!swatchElement || !colorSwatchesContainer) return; colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active')); swatchElement.classList.add('active'); currentHighlightColor = swatchElement.getAttribute('data-color'); }

// Handle Eraser button click in popup - CLOSE POPUP
if (eraserToolBtnPopup) {
    eraserToolBtnPopup.addEventListener('click', () => {
        setDrawMode('eraser');
        closeHighlightPopup(); // Close after selection
    });
}
function setDrawMode(mode) { drawMode = mode; if (mode === 'highlight') { if(eraserToolBtnPopup) eraserToolBtnPopup.classList.remove('active'); const activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch[data-color="' + currentHighlightColor + '"]'); if (activeSwatch && !activeSwatch.classList.contains('active')) { setActiveColorSwatch(activeSwatch); } else if (colorSwatchesContainer && !colorSwatchesContainer.querySelector('.color-swatch.active')) { const targetSwatch = colorSwatchesContainer.querySelector('.color-swatch[data-color="' + currentHighlightColor + '"]') || colorSwatchesContainer.querySelector('.color-swatch'); if(targetSwatch) setActiveColorSwatch(targetSwatch); } } else { if(eraserToolBtnPopup) eraserToolBtnPopup.classList.add('active'); if (colorSwatchesContainer) colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active')); } updateCursor(); }
if (brushSizeSliderPopup) { brushSizeSliderPopup.addEventListener('input', (e) => { currentBrushSize = e.target.value; }); currentBrushSize = brushSizeSliderPopup.value; }
if (clearHighlightsBtnPopup) clearHighlightsBtnPopup.addEventListener('click', () => { clearCurrentHighlights(); closeHighlightPopup(); });

window.addEventListener('resize', () => { const img = document.querySelector('.page-image'); if (img && highlightCanvas) { setTimeout(() => { sizeCanvasToImage(img, highlightCanvas); loadHighlights(currentPage); }, 150); } closeHighlightPopup(); if (toggleDrawModeBtn && toggleDrawModeBtn.classList.contains('active')) { toggleDrawModeBtn.classList.remove('active'); document.body.classList.remove('highlight-mode'); updateCursor(); } });

// --- SEARCH LOGIC ---
function toggleSearchBox() { if(!searchContainer)return;"none"!==searchContainer.style.display?closeSearchBox():(searchContainer.style.display="flex",searchInput&&searchInput.focus(),searchResults&&(searchResults.innerHTML="")) }
function closeSearchBox() { searchContainer&&(searchContainer.style.display="none"),searchInput&&(searchInput.value=""),searchResults&&(searchResults.innerHTML="") }
function performSearch() { if(!searchInput||!searchResults||0===Object.keys(bookTextData).length)return;const e=searchInput.value.trim().toLowerCase();if(searchResults.innerHTML="",e.length<2){const t=document.createElement("div");return t.classList.add("no-results"),t.textContent="Please enter at least 2 characters.",void searchResults.appendChild(t)}const n=[];for(const o in bookTextData){const a=bookTextData[o];a&&a.toLowerCase().includes(e)&&n.push(parseInt(o,10))}if(n.length>0){n.sort((e,t)=>e-t),n.forEach(e=>{const t=document.createElement("div");t.textContent=`Page ${e+1}`,t.onclick=()=>{goToPage(e),closeSearchBox()},searchResults.appendChild(t)})}else{const l=document.createElement("div");l.classList.add("no-results"),l.textContent="No results found.",searchResults.appendChild(l)} }
if (searchBtn) searchBtn.addEventListener('click', toggleSearchBox);
if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearchBox);
if (searchInput) { searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { performSearch(); e.preventDefault(); } if (e.key === 'Escape') { closeSearchBox(); e.preventDefault(); } }); }

// --- AI HELPER ---
const aiModal=document.getElementById("aiHelperModal"),aiHelperToggle=document.getElementById("aiHelperToggle"),aiCloseBtn=document.getElementById("aiCloseBtn"),aiResponseEl=document.getElementById("aiResponse"),aiLoadingEl=document.getElementById("aiLoading"),aiChapterTitleEl=document.getElementById("aiChapterTitle");
const GEMINI_API_KEY = (typeof config !== 'undefined' && config.geminiApiKey) ? config.geminiApiKey : 'YOUR_API_KEY_HERE';
async function getImageAsBase64FromCanvas(){/* ... unchanged ... */ const e=document.querySelector(".page-image");if(!e||!e.complete||0===e.naturalWidth)return console.error("Image not ready"),null;try{const t=document.createElement("canvas");t.width=e.naturalWidth,t.height=e.naturalHeight;return t.getContext("2d").drawImage(e,0,0),t.toDataURL("image/png").split(",")[1]}catch(o){return console.error("Canvas error:",o),null}}
if(aiHelperToggle)aiHelperToggle.addEventListener("click",()=>{const e=getCurrentChapter();if(aiChapterTitleEl)aiChapterTitleEl.textContent=e?e.title:"Current Page";if(aiResponseEl)aiResponseEl.innerHTML="";if(aiModal)aiModal.style.display="flex"});
if(aiCloseBtn)aiCloseBtn.addEventListener("click",()=>{if(aiModal)aiModal.style.display="none"});
if(aiModal)aiModal.addEventListener("click",e=>{if(e.target===aiModal)aiModal.style.display="none"});
function getCurrentChapter(){/* ... unchanged ... */ if(!config.chapters||0===config.chapters.length)return null;let e=config.chapters[0];for(let t=config.chapters.length-1;t>=0;t--)if(currentPage>=config.chapters[t].page-1){e=config.chapters[t];break}return e}
async function getAiHelp(e){/* ... unchanged ... */ if(!GEMINI_API_KEY||"YOUR_API_KEY_HERE"===GEMINI_API_KEY)return void(aiResponseEl&&(aiResponseEl.textContent="AI Helper not configured."));if(!aiLoadingEl||!aiResponseEl)return;aiLoadingEl.style.display="block",aiResponseEl.innerHTML="";let t;const n=getCurrentChapter(),o=n?n.title:"this page";try{if("analyze_page"===e){let a=await getImageAsBase64FromCanvas();if(!a)return aiResponseEl.textContent="Could not process page image.",void(aiLoadingEl.style.display="none");t={contents:[{parts:[{text:`Analyze this physics page (from chapter "${o}"). Summarize concepts,explain formulas/diagrams,and give a takeaway for a life science student.`},{inline_data:{mime_type:"image/png",data:a}}]}]}}else{let r;switch(e){case"explain":{const i=window.prompt(`Concept from "${o}" to explain?`,"Pascal's Principle");if(!i)return void(aiLoadingEl.style.display="none");r=`Explain "${i}" from "${o}" simply for life science students.`}break;case"quiz":r=`Generate 2 multiple-choice questions on "${o}". Explain the correct answer (bold it).`;break;case"relate":r=`Provide 2 examples of how "${o}" applies to biology or medicine.`;break;default:return void(aiLoadingEl.style.display="none")}t={contents:[{parts:[{text:r}]}]}}const s=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;const u=await fetch(s,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!u.ok){let p=u.statusText;try{p=(await u.json()).error.message||p}catch(g){}throw new Error(`API error (${u.status}): ${p}`)}const m=await u.json();if(!m.candidates||0===m.candidates.length||!m.candidates[0].content||!m.candidates[0].content.parts||0===m.candidates[0].content.parts.length){let f="Unknown";if(m.candidates&&m.candidates[0]&&m.candidates[0].finishReason)f=m.candidates[0].finishReason;return console.warn("AI response missing content. Reason:",f,m),void(aiResponseEl.textContent=`Response was blocked or empty. Reason: ${f}.`)}const y=m.candidates[0].content.parts[0].text;"undefined"!=typeof marked?aiResponseEl.innerHTML=marked.parse(y):aiResponseEl.innerText=y,window.MathJax&&MathJax.typesetPromise([aiResponseEl]).catch(b=>console.error("MathJax error:",b))}catch(w){console.error("AI Helper Error:",w),aiResponseEl.textContent=`Error: ${w.message}`}finally{aiLoadingEl.style.display="none"}}

// --- Translate Page ---
const translateBtn=document.getElementById("translateBtn"),hideTranslateBtn=document.getElementById("hideTranslateBtn");
async function translateCurrentPage(){/* ... unchanged ... */ const e=document.getElementById("overlay-translation");if(!e)return;e.style.display="block",e.textContent="🔄 Loading text...";const t=String(currentPage),n=bookTextData[t];if(void 0===n)return void(e.textContent="⚠️ Text data for this page is unavailable.");if(!n||!n.trim())return void(e.textContent="ℹ️ No translatable text found for this page.");if(!GEMINI_API_KEY||"YOUR_API_KEY_HERE"===GEMINI_API_KEY)return void(e.innerText="⚠️ Translation unavailable: No API key.\n\nPreview:\n\n"+n.slice(0,1500)+(n.length>1500?"...":""));e.textContent="🌐 Translating to Arabic...";try{const o=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,a={contents:[{parts:[{text:`Translate the following English physics text into clear, educational Arabic for university-level biology/medical students. Preserve equations and scientific terms. Do not add commentary.\n\n---START---\n${n}\n---END---`}]}]};const l=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!l.ok){let s=l.statusText;try{s=(await l.json()).error.message||s}catch(r){}throw new Error(`API error (${l.status}): ${s}`)}const d=await l.json();if(!d.candidates||0===d.candidates.length||!d.candidates[0].content||!d.candidates[0].content.parts||0===d.candidates[0].content.parts.length){let c="Unknown";if(d.candidates&&d.candidates[0]&&d.candidates[0].finishReason)c=d.candidates[0].finishReason;return console.warn("Translate response missing. Reason:",c,d),void(e.textContent=`❌ Translation failed. Reason: ${c}.`)}const u=d.candidates[0].content.parts[0].text;e.innerText=u,e.style.display="block",hideTranslateBtn&&(hideTranslateBtn.style.display="inline-block"),window.MathJax&&MathJax.typesetPromise([e]).catch(p=>console.error("MathJax translate error:",p))}catch(g){console.error("Translate error:",g),e.textContent=`❌ Translation Error: ${g.message}`}}
if(translateBtn)translateBtn.addEventListener("click",translateCurrentPage);
if(hideTranslateBtn)hideTranslateBtn.addEventListener("click",()=>{const e=document.getElementById("overlay-translation");if(e)e.style.display="none";if(hideTranslateBtn)hideTranslateBtn.style.display="none"});

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
    loadBookText();
    const flipbookElement = document.getElementById('flipbook');
    if (flipbookElement) {
        // Attach SWIPE listeners
        flipbookElement.addEventListener("touchstart", handleTouchStartSwipe, { passive: true });
        flipbookElement.addEventListener("touchend", handleTouchEndSwipe, { passive: true });
    }
    const pageCounterEl = document.getElementById('pageCounter');
    const pageInputEl = document.getElementById('pageInput');
    if (pageCounterEl) pageCounterEl.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInputEl) {
        pageInputEl.max = totalPages;
        pageInputEl.value = currentPage + 1;
    }
    renderThumbs();
    renderIndex();
    renderPage(); // Calls setupDrawingListeners, loadHighlights, and setupHammer internally
});

