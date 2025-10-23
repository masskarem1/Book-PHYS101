const config = {
  // --- Core Settings ---
  requireLogin: false, // Set to true to enable student ID login
  totalPages: 292,

  // --- Paths ---
  // Make sure these paths are correct relative to your index.html file
  imagePath: './images/Book_PHYS101_', // e.g., ./images/Book_PHYS101_0.png
  thumbPath: './thumbs/Book_PHYS101_', // e.g., ./thumbs/Book_PHYS101_0.jpg
  
  // --- Google Apps Script Proxy URL ---
  // This is your secure proxy URL. The API key is stored in Google Apps Script, not here.
  appsScriptProxyUrl: 'https://script.google.com/macros/s/AKfycbxzKK4RKp0rpCZcznOYPyV4aWMhBZLqYSn_ZFyNe3EO6_MxPWHZ3laF1QGL6zk6E4-h/exec',

  // --- Book Structure ---
  chapters: [], // This will be loaded from chapters.json

  // --- Embedded Content ---
  simulations: [
    { 
      page: 9, 
      url: "https://phet.colorado.edu/sims/html/curve-fitting/latest/curve-fitting_all.html" 
    },
    { 
      page: 45, 
      url: "https://phet.colorado.edu/sims/html/masses-and-springs-basics/latest/masses-and-springs-basics_all.html"
    }
  ],
  videos: [
    {
      page: 10,
      url: "https://www.youtube.com/watch?v=JieVY0q1Ypg"
    },
    {
      page: 48,
      url: "https://youtube.com/shorts/-H4oOfKtPDw?si=Jv94nlu73WhiL7M1"
    }
  ]
};

