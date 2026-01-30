// Main dashboard functionality
class Dashboard {
    constructor() {
        this.currentUser = null;
        this.userServers = [];
        this.currentServer = null;
        this.commands = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadInitialData();
    }

    async checkAuth() {
        const token = localStorage.getItem('discord_token');
        if (token) {
            await this.fetchUserData(token);
        }
    }

    async fetchUserData(token) {
        try {
            const response = await fetch('https://discord.com/api/users/@me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Auth failed');
            
            this.currentUser = await response.json();
            this.updateUI();
            await this.fetchUserServers(token);
        } catch (error) {
            this.handleAuthError();
        }
    }

    async fetchUserServers(token) {
        try {
            const response = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            this.userServers = await response.json();
            this.updateServerDisplay();
        } catch (error) {
            console.error('Failed to fetch servers:', error);
        }
    }

    updateUI() {
        document.getElementById('userInfo').innerHTML = `
            <img src="https://cdn.discordapp.com/avatars/${this.currentUser.id}/${this.currentUser.avatar}.png" 
                 class="user-avatar" alt="Avatar">
            <span>${this.currentUser.username}</span>
            <button class="btn btn-outline" onclick="dashboard.logout()">Logout</button>
        `;
        
        document.getElementById('navTabs').style.display = 'flex';
        this.showTab('server-tab');
    }

    updateServerDisplay() {
        const grid = document.getElementById('serverGrid');
        grid.innerHTML = this.userServers.map(server => `
            <div class="server-card" onclick="dashboard.selectServer('${server.id}')">
                <div class="server-icon">⚙️</div>
                <div class="server-name">${server.name}</div>
                <div class="server-info">ID: ${server.id}</div>
            </div>
        `).join('');
    }

    async selectServer(serverId) {
        this.currentServer = this.userServers.find(s => s.id === serverId);
        await this.loadServerCommands(serverId);
        this.showTab('command-tab');
    }

    async loadServerCommands(serverId) {
        try {
            // This would call your bot's API
            const response = await fetch(`/api/commands/${serverId}`);
            this.commands = await response.json();
            this.updateCommandList();
            this.updateLimits();
        } catch (error) {
            console.error('Failed to load commands:', error);
        }
    }

    updateCommandList() {
        const list = document.getElementById('commandList');
        list.innerHTML = this.commands.map(command => `
            <div class="command-item">
                <div class="command-header">
                    <div class="command-name">${command.name}</div>
                    <div class="command-actions">
                        <button class="btn btn-outline" onclick="dashboard.editCommand('${command.id}')">Edit</button>
                        <button class="btn btn-danger" onclick="dashboard.deleteCommand('${command.id}')">Delete</button>
                    </div>
                </div>
                <div class="command-meta">
                    <span>Type: ${command.type}</span>
                    <span>Language: ${command.language}</span>
                    <span>Created: ${new Date(command.createdAt).toLocaleDateString()}</span>
                </div>
                <pre><code>${command.code.substring(0, 200)}...</code></pre>
            </div>
        `).join('');
    }

    updateLimits() {
        const totalChars = this.commands.reduce((sum, cmd) => sum + cmd.code.length, 0);
        document.getElementById('commandsUsed').textContent = this.commands.length;
        document.getElementById('charactersUsed').textContent = totalChars.toLocaleString();
    }

    showTab(tabId) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
    }

    logout() {
        localStorage.removeItem('discord_token');
        location.reload();
    }

    setupEventListeners() {
        // Character counter for code editor
        document.getElementById('commandCode').addEventListener('input', (e) => {
            const count = e.target.value.length;
            document.getElementById('charCount').textContent = count.toLocaleString();
            
            if (count > 20000) {
                e.target.style.borderColor = 'var(--error)';
            } else {
                e.target.style.borderColor = '';
            }
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Global functions for HTML onclick attributes
function showTab(tabId) {
    window.dashboard?.showTab(tabId);
}

function login() {
    const clientId = '1466792124686008341';
    const redirectUri = encodeURIComponent(`${window.location.origin}/callback.html`);
    const scope = 'identify guilds';
    
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    }
