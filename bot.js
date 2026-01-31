const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const Redis = require('ioredis');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const app = express();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); 

app.use(bodyParser.json());

// --- FIXING THE PATHS ---
// Since your files are in the main (root) folder, we serve from '.'
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/callback.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'callback.html'));
});

// --- OAUTH2 EXCHANGE ---
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
        res.status(500).json({ error: 'Auth failed' });
    }
});

// --- COMMAND SAVING ---
app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

// --- EXECUTION ENGINE ---
async function executeCode(lang, code, context) {
    const timeout = 3000;
    const ctxString = JSON.stringify(context).replace(/'/g, "\\'");
    if (lang === 'js') {
        const vm = new VM({ timeout, sandbox: context });
        try { return await vm.run(`(async () => { ${code} })()`); } 
        catch (e) { return e.message; }
    }
    // (Python and Go logic remain the same...)
}

// --- BOT LISTENER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        if (message.content.startsWith((cmd.trigger || '!') + cmd.name) || message.content.includes(cmd.trigger)) {
            const output = await executeCode(cmd.language, cmd.code, { user: message.author.username, content: message.content });
            message.reply(`\`\`\`\n${output}\n\`\`\``);
        }
    }
});

client.login(config.TOKEN);
const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 S.S. Syntax Online on Port ${PORT}`));

// ... (Keep existing imports from previous bot.js)

// --- NEW API: CHECK IF BOT IS IN SERVER ---
app.get('/api/check-bot/:guildId', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Bot is not in this server." });
    res.json({ success: true });
});

// --- NEW API: GET ALL COMMANDS FOR SERVER ---
app.get('/api/commands/:guildId', async (req, res) => {
    const commands = await redis.hgetall(`commands:${req.params.guildId}`);
    const commandList = Object.values(commands).map(c => JSON.parse(c));
    res.json(commandList);
});

// --- NEW API: DELETE COMMAND ---
app.post('/api/delete-command', async (req, res) => {
    const { guildId, commandId } = req.body;
    await redis.hdel(`commands:${guildId}`, commandId);
    res.sendStatus(200);
});

// --- NEW API: DIAGNOSTICS (TEST CODE) ---
app.post('/api/test-code', async (req, res) => {
    const { language, code } = req.body;
    try {
        // Simple dry-run with mock context
        await executeCode(language, code, { user: "Tester", content: "!test" });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ... (Rest of your bot.js logic remains)

