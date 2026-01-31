const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const Redis = require('ioredis');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path'); // Required to fix the "Cannot GET" error
const axios = require('axios');
const config = require('./config');

// --- INITIALIZE DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const app = express();

// --- INITIALIZE REDIS ---
// Railway provides REDIS_URL automatically. If it's missing, it defaults to local.
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); 

app.use(bodyParser.json());

// --- SERVING THE DASHBOARD ---
// This tells Express to look into the "dashboard" folder for your HTML/CSS
app.use(express.static(path.join(__dirname, 'dashboard')));

// This fixes the "Cannot GET /" error by explicitly sending index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// This ensures the callback page also loads correctly if accessed directly
app.get('/callback.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'callback.html'));
});

// --- OAUTH2 AUTHENTICATION ---
app.post('/api/auth/exchange', async (req, res) => {
    const { code } = req.body;
    try {
        const params = new URLSearchParams();
        params.append('client_id', config.CLIENT_ID);
        params.append('client_secret', config.CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', config.REDIRECT_URI);

        const response = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        res.json({ access_token: response.data.access_token });
    } catch (error) {
        console.error("Auth Error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Authentication handshake failed' });
    }
});

// --- SAVE COMMAND TO REDIS ---
app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    if (!guildId || !command) return res.status(400).send("Missing Guild ID or Command Data");
    
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

// --- CODE EXECUTION ENGINE ---
async function executeCode(lang, code, context) {
    const timeout = 3000;
    const ctxString = JSON.stringify(context).replace(/'/g, "\\'");

    if (lang === 'js') {
        const vm = new VM({ timeout, sandbox: context });
        try { return await vm.run(`(async () => { ${code} })()`); } 
        catch (e) { return `JS Error: ${e.message}`; }
    }

    if (lang === 'py') {
        return new Promise(resolve => {
            const pyScript = `import json\ntry:\n    context = json.loads('${ctxString}')\n    ${code.replace(/\n/g, '\n    ')}\nexcept Exception as e:\n    print(e)`;
            fs.writeFileSync('temp.py', pyScript);
            exec('python3 temp.py', { timeout }, (err, stdout, stderr) => {
                resolve(stdout || stderr || "Execution finished (No output).");
            });
        });
    }

    if (lang === 'go') {
        return new Promise(resolve => {
            const goScript = `package main\nimport "fmt"\nfunc main() {\n ${code} \n}`;
            fs.writeFileSync('temp.go', goScript);
            exec('go run temp.go', { timeout }, (err, stdout, stderr) => {
                resolve(stdout || stderr || "Go process finished.");
            });
        });
    }
}

// --- DISCORD MESSAGE HANDLER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Get all custom commands for the specific server
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        let triggered = false;

        if (cmd.type === 'prefix' && message.content.startsWith((cmd.trigger || '!') + cmd.name)) triggered = true;
        if (cmd.type === 'message' && message.content.includes(cmd.trigger)) triggered = true;

        if (triggered) {
            const output = await executeCode(cmd.language, cmd.code, {
                user: message.author.username,
                content: message.content,
                guildName: message.guild.name
            });
            message.reply(`\`\`\`\n${output}\n\`\`\``);
        }
    }
});

// --- START UP ---
client.login(config.TOKEN);

const PORT = process.env.PORT || 80;
// We use 0.0.0.0 so Railway's external network can reach the container
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 S.S. Syntax Backend Live
    📡 Port: ${PORT}
    🏠 URL: ${config.REDIRECT_URI.replace('/callback.html', '')}
    `);
});
                        
