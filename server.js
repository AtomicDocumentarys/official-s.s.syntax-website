const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com/ajax/libs/"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com/ajax/libs/"]
        }
    }
}));

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Secure code execution module
const { executeCode } = require('./sandbox');

// In-memory storage for languages
let languages = {};

// Load initial data
async function loadLanguages() {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        languages = JSON.parse(data);
        console.log('✅ Loaded languages:', Object.keys(languages).length);
    } catch (error) {
        console.log('📝 Starting with default languages');
        languages = {
            'javascript': {
                id: 'javascript',
                name: 'JavaScript',
                code: `console.log("Hello, World!");\n\nfunction sayHello(name) {\n    return "Hello, " + name + "!";\n}\n\nconsole.log(sayHello("SS Syntax"));`,
                description: 'Client-side scripting language',
                icon: 'fab fa-js-square',
                color: '#f7df1e'
            },
            'python': {
                id: 'python',
                name: 'Python',
                code: `print("Hello, World!")\n\ndef say_hello(name):\n    return f"Hello, {name}!"\n\nprint(say_hello("SS Syntax"))`,
                description: 'High-level programming language',
                icon: 'fab fa-python',
                color: '#3776ab'
            },
            'golang': {
                id: 'golang',
                name: 'Golang',
                code: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n    \n    result := sayHello("SS Syntax")\n    fmt.Println(result)\n}\n\nfunc sayHello(name string) string {\n    return "Hello, " + name + "!"\n}`,
                description: 'Go programming language',
                icon: 'fab fa-golang',
                color: '#00add8'
            },
            'html': {
                id: 'html',
                name: 'HTML',
                code: `<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n    <style>\n        body {\n            font-family: Arial;\n            padding: 20px;\n        }\n        .hello {\n            color: #667eea;\n            font-size: 24px;\n        }\n    </style>\n</head>\n<body>\n    <div class="hello">Hello, SS Syntax!</div>\n</body>\n</html>`,
                description: 'HyperText Markup Language',
                icon: 'fab fa-html5',
                color: '#e34c26'
            }
        };
        await saveLanguages();
    }
}

// Save languages to file
async function saveLanguages() {
    try {
        await fs.writeFile('data.json', JSON.stringify(languages, null, 2));
    } catch (error) {
        console.error('Error saving languages:', error);
    }
}

// API Routes

// Get all languages
app.get('/api/languages', (req, res) => {
    res.json({
        success: true,
        languages: Object.values(languages)
    });
});

// Get specific language
app.get('/api/languages/:id', (req, res) => {
    const language = languages[req.params.id];
    if (language) {
        res.json({ success: true, language });
    } else {
        res.status(404).json({ success: false, error: 'Language not found' });
    }
});

// Execute code (SECURE)
app.post('/api/execute', async (req, res) => {
    try {
        const { language, code } = req.body;
        
        if (!language || !code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Language and code are required' 
            });
        }
        
        // Validate language
        if (!languages[language]) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid language' 
            });
        }
        
        // Secure code execution
        const result = await executeCode(language, code);
        
        res.json({
            success: true,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Execution error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Execution failed' 
        });
    }
});

// Discord webhook (for bot integration)
app.post('/api/discord/execute', async (req, res) => {
    try {
        const { language, code, userId } = req.body;
        const secret = req.headers['x-discord-secret'];
        
        // Simple authentication (you can change this)
        if (secret !== process.env.DISCORD_SECRET) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        if (!languages[language]) {
            return res.status(400).json({ success: false, error: 'Invalid language' });
        }
        
        const result = await executeCode(language, code);
        
        res.json({
            success: true,
            output: result.output,
            error: result.error,
            userId: userId
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        languages: Object.keys(languages).length 
    });
});

// Serve dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function start() {
    await loadLanguages();
    
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🌐 Dashboard: http://localhost:${PORT}`);
        console.log(`🔧 API ready at: http://localhost:${PORT}/api/languages`);
        console.log(`⚡ Secure execution enabled`);
    });
}

start().catch(console.error);
