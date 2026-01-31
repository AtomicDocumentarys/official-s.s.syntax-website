const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const { exec } = require('child_process');
const fs = require('fs');
const Redis = require('ioredis');
const axios = require('axios');
const cors = require('cors');  // Added for potential CORS if needed

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const app = express();
const redis = new Redis(process.env.REDIS_URL);
app.use(bodyParser.json());
app.use(cors());  // Enable CORS for frontend requests
app.use(express.static('.'));

// --- API ROUTES ---

// Fetch User Profile
app.get('/api/user-me', async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: req.headers.authorization }
        });
        res.json(response.data);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

// Fetch Mutual Servers
app.get('/api/mutual-servers', async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: req.headers.authorization }
        });
        const mutual = response.data.filter(g => (BigInt(g.permissions) & 0x20n) && client.guilds.cache.has(g.id));
        res.json(mutual);
    } catch (e) { res.status(500).json([]); }
});

// Fetch Guild Meta (Roles/Channels)
app.get('/api/guild-meta/:guildId', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ roles: [], channels: [] });
    res.json({
        roles: guild.roles.cache.map(r => ({ id: r.id, name: r.name })),
        channels: guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }))
    });
});

// Fetch Commands for Guild
app.get('/api/commands/:guildId', async (req, res) => {
    const commands = await redis.hgetall(`commands:${req.params.guildId}`);
    const cmdList = Object.values(commands).map(c => JSON.parse(c));
    res.json(cmdList);
});

// Save Command
app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    const count = await redis.hlen(`commands:${guildId}`);
    if (!command.isEdit && count >= 100) return res.status(403).send("Limit reached");
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

// Delete Command
app.delete('/api/command/:guildId/:cmdId', async (req, res) => {
    await redis.hdel(`commands:${req.params.guildId}`, req.params.cmdId);
    res.sendStatus(200);
});

// Settings (Prefix)
app.post('/api/settings/:guildId', async (req, res) => {
    await redis.set(`prefix:${req.params.guildId}`, req.body.prefix);
    res.sendStatus(200);
});

app.get('/api/settings/:guildId', async (req, res) => {
    const p = await redis.get(`prefix:${req.params.guildId}`) || "!";
    res.json({ prefix: p });
});

// OAuth Callback (Secure server-side handling)
app.get('/callback', (req, res) => {
    const code = req.query.code;
    if (!code) {
        // Redirect to Discord OAuth
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
        res.redirect(oauthUrl);
    } else {
        // Exchange code for token
        axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        .then(response => {
            const token = response.data.access_token;
            // Redirect back to frontend with token (replace with your GitHub Pages URL)
            res.redirect(`https://yourusername.github.io/sssyntax-dashboard/?token=${token}`);
        })
        .catch(err => res.status(500).send('OAuth failed'));
    }
});

// --- DISCORD HANDLER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    const globalPrefix = await redis.get(`prefix:${message.guild.id}`) || "!";

    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        const trigger = cmd.trigger.toLowerCase();
        const content = message.content.toLowerCase();
        let match = false;

        if (cmd.type === "Command (prefix)" && content.startsWith(globalPrefix + trigger)) match = true;
        else if (cmd.type === "Exact Match" && content === trigger) match = true;
        else if (cmd.type === "Starts with" && content.startsWith(trigger)) match = true;

        if (match) {
            if (cmd.roles?.length && !message.member.roles.cache.some(r => cmd.roles.includes(r.id))) continue;
            if (cmd.channels?.length && !cmd.channels.includes(message.channel.id)) continue;

            try {
                let output = '';
                if (cmd.lang === "JavaScript") {
                    const vm = new VM({ timeout: 1000, sandbox: { message, reply: (t) => { output += t + '\n'; message.reply(t); } } });
                    vm.run(cmd.code);
                } else if (cmd.lang === "Python") {
                    exec(`python3 -c "${cmd.code.replace(/"/g, '\\"')}"`, (e, out, err) => { 
                        output += out || err; 
                        if (out) message.reply(out); 
                    });
                }
                console.log(`Command executed: ${cmd.trigger}, Output: ${output}`);
            } catch (e) { console.error(e); }
        }
    }
});

client.login(process.env.TOKEN);
app.listen(process.env.PORT || 80);
