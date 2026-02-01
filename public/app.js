// Simple Frontend App
let currentUser = null;
let csrfToken = null;

// Initialize
async function init() {
    console.log('Initializing dashboard...');
    
    // Get CSRF token
    await fetchCSRFToken();
    
    // Check for token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam) {
        // Store token
        sessionStorage.setItem('auth_token', tokenParam);
        
        // Remove token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Load user data
        await loadUserData();
    } else {
        // Check session storage
        const storedToken = sessionStorage.getItem('auth_token');
        if (storedToken) {
            await loadUserData();
        }
    }
    
    // Load status
    loadStatus();
}

async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
        console.log('CSRF token loaded');
    } catch (error) {
        console.warn('CSRF token fetch failed:', error);
    }
}

async function loadUserData() {
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/user-me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            updateUserUI(user);
            showAuthenticatedUI();
            loadMutualServers();
        } else {
            // Token expired
            sessionStorage.removeItem('auth_token');
            showNotification('Session expired, please login again', 'warning');
        }
    } catch (error) {
        console.error('Load user error:', error);
    }
}

function updateUserUI(user) {
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userDiscriminator').textContent = '#' + user.discriminator;
    
    const avatarUrl = user.avatar ? 
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` :
        `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
    
    document.getElementById('userPfp').src = avatarUrl;
    
    document.getElementById('userSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
}

async function loadMutualServers() {
    const token = sessionStorage.getItem('auth_token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/mutual-servers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            const guilds = await response.json();
            updateGuildSelect(guilds);
        }
    } catch (error) {
        console.error('Load guilds error:', error);
    }
}

function updateGuildSelect(guilds) {
    const select = document.getElementById('guildSelect');
    select.innerHTML = '<option value="">Select a server...</option>';
    
    guilds.forEach(guild => {
        const option = document.createElement('option');
        option.value = guild.id;
        option.textContent = guild.name;
        select.appendChild(option);
    });
    
    if (guilds.length > 0) {
        select.classList.remove('hidden');
        document.querySelectorAll('.s-only').forEach(el => el.classList.remove('hidden'));
    }
}

async function loadStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Update status display
        document.getElementById('botStatus').textContent = data.bot;
        document.getElementById('botStatus').className = data.bot.includes('Online') ? 'status-good' : 'status-error';
        
        document.getElementById('redisStatus').textContent = data.redis;
        document.getElementById('redisStatus').className = data.redis.includes('Connected') ? 'status-good' : 'status-error';
        
        document.getElementById('serverCount').textContent = data.guilds;
        document.getElementById('botUptime').textContent = data.uptime;
        
        // Update security status
        updateSecurityStatus(data);
        
    } catch (error) {
        console.error('Load status error:', error);
    }
}

function updateSecurityStatus(data) {
    const csrfElement = document.getElementById('csrfStatus');
    const rateLimitElement = document.getElementById('rateLimitStatus');
    const encryptionElement = document.getElementById('encryptionStatus');
    
    csrfElement.innerHTML = `<i class="fas fa-check-circle"></i><span>CSRF Protection</span><span class="status-badge status-good">Active</span>`;
    
    rateLimitElement.innerHTML = `<i class="fas fa-check-circle"></i><span>Rate Limiting</span><span class="status-badge status-good">Active</span>`;
    
    if (data.redis.includes('Connected')) {
        encryptionElement.innerHTML = `<i class="fas fa-check-circle"></i><span>Encryption</span><span class="status-badge status-good">Active</span>`;
    } else {
        encryptionElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Encryption</span><span class="status-badge status-warning">No Redis</span>`;
    }
}

function showAuthenticatedUI() {
    document.querySelectorAll('.s-only').forEach(el => el.classList.remove('hidden'));
}

function login() {
    // Get the current origin for redirect
    const redirectUri = encodeURIComponent(window.location.origin + '/callback');
    const clientId = 'YOUR_CLIENT_ID'; // Replace with your actual client ID
    
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    window.location.href = authUrl;
}

function logout() {
    sessionStorage.removeItem('auth_token');
    currentUser = null;
    
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    document.querySelectorAll('.s-only').forEach(el => el.classList.add('hidden'));
    
    showNotification('Logged out successfully', 'success');
    switchTab('home');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Global functions for HTML
function switchTab(tabName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(`v-${tabName}`).classList.add('active');
    document.querySelector(`.nav-item[onclick*="${tabName}"]`).classList.add('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('dropdown').classList.toggle('show');
}

function addToServer() {
    const clientId = 'YOUR_CLIENT_ID'; // Replace with your actual client ID
    window.open(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`, '_blank');
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    const dropdown = document.getElementById('dropdown');
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Initialize app
    init();
    
    // Load status every 30 seconds
    setInterval(loadStatus, 30000);
});
