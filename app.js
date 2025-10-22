// ... (previous code) ...

function renderThumbs() {
    if (!thumbbar) return;
    thumbbar.innerHTML = "";
    thumbs.forEach((src, i) => { // 'i' is the 0-based index of the thumbnail
        const t = document.createElement("img");
        t.src = src;
        t.alt = `Thumb ${i + 1}`;
        t.loading = "lazy";
        t.addEventListener("click", () => {
            // --- DEBUGGING ---
            console.log(`Thumbnail clicked! Index: ${i}, Current Page Before Click: ${currentPage}`);
            // --- END DEBUGGING ---

            if (currentPage !== i) { // Prevent re-rendering same page
                 currentPage = i; // Update the current page index

                 // --- DEBUGGING ---
                 console.log(`Current Page Updated To: ${currentPage}. Calling renderPage().`);
                 // --- END DEBUGGING ---

                 renderPage(); // Render the newly selected page
            } else {
                 // --- DEBUGGING ---
                 console.log(`Clicked thumbnail ${i} is already the current page (${currentPage}). No action taken.`);
                 // --- END DEBUGGING ---
            }
        });
        t.onerror = () => {
            t.alt = "Thumb N/A";
            t.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'%3EN/A%3C/text%3E%3C/svg%3E";
        };
        thumbbar.appendChild(t);
    });
}

// ... (rest of app.js code) ...

