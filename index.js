const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const { NodeVM } = require('vm2');
const { exec } = require('child_process');
const fs = require('fs');
const Redis = require('ioredis');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { body, validationResult } = require('express-validator');

// Configuration
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || (process.env.RAILWAY_STATIC_URL ? `${process.env.RAILWAY_STATIC_URL}/callback` : 'https://official-sssyntax-website-production.up.railway.app/callback');
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Check environment variables
if (!TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REDIS_URL) {
    console.error('Missing environment variables');
    process.exit(1);
}

console.log('🚀 Server starting...');
console.log(`📊 PORT: ${PORT}, HOST: ${HOST}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const app = express();
const redis = new Redis(REDIS_URL);

// Global state
const rateLimit = new Map();
const errorLog = [];

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// === SERVE YOUR HTML DASHBOARD ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === DISCORD OAUTH ENDPOINTS ===
app.get('/api/authorize', (req, res) => {
    const redirectUri = encodeURIComponent(REDIRECT_URI);
    const scopes = encodeURIComponent('identify guilds');
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.redirect('/?error=no_code');
        
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );
        
        const { access_token } = tokenResponse.data;
        res.redirect(`/?token=${access_token}`);
    } catch (error) {
        console.error('OAuth error:', error.message);
        res.redirect('/?error=auth_failed');
    }
});

// === AUTHENTICATION MIDDLEWARE ===
async function authenticateUser(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const response = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        req.user = response.data;
        req.token = token;
        next();
    } catch (e) {
        console.error('Auth error:', e.message);
        res.status(401).json({ error: 'Invalid token' });
    }
}

// === USER ENDPOINTS ===
app.get('/api/user/me', authenticateUser, (req, res) => {
    res.json(req.user);
});

// === GUILDS/SERVERS ENDPOINTS ===
app.get('/api/guilds', authenticateUser, async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${req.token}` }
        });
        
        // Filter guilds where user has admin permissions and bot is in the guild
        const guilds = response.data.filter(guild => {
            try {
                const permissions = BigInt(guild.permissions);
                const hasAdmin = (permissions & 0x20n) === 0x20n; // MANAGE_GUILD permission
                const botInGuild = client.guilds.cache.has(guild.id);
                return hasAdmin && botInGuild;
            } catch {
                return false;
            }
        });
        
        // Add bot-specific info to each guild
        const guildsWithBotInfo = guilds.map(guild => {
            const botGuild = client.guilds.cache.get(guild.id);
            return {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                owner: guild.owner,
                permissions: guild.permissions,
                botJoined: botGuild ? botGuild.joinedAt : null,
                memberCount: botGuild ? botGuild.memberCount : 0
            };
        });
        
        res.json(guildsWithBotInfo);
    } catch (e) {
        console.error('Guilds error:', e.message);
        res.status(500).json({ error: 'Failed to fetch guilds' });
    }
});

// === COMMANDS ENDPOINTS ===
app.get('/api/commands/:guildId', authenticateUser, async (req, res) => {
    try {
        const commands = await redis.hgetall(`commands:${req.params.guildId}`);
        const commandList = [];
        
        for (const [id, data] of Object.entries(commands)) {
            try {
                const command = JSON.parse(data);
                commandList.push({
                    id: id,
                    ...command
                });
            } catch (e) {
                console.error('Failed to parse command:', id);
            }
        }
        
        res.json(commandList);
    } catch (e) {
        console.error('Commands fetch error:', e.message);
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});

app.post('/api/commands/:guildId', authenticateUser, async (req, res) => {
    try {
        const { guildId } = req.params;
        const command = req.body;
        
        if (!command.id) {
            command.id = crypto.randomUUID();
        }
        
        if (!command.createdAt) {
            command.createdAt = new Date().toISOString();
        }
        
        command.updatedAt = new Date().toISOString();
        
        await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
        res.json({ success: true, id: command.id });
    } catch (e) {
        console.error('Save command error:', e.message);
        res.status(500).json({ error: 'Failed to save command' });
    }
});

app.delete('/api/commands/:guildId/:commandId', authenticateUser, async (req, res) => {
    try {
        await redis.hdel(`commands:${req.params.guildId}`, req.params.commandId);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete command error:', e.message);
        res.status(500).json({ error: 'Failed to delete command' });
    }
});

// === SETTINGS ENDPOINTS ===
app.get('/api/settings/:guildId', authenticateUser, async (req, res) => {
    try {
        const prefix = await redis.get(`prefix:${req.params.guildId}`) || '!';
        res.json({ prefix });
    } catch (e) {
        console.error('Settings fetch error:', e.message);
        res.json({ prefix: '!' });
    }
});

app.post('/api/settings/:guildId', authenticateUser, async (req, res) => {
    try {
        const { prefix } = req.body;
        if (!prefix || prefix.length > 5) {
            return res.status(400).json({ error: 'Prefix must be 1-5 characters' });
        }
        
        await redis.set(`prefix:${req.params.guildId}`, prefix);
        res.json({ success: true });
    } catch (e) {
        console.error('Settings save error:', e.message);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// === DATABASE ENDPOINTS ===
app.get('/api/database/:guildId', authenticateUser, async (req, res) => {
    try {
        const entries = await redis.hgetall(`db:${req.params.guildId}`);
        const data = {};
        
        for (const [key, value] of Object.entries(entries)) {
            try {
                data[key] = JSON.parse(value);
            } catch {
                data[key] = value;
            }
        }
        
        res.json(data);
    } catch (e) {
        console.error('Database fetch error:', e.message);
        res.status(500).json({ error: 'Failed to fetch database' });
    }
});

app.post('/api/database/:guildId', authenticateUser, async (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key || key.length > 100) {
            return res.status(400).json({ error: 'Key must be 1-100 characters' });
        }
        
        await redis.hset(`db:${req.params.guildId}`, key, JSON.stringify(value));
        res.json({ success: true });
    } catch (e) {
        console.error('Database save error:', e.message);
        res.status(500).json({ error: 'Failed to save to database' });
    }
});

app.delete('/api/database/:guildId/:key', authenticateUser, async (req, res) => {
    try {
        await redis.hdel(`db:${req.params.guildId}`, req.params.key);
        res.json({ success: true });
    } catch (e) {
        console.error('Database delete error:', e.message);
        res.status(500).json({ error: 'Failed to delete from database' });
    }
});

// === STATUS ENDPOINT ===
app.get('/api/status', async (req, res) => {
    try {
        const botStatus = client.isReady() ? 'online' : 'offline';
        const redisStatus = await redis.ping() === 'PONG' ? 'connected' : 'disconnected';
        const uptime = process.uptime();
        
        res.json({
            bot: {
                status: botStatus,
                username: client.user?.tag || 'Not logged in',
                guilds: client.guilds.cache.size,
                uptime: Math.floor(uptime)
            },
            redis: {
                status: redisStatus
            },
            system: {
                uptime: Math.floor(uptime),
                memory: process.memoryUsage(),
                platform: process.platform,
                node: process.version
            }
        });
    } catch (e) {
        console.error('Status error:', e.message);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// === TEST COMMAND ENDPOINT ===
app.post('/api/test-command', authenticateUser, async (req, res) => {
    try {
        const { code, language } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'No code provided' });
        }
        
        let output = '';
        
        if (language === 'javascript' || language === 'JavaScript') {
            const vm = new NodeVM({
                timeout: 5000,
                sandbox: {
                    console: {
                        log: (...args) => {
                            output += args.map(arg => String(arg)).join(' ') + '\n';
                        }
                    }
                },
                require: {
                    external: false,
                    builtin: ['*']
                }
            });
            
            try {
                vm.run(code);
                res.json({ output: output || 'No output' });
            } catch (error) {
                res.json({ output: `Error: ${error.message}` });
            }
        } else if (language === 'python' || language === 'Python') {
            const tempFile = path.join(__dirname, `temp_${crypto.randomUUID()}.py`);
            
            try {
                fs.writeFileSync(tempFile, code);
                exec(`timeout 5 python3 ${tempFile}`, (error, stdout, stderr) => {
                    output = stdout || stderr || 'No output';
                    fs.unlinkSync(tempFile);
                    res.json({ output });
                });
            } catch (error) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                res.json({ output: `Error: ${error.message}` });
            }
        } else if (language === 'go' || language === 'Go') {
            const tempFile = path.join(__dirname, `temp_${crypto.randomUUID()}.go`);
            
            try {
                fs.writeFileSync(tempFile, code);
                exec(`timeout 5 go run ${tempFile}`, (error, stdout, stderr) => {
                    output = stdout || stderr || 'No output';
                    fs.unlinkSync(tempFile);
                    res.json({ output });
                });
            } catch (error) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                res.json({ output: `Error: ${error.message}` });
            }
        } else {
            res.status(400).json({ error: 'Unsupported language' });
        }
    } catch (e) {
        console.error('Test command error:', e.message);
        res.status(500).json({ error: 'Failed to test command' });
    }
});

// === DISCORD BOT MESSAGE HANDLER ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    try {
        const guildId = message.guild?.id;
        if (!guildId) return;
        
        const prefix = await redis.get(`prefix:${guildId}`) || '!';
        const commands = await redis.hgetall(`commands:${guildId}`);
        
        for (const [id, data] of Object.entries(commands)) {
            try {
                const command = JSON.parse(data);
                let matches = false;
                
                if (command.type === 'Command (prefix)') {
                    matches = message.content.startsWith(prefix + command.trigger);
                } else if (command.type === 'Exact Match') {
                    matches = message.content === command.trigger;
                } else if (command.type === 'Starts with') {
                    matches = message.content.startsWith(command.trigger);
                }
                
                if (matches) {
                    if (command.language === 'javascript') {
                        const vm = new NodeVM({
                            timeout: 5000,
                            sandbox: {
                                message: message,
                                args: message.content.split(' ').slice(1),
                                prefix: prefix
                            },
                            require: {
                                external: false,
                                builtin: ['*']
                            }
                        });
                        
                        try {
                            const result = vm.run(command.code);
                            if (result && typeof result === 'string') {
                                await message.reply(result);
                            }
                        } catch (error) {
                            await message.reply('❌ Error executing command');
                        }
                    }
                    break;
                }
            } catch (cmdError) {
                console.error('Command error:', cmdError);
            }
        }
    } catch (error) {
        console.error('Message handler error:', error);
    }
});

// === DISCORD BOT EVENTS - FIXED: Using clientReady instead of ready ===
// Remove the old 'ready' event and only use 'clientReady' to fix the warning
client.once('clientReady', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
});

// === START SERVER ===
async function startServer() {
    try {
        // Start Express server
        const server = app.listen(PORT, HOST, () => {
            console.log(`🌐 Dashboard running on http://${HOST}:${PORT}`);
        });

        // Start Discord bot
        console.log('🤖 Starting Discord bot...');
        await client.login(TOKEN);
        
        console.log('✅ All services started successfully');
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down...');
            server.close(() => {
                client.destroy();
                process.exit(0);
            });
        });
        
        // Keep process alive
        setInterval(() => {
            if (redis.status !== 'ready') {
                console.log('Reconnecting Redis...');
                redis.connect().catch(() => {});
            }
        }, 60000); // Check every minute
        
    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
}

// Start everything
startServer();
