// ---------- Config ----------
const config = {
    totalPages: 292,
    imagePath: './images/Book_PHYS101_',
    thumbPath: './thumbs/Book_PHYS101_',
    chapters: [
        { title: "CHAPTER 1 – Physics and Measurements", page: 8 },
        { title: "CHAPTER 2 – Solids and Elasticity", page: 40 },
        { title: "CHAPTER 3 – Fluids", page: 62 },
        { title: "CHAPTER 4 – Thermal Physics", page: 134 },
        { title: "CHAPTER 5 – Waves and Sound", page: 216 },
        { title: "APPENDIX", page: 278 }
    ],
    
    // ---------- Simulation Config ----------
    simulations: [
        { 
            page: 65, 
            url: "https://phet.colorado.edu/sims/html/under-pressure/latest/under-pressure_en.html" 
        },
        { 
            page: 72, 
            url: "https://phet.colorado.edu/sims/html/fluid-pressure-and-flow/latest/fluid-pressure-and-flow_en.html"
        }
    ],

    // ---------- Video Config ----------
    // Add 1-based page numbers and video URLs here
    videos: [
        {
            page: 10, // Example: On page 10
            url: "https://www.youtube.com/watch?v=hQ-rR-4n-7I" // Standard YouTube link
        },
        {
            page: 42, // Example: On page 42
            url: "https://www.youtube.com/watch?v=S-JpEjA2-iA"
        }
    ]
};
