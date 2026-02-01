const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet'); // Security headers
const rateLimit = require('express-rate-limit'); // Rate limiting
const csrf = require('csurf'); // CSRF protection
const cookieParser = require('cookie-parser');
const Redis = require('ioredis');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { body, validationResult } = require('express-validator');
const validator = require('validator'); // Input sanitization
const winston = require('winston'); // Proper logging

// Initialize Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'audit.log' })
  ]
});

// Configuration
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://official-sssyntax-website-production.up.railway.app/callback';
const REDIS_URL = process.env.REDIS_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const PORT = process.env.PORT || 3000;

// Check environment variables
if (!TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REDIS_URL) {
  logger.error('Missing environment variables', {
    TOKEN: !!TOKEN,
    CLIENT_ID: !!CLIENT_ID,
    CLIENT_SECRET: !!CLIENT_SECRET,
    REDIS_URL: !!REDIS_URL
  });
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
const redis = new Redis(REDIS_URL, {
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined
});

// Encryption functions
function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-gcm', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, authTag };
}

function decrypt(encrypted, authTag) {
  const decipher = crypto.createDecipher('aes-256-gcm', ENCRYPTION_KEY);
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Body parsing with limits
app.use(bodyParser.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(cookieParser());
app.use(cors({ 
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true 
}));

// Static files from public directory
app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
  }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);

// Request logging and sanitization middleware
app.use((req, res, next) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = validator.escape(validator.trim(req.query[key]));
      }
    });
  }
  
  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  logger.info('Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  next();
});

// Helper function to sanitize objects
function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = validator.escape(validator.trim(obj[key]));
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// CSRF token endpoint (must come before CSRF protection)
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false, // Must be accessible to JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ csrfToken });
});

// CSRF protection for mutation endpoints
const csrfCheck = (req, res, next) => {
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];
  
  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// OAuth Callback Route with validation
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      logger.warn('OAuth callback without code', { ip: req.ip });
      return res.redirect('/?error=no_code');
    }
    
    // Validate state parameter if provided
    if (state) {
      const isValidState = await validateStateParameter(state);
      if (!isValidState) {
        logger.warn('Invalid state parameter in OAuth callback', { ip: req.ip });
        return res.redirect('/?error=invalid_state');
      }
    }
    
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIS_URL
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'S.S. Syntax Bot'
        },
        timeout: 10000
      }
    );
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Store token securely with expiration
    const tokenId = crypto.randomUUID();
    await redis.setex(`token:${tokenId}`, expires_in || 604800, JSON.stringify({
      access_token,
      created_at: Date.now(),
      ip: req.ip
    }));
    
    // Redirect with encrypted token ID
    const encryptedToken = encrypt(tokenId);
    res.redirect(`/?token=${encodeURIComponent(JSON.stringify(encryptedToken))}`);
    
  } catch (error) {
    logger.error('OAuth callback error', { 
      error: error.message,
      ip: req.ip 
    });
    res.redirect('/?error=auth_failed');
  }
});

// Helper function for state validation
async function validateStateParameter(state) {
  try {
    const storedState = await redis.get(`oauth_state:${state}`);
    await redis.del(`oauth_state:${state}`); // Use once
    return storedState === 'valid';
  } catch {
    return false;
  }
}

// Authentication middleware with rate limiting
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const encryptedToken = authHeader.replace('Bearer ', '');
    let tokenId;
    
    try {
      const tokenData = JSON.parse(encryptedToken);
      tokenId = decrypt(tokenData.encrypted, tokenData.authTag);
    } catch {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Check Redis for token
    const tokenData = await redis.get(`token:${tokenId}`);
    if (!tokenData) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
    
    const { access_token } = JSON.parse(tokenData);
    
    // Verify with Discord
    const response = await axios.get('https://discord.com/api/users/@me', {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'User-Agent': 'S.S. Syntax Bot'
      },
      timeout: 5000
    });
    
    req.user = response.data;
    req.token = access_token;
    
    // Audit log
    await auditLog(req.user.id, 'AUTH', 'User authenticated', req.ip);
    
    next();
  } catch (error) {
    logger.error('Authentication error', { 
      error: error.message,
      ip: req.ip 
    });
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Guild access verification
async function verifyGuildAccess(req, res, next) {
  const guildId = req.params.guildId || req.body.guildId;
  
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID required' });
  }
  
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found or bot not in guild' });
    }
    
    const member = await guild.members.fetch(req.user.id).catch(() => null);
    if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return res.status(403).json({ error: 'Insufficient permissions (Manage Server required)' });
    }
    
    req.guild = guild;
    next();
  } catch (error) {
    logger.error('Guild access verification error', { 
      error: error.message,
      userId: req.user.id,
      guildId: guildId,
      ip: req.ip 
    });
    res.status(403).json({ error: 'Unable to verify guild access' });
  }
}

// Redis-based rate limiting
async function checkRedisRateLimit(userId, action, windowMs = 60000, maxRequests = 10) {
  const key = `ratelimit:${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count current requests in window
  const requestCount = await redis.zcard(key);
  
  if (requestCount >= maxRequests) {
    return false;
  }
  
  // Add new request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, Math.ceil(windowMs / 1000));
  
  return true;
}

// Audit logging
async function auditLog(userId, action, details, ip) {
  const logEntry = {
    userId,
    action,
    details,
    ip,
    timestamp: new Date().toISOString(),
    userAgent: 'API'
  };
  
  await redis.lpush('audit:logs', JSON.stringify(logEntry));
  await redis.ltrim('audit:logs', 0, 9999); // Keep last 10,000 entries
  
  logger.info('Audit log', logEntry);
}

// Secure command storage
async function saveCommand(guildId, command, userId) {
  const commandId = command.id || crypto.randomUUID();
  const safeCommand = {
    ...command,
    id: commandId,
    createdBy: userId,
    createdAt: command.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Remove any dangerous properties
    code: validator.escape(command.code).substring(0, 1000) // Limit code length
  };
  
  const encryptedCommand = encrypt(JSON.stringify(safeCommand));
  await redis.hset(`commands:${guildId}`, commandId, JSON.stringify(encryptedCommand));
  
  return commandId;
}

// API Routes

// User Info
app.get('/api/user-me', authenticateUser, async (req, res) => {
  res.json(req.user);
});

// Mutual Servers
app.get('/api/mutual-servers', authenticateUser, async (req, res) => {
  try {
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { 
        Authorization: `Bearer ${req.token}`,
        'User-Agent': 'S.S. Syntax Bot'
      },
      timeout: 5000
    });
    
    const mutual = response.data.filter(g => {
      try {
        return (BigInt(g.permissions) & 0x20n) === 0x20n && client.guilds.cache.has(g.id);
      } catch {
        return false;
      }
    });
    
    res.json(mutual);
  } catch (error) {
    logger.error('Mutual servers error', { 
      error: error.message,
      userId: req.user.id 
    });
    res.status(500).json([]);
  }
});

// Commands Management with CSRF protection
app.get('/api/commands/:guildId', authenticateUser, verifyGuildAccess, async (req, res) => {
  try {
    const commands = await redis.hgetall(`commands:${req.params.guildId}`);
    const cmdList = [];
    
    for (const [id, encrypted] of Object.entries(commands)) {
      try {
        const encryptedData = JSON.parse(encrypted);
        const decrypted = JSON.parse(decrypt(encryptedData.encrypted, encryptedData.authTag));
        cmdList.push(decrypted);
      } catch {
        // Skip corrupted entries
      }
    }
    
    res.json(cmdList);
  } catch (error) {
    logger.error('Commands fetch error', { 
      error: error.message,
      guildId: req.params.guildId,
      userId: req.user.id 
    });
    res.status(500).json([]);
  }
});

app.post('/api/save-command', authenticateUser, verifyGuildAccess, csrfCheck, [
  body('command.trigger').isString().trim().isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_\-]+$/),
  body('command.code').isString().trim().isLength({ min: 1, max: 1000 }),
  body('command.lang').isIn(['JavaScript']), // Only JavaScript allowed for security
  body('command.type').isIn(['Command (prefix)', 'Exact Match', 'Starts with']),
  body('command.cooldown').optional().isInt({ min: 1000, max: 60000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Rate limiting per user
    if (!await checkRedisRateLimit(req.user.id, 'save_command', 60000, 10)) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    const { guildId, command } = req.body;
    const count = await redis.hlen(`commands:${guildId}`);
    
    if (!command.isEdit && count >= 50) { // Reduced limit
      return res.status(403).json({ error: 'Command limit reached (50 commands max)' });
    }
    
    const commandId = await saveCommand(guildId, command, req.user.id);
    
    // Audit log
    await auditLog(req.user.id, 'SAVE_COMMAND', 
      `Saved command ${command.trigger} in guild ${guildId}`, req.ip);
    
    res.json({ success: true, message: 'Command saved securely', id: commandId });
  } catch (error) {
    logger.error('Save command error', { 
      error: error.message,
      userId: req.user.id,
      guildId: req.body.guildId 
    });
    res.status(500).json({ error: 'Failed to save command' });
  }
});

// Other API routes with similar security...

// System Status
app.get('/api/status', async (req, res) => {
  try {
    const botStatus = client.readyAt ? '🟢 Online' : '🔴 Offline';
    let redisStatus = '🔴 Disconnected';
    
    try {
      await redis.ping();
      redisStatus = '🟢 Connected';
    } catch {
      redisStatus = '🔴 Error';
    }
    
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    res.json({
      bot: botStatus,
      redis: redisStatus,
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      guilds: client.guilds.cache.size,
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memory.rss / 1024 / 1024) + ' MB'
      },
      node: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Status check error', { error: error.message });
    res.status(500).json({
      bot: '🔴 Offline',
      redis: '🔴 Disconnected',
      uptime: '0 minutes',
      guilds: 0,
      memory: '0 MB'
    });
  }
});

// Serve SPA for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/callback') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Discord message handler - REMOVED CODE EXECUTION FOR SECURITY
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  try {
    const guildId = message.guild?.id;
    if (!guildId) return;
    
    const prefix = await redis.get(`prefix:${guildId}`) || '!';
    const commands = await redis.hgetall(`commands:${guildId}`);
    
    for (const [id, encrypted] of Object.entries(commands)) {
      try {
        const encryptedData = JSON.parse(encrypted);
        const command = JSON.parse(decrypt(encryptedData.encrypted, encryptedData.authTag));
        
        let matches = false;
        if (command.type === 'Command (prefix)') {
          matches = message.content.startsWith(prefix + command.trigger);
        } else if (command.type === 'Exact Match') {
          matches = message.content === command.trigger;
        } else if (command.type === 'Starts with') {
          matches = message.content.startsWith(command.trigger);
        }
        
        if (matches) {
          // Simple response for now - REMOVED VM2 EXECUTION
          message.reply(`Command "${command.trigger}" received. Code execution disabled for security.`);
          break;
        }
      } catch {
        // Skip corrupted commands
      }
    }
  } catch (error) {
    logger.error('Message handler error', { error: error.message });
  }
});

// Discord bot events
client.once('clientReady', () => {
  logger.info('Bot logged in', { 
    tag: client.user.tag,
    guilds: client.guilds.cache.size 
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message,
    stack: err.stack,
    path: req.path,
    ip: req.ip 
  });
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', { 
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version 
  });
  
  // Start bot
  client.login(TOKEN).then(() => {
    logger.info('Bot login successful');
  }).catch(error => {
    logger.error('Bot login failed', { error: error.message });
    process.exit(1);
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  client.destroy();
  redis.quit();
  
  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, 5000);
});
