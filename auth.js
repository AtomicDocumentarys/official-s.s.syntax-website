// Handle OAuth callback
if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    
    if (token) {
        localStorage.setItem('discord_token', token);
        window.location.href = '/dashboard/';
    }
}

// Export auth functions
window.auth = {
    getToken: () => localStorage.getItem('discord_token'),
    isAuthenticated: () => !!localStorage.getItem('discord_token'),
    logout: () => {
        localStorage.removeItem('discord_token');
        window.location.href = '/dashboard/';
    }
};

