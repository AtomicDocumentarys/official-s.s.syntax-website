const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { VM } = require('vm2');
const { exec } = require('child_process'); // For Python and Go
const fs = require('fs');
const Redis = require('ioredis');
const axios = require('axios');
const config = require('./config');

// 1. Initialize Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// 2. Initialize Web Server & Redis
const app = express();
const redis = new Redis(process.env.REDIS_URL);
let liveLogs = [];

app.use(bodyParser.json());
app.use(express.static('.'));

// --- UTILITY: LOGGING ---
function addLog(guildId, message) {
    liveLogs.push({ guildId, timestamp: new Date().toLocaleTimeString(), message });
    if (liveLogs.length > 50) liveLogs.shift();
}

// --- EXECUTION ENGINES ---
async function runPython(code) {
    return new Promise((resolve, reject) => {
        // Escaping double quotes for the command line
        const escapedCode = code.replace(/"/g, '\\"');
        exec(`python3 -c "${escapedCode}"`, (error, stdout, stderr) => {
            if (error) reject(stderr || error.message);
            resolve(stdout);
        });
    });
}

async function runGo(code) {
    return new Promise((resolve, reject) => {
        const filename = `temp_${Date.now()}.go`;
        fs.writeFileSync(filename, code);
        exec(`go run ${filename}`, (error, stdout, stderr) => {
            fs.unlinkSync(filename); // Clean up file after running
            if (error) reject(stderr || error.message);
            resolve(stdout);
        });
    });
}

// --- API ROUTES ---

// Sync mutual servers
app.get('/api/mutual-servers', async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: req.headers.authorization }
        });
        const mutual = response.data.filter(g => (BigInt(g.permissions) & 0x8n) && client.guilds.cache.has(g.id));
        res.json(mutual);
    } catch (e) { res.status(500).send("Sync Error"); }
});

// Fetch roles and channels for the UI selectors
app.get('/api/guild-meta/:guildId', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).send("Guild not found");
    res.json({
        channels: guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
        roles: guild.roles.cache.map(r => ({ id: r.id, name: r.name }))
    });
});

app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

// --- DISCORD MESSAGE HANDLER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const commands = await redis.hgetall(`commands:${message.guild.id}`);
    for (const id in commands) {
        const cmd = JSON.parse(commands[id]);
        let triggered = false;
        const content = message.content;

        // Trigger logic
        if (cmd.type === "Command (prefix)") {
            if (content.startsWith((cmd.prefix || "!") + cmd.trigger)) triggered = true;
        } else if (cmd.type === "Starts with") {
            if (content.toLowerCase().startsWith(cmd.trigger.toLowerCase())) triggered = true;
        } else if (cmd.type === "Contains") {
            if (content.toLowerCase().includes(cmd.trigger.toLowerCase())) triggered = true;
        }

        if (triggered) {
            // Check Restrictions
            if (cmd.roles?.length > 0 && !message.member.roles.cache.some(r => cmd.roles.includes(r.id))) continue;
            if (cmd.channels?.length > 0 && !cmd.channels.includes(message.channel.id)) continue;

            addLog(message.guild.id, `Running ${cmd.lang} command: ${cmd.trigger}`);

            try {
                let output = "";
                if (cmd.lang === "JavaScript") {
                    const vm = new VM({ timeout: 2000, sandbox: { message, reply: (t) => message.reply(t) } });
                    output = await vm.run(cmd.code);
                } else if (cmd.lang === "Python") {
                    output = await runPython(cmd.code);
                    if (output) message.reply(output);
                } else if (cmd.lang === "Golang") {
                    output = await runGo(cmd.code);
                    if (output) message.reply(output);
                }
            } catch (err) {
                addLog(message.guild.id, `Execution Error: ${err}`);
                message.reply(`❌ Runtime Error:\n\`\`\`${err}\`\`\``);
            }
        }
    }
});

// --- STARTUP ---
client.on('ready', () => console.log(`Bot active: ${client.user.tag}`));
client.login(config.TOKEN);

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`Dashboard online on port ${PORT}`));
        
