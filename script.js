// DOM Elements
let currentLanguage = 'javascript';
let languages = {};
let editor = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load languages
    await loadLanguages();
    
    // Initialize CodeMirror editor
    initializeEditor();
    
    // Load first language
    switchLanguage('javascript');
    
    // Setup event listeners
    setupEventListeners();
});

// Load languages from API
async function loadLanguages() {
    try {
        const response = await fetch('/api/languages');
        const data = await response.json();
        
        if (data.success) {
            languages = {};
            data.languages.forEach(lang => {
                languages[lang.id] = lang;
            });
            
            // Update language list
            updateLanguageList();
        }
    } catch (error) {
        console.error('Error loading languages:', error);
    }
}

// Update language list in sidebar
function updateLanguageList() {
    const container = document.getElementById('languageList');
    container.innerHTML = '';
    
    Object.values(languages).forEach(lang => {
        const button = document.createElement('button');
        button.className = `language-btn ${currentLanguage === lang.id ? 'active' : ''}`;
        button.onclick = () => switchLanguage(lang.id);
        
        button.innerHTML = `
            <div class="language-icon">
                <i class="${lang.icon}"></i>
            </div>
            <div>
                <div class="language-name">${lang.name}</div>
                <div style="font-size: 0.8rem; color: #94a3b8;">${lang.description}</div>
            </div>
        `;
        
        container.appendChild(button);
    });
}

// Initialize CodeMirror editor
function initializeEditor() {
    editor = CodeMirror(document.getElementById('codeEditor'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        extraKeys: {
            'Ctrl-Space': 'autocomplete'
        },
        hintOptions: {
            completeSingle: false
        }
    });
    
    editor.setSize('100%', '100%');
}

// Switch to a different language
function switchLanguage(langId) {
    if (!languages[langId]) return;
    
    currentLanguage = langId;
    const lang = languages[langId];
    
    // Update active button
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.language-btn').classList.add('active');
    
    // Update editor header
    document.getElementById('editorTitle').innerHTML = `
        <i class="${lang.icon}"></i>
        ${lang.name} Editor
        <span style="color: ${lang.color}; margin-left: 10px;">●</span>
    `;
    
    // Update editor mode
    let mode;
    switch (langId) {
        case 'javascript': mode = 'javascript'; break;
        case 'python': mode = 'python'; break;
        case 'golang': mode = 'go'; break;
        case 'html': mode = 'htmlmixed'; break;
        default: mode = 'javascript';
    }
    
    editor.setOption('mode', mode);
    
    // Load language code
    editor.setValue(lang.code || '');
    
    // Update console header
    document.getElementById('consoleTitle').innerHTML = `
        <i class="fas fa-terminal"></i>
        ${lang.name} Output
    `;
    
    // Clear console
    clearConsole();
    
    // Update execution info
    updateExecutionInfo();
}

// Setup event listeners
function setupEventListeners() {
    // Run button
    document.getElementById('runBtn').addEventListener('click', runCode);
    
    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveCode);
    
    // Clear console button
    document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
    
    // Reset button
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('Reset code to default?')) {
            const lang = languages[currentLanguage];
            editor.setValue(lang.code || '');
        }
    });
}

// Run the code
async function runCode() {
    const code = editor.getValue();
    
    if (!code.trim()) {
        addConsoleOutput('Please enter some code to execute.', 'error');
        return;
    }
    
    // Show loading
    const runBtn = document.getElementById('runBtn');
    const originalText = runBtn.innerHTML;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    runBtn.disabled = true;
    
    // Clear console
    clearConsole();
    
    // Add starting message
    addConsoleOutput(`Starting ${languages[currentLanguage].name} execution...`, 'info');
    
    try {
        // Execute code
        const startTime = Date.now();
        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: currentLanguage,
                code: code
            })
        });
        
        const result = await response.json();
        const executionTime = Date.now() - startTime;
        
        if (result.success) {
            // Display output
            if (result.output) {
                addConsoleOutput(result.output, 'success');
            }
            
            // Display errors if any
            if (result.error) {
                addConsoleOutput(`Error: ${result.error}`, 'error');
            }
            
            // Update execution info
            updateExecutionInfo(result.executionTime || executionTime);
            
        } else {
            addConsoleOutput(`Error: ${result.error}`, 'error');
        }
        
    } catch (error) {
        addConsoleOutput(`Network error: ${error.message}`, 'error');
    } finally {
        // Restore button
        runBtn.innerHTML = originalText;
        runBtn.disabled = false;
    }
}

// Save the current code
async function saveCode() {
    const code = editor.getValue();
    const lang = languages[currentLanguage];
    
    try {
        const response = await fetch(`/api/languages/${currentLanguage}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local copy
            languages[currentLanguage].code = code;
            
            // Show success message
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
            }, 2000);
            
            addConsoleOutput('Code saved successfully!', 'success');
        } else {
            addConsoleOutput(`Error: ${result.error}`, 'error');
        }
        
    } catch (error) {
        addConsoleOutput(`Save error: ${error.message}`, 'error');
    }
}

// Add output to console
function addConsoleOutput(text, type = 'info') {
    const consoleOutput = document.getElementById('consoleOutput');
    const outputLine = document.createElement('div');
    outputLine.className = `output-line ${type}`;
    
    // Format the output
    const lines = text.split('\n');
    lines.forEach(line => {
        const lineDiv = document.createElement('div');
        lineDiv.textContent = line || ' ';
        outputLine.appendChild(lineDiv);
    });
    
    consoleOutput.appendChild(outputLine);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Clear console
function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = '';
    addConsoleOutput('Console cleared. Ready for execution.', 'info');
}

// Update execution info
function updateExecutionInfo(time = 0) {
    document.getElementById('execTime').textContent = `${time}ms`;
    document.getElementById('codeSize').textContent = `${editor.getValue().length} chars`;
    document.getElementById('languageName').textContent = languages[currentLanguage].name;
}

// Discord bot integration (for your bot to call)
window.runCodeForDiscord = async function(language, code) {
    try {
        const response = await fetch('/api/discord/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-discord-secret': 'YOUR_SECRET_KEY' // Change this in production
            },
            body: JSON.stringify({
                language: language,
                code: code,
                userId: 'discord_user'
            })
        });
        
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
};
