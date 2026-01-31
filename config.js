module.exports = {
    // These read from the Railway "Variables" tab
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    
    // YOUR PRODUCTION URL
    // Ensure this matches the Discord Developer Portal Redirect exactly
    REDIRECT_URI: "https://official-sssyntax-website-production.up.railway.app/callback.html" 
};
