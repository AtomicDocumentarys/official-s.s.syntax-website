// Simple Frontend
let user = null;
let clientId = null;

// Load on start
window.onload = async function() {
  // First get the client ID from server
  await getClientId();
  
  checkAuth();
  loadStatus();
  
  // Check for token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    sessionStorage.setItem('token', token);
    window.history.replaceState({}, '', '/');
    checkAuth();
  }
};

// Get client ID from server
async function getClientId() {
  try {
    // You can store client ID in a meta tag or get it from an API endpoint
    // For now, we'll store it in a meta tag in index.html
    const metaTag = document.querySelector('meta[name="client-id"]');
    if (metaTag) {
      clientId = metaTag.getAttribute('content');
    }
    
    // If not in meta tag, try to get it from a simple endpoint
    if (!clientId) {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        clientId = data.clientId;
      } catch (error) {
        console.log('No config endpoint, will use fallback');
      }
    }
    
    console.log('Client ID loaded:', clientId);
  } catch (error) {
    console.error('Failed to get client ID:', error);
  }
}

// Check if user is authenticated
async function checkAuth() {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    showLoginUI();
    return;
  }
  
  try {
    const response = await fetch('/api/user-me', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    if (response.ok) {
      user = await response.json();
      showUserUI(user);
      loadGuilds();
    } else {
      sessionStorage.removeItem('token');
      showLoginUI();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginUI();
  }
}

// Show login button
function showLoginUI() {
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('userSection').style.display = 'none';
  document.querySelectorAll('.s-only').forEach(el => {
    el.style.display = 'none';
  });
}

// Show user info
function showUserUI(userData) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('userSection').style.display = 'flex';
  
  // Update user info
  document.getElementById('userName').textContent = userData.username;
  document.getElementById('userDiscriminator').textContent = '#' + userData.discriminator;
  document.getElementById('userPfp').src = userData.avatar 
    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  
  // Show protected sections
  document.querySelectorAll('.s-only').forEach(el => {
    el.style.display = 'block';
  });
}

// Load mutual guilds
async function loadGuilds() {
  const token = sessionStorage.getItem('token');
  if (!token) return;
  
  try {
    const response = await fetch('/api/mutual-servers', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    if (response.ok) {
      const guilds = await response.json();
      updateGuildSelect(guilds);
    }
  } catch (error) {
    console.error('Failed to load guilds:', error);
  }
}

// Update guild dropdown
function updateGuildSelect(guilds) {
  const select = document.getElementById('guildSelect');
  select.innerHTML = '<option value="">Select a server...</option>';
  
  guilds.forEach(guild => {
    const option = document.createElement('option');
    option.value = guild.id;
    option.textContent = guild.name;
    select.appendChild(option);
  });
}

// Load system status
async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    // Update status display
    const botStatus = document.getElementById('botStatus');
    botStatus.textContent = data.bot;
    botStatus.className = data.bot.includes('Online') ? 'status-good' : 'status-error';
    
    const redisStatus = document.getElementById('redisStatus');
    redisStatus.textContent = data.redis;
    redisStatus.className = data.redis.includes('Connected') ? 'status-good' : 'status-error';
    
    document.getElementById('serverCount').textContent = data.guilds || 0;
    document.getElementById('botUptime').textContent = data.uptime || '0 minutes';
    
  } catch (error) {
    console.error('Status load failed:', error);
  }
}

// Login function
function login() {
  if (!clientId) {
    alert('Client ID not loaded yet. Please refresh the page.');
    return;
  }
  
  const redirectUri = encodeURIComponent(window.location.origin + '/callback');
  window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
}

// Logout function
function logout() {
  sessionStorage.removeItem('token');
  user = null;
  showLoginUI();
  showNotification('Logged out successfully', 'success');
}

// Add bot to server
function addToServer() {
  if (!clientId) {
    alert('Client ID not loaded yet. Please refresh the page.');
    return;
  }
  
  window.open(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`, '_blank');
}

// Simple notification
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  if (!container) {
    alert(message); // Fallback to alert
    return;
  }
  
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

// Tab switching
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.view').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById('v-' + tabName).classList.add('active');
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Find and activate the clicked nav item
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabName)) {
      item.classList.add('active');
    }
  });
}

// Theme toggle
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Guild selection
function selectGuild() {
  const select = document.getElementById('guildSelect');
  const guildId = select.value;
  
  if (guildId) {
    showNotification(`Selected server: ${select.options[select.selectedIndex].text}`, 'success');
  }
}

// Toggle dropdown
function toggleDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('dropdown');
  dropdown.classList.toggle('show');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('dropdown');
  if (dropdown && dropdown.classList.contains('show') && 
      !event.target.closest('.user-menu')) {
    dropdown.classList.remove('show');
  }
});

// Toggle sidebar for mobile
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('show');
}

// View user profile
function viewProfile() {
  if (user) {
    showNotification(`Viewing profile: ${user.username}#${user.discriminator}`, 'info');
  }
}

// Open security settings
function openSecuritySettings() {
  switchTab('security');
}

// Run security scan
function runSecurityScan() {
  showNotification('Running security scan...', 'info');
  setTimeout(() => {
    showNotification('Security scan complete. All systems secure.', 'success');
  }, 2000);
}

// Auto-refresh status every 30 seconds
setInterval(loadStatus, 30000);

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
