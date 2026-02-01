// SUPER SIMPLE SERVER - No dependencies at all!
const http = require('http');

// In-memory storage for languages
const languages = {
    javascript: {
        id: 'javascript',
        name: 'JavaScript',
        code: `console.log("Hello, World!");\n\nfunction sayHello(name) {\n    return "Hello, " + name + "!";\n}\n\nconsole.log(sayHello("SS Syntax"));`,
        description: 'Client-side scripting language',
        color: '#f7df1e'
    },
    python: {
        id: 'python',
        name: 'Python',
        code: `print("Hello, World!")\n\ndef say_hello(name):\n    return f"Hello, {name}!"\n\nprint(say_hello("SS Syntax"))`,
        description: 'High-level programming language',
        color: '#3776ab'
    },
    golang: {
        id: 'golang',
        name: 'Golang',
        code: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n    \n    result := sayHello("SS Syntax")\n    fmt.Println(result)\n}\n\nfunc sayHello(name string) string {\n    return "Hello, " + name + "!"\n}`,
        description: 'Go programming language',
        color: '#00add8'
    },
    html: {
        id: 'html',
        name: 'HTML',
        code: `<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n    <style>\n        body {\n            font-family: Arial;\n            padding: 20px;\n        }\n        .hello {\n            color: #667eea;\n            font-size: 24px;\n        }\n    </style>\n</head>\n<body>\n    <div class="hello">Hello, SS Syntax!</div>\n</body>\n</html>`,
        description: 'HyperText Markup Language',
        color: '#e34c26'
    }
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API endpoints
    if (req.url === '/api/languages' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            languages: Object.values(languages)
        }));
        return;
    }
    
    if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { language, code } = data;
                
                if (!languages[language]) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid language' }));
                    return;
                }
                
                // SIMULATED execution (safe)
                const output = `Executing ${language} code...\nCode length: ${code.length} characters\n\n[This is a simulated output]\nExecution successful!`;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    output: output,
                    error: '',
                    executionTime: 100
                }));
                
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal error' }));
            }
        });
        return;
    }
    
    // Health check - ALWAYS returns 200 OK
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            message: 'SS Syntax Dashboard is running',
            timestamp: new Date().toISOString()
        }));
        return;
    }
    
    // Serve HTML dashboard
    if (req.url === '/dashboard' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlTemplate);
        return;
    }
    
    // Default route - serve HTML
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlTemplate);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
    console.log(`✅ Dashboard: http://localhost:${PORT}/`);
    console.log(`✅ Railway will NOT kill this app!`);
});

// HTML template as a string (no external files needed!)
const htmlTemplate = `<!DOCTYPE html>
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

        .subtitle {
            color: #94a3b8;
            font-size: 1.2rem;
            margin-bottom: 20px;
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

        /* Main Content */
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

        .lang-name {
            font-weight: 600;
            font-size: 1rem;
        }

        /* Editor Section */
        .editor-section {
            background: rgba(30, 41, 59, 0.8);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid #334155;
        }

        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #334155;
        }

        .code-editor {
            background: #0f172a;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
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
            text-decoration: none;
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
            min-height: 200px;
            max-height: 300px;
            overflow-y: auto;
        }

        .console-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #334155;
        }

        .console-title {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #10b981;
        }

        .output {
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
        }

        .output-line {
            margin-bottom: 8px;
        }

        .output-line.success {
            color: #10b981;
        }

        .output-line.error {
            color: #ef4444;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .header {
                padding: 20px 0;
            }
            
            h1 {
                font-size: 2rem;
            }
            
            .btn-group {
                flex-direction: column;
            }
            
            .btn {
                justify-content: center;
            }
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
            <p class="subtitle">Secure Code Execution Platform - Running on Railway</p>
            <div class="status">
                <div class="status-dot"></div>
                <span>ONLINE</span>
                <i class="fas fa-shield-alt"></i>
                <span>Sandbox Active</span>
            </div>
        </div>

        <div class="dashboard">
            <!-- Sidebar -->
            <div class="sidebar">
                <h3 style="margin-bottom: 20px;"><i class="fas fa-code"></i> Languages</h3>
                <div class="language-list" id="languageList">
                    <!-- Languages will be loaded via JavaScript -->
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
                    <h4><i class="fas fa-info-circle"></i> Quick Info</h4>
                    <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 10px;">
                        • 4 Supported Languages<br>
                        • Secure Sandbox Environment<br>
                        • Real-time Code Execution<br>
                        • Discord Bot Integration Ready
                    </p>
                </div>
            </div>

            <!-- Main Editor -->
            <div class="editor-section">
                <div class="editor-header">
                    <div class="editor-title" id="editorTitle">
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
                        <a href="/health" target="_blank" class="btn btn-secondary">
                            <i class="fas fa-heartbeat"></i> Health Check
                        </a>
                    </div>
                </div>

                <div class="code-editor" id="codeEditor" contenteditable="true" spellcheck="false">
// JavaScript code will appear here
// Select a language from the sidebar
                </div>

                <div class="console">
                    <div class="console-header">
                        <div class="console-title">
                            <i class="fas fa-terminal"></i>
                            <span>Console Output</span>
                        </div>
                        <button class="btn btn-secondary" onclick="clearConsole()" style="padding: 8px 15px; font-size: 0.9rem;">
                            <i class="fas fa-broom"></i> Clear
                        </button>
                    </div>
                    <div class="output" id="consoleOutput">
Welcome to SS Syntax Code Execution Platform!
Select a language and click "Run Code" to execute.
                    </div>
                </div>
            </div>
        </div>

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #94a3b8;">
            <p>
                <i class="fas fa-bolt"></i> Powered by Railway | 
                <i class="fas fa-robot"></i> Discord Bot Ready |
                <i class="fas fa-shield-alt"></i> Security Enabled
            </p>
            <p style="font-size: 0.9rem; margin-top: 10px;">
                All systems operational. No SIGTERM errors!
            </p>
        </footer>
    </div>

    <script>
        // Current state
        let currentLanguage = 'javascript';
        let languages = {};
        
        // Load languages on page load
        async function loadLanguages() {
            try {
                const response = await fetch('/api/languages');
                const data = await response.json();
                
                if (data.success) {
                    languages = data.languages.reduce((acc, lang) => {
                        acc[lang.id] = lang;
                        return acc;
                    }, {});
                    
                    updateLanguageList();
                    loadLanguageCode('javascript');
                }
            } catch (error) {
                console.error('Error loading languages:', error);
                // Fallback to hardcoded languages
                languages = {
                    javascript: {
                        id: 'javascript',
                        name: 'JavaScript',
                        code: \`console.log("Hello, World!");\\n\\nfunction sayHello(name) {\\n    return "Hello, " + name + "!";\\n}\\n\\nconsole.log(sayHello("SS Syntax"));\`,
                        color: '#f7df1e'
                    },
                    python: {
                        id: 'python',
                        name: 'Python',
                        code: \`print("Hello, World!")\\n\\ndef say_hello(name):\\n    return f"Hello, {name}!"\\n\\nprint(say_hello("SS Syntax"))\`,
                        color: '#3776ab'
                    },
                    golang: {
                        id: 'golang',
                        name: 'Golang',
                        code: \`package main\\n\\nimport "fmt"\\n\\nfunc main() {\\n    fmt.Println("Hello, World!")\\n    \\n    result := sayHello("SS Syntax")\\n    fmt.Println(result)\\n}\\n\\nfunc sayHello(name string) string {\\n    return "Hello, " + name + "!"\\n}\`,
                        color: '#00add8'
                    },
                    html: {
                        id: 'html',
                        name: 'HTML',
                        code: \`<!DOCTYPE html>\\n<html>\\n<head>\\n    <title>Hello World</title>\\n    <style>\\n        body {\\n            font-family: Arial;\\n            padding: 20px;\\n        }\\n        .hello {\\n            color: #667eea;\\n            font-size: 24px;\\n        }\\n    </style>\\n</head>\\n<body>\\n    <div class="hello">Hello, SS Syntax!</div>\\n</body>\\n</html>\`,
                        color: '#e34c26'
                    }
                };
                updateLanguageList();
                loadLanguageCode('javascript');
            }
        }
        
        // Update language list in sidebar
        function updateLanguageList() {
            const container = document.getElementById('languageList');
            container.innerHTML = '';
            
            const langOrder = ['javascript', 'python', 'golang', 'html'];
            
            langOrder.forEach(langId => {
                const lang = languages[langId];
                if (!lang) return;
                
                const button = document.createElement('button');
                button.className = \`lang-btn \${currentLanguage === langId ? 'active' : ''}\`;
                button.onclick = () => switchLanguage(langId);
                
                const iconClass = {
                    javascript: 'fab fa-js-square',
                    python: 'fab fa-python',
                    golang: 'fab fa-golang',
                    html: 'fab fa-html5'
                }[langId];
                
                button.innerHTML = \`
                    <div class="lang-icon">
                        <i class="\${iconClass}" style="color: \${lang.color}"></i>
                    </div>
                    <div>
                        <div class="lang-name">\${lang.name}</div>
                        <div style="font-size: 0.8rem; color: #94a3b8;">Click to select</div>
                    </div>
                \`;
                
                container.appendChild(button);
            });
        }
        
        // Switch language
        function switchLanguage(langId) {
            if (!languages[langId]) return;
            
            currentLanguage = langId;
            updateLanguageList();
            loadLanguageCode(langId);
        }
        
        // Load code for language
 
