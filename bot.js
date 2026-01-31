const { Client, GatewayIntentBits } = require('discord.js');
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

// --- API ROUTES ---
app.get('/api/mutual-servers', async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: req.headers.authorization }
        });
        const mutual = response.data.filter(g => (BigInt(g.permissions) & 0x8n) && client.guilds.cache.has(g.id));
        res.json(mutual);
    } catch (e) { res.status(500).send("Sync Error"); }
});

app.get('/api/commands/:guildId', async (req, res) => {
    const data = await redis.hgetall(`commands:${req.params.guildId}`);
    const commands = Object.values(data).map(v => JSON.parse(v));
    res.json(commands);
});

app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    const existing = await redis.hlen(`commands:${guildId}`);
    if (existing >= 100 && !command.isEdit) return res.status(403).send("Limit reached (100)");
    
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

app.delete('/api/command/:guildId/:cmdId', async (req, res) => {
    await redis.hdel(`commands:${req.params.guildId}`, req.params.cmdId);
    res.sendStatus(200);
});

// --- MESSAGE HANDLER (The "Heart" of the Bot) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Fetch only this server's commands
    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        let triggered = false;
        const input = message.content;
        const trigger = cmd.trigger;

        if (cmd.type === "Command (prefix)") {
            if (input.startsWith((cmd.prefix || "!") + trigger)) triggered = true;
        } else if (cmd.type === "Starts with") {
            if (input.toLowerCase().startsWith(trigger.toLowerCase())) triggered = true;
        } else if (cmd.type === "Exact Match") {
            if (input.toLowerCase() === trigger.toLowerCase()) triggered = true;
        }

        if (triggered) {
            // Restriction Checks
            if (cmd.roles?.length && !message.member.roles.cache.some(r => cmd.roles.includes(r.id))) continue;
            if (cmd.channels?.length && !cmd.channels.includes(message.channel.id)) continue;

            try {
                if (cmd.lang === "JavaScript") {
                    const vm = new VM({ timeout: 2000, sandbox: { message, reply: (t) => message.reply(t) } });
                    await vm.run(cmd.code);
                } else if (cmd.lang === "Python") {
                    exec(`python3 -c "${cmd.code.replace(/"/g, '\\"')}"`, (err, stdout) => {
                        if (stdout) message.reply(stdout);
                    });
                }
            } catch (e) { console.error(e); }
        }
    }
});

client.login(process.env.TOKEN || config.TOKEN);
app.listen(process.env.PORT || 80);
    
