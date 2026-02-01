const { Client, GatewayIntentBits, PermissionsBitField, Collection } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const zlib = require('zlib');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { NodeVM } = require('vm2');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const util = require('util');

// Promisify zlib functions
const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

// --- CONFIGURATION ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || (process.env.RAILWAY_STATIC_URL ? `${process.env.RAILWAY_STATIC_URL}/callback` : 'http://localhost:3000/callback');
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const API_SECRET = process.env.API_SECRET || crypto.randomBytes(32).toString('hex');

// Parse ALLOWED_ORIGINS from environment variable
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
if (ALLOWED_ORIGINS.length === 0 && NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

// Bot configuration with multi-bot support
const BOTS = {
  main: {
    token: TOKEN,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    name: 'S.S. Syntax',
    status: {
      ready: false,
      uptime: 0,
      guilds: 0,
      ping: 0
    }
  }
};

// --- DATA STRUCTURES ---
const commandCache = new Map();
const sessionCache = new Map();
const cooldowns = new Map();
const botClients = new Map();
const executionLogs = new Map();
const guildCache = new Map();

// Cleanup intervals
setInterval(() => {
  const now = Date.now();
  for (const [key, expires] of cooldowns.entries()) {
    if (expires < now) cooldowns.delete(key);
  }
  for (const [sessionId, session] of sessionCache.entries()) {
    if (session.expiresAt <= now) sessionCache.delete(sessionId);
  }
  for (const [cacheKey, logs] of executionLogs.entries()) {
    if (logs.length > 1000) executionLogs.set(cacheKey, logs.slice(0, 1000));
  }
  for (const [guildKey, { timestamp }] of guildCache.entries()) {
    if (now - timestamp > 5 * 60 * 1000) guildCache.delete(guildKey);
  }
}, 60000);

// --- ENVIRONMENT VALIDATION ---
console.log('🔍 Environment check:');
console.log(`   NODE_ENV: ${NODE_ENV}`);
console.log(`   PORT: ${PORT}`);
console.log(`   CLIENT_ID: ${CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`   TOKEN: ${TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`   REDIS_URL: ${REDIS_URL ? '✅ Set' : '❌ Missing'}`);

const requiredEnvVars = ['TOKEN', 'CLIENT_ID', 'REDIS_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.log('⚠️  Server will start but some features may not work');
}

// --- EXPRESS APP ---
const app = express();

// === RAILWAY CRITICAL FIX 1: Health check FIRST ===
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'discord-bot-platform',
    environment: NODE_ENV,
    version: '2.0.0'
  });
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: false
}));

// CORS with origin validation
app.use(cors({
  origin: (origin, callback) => {
    if (!origin && NODE_ENV === 'development') return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// === RAILWAY CRITICAL FIX 2: Redis TLS ===
let redis;
try {
  redis = new Redis(REDIS_URL, {
    tls: REDIS_URL && REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 100, 5000),
    reconnectOnError: (err) => err.message.includes('READONLY')
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  redis.on('close', () => console.warn('⚠️ Redis connection closed'));
} catch (error) {
  console.error('❌ Failed to create Redis client:', error.message);
  redis = {
    get: async () => null,
    set: async () => 'OK',
    hgetall: async () => ({}),
    hset: async () => 0,
    del: async () => 0,
    setex: async () => 'OK',
    lpush: async () => 0,
    lrange: async () => [],
    ltrim: async () => 'OK',
    on: () => {}
  };
}

// --- MIDDLEWARE ---
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = uuidv4().substring(0, 8);
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${requestId} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) console.error(`❌ ${logMessage}`);
    else if (res.statusCode >= 400) console.warn(`⚠️ ${logMessage}`);
    else console.log(`✅ ${logMessage}`);
  });
  req.requestId = requestId;
  next();
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// --- SESSION MANAGEMENT ---
function generateSessionId() {
  const uuid = uuidv4();
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(uuid);
  return `${uuid}:${hmac.digest('hex').substring(0, 16)}`;
}

function verifySessionId(sessionId) {
  const [uuid, signature] = sessionId.split(':');
  if (!uuid || !signature) return false;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(uuid);
  return signature === hmac.digest('hex').substring(0, 16);
}

async function createSession(discordToken, userData, ipAddress) {
  const sessionId = generateSessionId();
  const sessionData = {
    discordToken,
    userData,
    ipAddress,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000),
    lastActivity: Date.now()
  };
  await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(sessionData));
  sessionCache.set(sessionId, sessionData);
  return sessionId;
}

async function validateSession(sessionId, ipAddress) {
  if (!verifySessionId(sessionId)) return null;
  
  // Check memory cache
  if (sessionCache.has(sessionId)) {
    const session = sessionCache.get(sessionId);
    if (session.expiresAt <= Date.now()) {
      sessionCache.delete(sessionId);
      await redis.del(`session:${sessionId}`);
      return null;
    }
    if (NODE_ENV === 'production' && ipAddress && session.ipAddress !== ipAddress) {
      console.warn(`🚨 Session IP mismatch`);
      return null;
    }
    session.lastActivity = Date.now();
    return session;
  }
  
  // Check Redis
  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) return null;
  
  const session = JSON.parse(sessionData);
  if (session.expiresAt <= Date.now()) {
    await redis.del(`session:${sessionId}`);
    return null;
  }
  
  session.lastActivity = Date.now();
  sessionCache.set(sessionId, session);
  await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(session));
  return session;
}

// --- DISCORD BOT INITIALIZATION (NON-BLOCKING) ---
async function initializeBots() {
  for (const [botName, botConfig] of Object.entries(BOTS)) {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers
        ],
        partials: ['MESSAGE', 'CHANNEL']
      });

      botClients.set(botName, {
        client,
        config: botConfig,
        status: { ready: false, uptime: 0, guilds: 0, ping: 0, startedAt: Date.now() },
        guilds: new Collection()
      });

      // Setup bot events
      client.once('ready', () => {
        console.log(`🤖 ${botConfig.name} logged in as ${client.user.tag}`);
        const botData = botClients.get(botName);
        botData.status.ready = true;
        botData.status.guilds = client.guilds.cache.size;
        botData.status.startedAt = Date.now();
      });

      client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        
        // Command handling logic here
        const prefix = '!';
        if (!message.content.startsWith(prefix)) return;
        
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Load and execute custom commands from Redis
        const commands = await loadGuildCommands(message.guild.id, botName);
        const command = commands.find(cmd => cmd.name === commandName);
        
        if (command) {
          try {
            const sandbox = createSandbox(message);
            const startTime = Date.now();
            await sandbox.run(command.code);
            const executionTime = Date.now() - startTime;
            
            await logCommandExecution(
              message.guild.id,
              message.author.id,
              command.id,
              true,
              null,
              executionTime,
              botName
            );
          } catch (error) {
            console.error(`Command execution error: ${error.message}`);
            await logCommandExecution(
              message.guild.id,
              message.author.id,
              command.id,
              false,
              error,
              null,
              botName
            );
          }
        }
      });

      await client.login(botConfig.token);
      console.log(`✅ ${botConfig.name} login initiated`);
    } catch (error) {
      console.error(`❌ Failed to login ${botConfig.name}:`, error.message);
    }
  }
}

// --- SANDBOX ---
function createSandbox(message) {
  return new NodeVM({
    timeout: 2000,
    sandbox: {
      message: {
        author: {
          id: message.author.id,
          username: message.author.username,
          bot: message.author.bot
        },
        channel: {
          id: message.channel.id,
          name: message.channel.name,
          send: async (content) => {
            if (typeof content !== 'string') content = String(content);
            if (content.length > 2000) content = content.substring(0, 1997) + '...';
            return message.channel.send(content).catch(console.error);
          }
        },
        guild: message.guild,
        content: message.content,
        reply: (content) => message.reply(content).catch(console.error)
      },
      console: {
        log: (...args) => {
          const logMsg = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          console.log(`[Command ${message.guild?.id}]`, logMsg);
        }
      }
    },
    require: false,
    eval: false,
    wasm: false,
    wrapper: 'none'
  });
}

// --- COMMAND MANAGEMENT ---
async function loadGuildCommands(guildId, botName = 'main') {
  try {
    const cacheKey = `${botName}:${guildId}`;
    if (guildCache.has(cacheKey)) {
      const cached = guildCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }
    
    const commands = await redis.hgetall(`commands:${botName}:${guildId}`);
    const parsedCommands = Object.values(commands)
      .map(c => {
        try { return JSON.parse(c); } catch { return null; }
      })
      .filter(c => c !== null);
    
    guildCache.set(cacheKey, {
      timestamp: Date.now(),
      data: parsedCommands
    });
    
    return parsedCommands;
  } catch (error) {
    console.error('Failed to load commands:', error.message);
    return [];
  }
}

async function logCommandExecution(guildId, userId, commandId, success, error = null, executionTime = null, botName = 'main') {
  const logEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    guildId,
    userId,
    commandId,
    bot: botName,
    success,
    error: error ? error.message : null,
    executionTime
  };
  
  await redis.lpush(`logs:${botName}:${guildId}`, JSON.stringify(logEntry));
  await redis.ltrim(`logs:${botName}:${guildId}`, 0, 9999);
}

// --- AUTHENTICATION MIDDLEWARE ---
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = req.cookies?.sessionId || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session token provided' });
    }
    
    const session = await validateSession(sessionId, req.ip);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    req.session = session;
    req.user = session.userData;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// === CRITICAL ROUTES FOR YOUR index.html ===

// OAuth Login
app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = ['identify', 'guilds'];
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes.join('%20')}&state=${state}`;
  res.redirect(url);
});

// OAuth Callback
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const { access_token, token_type } = tokenResponse.data;
    
    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        authorization: `${token_type} ${access_token}`,
      },
    });
    
    const user = userResponse.data;
    
    // Create session
    const sessionId = await createSession(access_token, user, req.ip);
    
    // Set cookie and redirect
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get current user
app.get('/api/me', authenticateUser, (req, res) => {
  res.json(req.user);
});

// Get guilds
app.get('/api/guilds', authenticateUser, async (req, res) => {
  try {
    const bot = botClients.get('main');
    if (!bot || !bot.client.isReady()) {
      return res.status(503).json({ error: 'Bot not ready' });
    }
    
    const guilds = bot.client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      owner: guild.ownerId === req.user.id,
      permissions: guild.members.cache.get(req.user.id)?.permissions.bitfield || 0
    }));
    
    res.json({ guilds });
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

// Get commands for guild
app.get('/api/commands/:guildId', authenticateUser, async (req, res) => {
  try {
    const { guildId } = req.params;
    const commands = await loadGuildCommands(guildId);
    res.json({ commands });
  } catch (error) {
    console.error('Error fetching commands:', error);
    res.status(500).json({ error: 'Failed to fetch commands' });
  }
});

// Create/update command
app.post('/api/commands/:guildId', authenticateUser, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { name, code, description, permissions } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    
    const commandId = uuidv4();
    const commandData = {
      id: commandId,
      name,
      code,
      description: description || '',
      permissions: permissions || {
        roles: [],
        users: [],
        requiredFlags: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    await redis.hset(`commands:main:${guildId}`, commandId, JSON.stringify(commandData));
    await clearCommandCache(guildId);
    
    res.json({ 
      success: true, 
      command: commandData,
      message: 'Command saved successfully'
    });
  } catch (error) {
    console.error('Error saving command:', error);
    res.status(500).json({ error: 'Failed to save command' });
  }
});

// Execute command from dashboard
app.post('/api/execute/:guildId', authenticateUser, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { code } = req.body;
    
    const bot = botClients.get('main');
    if (!bot || !bot.client.isReady()) {
      return res.status(503).json({ error: 'Bot not ready' });
    }
    
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    // Find a text channel
    const channel = guild.channels.cache.find(ch => 
      ch.isTextBased() && ch.permissionsFor(bot.client.user).has('SendMessages')
    );
    
    if (!channel) {
      return res.status(400).json({ error: 'No suitable channel found' });
    }
    
    // Create a mock message for sandbox
    const mockMessage = {
      author: { id: req.user.id, username: req.user.username, bot: false },
      channel: {
        id: channel.id,
        name: channel.name,
        send: async (content) => {
          if (typeof content !== 'string') content = String(content);
          if (content.length > 2000) content = content.substring(0, 1997) + '...';
          return channel.send(cont
