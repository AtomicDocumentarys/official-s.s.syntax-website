// Dashboard functionality for S.S. Syntax
let currentUser = null;
let userServers = [];

// Discord OAuth2 Configuration
const CLIENT_ID = '1466792124686008341';
const REDIRECT_URI = window.location.origin + '/callback.html';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
});

// Discord Login
function login() {
    const scope = 'identify guilds';
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${scope}`;
    window.location.href = authUrl;
}

// Check for existing authentication
function checkExistingAuth() {
    const token = localStorage.getItem('discord_token');
    if (token) {
        fetchUserData(token);
    }
}

// Fetch user data after login
function fetchUserData(token) {
    fetch('https://discord.com/api/users/@me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(user => {
        currentUser = user;
        localStorage.setItem('discord_token', token);
        updateUserInterface();
        fetchUserServers(token);
    })
    .catch(error => {
        console.error('Auth error:', error);
        localStorage.removeItem('discord_token');
    });
}

// Fetch user's servers
function fetchUserServers(token) {
    fetch('https://discord.com/api/users/@me/guilds', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(servers => {
        userServers = servers.filter(server => (server.permissions & 0x20) === 0x20); // MANAGE_SERVER
    updateServerSelect();
}

// Update UI after login
function updateUserInterface() {
    const userInfo = document.getElementById('userInfo');
    const serverSection = document.getElementById('serverSection');
    const commandBuilder = document.getElementById('commandBuilder');
    const quickActions = document.getElementById('quickActions');
    
    userInfo.innerHTML = `
        <img src="https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png" width="32" height="32" style="border-radius: 50%; vertical-align: middle;">
        <span style="margin: 0 10px;">${currentUser.username}</span>
        <button class="btn" onclick="logout()">Logout</button>
    `;
    
    serverSection.style.display = 'block';
    commandBuilder.style.display = 'block';
    quickActions.style.display = 'block';
}

// Update server dropdown
function updateServerSelect() {
    const select = document.getElementById('serverSelect');
    select.innerHTML = '<option value="">Choose a server...</option>';
    
    userServers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = server.name;
        select.appendChild(option);
    });
}

// Create new command
function createCommand() {
    const name = document.getElementById('commandName').value.trim();
    const triggerType = document.getElementById('triggerType').value;
    const language = document.getElementById('commandLanguage').value;
    const code = document.getElementById('commandCode').value.trim();
    
    if (!name) {
        alert('Please enter a command name');
        return;
    }
    
    if (!code) {
        alert('Please enter some code');
        return;
    }
    
    const command = {
        id: generateId(),
        name: name,
        triggerType: triggerType,
        language: language,
        code: code,
        createdAt: new Date().toISOString()
    };
    
    saveCommand(command);
    displayCommand(command);
    clearForm();
    
    alert(`Command "${name}" created successfully!`);
}

// Save command to localStorage
function saveCommand(command) {
    let commands = JSON.parse(localStorage.getItem('ss_syntax_commands') || [];
    commands.push(command);
    localStorage.setItem('ss_syntax_commands', JSON.stringify(commands));
}

// Display command in the list
function displayCommand(command) {
    const commandList = document.getElementById('commandList');
    const commandCard = document.createElement('div');
    commandCard.className = 'command-card';
    
    commandCard.innerHTML = `
        <div class="command-header">
            <span class="command-name">${command.name}</span>
            <button class="btn" onclick="deleteCommand('${command.id}')">Delete</button>
        </div>
        <div class="command-meta">
            <strong>Trigger:</strong> ${getTriggerTypeName(command.triggerType)} | 
            <strong>Language:</strong> ${getLanguageName(command.language)}
        </div>
        <pre><code>${command.code}</code></pre>
    `;
    
    commandList.appendChild(commandCard);
}

// Load existing commands
function loadCommands() {
    const commands = JSON.parse(localStorage.getItem('ss_syntax_commands') || [];
    commands.forEach(displayCommand);
}

// Delete command
function deleteCommand(commandId) {
    let commands = JSON.parse(localStorage.getItem('ss_syntax_commands') || [];
    commands = commands.filter(cmd => cmd.id !== commandId);
    localStorage.setItem('ss_syntax_commands', JSON.stringify(commands));
    document.getElementById('commandList').innerHTML = '';
    loadCommands();
}

// Clear form
function clearForm() {
    document.getElementById('commandName').value = '';
    document.getElementById('commandCode').value = '';
}

// Helper functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTriggerTypeName(type) {
    const types = {
        'prefix': 'Prefix Command',
        'slash': 'Slash Command',
        'message': 'Message Contains',
        'reaction': 'Reaction Added',
        'member': 'Member Joins'
    };
    return types[type] || type;
}

function getLanguageName(lang) {
    const languages = {
        'js': 'JavaScript',
        'py': 'Python',
        'ts': 'TypeScript',
        'go': 'Go'
    };
    return languages[lang] || lang;
}

// Quick Actions
function deployBot() {
    alert('🚀 Deploying bot with all commands...');
    // Here you would send commands to your bot API
}

function viewLogs() {
    alert('📊 Opening logs dashboard...');
}

function exportCommands() {
    const commands = JSON.parse(localStorage.getItem('ss_syntax_commands') || [];
    const dataStr = JSON.stringify(commands, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ss_syntax_commands.json';
    link.click();
}

function importCommands() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            const importedCommands = JSON.parse(event.target.result);
            localStorage.setItem('ss_syntax_commands', JSON.stringify(importedCommands));
        document.getElementById('commandList').innerHTML = '';
        loadCommands();
        alert('✅ Commands imported successfully!');
    };
    input.click();
}

// Logout
function logout() {
    localStorage.removeItem('discord_token');
    location.reload();
}
  
