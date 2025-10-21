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
        ALLOWED_IDS = []; // Default to empty if loading fails
    }
}

// Check config.js to enable/disable login
// Ensure config exists before checking its properties
if (typeof config !== 'undefined' && config.requireLogin === true) {
    loadIDs(); // Load the student IDs only if required
    const lockScreen = document.getElementById('lockScreen');
    if (lockScreen) {
        lockScreen.style.display = 'flex'; // Show the lock screen
    }
}

// Unlock button
const unlockBtn = document.getElementById('unlockBtn');
if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
        const idInput = document.getElementById("idInput");
        const entered = idInput ? idInput.value.trim() : "";
        const idError = document.getElementById("idError");
        if (!idError) return; // Exit if error element not found

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
        if (!res.ok) throw new Error("book-text.json not found or inaccessible");
        bookTextData = await res.json();
        console.log("Book text loaded successfully.");
    } catch (err) {
        console.error("Could not load book text:", err);
        const translateBtn = document.getElementById('translateBtn');
        if (translateBtn) {
            translateBtn.disabled = true;
            translateBtn.title = "Translation unavailable: Book text file failed to load.";
            translateBtn.textContent = "🌐 Text Unavailable";
            translateBtn.style.backgroundColor = '#aaa'; // Ensure disabled style is applied
            translateBtn.style.cursor = 'not-allowed';
        }
    }
}

// ---------- Flipbook data ----------
// Make sure config is defined before using it
const totalPages = (typeof config !== 'undefined' && config.totalPages) ? config.totalPages : 1; // Default to 1 page if config missing
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
const highlightToolbar = document.getElementById('highlight-toolbar');
const highlightToolBtn = document.getElementById('highlight-tool-btn');
const eraserToolBtn = document.getElementById('eraser-tool-btn');
const colorPicker = document.getElementById('highlight-color');
const brushSizeSlider = document.getElementById('brush-size');
const clearHighlightsBtn = document.getElementById('clear-highlights-btn');
let highlightCanvas, ctx, isDrawing = false, drawMode = 'highlight', lastX = 0, lastY = 0;


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
    if (!flipbook) return; // Don't proceed if flipbook element isn't found
    flipbook.innerHTML = ""; // Clear previous content
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";

    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    canvas.id = "highlight-canvas";
    highlightCanvas = canvas; // Assign to global variable for access

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
        // Size the canvas to the image once it's loaded
        sizeCanvasToImage(img, canvas);
        ctx = canvas.getContext('2d'); // Get context AFTER sizing
        setupDrawingListeners(canvas); // Setup listeners AFTER sizing and context
        loadHighlights(currentPage); // Load highlights AFTER sizing and context
    };

    wrap.appendChild(img);
    wrap.appendChild(canvas);

    // Add translation overlay container inside wrap
    const overlay = document.createElement("div");
    overlay.className = "overlay-translation";
    overlay.id = "overlay-translation";
    wrap.appendChild(overlay);

    flipbook.appendChild(wrap); // Add the complete wrap to the flipbook


    if (counter) counter.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInput) pageInput.value = currentPage + 1;
    highlightThumb();

    // Safely check config before accessing properties
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

    preloadImages();
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
        t.addEventListener("click", () => {
            if (currentPage !== i) { // Prevent re-rendering same page
                 currentPage = i;
                 renderPage();
            }
        });
        t.onerror = () => {
            t.alt = "Thumb N/A";
            t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E";
        };
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
        if (rect.left < parentRect.left || rect.right > parentRect.right || rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
             activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

function renderIndex() {
    if (!indexMenu || !indexToggle) return;
    indexMenu.innerHTML = "";
    if (typeof config !== 'undefined' && config.chapters && config.chapters.length > 0) {
        config.chapters.forEach(chapter => {
            const button = document.createElement("button");
            button.textContent = chapter.title;
            button.onclick = () => goToPage(chapter.page - 1);
            indexMenu.appendChild(button);
        });
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
        pageInput.value = currentPage + 1; // Reset if invalid or same page
    }
}
if (pageInput) {
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { jumpToPage(); e.preventDefault(); } });
}


function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(`Error attempting full screen: ${err.message} (${err.name})`));
    } else {
        document.exitFullscreen();
    }
}
function shareBook(){
    const shareData = { title: "PHYS101 Flipbook", url: window.location.href };
    if (navigator.share) {
         navigator.share(shareData).catch((err) => console.log("Share failed:", err));
    } else if (navigator.clipboard) {
         navigator.clipboard.writeText(window.location.href).then(() => {
             alert("Link copied to clipboard!");
         }).catch(err => {
             console.error("Failed to copy link:", err);
             alert("Failed to copy link.");
         });
    } else {
        alert("Sharing not supported on this browser.");
    }
}
function openIndexMenu() {
    if (!indexToggle || !footer || !indexMenu) return;
    const rect = indexToggle.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    indexMenu.style.left = `${rect.left - footerRect.left}px`;
    indexMenu.style.bottom = `${footerRect.height}px`;
    indexMenu.style.top = "auto";
    indexMenu.style.display = "flex";
    indexMenu.setAttribute("aria-hidden","false");
    indexToggle.setAttribute("aria-expanded","true");
}
function closeIndexMenu(){
    if (!indexMenu || !indexToggle) return;
    indexMenu.style.display="none";
    indexMenu.setAttribute("aria-hidden","true");
    indexToggle.setAttribute("aria-expanded","false");
}
if (indexToggle) {
    indexToggle.addEventListener("click", e=>{ e.stopPropagation(); indexMenu.style.display === "flex" ? closeIndexMenu() : openIndexMenu(); });
}
if (indexMenu) {
    indexMenu.addEventListener("click", e => e.stopPropagation());
}
document.addEventListener("click", e=>{ // Close menu if clicking outside
    if (indexMenu && indexToggle && indexMenu.style.display === "flex" && !indexMenu.contains(e.target) && !indexToggle.contains(e.target)) {
         closeIndexMenu();
    }
});
function goToPage(page){
    if (page >= 0 && page < images.length){
        currentPage = page;
        renderPage();
        closeIndexMenu();
    }
}
window.goToPage = goToPage; // Make accessible if needed globally

// ---------- Input & touch ----------
let touchStartX = 0;
let touchEndX = 0;
const swipeThreshold = 50;
function handleTouchStart(e){ touchStartX = e.touches[0].clientX; } // Use clientX for touch
function handleTouchEnd(e){ touchEndX = e.changedTouches[0].clientX; handleSwipeGesture(); }
function handleSwipeGesture(){
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > swipeThreshold){
         if(diff > 0){ prevPage(); } else { nextPage(); }
    }
}

// ---------- Modals (PhET, Video) ----------
function openPhetModal(){
    const simConfig = typeof config !== 'undefined' && config.simulations && config.simulations.find(s => s.page === (currentPage + 1));
    if (simConfig && simConfig.url) {
        if(phetFrame) phetFrame.src = simConfig.url;
        if(phetModal) phetModal.style.display = 'flex';
    } else { alert("No simulation found for this page."); }
}
function closePhetModal(){
    if(phetModal) phetModal.style.display = 'none';
    if(phetFrame) phetFrame.src = 'about:blank';
}
if(phetBtn) phetBtn.addEventListener('click', openPhetModal);
if(phetCloseBtn) phetCloseBtn.addEventListener('click', closePhetModal);
if(phetModal) phetModal.addEventListener('click', (e) => { if(e.target === phetModal) closePhetModal(); });

function openVideoModal(){
    const videoConfig = typeof config !== 'undefined' && config.videos && config.videos.find(v => v.page === (currentPage + 1));
    if (videoConfig && videoConfig.url) {
        if(videoFrame) videoFrame.src = getYoutubeEmbedUrl(videoConfig.url);
        if(videoModal) videoModal.style.display = 'flex';
    } else { alert("No video found for this page."); }
}
function closeVideoModal(){
    if(videoModal) videoModal.style.display = 'none';
    if(videoFrame) videoFrame.src = 'about:blank';
}
if(videoBtn) videoBtn.addEventListener('click', openVideoModal);
if(videoCloseBtn) videoCloseBtn.addEventListener('click', closeVideoModal);
if(videoModal) videoModal.addEventListener('click', (e) => { if(e.target === videoModal) closeVideoModal(); });

// --- HIGHLIGHTING LOGIC ---
function sizeCanvasToImage(img, canvas) {
    if (!img || !canvas) return;
    const rect = img.getBoundingClientRect();
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.top = `${img.offsetTop}px`;
    canvas.style.left = `${img.offsetLeft}px`;
    if (ctx) ctx = canvas.getContext('2d');
}

function getDrawPosition(e, canvas) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function startDrawing(e) {
    if (!highlightCanvas || !ctx || !document.body.classList.contains('highlight-mode')) return;
    if (e.touches) e.preventDefault();
    isDrawing = true;
    const pos = getDrawPosition(e, highlightCanvas);
    [lastX, lastY] = [pos.x, pos.y];
    draw(e); // Draw a single point on click/tap
}

function draw(e) {
    if (!isDrawing || !ctx) return;
    if (e.touches) e.preventDefault();
    const pos = getDrawPosition(e, highlightCanvas);
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawMode === 'highlight') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSizeSlider.value;
    } else { // Eraser
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = brushSizeSlider.value;
    }
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing() { if (isDrawing) { isDrawing = false; saveHighlights(currentPage); } }

function setupDrawingListeners(canvas) {
    if (!canvas) return;
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseleave', stopDrawing);
    canvas.removeEventListener('touchstart', startDrawing);
    canvas.removeEventListener('touchmove', draw);
    canvas.removeEventListener('touchend', stopDrawing);

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function saveHighlights(pageNumber) {
    if (!highlightCanvas) return;
    requestAnimationFrame(() => {
        try {
            localStorage.setItem(`flipbook-highlights-page-${pageNumber}`, highlightCanvas.toDataURL());
        } catch (e) {
            console.error("Failed to save highlights:", e);
            if (e.name === 'QuotaExceededError') alert('Could not save highlights. Browser storage is full.');
        }
    });
}

function loadHighlights(pageNumber) {
    if (!highlightCanvas || !ctx) return;
    const dataUrl = localStorage.getItem(`flipbook-highlights-page-${pageNumber}`);
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = dataUrl;
    }
}

function clearCurrentHighlights() {
    if (!ctx) return;
    if (confirm("Erase all highlights on this page? This cannot be undone.")) {
        ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        localStorage.removeItem(`flipbook-highlights-page-${currentPage}`);
    }
}

// Event Listeners for Highlight Toolbar
if (toggleDrawModeBtn) {
    toggleDrawModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('highlight-mode');
        if (highlightToolbar) highlightToolbar.classList.toggle('visible');
        const isActive = document.body.classList.contains('highlight-mode');
        toggleDrawModeBtn.classList.toggle('active', isActive);

        if (isActive) {
            drawMode = 'highlight'; // Default to highlight
            if(highlightToolBtn) highlightToolBtn.classList.add('active');
            if(eraserToolBtn) eraserToolBtn.classList.remove('active');
            if(highlightCanvas) highlightCanvas.style.cursor = 'crosshair';
        } else {
            // When turning drawing off, just remove cursor style
            if(highlightCanvas) highlightCanvas.style.cursor = 'default';
        }
    });
}

if (highlightToolBtn) {
    highlightToolBtn.addEventListener('click', () => {
        drawMode = 'highlight';
        highlightToolBtn.classList.add('active');
        if(eraserToolBtn) eraserToolBtn.classList.remove('active');
        if(highlightCanvas) highlightCanvas.style.cursor = 'crosshair';
    });
}

if (eraserToolBtn) {
    eraserToolBtn.addEventListener('click', () => {
        drawMode = 'eraser';
        eraserToolBtn.classList.add('active');
        if(highlightToolBtn) highlightToolBtn.classList.remove('active');
        if(highlightCanvas) highlightCanvas.style.cursor = 'cell';
    });
}
if (colorPicker) colorPicker.addEventListener('change', () => { if(highlightToolBtn) highlightToolBtn.click(); });
if (clearHighlightsBtn) clearHighlightsBtn.addEventListener('click', clearCurrentHighlights);

window.addEventListener('resize', () => {
    const img = document.querySelector('.page-image');
    if (img && highlightCanvas) {
        setTimeout(() => { sizeCanvasToImage(img, highlightCanvas); loadHighlights(currentPage); }, 100);
    }
});

// --- AI HELPER ---
const aiModal = document.getElementById("aiHelperModal"),
    aiHelperToggle = document.getElementById("aiHelperToggle"),
    aiCloseBtn = document.getElementById("aiCloseBtn"),
    aiResponseEl = document.getElementById("aiResponse"),
    aiLoadingEl = document.getElementById("aiLoading"),
    aiChapterTitleEl = document.getElementById("aiChapterTitle");

const GEMINI_API_KEY = (typeof config !== 'undefined' && config.geminiApiKey) ? config.geminiApiKey : 'YOUR_API_KEY_HERE';

async function getImageAsBase64FromCanvas() {
    const e = document.querySelector(".page-image");
    if (!e || !e.complete || 0 === e.naturalWidth) return console.error("Image not ready"), null;
    try {
        const t = document.createElement("canvas");
        t.width = e.naturalWidth, t.height = e.naturalHeight;
        return t.getContext("2d").drawImage(e, 0, 0), t.toDataURL("image/png").split(",")[1]
    } catch (o) {
        return console.error("Canvas error:", o), null
    }
}
if(aiHelperToggle)aiHelperToggle.addEventListener("click",()=>{const e=getCurrentChapter();if(aiChapterTitleEl)aiChapterTitleEl.textContent=e?e.title:"Current Page";if(aiResponseEl)aiResponseEl.innerHTML="";if(aiModal)aiModal.style.display="flex"});
if(aiCloseBtn)aiCloseBtn.addEventListener("click",()=>{if(aiModal)aiModal.style.display="none"});
if(aiModal)aiModal.addEventListener("click",e=>{if(e.target===aiModal)aiModal.style.display="none"});

function getCurrentChapter() {
    if (!config.chapters || 0 === config.chapters.length) return null;
    let e = config.chapters[0];
    for (let t = config.chapters.length - 1; t >= 0; t--)
        if (currentPage >= config.chapters[t].page - 1) {
            e = config.chapters[t];
            break
        } return e
}
async function getAiHelp(e) {
    if (!GEMINI_API_KEY || "YOUR_API_KEY_HERE" === GEMINI_API_KEY) return void(aiResponseEl && (aiResponseEl.textContent = "AI Helper not configured."));
    if (!aiLoadingEl || !aiResponseEl) return;
    aiLoadingEl.style.display = "block", aiResponseEl.innerHTML = "";
    let t;
    const n = getCurrentChapter(),
        o = n ? n.title : "this page";
    try {
        if ("analyze_page" === e) {
            let a = await getImageAsBase64FromCanvas();
            if (!a) return aiResponseEl.textContent = "Could not process page image.", void(aiLoadingEl.style.display = "none");
            t = {
                contents: [{
                    parts: [{
                        text: `Analyze this physics page (from chapter "${o}"). Summarize concepts, explain formulas/diagrams, and give a takeaway for a life science student.`
                    }, {
                        inline_data: {
                            mime_type: "image/png",
                            data: a
                        }
                    }]
                }]
            }
        } else {
            let r;
            switch (e) {
                case "explain":
                    {
                        const i = window.prompt(`Concept from "${o}" to explain?`, "Pascal's Principle");
                        if (!i) return void(aiLoadingEl.style.display = "none");r = `Explain "${i}" from "${o}" simply for life science students.`
                    }
                    break;
                case "quiz":
                    r = `Generate 2 multiple-choice questions on "${o}". Explain the correct answer (bold it).`;
                    break;
                case "relate":
                    r = `Provide 2 examples of how "${o}" applies to biology or medicine.`;
                    break;
                default:
                    return void(aiLoadingEl.style.display = "none")
            }
            t = {
                contents: [{
                    parts: [{
                        text: r
                    }]
                }]
            }
        }
        const s = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const u = await fetch(s, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(t)
        });
        if (!u.ok) {
            let p = u.statusText;
            try {
                p = (await u.json()).error.message || p
            } catch (g) {}
            throw new Error(`API error (${u.status}): ${p}`)
        }
        const m = await u.json();

        // **FIX STARTS HERE**
        let finishReason = "Unknown";
        if (m.candidates && m.candidates[0] && m.candidates[0].finishReason) {
            finishReason = m.candidates[0].finishReason;
        }

        if (!m.candidates || m.candidates.length === 0 || !m.candidates[0].content || !m.candidates[0].content.parts || m.candidates[0].content.parts.length === 0) {
            console.warn("AI response missing content. Reason:", finishReason, m);
            aiResponseEl.textContent = `Response was blocked or empty. Reason: ${finishReason}.`;
            return;
        }
        // **FIX ENDS HERE**

        const y = m.candidates[0].content.parts[0].text;
        "undefined" != typeof marked ? aiResponseEl.innerHTML = marked.parse(y) : aiResponseEl.innerText = y, window.MathJax && MathJax.typesetPromise([aiResponseEl]).catch(b => console.error("MathJax error:", b))
    } catch (w) {
        console.error("AI Helper Error:", w), aiResponseEl.textContent = `Error: ${w.message}`
    } finally {
        aiLoadingEl.style.display = "none"
    }
}


// --- Translate Page ---
const translateBtn = document.getElementById("translateBtn"),
    hideTranslateBtn = document.getElementById("hideTranslateBtn");
async function translateCurrentPage() {
    const e = document.getElementById("overlay-translation");
    if (!e) return;
    e.style.display = "block", e.textContent = "🔄 Loading text...";
    const t = String(currentPage),
        n = bookTextData[t];
    if (void 0 === n) return void(e.textContent = "⚠️ Text data for this page is unavailable.");
    if (!n || !n.trim()) return void(e.textContent = "ℹ️ No translatable text found for this page.");
    if (!GEMINI_API_KEY || "YOUR_API_KEY_HERE" === GEMINI_API_KEY) return void(e.innerText = "⚠️ Translation unavailable: No API key.\n\nPreview:\n\n" + n.slice(0, 1500) + (n.length > 1500 ? "..." : ""));
    e.textContent = "🌐 Translating to Arabic...";
    try {
        const o = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
            a = {
                contents: [{
                    parts: [{
                        text: `Translate the following English physics text into clear, educational Arabic for university-level biology/medical students. Preserve equations and scientific terms. Do not add commentary.\n\n---START---\n${n}\n---END---`
                    }]
                }]
            };
        const l = await fetch(o, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(a)
        });
        if (!l.ok) {
            let s = l.statusText;
            try {
                s = (await l.json()).error.message || s
            } catch (r) {}
            throw new Error(`API error (${l.status}): ${s}`)
        }
        const d = await l.json();

        // **FIX STARTS HERE**
        let c = "Unknown";
        if (d.candidates && d.candidates[0] && d.candidates[0].finishReason) {
            c = d.candidates[0].finishReason;
        }

        if (!d.candidates || d.candidates.length === 0 || !d.candidates[0].content || !d.candidates[0].content.parts || d.candidates[0].content.parts.length === 0) {
            console.warn("Translate response missing. Reason:", c, d);
            e.textContent = `❌ Translation failed. Reason: ${c}.`;
            return;
        }
        // **FIX ENDS HERE**

        const u = d.candidates[0].content.parts[0].text;
        e.innerText = u, e.style.display = "block", hideTranslateBtn && (hideTranslateBtn.style.display = "inline-block"), window.MathJax && MathJax.typesetPromise([e]).catch(p => console.error("MathJax translate error:", p))
    } catch (g) {
        console.error("Translate error:", g), e.textContent = `❌ Translation Error: ${g.message}`
    }
}
if (translateBtn) translateBtn.addEventListener("click", translateCurrentPage);
if (hideTranslateBtn) hideTranslateBtn.addEventListener("click", () => {
    const e = document.getElementById("overlay-translation");
    if (e) e.style.display = "none";
    if (hideTranslateBtn) hideTranslateBtn.style.display = "none"
});


// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
    loadBookText();
    const flipbookElement = document.getElementById('flipbook');
    if (flipbookElement) {
        flipbookElement.addEventListener("touchstart", handleTouchStart, { passive: false });
        flipbookElement.addEventListener("touchend", handleTouchEnd, { passive: false });
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
    renderPage();
});

