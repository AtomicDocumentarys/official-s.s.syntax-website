const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const { VM } = require('vm2');
const Redis = require('ioredis');
const path = require('path');
const config = require('./config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const app = express();
const redis = new Redis(); // Ensure Redis is running
app.use(express.json());
app.use(express.static('dashboard'));

// --- CODE EXECUTION ENGINE ---
const runSandbox = async (code, context) => {
    const vm = new VM({
        timeout: 2000,
        sandbox: { ...context, console: { log: (arg) => console.log(`[VM LOG]: ${arg}`) } }
    });
    try {
        return await vm.run(`(async () => { ${code} })()`);
    } catch (err) {
        return `⚠️ Error: ${err.message}`;
    }
};

// --- DISCORD EVENT LISTENER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Fetch commands for this specific guild from Redis
    const guildCommands = await redis.hgetall(`commands:${message.guild.id}`);
    
    for (const id in guildCommands) {
        const cmd = JSON.parse(guildCommands[id]);
        let triggered = false;

        // Trigger Logic (Similar to YAGPDB)
        if (cmd.type === 'prefix' && message.content.startsWith((cmd.prefix || '!') + cmd.name)) triggered = true;
        if (cmd.type === 'message' && message.content.toLowerCase().includes(cmd.trigger.toLowerCase())) triggered = true;

        if (triggered) {
            const context = {
                user: message.author,
                guild: message.guild,
                channel: message.channel,
                args: message.content.split(' ').slice(1)
            };
            const result = await runSandbox(cmd.code, context);
            if (result) message.reply(String(result));
        }
    }
});

// --- API ROUTES FOR DASHBOARD ---
app.get('/api/bot-guilds', (req, res) => {
    const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.icon }));
    res.json(guilds);
});

app.post('/api/save-command', async (req, res) => {
    const { guildId, command } = req.body;
    if (!guildId || !command) return res.status(400).send('Missing data');
    
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
    res.sendStatus(200);
});

client.login(config.TOKEN);
app.listen(80, () => console.log('Dashboard running on http://localhost'));
