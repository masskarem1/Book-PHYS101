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
    const rect = img.getBoundingClientRect(); // Use bounds of the actual image element
    // Set canvas internal resolution to match image's natural resolution
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    // Set canvas display size to match the displayed image size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    // Position canvas exactly over the image
    canvas.style.position = 'absolute'; // Ensure positioning context
    canvas.style.top = `${img.offsetTop}px`;
    canvas.style.left = `${img.offsetLeft}px`;

     // Recalculate context if it exists (useful on resize)
    if (ctx) {
        ctx = canvas.getContext('2d');
    }
}


function getDrawPosition(e, canvas) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;   // Calculate scale based on internal vs display size
    const scaleY = canvas.height / rect.height;
    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // Calculate position relative to canvas, scaled to internal resolution
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}


function startDrawing(e) {
    if (!highlightCanvas || !ctx) return;
    // Prevent default touch actions like scrolling while drawing
    if (e.touches) e.preventDefault();
    isDrawing = true;
    const pos = getDrawPosition(e, highlightCanvas);
    [lastX, lastY] = [pos.x, pos.y];
     // Optional: Draw a small dot on start for immediate feedback
     ctx.beginPath();
     ctx.fillStyle = (drawMode === 'highlight') ? colorPicker.value : 'rgba(0,0,0,0)'; // Transparent for eraser start?
     if (drawMode === 'highlight') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = colorPicker.value;
     } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)'; // Must be opaque for destination-out
     }
     ctx.arc(pos.x, pos.y, brushSizeSlider.value / 2, 0, Math.PI * 2);
     ctx.fill();
}


function draw(e) {
    if (!isDrawing || !highlightCanvas || !ctx) return;
    if (e.touches) e.preventDefault();
    const pos = getDrawPosition(e, highlightCanvas);

    ctx.beginPath();

    if (drawMode === 'highlight') {
        ctx.globalCompositeOperation = 'source-over'; // Default drawing mode
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSizeSlider.value;
    } else { // Eraser mode
        ctx.globalCompositeOperation = 'destination-out'; // Erases existing content
        ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter, but needs to be opaque
        ctx.lineWidth = brushSizeSlider.value;
    }

    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineCap = 'round'; // Smooth ends
    ctx.lineJoin = 'round'; // Smooth corners
    ctx.stroke();

    [lastX, lastY] = [pos.x, pos.y];
}


function stopDrawing(e) {
    if (isDrawing) {
        isDrawing = false;
        // Optional: Call draw one last time for touch end? Not usually necessary with mouseup/leave
        // draw(e); // Uncomment if lines sometimes don't complete on touch end
        saveHighlights(currentPage);
    }
}


function setupDrawingListeners(canvas) {
    if (!canvas) return;
    // Remove old listeners if any (important for page changes)
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseleave', stopDrawing);
    canvas.removeEventListener('touchstart', startDrawing);
    canvas.removeEventListener('touchmove', draw);
    canvas.removeEventListener('touchend', stopDrawing);

    // Add new listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    // Use non-passive listeners for touch to allow preventDefault()
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}


function saveHighlights(pageNumber) {
    if (!highlightCanvas) return;
    try {
        // Use requestAnimationFrame to ensure canvas is ready
        requestAnimationFrame(() => {
            const dataUrl = highlightCanvas.toDataURL();
            localStorage.setItem(`flipbook-highlights-page-${pageNumber}`, dataUrl);
             console.log(`Highlights saved for page ${pageNumber}`);
        });
    } catch (e) {
        console.error("Failed to save highlights:", e);
        // Handle potential storage quota errors
        if (e.name === 'QuotaExceededError') {
            alert('Could not save highlights. Browser storage might be full.');
        }
    }
}


function loadHighlights(pageNumber) {
    if (!highlightCanvas || !ctx) {
        console.warn("Canvas or context not ready for loading highlights.");
        return;
    }
     const dataUrl = localStorage.getItem(`flipbook-highlights-page-${pageNumber}`);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => {
             // Clear existing canvas before drawing saved image
            ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
            // Draw the saved highlight image
            ctx.drawImage(img, 0, 0);
            console.log(`Highlights loaded for page ${pageNumber}`);
        };
        img.onerror = () => {
            console.error(`Failed to load highlight image from localStorage for page ${pageNumber}`);
             // Optionally remove corrupted data
             localStorage.removeItem(`flipbook-highlights-page-${pageNumber}`);
        }
        img.src = dataUrl;
    } else {
         // If no saved data, ensure canvas is clear
         ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    }
}


function clearCurrentHighlights() {
    if (!highlightCanvas || !ctx) return;
    if (confirm("Are you sure you want to erase all highlights on this page? This cannot be undone.")) {
        ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        localStorage.removeItem(`flipbook-highlights-page-${currentPage}`);
        console.log(`Highlights cleared for page ${currentPage}`);
    }
}

// Event Listeners for Highlight Toolbar
if (highlightToolBtn) {
    highlightToolBtn.addEventListener('click', () => {
        const bodyClassList = document.body.classList;
        bodyClassList.toggle('highlight-mode');

        if(highlightToolbar) highlightToolbar.classList.toggle('visible', bodyClassList.contains('highlight-mode'));

        if (bodyClassList.contains('highlight-mode')) {
             drawMode = 'highlight'; // Default to highlight when turning on
             highlightToolBtn.classList.add('active');
             if(eraserToolBtn) eraserToolBtn.classList.remove('active'); // Deactivate eraser if active
             if(highlightCanvas) highlightCanvas.style.cursor = 'crosshair';
        } else {
             highlightToolBtn.classList.remove('active');
             if(eraserToolBtn) eraserToolBtn.classList.remove('active');
             if(highlightCanvas) highlightCanvas.style.cursor = 'default';
        }
    });
}
if (eraserToolBtn) {
    eraserToolBtn.addEventListener('click', () => {
        if (!document.body.classList.contains('highlight-mode')) {
             // Turn on highlight mode if it's off when eraser is clicked
             highlightToolBtn.click();
        }
        drawMode = 'eraser';
        eraserToolBtn.classList.add('active');
         // No need to remove 'active' from highlightToolBtn, signifies drawing is on
        if(highlightCanvas) highlightCanvas.style.cursor = 'cell'; // Change cursor for eraser
    });
}
if (colorPicker) {
    colorPicker.addEventListener('change', () => {
        drawMode = 'highlight'; // Switch back to highlight mode when color changes
        if(eraserToolBtn) eraserToolBtn.classList.remove('active');
        if(highlightCanvas) highlightCanvas.style.cursor = 'crosshair';
    });
}
if (clearHighlightsBtn) {
    clearHighlightsBtn.addEventListener('click', clearCurrentHighlights);
}

// Ensure canvas resizes correctly and reloads highlights on window resize
window.addEventListener('resize', () => {
    const img = document.querySelector('.page-image');
    if (img && highlightCanvas) {
         // Use a small delay to allow layout to settle
         setTimeout(() => {
            sizeCanvasToImage(img, highlightCanvas);
            loadHighlights(currentPage); // Reload highlights to fit new size
        }, 100); // 100ms delay might be enough
    }
});


// --- AI HELPER (Functions as before, ensure API calls use correct model) ---
const aiModal=document.getElementById("aiHelperModal"),aiHelperToggle=document.getElementById("aiHelperToggle"),aiCloseBtn=document.getElementById("aiCloseBtn"),aiResponseEl=document.getElementById("aiResponse"),aiLoadingEl=document.getElementById("aiLoading"),aiChapterTitleEl=document.getElementById("aiChapterTitle");
const GEMINI_API_KEY = (typeof config !== 'undefined' && config.geminiApiKey) ? config.geminiApiKey : 'YOUR_API_KEY_HERE';

async function getImageAsBase64FromCanvas(){const e=document.querySelector(".page-image");if(!e||!e.complete||0===e.naturalWidth)return console.error("Image not ready or not found for canvas conversion"),null;try{const t=document.createElement("canvas");t.width=e.naturalWidth,t.height=e.naturalHeight;const n=t.getContext("2d");return n.drawImage(e,0,0),t.toDataURL("image/png").split(",")[1]}catch(o){return console.error("Error converting image via canvas:",o),null}}
if (aiHelperToggle) {
    aiHelperToggle.addEventListener("click",()=>{const e=getCurrentChapter(); if(aiChapterTitleEl) aiChapterTitleEl.textContent=e?e.title:"Current Page"; if(aiResponseEl) aiResponseEl.innerHTML=""; if(aiModal) aiModal.style.display="flex" });
}
if (aiCloseBtn) {
    aiCloseBtn.addEventListener("click",()=> { if(aiModal) aiModal.style.display="none"});
}
if (aiModal) {
    aiModal.addEventListener("click",(e)=>{ if(e.target===aiModal) aiModal.style.display="none"});
}
function getCurrentChapter(){if(!config.chapters||0===config.chapters.length)return null;let e=config.chapters[0];for(let t=config.chapters.length-1;t>=0;t--)if(currentPage>=config.chapters[t].page-1){e=config.chapters[t];break}return e}
async function getAiHelp(e){if(!GEMINI_API_KEY||"YOUR_API_KEY_HERE"===GEMINI_API_KEY)return void(aiResponseEl&&(aiResponseEl.textContent="AI Helper not configured: API key missing in config.js or placeholder used."));if(!aiLoadingEl||!aiResponseEl)return;aiLoadingEl.style.display="block",aiResponseEl.innerHTML="";let t;const n=getCurrentChapter(),o=n?n.title:"this page";try{if("analyze_page"===e){const a=document.querySelector(".page-image");if(!a||!a.complete||0===a.naturalWidth)return aiResponseEl.textContent="Page image not fully loaded yet. Please wait a moment and try again.",void(aiLoadingEl.style.display="none");let l=await getImageAsBase64FromCanvas();if(!l)return aiResponseEl.textContent="Could not process page image data.",void(aiLoadingEl.style.display="none");t={contents:[{parts:[{text:`Analyze the content of this physics textbook page (likely from chapter "${o}"). Summarize the key concepts, explain any important formulas or diagrams, and provide a key takeaway relevant for a university life science student.`},{inline_data:{mime_type:"image/png",data:l}}]}]}}else{let r;switch(e){case"explain":{const i=window.prompt(`What concept from "${o}" would you like explained?`,"e.g., Pascal's Principle");if(!i)return void(aiLoadingEl.style.display="none");r=`You are a physics tutor for university life science students. Explain the concept of "${i}" from the chapter "${o}" in a simple, clear, and concise way. Use analogies related to biology or medicine if appropriate.`}break;case"quiz":r=`You are a physics tutor. Based on the chapter "${o}",generate 2 challenging multiple-choice quiz questions (4 options each, labeled A, B, C, D) to test a student's understanding. After each question, provide the correct answer letter in bold (e.g., **A**) and a brief explanation for why it's correct.`;break;case"relate":r=`You are a physics tutor for university life science students. For the chapter on "${o}", provide two clear and distinct examples of how the physics principles discussed apply directly to biological systems, medical procedures, or medical devices. Explain the connection clearly.`;break;default:return console.error("Unknown AI help type:",e),void(aiLoadingEl.style.display="none")}t={contents:[{parts:[{text:r}]}]}}const s=`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,d=`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,c="analyze_page"===e?s:d;const u=await fetch(c,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!u.ok){let p=u.statusText;try{const g=await u.json();p=(g.error && g.error.message)||p}catch(h){}throw new Error(`API error (${u.status}): ${p}`)}const m=await u.json();let f=(m.candidates && m.candidates[0] && m.candidates[0].finishReason)||"Unknown reason";if(!m.candidates||0===m.candidates.length||!m.candidates[0].content||!m.candidates[0].content.parts||0===m.candidates[0].content.parts.length)console.warn("AI response missing content. Finish reason:",f,m),aiResponseEl.textContent=`Sorry, the AI response was blocked or empty. Reason: ${f}. Please try rephrasing or a different request.`;else{const y=m.candidates[0].content.parts[0].text;"undefined"!=typeof marked?aiResponseEl.innerHTML=marked.parse(y):aiResponseEl.innerText=y,window.MathJax&&MathJax.typesetPromise([aiResponseEl]).catch(b=>console.error("MathJax typesetting error:",b))}}catch(w){console.error("AI Helper Error:",w),aiResponseEl.textContent=`Sorry, an error occurred while getting the AI response: ${w.message}`}finally{aiLoadingEl.style.display="none"}}

// --- Translate Page ---
const translateBtn=document.getElementById("translateBtn"),hideTranslateBtn=document.getElementById("hideTranslateBtn");
async function translateCurrentPage(){const e=document.getElementById("overlay-translation");if(!e)return;e.style.display="block",e.textContent="🔄 Loading text...";const t=String(currentPage),n=bookTextData[t];if(void 0===n)return void(e.textContent="⚠️ Text data for this page is currently unavailable.");if(!n||!n.trim())return void(e.textContent="ℹ️ No translatable text found for this page in the data file.");if(!GEMINI_API_KEY||"YOUR_API_KEY_HERE"===GEMINI_API_KEY)return void(e.innerText="⚠️ Translation unavailable: No Gemini API key configured.\n\nDetected English (preview):\n\n"+n.slice(0,1500)+(n.length>1500?"...":""));e.textContent="🌐 Translating to Arabic... Please wait.";try{const o=`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,a={contents:[{parts:[{text:`Translate the following English physics textbook text accurately into clear, educational Arabic suitable for university-level biology or medical students. Preserve mathematical equations and scientific terminology where possible using standard Arabic equivalents. Focus solely on translation; do not add any commentary, interpretations, or explanations beyond the original text.\n\n---START TEXT---\n${n}\n---END TEXT---`}]}]};const l=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!l.ok){let s=l.statusText;try{const i=await l.json();s=(i.error && i.error.message)||s}catch(r){}throw new Error(`API error (${l.status}): ${s}`)}const d=await l.json();let c=(d.candidates && d.candidates[0] && d.candidates[0].finishReason)||"Unknown reason";if(!d.candidates||0===d.candidates.length||!d.candidates[0].content||!d.candidates[0].content.parts||0===d.candidates[0].content.parts.length)console.warn("Translation response missing content. Finish reason:",c,d),e.textContent=`❌ Translation failed or was blocked. Reason: ${c}.`;else{const u=d.candidates[0].content.parts[0].text;e.innerText=u,e.style.display="block",hideTranslateBtn&&(hideTranslateBtn.style.display="inline-block"),window.MathJax&&MathJax.typesetPromise([e]).catch(p=>console.error("MathJax typesetting error on translation:",p))}}catch(g){console.error("Translate error:",g),e.textContent=`❌ Translation Error: ${g.message}`}}
if(translateBtn) translateBtn.addEventListener("click",translateCurrentPage);
if(hideTranslateBtn) hideTranslateBtn.addEventListener("click",()=>{const e=document.getElementById("overlay-translation");e&&(e.style.display="none"),hideTranslateBtn.style.display="none"});

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
    loadBookText(); // Start loading book text early

    const flipbookElement = document.getElementById('flipbook');
    if (flipbookElement) {
        flipbookElement.addEventListener("touchstart", handleTouchStart, { passive: false });
        flipbookElement.addEventListener("touchend", handleTouchEnd, { passive: false });
    } else { console.error("Flipbook element not found"); }

    const pageCounterEl = document.getElementById('pageCounter');
    const pageInputEl = document.getElementById('pageInput');
    if (pageCounterEl) pageCounterEl.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInputEl) {
         pageInputEl.max = totalPages;
         pageInputEl.value = currentPage + 1; // Set initial value
    }

    // Render initial state
    renderThumbs();
    renderIndex();
    renderPage(); // This will also handle initial highlight loading via img.onload
});
```eof
