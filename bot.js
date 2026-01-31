const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
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
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
let liveLogs = [];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

function addLog(guildId, message) {
    liveLogs.push({ guildId, timestamp: new Date().toLocaleTimeString(), message });
    if (liveLogs.length > 50) liveLogs.shift();
}

// FIX: Filter only servers where user is Admin AND Bot is present
app.get('/api/mutual-servers', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send("Unauthorized");
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: authHeader }
        });
        const mutual = response.data.filter(g => 
            (BigInt(g.permissions) & 0x8n) && client.guilds.cache.has(g.id)
        );
        res.json(mutual);
    } catch (e) { res.status(500).send("Sync Error"); }
});

// Database API for the Dashboard Tab
app.get('/api/db-all/:guildId', async (req, res) => {
    const data = await redis.hgetall(`userdata:${req.params.guildId}`);
    res.json(data);
});

app.post('/api/db-delete', async (req, res) => {
    await redis.hdel(`userdata:${req.body.guildId}`, req.body.key);
    res.sendStatus(200);
});

// --- COMMAND EXECUTION ENGINE ---
async function runCommand(cmd, message) {
    const guildId = message.guild.id;
    
    // Automated DB Functions injected into the sandbox
    const db = {
        set: async (key, val) => await redis.hset(`userdata:${guildId}`, key, JSON.stringify(val)),
        get: async (key) => {
            const data = await redis.hget(`userdata:${guildId}`, key);
            return data ? JSON.parse(data) : null;
        },
        del: async (key) => await redis.hdel(`userdata:${guildId}`, key),
        all: async () => await redis.hgetall(`userdata:${guildId}`)
    };

    const context = {
        db,
        message,
        user: message.author,
        reply: (text) => message.reply(text),
        sendLog: (msg) => addLog(guildId, msg)
    };

    const vm = new VM({ timeout: 3000, sandbox: context });
    try {
        addLog(guildId, `Executing !${cmd.trigger}`);
        await vm.run(`(async () => { ${cmd.code} })()`);
    } catch (e) {
        addLog(guildId, `Error: ${e.message}`);
        message.reply(`⚠️ Command Error: ${e.message}`);
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        if (message.content.startsWith('!' + cmd.trigger)) {
            await runCommand(cmd, message);
        }
    }
});

client.login(config.TOKEN);
app.listen(process.env.PORT || 80, '0.0.0.0');
    
