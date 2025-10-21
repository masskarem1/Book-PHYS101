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
if (typeof config !== 'undefined' && config.requireLogin === true) {
    loadIDs(); // Load the student IDs only if required
    document.getElementById('lockScreen').style.display = 'flex'; // Show the lock screen
} else {
    // Login is not required, lock screen stays hidden
}

// Unlock button
document.getElementById('unlockBtn').addEventListener('click', () => {
    const entered = document.getElementById("idInput").value.trim();
    const idError = document.getElementById("idError");
    idError.style.display = 'none';
    if (!entered) {
        idError.textContent = 'Please enter an ID';
        idError.style.display = 'block';
        return;
    }
    if (ALLOWED_IDS.includes(entered)) {
        document.getElementById("lockScreen").style.display = "none";
    } else {
        idError.textContent = 'Invalid ID';
        idError.style.display = 'block';
    }
});

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
            translateBtn.style.cursor = 'not-allowed';
        }
    }
}
loadBookText(); // Load the text when the script runs

// ---------- Flipbook data ----------
const totalPages = config.totalPages;
const images = Array.from({ length: totalPages }, (_, i) => `${config.imagePath}${i}.png`);
const thumbs = Array.from({ length: totalPages }, (_, i) => `${config.thumbPath}${i}.jpg`);
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

function getYoutubeEmbedUrl(url) {
    try {
        const urlObj = new URL(url);
        let videoId = null;
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
            videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
            // Already an embed URL, potentially with parameters
            // Ensure autoplay=1&rel=0 are present or added
            urlObj.searchParams.set('autoplay', '1');
            urlObj.searchParams.set('rel', '0');
            // Use youtube-nocookie for privacy
            urlObj.hostname = 'www.youtube-nocookie.com';
            return urlObj.toString();
        } else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/shorts/')) {
            videoId = urlObj.pathname.split('/shorts/')[1];
        }

        if (videoId) {
            // Construct embed URL with parameters
            const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
            return embedUrl;
        }
    } catch (e) {
        console.error("Invalid video URL:", url, e);
    }
    return url; // Return original URL if parsing fails or no ID found
}

// ---------- Render page ----------
function renderPage() {
    flipbook.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    const img = document.createElement("img");
    img.className = "page-image";
    img.src = images[currentPage];
    img.alt = `Page ${currentPage + 1}`;
    img.loading = "eager"; // Load current page image immediately
    img.crossOrigin = "anonymous"; // Needed for canvas interaction if optimizing AI helper later
    img.onerror = () => {
        img.alt = "Image not available";
        img.style.opacity = 0.5;
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='24' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E";
    }; // Placeholder on error
    const overlay = document.createElement("div");
    overlay.className = "overlay-translation";
    overlay.id = "overlay-translation";
    wrap.appendChild(img);
    wrap.appendChild(overlay);
    flipbook.appendChild(wrap);
    counter.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    pageInput.value = currentPage + 1; // Update input field
    highlightThumb();
    const simConfig = config.simulations.find(s => s.page === (currentPage + 1));
    phetBtn.style.display = simConfig ? 'inline-block' : 'none';
    const videoConfig = config.videos.find(v => v.page === (currentPage + 1));
    videoBtn.style.display = videoConfig ? 'inline-block' : 'none';

    // Hide translation overlay when page changes
    const currentOverlay = document.getElementById('overlay-translation');
    if (currentOverlay) currentOverlay.style.display = 'none';
    const hideBtn = document.getElementById('hideTranslateBtn');
    if (hideBtn) hideBtn.style.display = 'none';

    // Preload adjacent images
    preloadImages();
}

// ---------- Preloading ----------
function preloadImages() {
    // Preload next page
    if (currentPage < images.length - 1) {
        const nextImg = new Image();
        nextImg.src = images[currentPage + 1];
    }
    // Preload previous page
    if (currentPage > 0) {
        const prevImg = new Image();
        prevImg.src = images[currentPage - 1];
    }
}


// ---------- Thumbnails ----------
function renderThumbs() {
    thumbbar.innerHTML = "";
    thumbs.forEach((src, i) => {
        const t = document.createElement("img");
        t.src = src;
        t.alt = `Thumb ${i + 1}`;
        t.loading = "lazy"; // Lazy load thumbnails
        t.addEventListener("click", () => {
            currentPage = i;
            renderPage();
        });
        t.onerror = () => {
            t.alt = "Thumb N/A";
            t.style.opacity = 0.6;
            t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E";
        }; // Placeholder
        thumbbar.appendChild(t);
    });
}

function highlightThumb() {
    let activeThumb = null;
    thumbbar.querySelectorAll("img").forEach((im, i) => {
        const isActive = i === currentPage;
        im.classList.toggle("active", isActive);
        if (isActive) {
            activeThumb = im;
        }
    });
    if (activeThumb) {
        // Check if element is visible before scrolling
        const rect = activeThumb.getBoundingClientRect();
        const parentRect = thumbbar.getBoundingClientRect();
        if (rect.left < parentRect.left || rect.right > parentRect.right) {
            activeThumb.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }
}

// ---------- Index ----------
function renderIndex() {
    indexMenu.innerHTML = "";
    if (config.chapters && config.chapters.length > 0) {
        config.chapters.forEach(chapter => {
            const button = document.createElement("button");
            button.textContent = chapter.title;
            button.onclick = () => goToPage(chapter.page - 1); // Go to 0-based index
            indexMenu.appendChild(button);
        });
        indexToggle.style.display = 'inline-block'; // Show index button if chapters exist
    } else {
        indexToggle.style.display = 'none'; // Hide index button if no chapters
    }
}

// ---------- Navigation ----------
function nextPage() {
    if (currentPage < images.length - 1) {
        currentPage++;
        renderPage();
    } else {
        console.log("Already on last page");
    }
}

function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        renderPage();
    } else {
        console.log("Already on first page");
    }
}

function firstPage() {
    if (currentPage !== 0) {
        currentPage = 0;
        renderPage();
    }
}

function lastPage() {
    if (currentPage !== images.length - 1) {
        currentPage = images.length - 1;
        renderPage();
    }
}

function jumpToPage() {
    const v = parseInt(pageInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages && (v - 1) !== currentPage) {
        currentPage = v - 1;
        renderPage();
    } else if ((v - 1) === currentPage) {
        console.log("Already on page", v);
        pageInput.value = v; // Ensure input reflects current page even if no change
    } else {
        console.log("Invalid page number entered:", pageInput.value);
        pageInput.value = currentPage + 1; // Reset input to current page
    }
}
// Listen for Enter key in the page input field
pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        jumpToPage();
        e.preventDefault(); // Prevent default form submission if applicable
    }
});

function toggleFullScreen() {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(err => console.error(`Error attempting full screen: ${err.message} (${err.name})`));
}

function shareBook() {
    const shareData = {
        title: "PHYS101 Flipbook",
        url: window.location.href
    };
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
    const rect = indexToggle.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    indexMenu.style.left = `${rect.left - footerRect.left}px`; // Position relative to footer
    indexMenu.style.bottom = `${footerRect.height}px`; // Position above the footer
    indexMenu.style.top = "auto";
    indexMenu.style.display = "flex";
    indexMenu.setAttribute("aria-hidden", "false");
    indexToggle.setAttribute("aria-expanded", "true");
}

function closeIndexMenu() {
    indexMenu.style.display = "none";
    indexMenu.setAttribute("aria-hidden", "true");
    indexToggle.setAttribute("aria-expanded", "false");
}
indexToggle.addEventListener("click", e => {
    e.stopPropagation();
    indexMenu.style.display === "flex" ? closeIndexMenu() : openIndexMenu();
});
indexMenu.addEventListener("click", e => e.stopPropagation()); // Prevent clicks inside menu from closing it
document.addEventListener("click", e => { // Close menu if clicking outside
    if (indexMenu.style.display === "flex" && !indexMenu.contains(e.target) && !indexToggle.contains(e.target)) {
        closeIndexMenu();
    }
});

function goToPage(page) {
    if (page >= 0 && page < images.length) {
        currentPage = page;
        renderPage();
        closeIndexMenu();
    } else {
        console.error("Attempted to go to invalid page:", page);
    }
}
window.goToPage = goToPage; // Make accessible if needed globally (e.g., from console)

// ---------- Input & touch ----------
let touchStartX = 0;
let touchEndX = 0;
const swipeThreshold = 50; // Minimum pixels for a swipe
function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
}

function handleSwipeGesture() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            prevPage();
        } else {
            nextPage();
        }
    }
}
// Use DOMContentLoaded to ensure elements exist before adding listeners
document.addEventListener("DOMContentLoaded", () => {
    const flipbookElement = document.getElementById('flipbook'); // Get element reference
    if (flipbookElement) {
        flipbookElement.addEventListener("touchstart", handleTouchStart, {
            passive: true
        });
        flipbookElement.addEventListener("touchend", handleTouchEnd, {
            passive: true
        });
    } else {
        console.error("Flipbook element not found");
    }
    // Also initialize page counter and max value for input here
    const pageCounterEl = document.getElementById('pageCounter');
    const pageInputEl = document.getElementById('pageInput');
    if (pageCounterEl) pageCounterEl.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    if (pageInputEl) pageInputEl.max = totalPages;

    renderThumbs(); // Render thumbs after DOM is ready
    renderIndex(); // Render index after DOM is ready
    renderPage(); // Initial page render
});

document.addEventListener("keydown", e => {
    // Prevent arrow keys from scrolling the page when modals are not open
    if (phetModal.style.display !== 'flex' && videoModal.style.display !== 'flex') {
        if (e.key === "ArrowRight") {
            nextPage();
            e.preventDefault();
        }
        if (e.key === "ArrowLeft") {
            prevPage();
            e.preventDefault();
        }
    }
    if (e.key === "Escape") {
        if (indexMenu.style.display === "flex") {
            closeIndexMenu();
            e.preventDefault();
        } else if (phetModal.style.display === "flex") {
            closePhetModal();
            e.preventDefault();
        } else if (videoModal.style.display === "flex") {
            closeVideoModal();
            e.preventDefault();
        } else if (aiModal.style.display === "flex") {
            aiModal.style.display = 'none';
            e.preventDefault();
        }
    }
});

// ---------- Modals (PhET, Video) ----------
function openPhetModal() {
    const simConfig = config.simulations.find(s => s.page === (currentPage + 1));
    if (simConfig && simConfig.url) {
        phetFrame.src = simConfig.url;
        phetModal.style.display = 'flex';
    } else {
        alert("No simulation found for this page.");
    }
}

function closePhetModal() {
    phetModal.style.display = 'none';
    phetFrame.src = 'about:blank';
} // Clear src to stop simulation
phetBtn.addEventListener('click', openPhetModal);
phetCloseBtn.addEventListener('click', closePhetModal);
phetModal.addEventListener('click', (e) => {
    if (e.target === phetModal) closePhetModal();
}); // Close if clicking background

function openVideoModal() {
    const videoConfig = config.videos.find(v => v.page === (currentPage + 1));
    if (videoConfig && videoConfig.url) {
        videoFrame.src = getYoutubeEmbedUrl(videoConfig.url); // Ensure autoplay
        videoModal.style.display = 'flex';
    } else {
        alert("No video found for this page.");
    }
}

function closeVideoModal() {
    videoModal.style.display = 'none';
    videoFrame.src = 'about:blank';
} // Clear src to stop video
videoBtn.addEventListener('click', openVideoModal);
videoCloseBtn.addEventListener('click', closeVideoModal);
videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeVideoModal();
}); // Close if clicking background

// ---------- AI HELPER ----------
const aiModal = document.getElementById('aiHelperModal');
const aiHelperToggle = document.getElementById('aiHelperToggle');
const aiCloseBtn = document.getElementById('aiCloseBtn');
const aiResponseEl = document.getElementById('aiResponse');
const aiLoadingEl = document.getElementById('aiLoading');
const aiChapterTitleEl = document.getElementById('aiChapterTitle');
const GEMINI_API_KEY = (typeof config !== 'undefined' && config.geminiApiKey) ? config.geminiApiKey : 'YOUR_API_KEY_HERE'; // Get API key from config or use placeholder

// Efficient base64 conversion using canvas
async function getImageAsBase64FromCanvas() {
    const img = document.querySelector('.page-image');
    if (!img || !img.complete || img.naturalWidth === 0) {
        console.error("Image not ready or not found for canvas conversion");
        return null;
    }
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png').split(',')[1]; // Get base64 part
    } catch (error) {
        console.error("Error converting image via canvas:", error);
        return null;
    }
}

aiHelperToggle.addEventListener('click', () => {
    const currentChapter = getCurrentChapter();
    aiChapterTitleEl.textContent = currentChapter ? currentChapter.title : "Current Page"; // Handle cases with no chapters
    aiResponseEl.innerHTML = ''; // Clear previous response
    aiModal.style.display = 'flex';
});
aiCloseBtn.addEventListener('click', () => aiModal.style.display = 'none');
aiModal.addEventListener('click', (e) => {
    if (e.target === aiModal) aiModal.style.display = 'none';
}); // Close if clicking background

function getCurrentChapter() {
    if (!config.chapters || config.chapters.length === 0) return null; // No chapters defined
    let currentChapter = config.chapters[0]; // Default to first chapter
    // Iterate backwards to find the chapter the current page belongs to
    for (let i = config.chapters.length - 1; i >= 0; i--) {
        // Page numbers in config are 1-based, currentPage is 0-based
        if (currentPage >= (config.chapters[i].page - 1)) {
            currentChapter = config.chapters[i];
            break;
        }
    }
    return currentChapter;
}

async function getAiHelp(type) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        aiResponseEl.textContent = "AI Helper not configured: API key missing in config.js or placeholder used.";
        return;
    }

    aiLoadingEl.style.display = 'block';
    aiResponseEl.innerHTML = '';
    let requestBody;
    const chapterInfo = getCurrentChapter();
    const chapterTitle = chapterInfo ? chapterInfo.title : "this page";

    try { // Wrap the main logic in try-catch for better error handling
        if (type === 'analyze_page') {
            const pageImageElement = document.querySelector('.page-image');
            if (!pageImageElement || !pageImageElement.complete || pageImageElement.naturalWidth === 0) {
                aiResponseEl.textContent = "Page image not fully loaded yet. Please wait a moment and try again.";
                aiLoadingEl.style.display = 'none';
                return;
            }
            // Use the faster canvas method
            let imageData = await getImageAsBase64FromCanvas();

            if (!imageData) {
                aiResponseEl.textContent = "Could not process page image data.";
                aiLoadingEl.style.display = 'none';
                return;
            }
            requestBody = {
                contents: [{
                    parts: [{
                        text: `Analyze the content of this physics textbook page (likely from chapter "${chapterTitle}"). Summarize the key concepts, explain any important formulas or diagrams, and provide a key takeaway relevant for a university life science student.`
                    }, {
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData
                        }
                    }]
                }]
            };
        } else {
            let aiPrompt;
            switch (type) {
                case 'explain':
                    const concept = window.prompt(`What concept from "${chapterTitle}" would you like explained?`, "e.g., Pascal's Principle");
                    if (!concept) {
                        aiLoadingEl.style.display = 'none';
                        return;
                    } // User cancelled prompt
                    aiPrompt = `You are a physics tutor for university life science students. Explain the concept of "${concept}" from the chapter "${chapterTitle}" in a simple, clear, and concise way. Use analogies related to biology or medicine if appropriate.`;
                    break;
                case 'quiz':
                    aiPrompt = `You are a physics tutor. Based on the chapter "${chapterTitle}", generate 2 challenging multiple-choice quiz questions (4 options each, labeled A, B, C, D) to test a student's understanding. After each question, provide the correct answer letter in bold (e.g., **A**) and a brief explanation for why it's correct.`;
                    break;
                case 'relate':
                    aiPrompt = `You are a physics tutor for university life science students. For the chapter on "${chapterTitle}", provide two clear and distinct examples of how the physics principles discussed apply directly to biological systems, medical procedures, or medical devices. Explain the connection clearly.`;
                    break;
                default:
                    console.error("Unknown AI help type:", type);
                    aiLoadingEl.style.display = 'none';
                    return;
            }
            requestBody = {
                contents: [{
                    parts: [{
                        text: aiPrompt
                    }]
                }]
            };
        }

        // --- FIX: Use the correct model name for all API calls ---
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorText = response.statusText;
            try {
                const errorData = await response.json();
                errorText = errorData.error ? .message || errorText;
            } catch (e) { /* Ignore if response body isn't JSON */ }
            throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Handle potential safety blocks or empty responses
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            let finishReason = data.candidates ? .[0] ? .finishReason || 'Unknown reason';
            console.warn("AI response missing content. Finish reason:", finishReason, data);
            aiResponseEl.textContent = `Sorry, the AI response was blocked or empty. Reason: ${finishReason}. Please try rephrasing or a different request.`;
        } else {
            const text = data.candidates[0].content.parts[0].text;
            if (typeof marked !== 'undefined') {
                aiResponseEl.innerHTML = marked.parse(text); // Use marked if available
            } else {
                aiResponseEl.innerText = text; // Fallback to plain text
            }
            if (window.MathJax) {
                MathJax.typesetPromise([aiResponseEl]).catch(err => console.error("MathJax typesetting error:", err));
            }
        }

    } catch (error) {
        console.error("AI Helper Error:", error);
        aiResponseEl.textContent = `Sorry, an error occurred while getting the AI response: ${error.message}`;
    } finally {
        aiLoadingEl.style.display = 'none';
    }
}


// --- Translate Page (USING PRE-EXTRACTED TEXT) ---
const translateBtn = document.getElementById('translateBtn');
const hideTranslateBtn = document.getElementById('hideTranslateBtn');

async function translateCurrentPage() {
    const overlay = document.getElementById('overlay-translation');
    if (!overlay) return;

    overlay.style.display = 'block';
    overlay.textContent = '🔄 Loading text...';

    const pageKey = String(currentPage); // Ensure the key is a string
    const englishText = bookTextData[pageKey];

    if (englishText === undefined) {
        overlay.textContent = '⚠️ Text data for this page is currently unavailable.';
        return;
    }
    if (!englishText || !englishText.trim()) {
        overlay.textContent = 'ℹ️ No translatable text found for this page in the data file.';
        return;
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        overlay.innerText = "⚠️ Translation unavailable: No Gemini API key configured.\n\nDetected English (preview):\n\n" + englishText.slice(0, 1500) + (englishText.length > 1500 ? "..." : "");
        return;
    }

    overlay.textContent = '🌐 Translating to Arabic... Please wait.';

    try {
        // --- FIX: Use the correct model name for translation API call ---
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const requestBody = {
            contents: [{
                parts: [{
                    text: `Translate the following English physics textbook text accurately into clear, educational Arabic suitable for university-level biology or medical students. Preserve mathematical equations and scientific terminology where possible using standard Arabic equivalents. Focus solely on translation; do not add any commentary, interpretations, or explanations beyond the original text.\n\n---START TEXT---\n${englishText}\n---END TEXT---`
                }]
            }]
        };

        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!resp.ok) {
            let errorText = resp.statusText;
            try {
                const errData = await resp.json();
                errorText = errData.error ? .message || errorText;
            } catch (e) { /* Ignore JSON parse error */ }
            throw new Error(`API error (${resp.status}): ${errorText}`);
        }

        const data = await resp.json();

        // Handle potential safety blocks or empty responses
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            let finishReason = data.candidates ? .[0] ? .finishReason || 'Unknown reason';
            console.warn("Translation response missing content. Finish reason:", finishReason, data);
            overlay.textContent = `❌ Translation failed or was blocked. Reason: ${finishReason}.`;
        } else {
            const translated = data.candidates[0].content.parts[0].text;
            overlay.innerText = translated; // Use innerText for safety
            overlay.style.display = 'block'; // Ensure it's visible
            hideTranslateBtn.style.display = 'inline-block'; // Show hide button

            if (window.MathJax) {
                MathJax.typesetPromise([overlay]).catch(err => console.error("MathJax typesetting error on translation:", err));
            }
        }

    } catch (err) {
        console.error("Translate error:", err);
        overlay.textContent = `❌ Translation Error: ${err.message}`;
    }
}

translateBtn.addEventListener('click', translateCurrentPage);
hideTranslateBtn.addEventListener('click', () => {
    const overlay = document.getElementById('overlay-translation');
    if (overlay) overlay.style.display = 'none';
    hideTranslateBtn.style.display = 'none';
});
// --- End Translate Page ---
</script>
</body>
</html>

