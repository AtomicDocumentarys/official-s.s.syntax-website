const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const { exec } = require('child_process');
const Redis = require('ioredis');
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
const redis = new Redis(process.env.REDIS_URL);
app.use(bodyParser.json());
app.use(express.static('.'));

// --- PERMANENT SERVER SYNC FIX ---
app.get('/api/mutual-servers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).send("Unauthorized");

        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: authHeader }
        });

        // Ensure bot cache is ready
        if (client.guilds.cache.size === 0) {
            await client.guilds.fetch();
        }

        const mutual = response.data.filter(g => {
            const isManager = (BigInt(g.permissions) & 0x8n) || (BigInt(g.permissions) & 0x20n);
            return isManager && client.guilds.cache.has(g.id);
        });

        res.json(mutual);
    } catch (e) {
        console.error("Sync Error:", e.message);
        res.status(500).json([]);
    }
});

app.get('/api/commands/:guildId', async (req, res) => {
    const data = await redis.hgetall(`commands:${req.params.guildId}`);
    res.json(Object.values(data).map(v => JSON.parse(v)));
});

app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    const count = await redis.hlen(`commands:${guildId}`);
    if (!command.isEdit && count >= 100) return res.status(403).send("Limit reached");
    
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

app.delete('/api/command/:guildId/:cmdId', async (req, res) => {
    await redis.hdel(`commands:${req.params.guildId}`, req.params.cmdId);
    res.sendStatus(200);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        const trigger = cmd.trigger.toLowerCase();
        const content = message.content.toLowerCase();
        let match = false;

        if (cmd.type === "Command (prefix)" && content.startsWith((cmd.prefix || "!") + trigger)) match = true;
        if (cmd.type === "Exact Match" && content === trigger) match = true;
        if (cmd.type === "Starts with" && content.startsWith(trigger)) match = true;

        if (match) {
            try {
                if (cmd.lang === "JavaScript") {
                    const vm = new VM({ timeout: 1000, sandbox: { message, reply: (t) => message.reply(t) } });
                    vm.run(cmd.code);
                } else if (cmd.lang === "Python") {
                    exec(`python3 -c "${cmd.code.replace(/"/g, '\\"')}"`, (err, stdout) => {
                        if (stdout) message.reply(stdout);
                    });
                }
            } catch (e) { console.error("Runtime Error", e); }
        }
    }
});

client.login(process.env.TOKEN || config.TOKEN);
app.listen(process.env.PORT || 80);
