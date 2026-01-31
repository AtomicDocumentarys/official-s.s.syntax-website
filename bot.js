const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const Redis = require('ioredis');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Redis connection with error handling to prevent crashes
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redis.on('error', (err) => console.log('Redis Connection Error:', err));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// --- HELPERS ---
function sendLog(guildId, message) {
    io.to(guildId).emit('log', { timestamp: new Date().toLocaleTimeString(), message });
}

io.on('connection', (socket) => {
    socket.on('join-server', (guildId) => {
        if (guildId) socket.join(guildId);
    });
});

// --- API ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/callback.html', (req, res) => res.sendFile(path.join(__dirname, 'callback.html')));

app.get('/api/commands/:guildId', async (req, res) => {
    try {
        const commands = await redis.hgetall(`commands:${req.params.guildId}`);
        res.json(Object.values(commands).map(c => JSON.parse(c)));
    } catch (e) { res.json([]); }
});

app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

app.post('/api/auth/exchange', async (req, res) => {
    const { code } = req.body;
    try {
        const params = new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: config.REDIRECT_URI
        });
        const response = await axios.post('https://discord.com/api/oauth2/token', params);
        res.json({ access_token: response.data.access_token });
    } catch (e) { res.status(500).send("Auth Fail"); }
});

// --- EXECUTION ---
async function executeCode(code, context) {
    const vm = new VM({ timeout: 3000, sandbox: context });
    try { 
        return await vm.run(`(async () => { ${code} })()`); 
    } catch (e) { 
        return `Error: ${e.message}`; 
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
        const commands = await redis.hgetall(`commands:${message.guild.id}`);
        for (const id in commands) {
            const cmd = JSON.parse(commands[id]);
            if (message.content.startsWith('!' + cmd.name)) {
                sendLog(message.guild.id, `Triggered !${cmd.name}`);
                const out = await executeCode(cmd.code, { user: message.author.username });
                message.reply(`\`\`\`\n${out}\n\`\`\``);
                sendLog(message.guild.id, `Result: ${out}`);
            }
        }
    } catch (e) { console.error(e); }
});

client.login(config.TOKEN);
server.listen(process.env.PORT || 80, '0.0.0.0');
                           
