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
         // Enable translate function after text loads
         // (No button to enable, function is called directly)
    } catch (err) {
        console.error("Could not load book text:", err);
         // Disable search button if text loading fails
         const searchBtn = document.getElementById('searchBtn');
         if (searchBtn) searchBtn.disabled = true;
         // Indicate translation is unavailable if text failed to load
         // (Could add a visual cue in AI modal if desired)
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

    resetZoomPan(wrap); // Reset transformations

    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    canvas.id = "highlight-canvas";
    highlightCanvas = canvas;

    img.className = "page-image";
    img.src = images[currentPage];
    img.alt = `Page ${currentPage + 1}`;
    img.loading = "eager";
    img.crossOrigin = "anonymous";
    img.onerror = () => { /* ... placeholder ... */ img.alt = "Image not available"; img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='24' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E"; };

    img.onload = () => {
        sizeCanvasToImage(img, canvas);
        ctx = canvas.getContext('2d');
        setupDrawingListeners(canvas);
        loadHighlights(currentPage);
        updateCursor();
        setupHammer(wrap);
    };

    wrap.appendChild(img);
    wrap.appendChild(canvas);

    // --- Create and append Translation Overlay ---
    const overlay = document.createElement("div");
    overlay.className = "overlay-translation";
    overlay.id = "overlay-translation";

    // --- Add Close Button inside Overlay ---
    const closeBtn = document.createElement("span");
    closeBtn.className = "translation-close-btn";
    closeBtn.innerHTML = "&times;"; // Use × symbol
    closeBtn.title = "Close Translation";
    closeBtn.onclick = () => {
        overlay.style.display = 'none';
    };
    overlay.appendChild(closeBtn);
    // --- End Add Close Button ---

    wrap.appendChild(overlay);
    // --- End Translation Overlay ---

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
    if (currentOverlay) currentOverlay.style.display = 'none'; // Ensure it starts hidden

    closeSearchBox();
    closeHighlightPopup();
    preloadImages();
}

function resetZoomPan(element) { /* ... unchanged ... */ currentScale=1,currentOffsetX=0,currentOffsetY=0,pinchStartScale=1,element&&(element.style.transform="scale(1) translate(0px, 0px)");const t=document.getElementById("flipbook");t&&hammerManager&&(hammerManager.get("pan").set({enable:!0,direction:Hammer.DIRECTION_ALL})) }
function preloadImages() { /* ... unchanged ... */ currentPage<images.length-1&&(new Image).src=images[currentPage+1],currentPage>0&&(new Image).src=images[currentPage-1] }
function renderThumbs() { /* ... unchanged ... */ if(!thumbbar)return;thumbbar.innerHTML="";thumbs.forEach((e,t)=>{const n=document.createElement("img");n.src=e,n.alt=`Thumb ${t+1}`,n.loading="lazy",n.addEventListener("click",()=>{currentPage!==t&&(currentPage=t,renderPage())}),n.onerror=()=>{n.alt="Thumb N/A",n.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E"},thumbbar.appendChild(n)}) }
function highlightThumb() { /* ... unchanged ... */ if(!thumbbar)return;let e=null;thumbbar.querySelectorAll("img").forEach((t,n)=>{const o=n===currentPage;t.classList.toggle("active",o),o&&(e=t)}),e&&(()=>{const t=e.getBoundingClientRect(),n=thumbbar.getBoundingClientRect();(t.left<n.left||t.right>n.right)&&e.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})})() }
function renderIndex() { /* ... unchanged ... */ if(!indexMenu||!indexToggle)return;indexMenu.innerHTML="";typeof config!="undefined"&&config.chapters&&config.chapters.length>0?(config.chapters.forEach(e=>{const t=document.createElement("button");t.textContent=e.title,t.onclick=()=>goToPage(e.page-1),indexMenu.appendChild(t)}),indexToggle.style.display="inline-block"):indexToggle.style.display="none" }
function nextPage() { /* ... unchanged ... */ currentPage<images.length-1&&(currentPage++,renderPage()) }
function prevPage() { /* ... unchanged ... */ currentPage>0&&(currentPage--,renderPage()) }
function firstPage() { /* ... unchanged ... */ 0!==currentPage&&(currentPage=0,renderPage()) }
function lastPage() { /* ... unchanged ... */ currentPage!==images.length-1&&(currentPage=images.length-1,renderPage()) }
function jumpToPage() { /* ... unchanged ... */ if(!pageInput)return;const e=parseInt(pageInput.value,10);!isNaN(e)&&e>=1&&e<=totalPages&&e-1!==currentPage?(currentPage=e-1,renderPage()):pageInput.value=currentPage+1 }
if (pageInput) pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { jumpToPage(); e.preventDefault(); } });
function toggleFullScreen() { /* ... unchanged ... */ document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(e=>console.error(`Fullscreen error: ${e.message}`)) }
function shareBook(){ /* ... unchanged ... */ const e={title:"PHYS101 Flipbook",url:window.location.href};if(navigator.share)navigator.share(e).catch(t=>console.log("Share failed:",t));else if(navigator.clipboard){const n=document.createElement("textarea");n.value=window.location.href,document.body.appendChild(n),n.focus(),n.select();try{document.execCommand("copy"),alert("Link copied to clipboard!")}catch(o){console.error("Fallback copy failed",o),alert("Failed to copy link.")}document.body.removeChild(n)}else alert("Sharing/Copying not supported.") }
function openIndexMenu() { /* ... unchanged ... */ if(!indexToggle||!footer||!indexMenu)return;const e=indexToggle.getBoundingClientRect(),t=footer.getBoundingClientRect();indexMenu.style.left=`${e.left-t.left}px`,indexMenu.style.bottom=`${t.height}px`,indexMenu.style.top="auto",indexMenu.style.display="flex",indexMenu.setAttribute("aria-hidden","false"),indexToggle.setAttribute("aria-expanded","true") }
function closeIndexMenu(){ /* ... unchanged ... */ if(!indexMenu||!indexToggle)return;indexMenu.style.display="none",indexMenu.setAttribute("aria-hidden","true"),indexToggle.setAttribute("aria-expanded","false") }
if (indexToggle) indexToggle.addEventListener("click", e=>{ e.stopPropagation(); indexMenu.style.display === "flex" ? closeIndexMenu() : openIndexMenu(); });
if (indexMenu) indexMenu.addEventListener("click", e => e.stopPropagation());

document.addEventListener("click", e => { /* ... unchanged ... */ indexMenu&&indexToggle&&"flex"===indexMenu.style.display&&!indexMenu.contains(e.target)&&!indexToggle.contains(e.target)&&closeIndexMenu(),searchContainer&&"none"!==searchContainer.style.display&&!searchContainer.contains(e.target)&&e.target!==searchBtn&&closeSearchBox(),highlightPopup&&toggleDrawModeBtn&&highlightPopup.classList.contains("visible")&&!highlightPopup.contains(e.target)&&e.target!==toggleDrawModeBtn&&closeHighlightPopup() });
function goToPage(page){ /* ... unchanged ... */ page>=0&&page<images.length&&(currentPage=page,renderPage(),closeIndexMenu()) }
window.goToPage = goToPage;

// ---------- Input & touch (For SWIPING ONLY - Modified) ----------
let touchStartX = 0, touchEndX = 0; const swipeThreshold = 50; let isPinching = false;
function handleTouchStartSwipe(e){ if (document.body.classList.contains('highlight-mode') || isPinching || e.touches.length > 1) { touchStartX = null; return; } touchStartX = e.touches[0].clientX; }
function handleTouchEndSwipe(e){ if (document.body.classList.contains('highlight-mode') || isPinching || touchStartX === null || e.touches.length > 0) { touchStartX = null; return; } touchEndX = e.changedTouches[0].clientX; handleSwipeGesture(); }
function handleSwipeGesture(){ if (touchStartX === null) return; const diff = touchEndX - touchStartX; if (Math.abs(diff) > swipeThreshold){ if(diff > 0){ prevPage(); } else { nextPage(); } } touchStartX = null; }

// ---------- Modals (PhET, Video) ----------
function openPhetModal(){ /* ... unchanged ... */ const a=typeof config!="undefined"&&config.simulations&&config.simulations.find(e=>e.page===currentPage+1);a&&a.url?(phetFrame&&(phetFrame.src=a.url),phetModal&&(phetModal.style.display="flex")):alert("No simulation found for this page.") }
function closePhetModal(){ /* ... unchanged ... */ phetModal&&(phetModal.style.display="none"),phetFrame&&(phetFrame.src="about:blank") }
if(phetBtn)phetBtn.addEventListener("click",openPhetModal);
if(phetCloseBtn)phetCloseBtn.addEventListener("click",closePhetModal);
if(phetModal)phetModal.addEventListener("click",e=>{e.target===phetModal&&closePhetModal()});
function openVideoModal(){ /* ... unchanged ... */ const a=typeof config!="undefined"&&config.videos&&config.videos.find(e=>e.page===currentPage+1);a&&a.url?(videoFrame&&(videoFrame.src=getYoutubeEmbedUrl(a.url)),videoModal&&(videoModal.style.display="flex")):alert("No video found for this page.") }
function closeVideoModal(){ /* ... unchanged ... */ videoModal&&(videoModal.style.display="none"),videoFrame&&(videoFrame.src="about:blank") }
if(videoBtn)videoBtn.addEventListener("click",openVideoModal);
if(videoCloseBtn)videoCloseBtn.addEventListener("click",closeVideoModal);
if(videoModal)videoModal.addEventListener("click",e=>{e.target===videoModal&&closeVideoModal()});


// --- HAMMER.JS SETUP (Updated for Scrolling) ---
function setupHammer(element) { /* ... unchanged ... */ if(!element||"undefined"==typeof Hammer)return;hammerManager&&(hammerManager.destroy(),hammerManager=null),hammerManager=new Hammer.Manager(element);const e=new Hammer.Pinch({pointers:2}),t=new Hammer.Pan({pointers:0,direction:Hammer.DIRECTION_ALL});e.recognizeWith(t),hammerManager.add([e,t]);let n=currentOffsetX,o=currentOffsetY;hammerManager.on("pinchstart",e=>{isDrawing||(isPinching=!0,pinchStartScale=currentScale,element.style.transition="none")}),hammerManager.on("pinchmove",e=>{isDrawing||!isPinching||(currentScale=Math.max(1,Math.min(pinchStartScale*e.scale,5)),applyTransform(element))}),hammerManager.on("pinchend pinchcancel",e=>{isDrawing||(isPinching=!1,element.style.transition="",adjustPanLimits(element),applyTransform(element))}),hammerManager.on("panstart",e=>{!isDrawing&&!(currentScale>1&&e.pointers.length<2)&&(n=currentOffsetX,o=currentOffsetY,element.style.transition="none")}),hammerManager.on("panmove",e=>{if(isDrawing)return;if(currentScale>1&&e.pointers.length<2)return;if(1===currentScale&&1===e.pointers.length){if(!(Math.abs(e.deltaY)>Math.abs(e.deltaX)))return}const t=element.getBoundingClientRect(),a=flipbook.getBoundingClientRect(),i=Math.max(0,(t.width-a.width)/2),r=Math.max(0,(t.height-a.height)/2),l=n+e.deltaX,s=o+e.deltaY;currentOffsetX=Math.max(-i,Math.min(l,i)),currentOffsetY=Math.max(-r,Math.min(s,r)),applyTransform(element)}),hammerManager.on("panend pancancel",e=>{isDrawing||(element.style.transition="",n=currentOffsetX,o=currentOffsetY)}) }
function adjustPanLimits(element) { /* ... unchanged ... */ if(!element||currentScale<=1)return currentOffsetX=0,void(currentOffsetY=0);const e=element.getBoundingClientRect(),t=flipbook.getBoundingClientRect(),n=Math.max(0,(e.width-t.width)/2),o=Math.max(0,(e.height-t.height)/2);currentOffsetX=Math.max(-n,Math.min(currentOffsetX,n)),currentOffsetY=Math.max(-o,Math.min(currentOffsetY,o)) }
function applyTransform(element) { /* ... unchanged ... */ element&&(element.style.transform=`scale(${currentScale}) translate(${currentOffsetX}px, ${currentOffsetY}px)`) }

// --- HIGHLIGHTING LOGIC ---
function sizeCanvasToImage(img, canvas) { /* ... unchanged ... */ if(!img||!canvas)return;const e=img.getBoundingClientRect();canvas.width=img.naturalWidth,canvas.height=img.naturalHeight,canvas.style.width=`${e.width}px`,canvas.style.height=`${e.height}px`,canvas.style.top="0px",canvas.style.left="0px",ctx&&(ctx=canvas.getContext("2d")) }
function getDrawPosition(e, canvas) { /* ... unchanged ... */ if(!canvas)return{x:0,y:0};const t=canvas.closest(".page-wrap");if(!t)return{x:0,y:0};const n=canvas.getBoundingClientRect(),o=t.getBoundingClientRect(),a=canvas.width/n.width,i=canvas.height/n.height;let r,l;return e.touches&&e.touches.length>0?(r=e.touches[0].pageX-window.scrollX,l=e.touches[0].pageY-window.scrollY):e.changedTouches&&e.changedTouches.length>0?(r=e.changedTouches[0].pageX-window.scrollX,l=e.changedTouches[0].pageY-window.scrollY):(r=e.clientX,l=e.clientY),{x:(r-n.left)*a,y:(l-n.top)*i} }
function startDrawing(e) { /* ... unchanged ... */ if(!highlightCanvas||!ctx||!document.body.classList.contains("highlight-mode")||e.target!==highlightCanvas)return;if(e.touches&&e.touches.length>1)return;hammerManager&&(hammerManager.get("pinch").set({enable:!1}),hammerManager.get("pan").set({enable:!1})),e.touches&&e.preventDefault(),isDrawing=!0;const t=getDrawPosition(e,highlightCanvas);[lastX,lastY]=[t.x,t.y],"eraser"===drawMode&&(ctx.beginPath(),ctx.globalCompositeOperation="destination-out",ctx.fillStyle="rgba(0,0,0,1)",ctx.arc(t.x,t.y,currentBrushSize/2,0,2*Math.PI),ctx.fill()) }
function draw(e) { /* ... unchanged ... */ if(!isDrawing||!ctx)return;e.touches&&e.preventDefault(),"eraser"===drawMode&&(()=>{const t=getDrawPosition(e,highlightCanvas);ctx.beginPath(),ctx.globalCompositeOperation="destination-out",ctx.strokeStyle="rgba(0,0,0,1)",ctx.lineWidth=currentBrushSize,ctx.moveTo(lastX,lastY),ctx.lineTo(t.x,t.y),ctx.lineCap="round",ctx.lineJoin="round",ctx.stroke(),[lastX,lastY]=[t.x,t.y]})() }
function stopDrawing(e) { /* ... unchanged ... */ if(!isDrawing)return;isDrawing=!1;let t=getDrawPosition(e,highlightCanvas);"highlight"===drawMode&&(ctx.beginPath(),ctx.globalCompositeOperation="source-over",ctx.strokeStyle=currentHighlightColor,ctx.lineWidth=currentBrushSize,ctx.lineCap="butt",ctx.moveTo(lastX,lastY),ctx.lineTo(t.x,lastY),ctx.stroke()),saveHighlights(currentPage),hammerManager&&(hammerManager.get("pinch").set({enable:!0}),hammerManager.get("pan").set({enable:!0})) }
function setupDrawingListeners(canvas) { /* ... unchanged ... */ canvas&&(canvas.removeEventListener("mousedown",startDrawing),canvas.removeEventListener("mousemove",draw),canvas.removeEventListener("mouseup",stopDrawing),canvas.removeEventListener("mouseleave",stopDrawing),canvas.removeEventListener("touchstart",startDrawing),canvas.removeEventListener("touchmove",draw),canvas.removeEventListener("touchend",stopDrawing),canvas.removeEventListener("touchcancel",stopDrawing),canvas.addEventListener("mousedown",startDrawing),canvas.addEventListener("mousemove",draw),canvas.addEventListener("mouseup",stopDrawing),canvas.addEventListener("mouseleave",stopDrawing),canvas.addEventListener("touchstart",startDrawing,{passive:!1}),canvas.addEventListener("touchmove",draw,{passive:!1}),canvas.addEventListener("touchend",stopDrawing),canvas.addEventListener("touchcancel",stopDrawing)) }
function saveHighlights(pageNumber) { /* ... unchanged ... */ highlightCanvas&&requestAnimationFrame(()=>{try{localStorage.setItem(`flipbook-highlights-page-${pageNumber}`,highlightCanvas.toDataURL())}catch(e){console.error("Save highlights error:",e),"QuotaExceededError"===e.name&&alert("Storage full.")}}) }
function loadHighlights(pageNumber) { /* ... unchanged ... */ if(!highlightCanvas||!ctx)return;const e=localStorage.getItem(`flipbook-highlights-page-${pageNumber}`);ctx.clearRect(0,0,highlightCanvas.width,highlightCanvas.height),e&&(()=>{const t=new Image;t.onload=()=>{ctx.drawImage(t,0,0)},t.onerror=()=>{console.error("Failed load highlight",pageNumber),localStorage.removeItem(`flipbook-highlights-page-${pageNumber}`)},t.src=e})() }
function clearCurrentHighlights() { /* ... unchanged ... */ ctx&&confirm("Erase all highlights on this page?")&&(ctx.clearRect(0,0,highlightCanvas.width,highlightCanvas.height),localStorage.removeItem(`flipbook-highlights-page-${currentPage}`)) }
function updateCursor() { /* ... unchanged ... */ if(!highlightCanvas)return;const e=document.body.classList.contains("highlight-mode");e?"highlight"===drawMode?(highlightCanvas.style.cursor="",highlightCanvas.classList.add("highlight-cursor")):(highlightCanvas.style.cursor="cell",highlightCanvas.classList.remove("highlight-cursor")):(highlightCanvas.style.cursor="default",highlightCanvas.classList.remove("highlight-cursor")) }

// --- Event Listeners for Highlight Pop-up (Updated for Auto-Close) ---
if (toggleDrawModeBtn) {
    toggleDrawModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (highlightPopup) {
            const isVisible = highlightPopup.classList.contains('visible');
            if (isVisible) {
                closeHighlightPopup(); document.body.classList.remove('highlight-mode'); toggleDrawModeBtn.classList.remove('active'); updateCursor();
            } else {
                openHighlightPopup(); document.body.classList.add('highlight-mode'); toggleDrawModeBtn.classList.add('active');
                let activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch.active');
                if (!activeSwatch && colorSwatchesContainer) activeSwatch = colorSwatchesContainer.querySelector('.color-swatch');
                setActiveColorSwatch(activeSwatch); setDrawMode('highlight');
            }
        }
    });
}
function openHighlightPopup() { if(highlightPopup) highlightPopup.classList.add('visible'); }
function closeHighlightPopup() { if(highlightPopup) highlightPopup.classList.remove('visible'); }
if (colorSwatchesContainer) { colorSwatchesContainer.addEventListener('click', (e) => { if (e.target.classList.contains('color-swatch')) { setActiveColorSwatch(e.target); setDrawMode('highlight'); closeHighlightPopup(); } }); }
function setActiveColorSwatch(swatchElement) { if (!swatchElement || !colorSwatchesContainer) return; colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active')); swatchElement.classList.add('active'); currentHighlightColor = swatchElement.getAttribute('data-color'); }
if (eraserToolBtnPopup) eraserToolBtnPopup.addEventListener('click', () => { setDrawMode('eraser'); closeHighlightPopup(); });
function setDrawMode(mode) { drawMode = mode; if (mode === 'highlight') { if(eraserToolBtnPopup) eraserToolBtnPopup.classList.remove('active'); const activeSwatch = colorSwatchesContainer && colorSwatchesContainer.querySelector('.color-swatch[data-color="' + currentHighlightColor + '"]'); if (activeSwatch && !activeSwatch.classList.contains('active')) { setActiveColorSwatch(activeSwatch); } else if (colorSwatchesContainer && !colorSwatchesContainer.querySelector('.color-swatch.active')) { const targetSwatch = colorSwatchesContainer.querySelector('.color-swatch[data-color="' + currentHighlightColor + '"]') || colorSwatchesContainer.querySelector('.color-swatch'); if(targetSwatch) setActiveColorSwatch(targetSwatch); } } else { if(eraserToolBtnPopup) eraserToolBtnPopup.classList.add('active'); if (colorSwatchesContainer) colorSwatchesContainer.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active')); } updateCursor(); }
if (brushSizeSliderPopup) { brushSizeSliderPopup.addEventListener('input', (e) => { currentBrushSize = e.target.value; }); currentBrushSize = brushSizeSliderPopup.value; }
if (clearHighlightsBtnPopup) clearHighlightsBtnPopup.addEventListener('click', () => { clearCurrentHighlights(); closeHighlightPopup(); });

window.addEventListener('resize', () => { const img = document.querySelector('.page-image'); if (img && highlightCanvas) { setTimeout(() => { sizeCanvasToImage(img, highlightCanvas); loadHighlights(currentPage); }, 150); } closeHighlightPopup(); if (toggleDrawModeBtn && toggleDrawModeBtn.classList.contains('active')) { toggleDrawModeBtn.classList.remove('active'); document.body.classList.remove('highlight-mode'); updateCursor(); } });

// --- SEARCH LOGIC ---
function toggleSearchBox() { /* ... unchanged ... */ if(!searchContainer)return;"none"!==searchContainer.style.display?closeSearchBox():(searchContainer.style.display="flex",searchInput&&searchInput.focus(),searchResults&&(searchResults.innerHTML="")) }
function closeSearchBox() { /* ... unchanged ... */ searchContainer&&(searchContainer.style.display="none"),searchInput&&(searchInput.value=""),searchResults&&(searchResults.innerHTML="") }
function performSearch() { /* ... unchanged ... */ if(!searchInput||!searchResults||0===Object.keys(bookTextData).length)return;const e=searchInput.value.trim().toLowerCase();if(searchResults.innerHTML="",e.length<2){const t=document.createElement("div");return t.classList.add("no-results"),t.textContent="Please enter at least 2 characters.",void searchResults.appendChild(t)}const n=[];for(const o in bookTextData){const a=bookTextData[o];a&&a.toLowerCase().includes(e)&&n.push(parseInt(o,10))}if(n.length>0){n.sort((e,t)=>e-t),n.forEach(e=>{const t=document.createElement("div");t.textContent=`Page ${e+1}`,t.onclick=()=>{goToPage(e),closeSearchBox()},searchResults.appendChild(t)})}else{const l=document.createElement("div");l.classList.add("no-results"),l.textContent="No results found.",searchResults.appendChild(l)} }
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

// --- Translate Page (Moved to AI Modal) ---
async function translateCurrentPage() {
    // Close AI modal first
    if(aiModal) aiModal.style.display = 'none';

    const overlay = document.getElementById("overlay-translation");
    if (!overlay) return;
    overlay.style.display = 'block'; // Show overlay
    overlay.textContent = '🔄 Loading text...';
    const pageKey = String(currentPage);
    const englishText = bookTextData[pageKey];

    if (englishText === undefined) { overlay.textContent = '⚠️ Text data unavailable.'; return; }
    if (!englishText || !englishText.trim()) { overlay.textContent = 'ℹ️ No translatable text found.'; return; }
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') { overlay.innerText = "⚠️ Translation unavailable: No API key.\n\nPreview:\n\n"+englishText.slice(0,1500)+(englishText.length>1500?"...":""); return; }

    overlay.textContent = '🌐 Translating to Arabic...';
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const requestBody = { contents: [{ parts: [{ text:`Translate the following English physics text into clear, educational Arabic for university-level biology/medical students. Preserve equations and scientific terms. Do not add commentary.\n\n---START---\n${englishText}\n---END---` }] }] };
        const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!resp.ok) { let errorText = resp.statusText; try { errorText = (await resp.json()).error.message || errorText; } catch (e) {} throw new Error(`API error (${resp.status}): ${errorText}`); }
        const data = await resp.json();
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) { let reason = "Unknown"; if (data.candidates && data.candidates[0]) reason = data.candidates[0].finishReason; console.warn("Translate response missing. Reason:", reason, data); overlay.textContent = `❌ Translation failed. Reason: ${reason}.`; return; }
        const translated = data.candidates[0].content.parts[0].text;
        overlay.innerText = translated; // Display translation
        // No separate hide button needed, close icon is part of overlay
        window.MathJax && MathJax.typesetPromise([overlay]).catch(p => console.error("MathJax translate error:", p));
    } catch (err) {
        console.error("Translate error:", err);
        overlay.textContent = `❌ Translation Error: ${err.message}`;
    }
}
// Removed listeners for old translate/hide buttons


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

