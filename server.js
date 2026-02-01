const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Languages database
const languages = {
    javascript: {
        id: 'javascript',
        name: 'JavaScript',
        code: `console.log("Hello, World!");\n\nfunction calculateSum(a, b) {\n    return a + b;\n}\n\nconsole.log("Sum of 5 and 3:", calculateSum(5, 3));`,
        description: 'Client-side scripting language',
        icon: 'fab fa-js-square',
        color: '#f7df1e'
    },
    python: {
        id: 'python',
        name: 'Python',
        code: `print("Hello, World!")\n\ndef calculate_sum(a, b):\n    return a + b\n\nprint(f"Sum of 5 and 3: {calculate_sum(5, 3)}")`,
        description: 'High-level programming language',
        icon: 'fab fa-python',
        color: '#3776ab'
    },
    golang: {
        id: 'golang',
        name: 'Golang',
        code: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n    \n    sum := calculateSum(5, 3)\n    fmt.Printf("Sum of 5 and 3: %d\\n", sum)\n}\n\nfunc calculateSum(a int, b int) int {\n    return a + b\n}`,
        description: 'Go programming language',
        icon: 'fab fa-golang',
        color: '#00add8'
    },
    html: {
        id: 'html',
        name: 'HTML',
        code: `<!DOCTYPE html>\n<html>\n<head>\n    <title>SS Syntax Demo</title>\n    <style>\n        body {\n            font-family: Arial;\n            padding: 40px;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            color: white;\n        }\n        .card {\n            background: rgba(255,255,255,0.1);\n            padding: 30px;\n            border-radius: 20px;\n        }\n    </style>\n</head>\n<body>\n    <div class="card">\n        <h1>Hello from SS Syntax!</h1>\n        <p>HTML execution successful.</p>\n    </div>\n</body>\n</html>`,
        description: 'HyperText Markup Language',
        icon: 'fab fa-html5',
        color: '#e34c26'
    }
};

// API: Get all languages
app.get('/api/languages', (req, res) => {
    res.json({
        success: true,
        languages: Object.values(languages)
    });
});

// API: Execute code
app.post('/api/execute', (req, res) => {
    const { language, code } = req.body;
    
    if (!languages[language]) {
        return res.json({ success: false, error: 'Invalid language' });
    }
    
    // Simulate execution (safe)
    const output = `✅ Executing ${language.toUpperCase()} code...\n\n` +
                  `Code length: ${code.length} characters\n` +
                  `Lines: ${code.split('\\n').length}\n` +
                  `Execution time: ${Math.random() * 100 + 50}ms\n\n` +
                  `[Simulated output - Real execution coming soon!]`;
    
    res.json({
        success: true,
        output: output,
        error: '',
        executionTime: 150,
        language: language
    });
});

// Health check (for Render)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'SS Syntax Dashboard',
        languages: Object.keys(languages).length,
        uptime: process.uptime()
    });
});

// Serve the dashboard HTML
app.get('*', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SS Syntax Dashboard</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            body {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                min-height: 100vh;
                color: #e2e8f0;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            
            /* Header */
            .header {
                text-align: center;
                padding: 40px 0;
                border-bottom: 2px solid #334155;
                margin-bottom: 40px;
            }
            
            .logo {
                font-size: 3rem;
                color: #667eea;
                margin-bottom: 20px;
            }
            
            h1 {
                font-size: 2.5rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
                margin-bottom: 10px;
            }
            
            .status {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 10px 20px;
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 50px;
                font-weight: 600;
                margin-top: 20px;
            }
            
            .status-dot {
                width: 10px;
                height: 10px;
                background: #22c55e;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Dashboard Grid */
            .dashboard {
                display: grid;
                grid-template-columns: 250px 1fr;
                gap: 30px;
                min-height: 600px;
            }
            
            /* Sidebar */
            .sidebar {
                background: rgba(30, 41, 59, 0.8);
                border-radius: 15px;
                padding: 25px;
                border: 1px solid #334155;
            }
            
            .language-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .lang-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 15px;
                background: rgba(51, 65, 85, 0.5);
                border: none;
                border-radius: 10px;
                color: #e2e8f0;
                cursor: pointer;
                transition: all 0.3s;
                text-align: left;
            }
            
            .lang-btn:hover {
                background: rgba(51, 65, 85, 0.8);
                transform: translateX(5px);
            }
            
            .lang-btn.active {
                background: rgba(102, 126, 234, 0.2);
                border-left: 4px solid #667eea;
            }
            
            .lang-icon {
                font-size: 1.5rem;
                width: 30px;
            }
            
            /* Editor Section */
            .editor-section {
                background: rgba(30, 41, 59, 0.8);
                border-radius: 15px;
                padding: 25px;
                border: 1px solid #334155;
            }
            
            .code-editor {
                background: #0f172a;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                min-height: 300px;
                font-family: 'Fira Code', monospace;
                font-size: 14px;
                line-height: 1.5;
                white-space: pre-wrap;
                color: #e2e8f0;
                border: 1px solid #334155;
            }
            
            /* Buttons */
            .btn-group {
                display: flex;
                gap: 15px;
                margin-top: 20px;
            }
            
            .btn {
                padding: 12px 25px;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                transition: all 0.3s;
                font-size: 1rem;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
            
            .btn-secondary {
                background: rgba(51, 65, 85, 0.8);
                color: #e2e8f0;
                border: 1px solid #475569;
            }
            
            /* Console */
            .console {
                background: #0f172a;
                border-radius: 10px;
                padding: 20px;
                margin-top: 20px;
                border: 1px solid #334155;
            }
            
            .console-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #334155;
            }
            
            .output {
                font-family: 'Fira Code', monospace;
                font-size: 14px;
                line-height: 1.5;
                white-space: pre-wrap;
                min-height: 100px;
            }
            
            .output-line {
                margin-bottom: 8px;
            }
            
            .success { color: #10b981; }
            .error { color: #ef4444; }
            .info { color: #60a5fa; }
            
            /* Mobile */
            @media (max-width: 768px) {
                .dashboard { grid-template-columns: 1fr; }
                h1 { font-size: 2rem; }
                .btn-group { flex-direction: column; }
                .btn { justify-content: center; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <i class="fas fa-robot"></i>
                </div>
                <h1>SS Syntax Dashboard</h1>
                <p>Secure Code Execution Platform - Running on Render</p>
                <div class="status">
                    <div class="status-dot"></div>
                    <span>ONLINE</span>
                    <i class="fas fa-bolt"></i>
                    <span>Render.com</span>
                </div>
            </div>
            
            <div class="dashboard">
                <div class="sidebar">
                    <h3><i class="fas fa-code"></i> Languages</h3>
                    <div class="language-list" id="languageList">
                        <!-- Languages load here -->
                    </div>
                </div>
                
                <div class="editor-section">
                    <div class="editor-header">
                        <div id="editorTitle">
                            <i class="fab fa-js-square"></i>
                            <span>JavaScript Editor</span>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="runCode()" id="runBtn">
                                <i class="fas fa-play"></i> Run Code
                            </button>
                            <button class="btn btn-secondary" onclick="resetCode()">
                                <i class="fas fa-redo"></i> Reset
                            </button>
                        </div>
                    </div>
                    
                    <div class="code-editor" id="codeEditor" contenteditable="true">
// Select a language from the sidebar
// Then click "Run Code" to execute
                    </div>
                    
                    <div class="console">
                        <div class="console-header">
                            <div>
                                <i class="fas fa-terminal"></i>
                                <span>Console Output</span>
                            </div>
                            <button class="btn btn-secondary" onclick="clearConsole()" style="padding: 8px 15px;">
                                <i class="fas fa-broom"></i> Clear
                            </button>
                        </div>
                        <div class="output" id="consoleOutput">
Welcome to SS Syntax Dashboard!
Select a language and click "Run Code".
                        </div>
                    </div>
                </div>
            </div>
            
            <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #94a3b8;">
                <p>
                    <i class="fas fa-bolt"></i> Powered by Render.com | 
                    <i class="fas fa-robot"></i> Discord Bot Ready |
                    <i class="fas fa-shield-alt"></i> Secure Execution
                </p>
            </footer>
        </div>
        
        <script>
            let currentLanguage = 'javascript';
            let languages = {};
            
            // Load languages on startup
            async function loadLanguages() {
                try {
                    const response = await fetch('/api/languages');
                    const data = await response.json();
                    
                    if (data.success) {
                        languages = {};
                        data.languages.forEach(lang => {
                            languages[lang.id] = lang;
                        });
                        updateLanguageList();
                        loadLanguageCode('javascript');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    // Fallback
                    languages = ${JSON.stringify(languages)};
                    updateLanguageList();
                    loadLanguageCode('javascript');
                }
            }
            
            function updateLanguageList() {
                const container = document.getElementById('languageList');
                container.innerHTML = '';
                
                ['javascript', 'python', 'golang', 'html'].forEach(langId => {
                    const lang = languages[langId];
                    if (!lang) return;
                    
                    const btn = document.createElement('button');
                    btn.className = 'lang-btn';
                    if (currentLanguage === langId) btn.classList.add('active');
                    btn.onclick = () => switchLanguage(langId);
                    
                    btn.innerHTML = \`
                        <div class="lang-icon">
                            <i class="\${lang.icon}" style="color: \${lang.color}"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600;">\${lang.name}</div>
                            <div style="font-size: 0.8rem; color: #94a3b8;">\${lang.description}</div>
                        </div>
                    \`;
                    
                    container.appendChild(btn);
                });
            }
            
            function switchLanguage(langId) {
                currentLanguage = langId;
                updateLanguageList();
                loadLanguageCode(langId);
            }
            
            function loadLanguageCode(langId) {
                const lang = languages[langId];
                if (!lang) return;
                
                document.getElementById('codeEditor').textContent = lang.code || '';
                document.getElementById('editorTitle').innerHTML = \`
                    <i class="\${lang.icon}" style="color: \${lang.color}"></i>
                    <span>\${lang.name} Editor</span>
                \`;
            }
            
            async function runCode() {
                const code = document.getElementById('codeEditor').textContent;
                const runBtn = document.getElementById('runBtn');
                
                if (!code.trim()) {
                    addConsoleOutput('Please enter some code.', 'error');
                    return;
                }
                
                // Show loading
                runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
                runBtn.disabled = true;
                
                clearConsole();
                addConsoleOutput(\`Executing \${languages[currentLanguage].name} code...\\n\`, 'info');
                
                try {
                    const response = await fetch('/api/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ language: currentLanguage, code })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        addConsoleOutput(result.output, 'success');
                        if (result.error) {
                            addConsoleOutput(\`Error: \${result.error}\`, 'error');
                        }
                    } else {
                        addConsoleOutput(\`Error: \${result.error}\`, 'error');
                    }
                } catch (error) {
                    addConsoleOutput(\`Network error: \${error.message}\`, 'error');
                } finally {
                    runBtn.innerHTML = '<i class="fas fa-play"></i> Run Code';
                    runBtn.disabled = false;
                }
            }
            
            function resetCode() {
                if (confirm('Reset to default code?')) {
                    loadLanguageCode(currentLanguage);
                    addConsoleOutput('Code reset.', 'info');
                }
            }
            
            function addConsoleOutput(text, type) {
                const output = document.getElementById('consoleOutput');
                const line = document.createElement('div');
                line.className = \`output-line \${type}\`;
                line.textContent = text;
                output.appendChild(line);
                output.scrollTop = output.scrollHeight;
            }
            
            function clearConsole() {
                document.getElementById('consoleOutput').innerHTML = 
                    'Welcome to SS Syntax Dashboard!\\nSelect a language and click "Run Code".';
            }
            
            // Initialize
            loadLanguages();
        </script>
    </body>
    </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ SS Syntax Dashboard running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api/languages`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
});
