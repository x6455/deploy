require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const os = require('os');
const { spawn, exec } = require('child_process');
const morgan = require('morgan');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const PORT = process.env.MONITOR_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const ADMIN_PASSWORD = process.env.ADMIN_PASS;
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

let instances = new Map();
let users = {};
let processes = new Map(); // Track running processes

const BOTS_FOLDER = path.join(__dirname, 'bots');
const BOT_LIST_FILE = path.join(__dirname, 'bot.list.json');

// Add this function to monitor-server.js (make sure it's after the processes Map is defined)
function syncInstanceStatus() {
  instances.forEach((instance, id) => {
    const wasRunning = instance.running;
    const isRunning = processes.has(id);
    
    // Update status if changed
    if (wasRunning !== isRunning) {
      instance.running = isRunning;
      logger.info(`Instance ${id} status changed to: ${isRunning ? 'running' : 'stopped'}`);
      
      // Emit status update to dashboard
      io.emit('instanceUpdate', { id: id, running: isRunning });
    }
  });
}

// Call this periodically (every 10 seconds) - make sure this is after io is defined
setInterval(syncInstanceStatus, 10000);


// Load bots from bot.list.json
function loadBotsFromList() {
  try {
    if (!fs.existsSync(BOT_LIST_FILE)) {
      logger.warn(`bot.list.json not found at ${BOT_LIST_FILE}`);
      // Create empty bot list file if it doesn't exist
      fs.writeFileSync(BOT_LIST_FILE, JSON.stringify({ bots: [] }, null, 2));
      return [];
    }

    const data = fs.readFileSync(BOT_LIST_FILE, 'utf8');
    const botList = JSON.parse(data).bots || [];
    
    logger.info(`Loaded ${botList.length} bots from bot.list.json`);
    
    // Clear existing instances and register new ones
    instances.clear();
    
    botList.forEach(bot => {
      const botFolder = path.join(BOTS_FOLDER, bot.folder);
      const dbPath = path.join(botFolder, bot.db);
      const scriptPath = path.join(botFolder, bot.script);
      
      // Check if bot folder exists
      if (!fs.existsSync(botFolder)) {
        logger.warn(`Bot folder not found: ${botFolder}`);
        return;
      }
      
      instances.set(bot.id, { 
        id: bot.id,
        folder: bot.folder,
        dbPath, 
        scriptPath,
        metrics: {}, 
        logs: [],
        running: false,
        process: null
      });
      
      logger.info(`Registered bot: ${bot.id} (${bot.folder})`);
    });
    
    return botList;
  } catch (err) {
    logger.error(`Failed to load bot.list.json: ${err.message}`);
    return [];
  }
}

// Initialize bots on server start
loadBotsFromList();


function restartBotInstance(instanceId) {
  const instance = instances.get(instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  logger.info(`Restarting instance ${instanceId}`);

  // Stop if running
  if (instance.running && processes.has(instanceId)) {
    stopBotInstance(instanceId);
    
    // Wait a moment for the process to fully stop
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          // Start the instance again
          startBotInstance(instanceId);
          logger.info(`Instance ${instanceId} restarted successfully`);
          resolve();
        } catch (error) {
          logger.error(`Failed to restart instance ${instanceId}: ${error.message}`);
          throw error;
        }
      }, 1000);
    });
  } else {
    // If not running, just start it
    startBotInstance(instanceId);
    logger.info(`Instance ${instanceId} started (was not running)`);
  }
}
function startBotInstance(instanceId) {
  const instance = instances.get(instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  logger.info(`🚀 STARTING BOT: ${instanceId}`);
  logger.info(`📁 Script: ${instance.scriptPath}`);
  logger.info(`📁 Directory: ${path.dirname(instance.scriptPath)}`);
  logger.info(`✅ File exists: ${fs.existsSync(instance.scriptPath)}`);

  // Check if we can read the file
  try {
    fs.accessSync(instance.scriptPath, fs.constants.R_OK);
    logger.info(`📖 File is readable: YES`);
  } catch (err) {
    logger.info(`❌ File is readable: NO - ${err.message}`);
    throw err;
  }

  const botProcess = spawn('node', [instance.scriptPath], {
    cwd: path.dirname(instance.scriptPath),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      INSTANCE_ID: instanceId,
      MONITOR_SERVER: `http://localhost:${PORT}`,
      AGENT_TOKEN: AGENT_TOKEN,
      NODE_ENV: 'production'
    }
  });

  logger.info(`📊 Bot process spawned for ${instanceId}, PID: ${botProcess.pid}`);

  // Store process reference
  processes.set(instanceId, botProcess);
  instance.process = botProcess;
  instance.running = true;

  // Enhanced stdout handling
  botProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    logger.info(`[${instanceId} STDOUT]: ${message}`);
    
    // Add to instance logs
    instance.logs.push({
      level: 'info',
      message: message,
      timestamp: new Date().toISOString()
    });
    
    // Keep logs manageable
    if (instance.logs.length > 1000) {
      instance.logs = instance.logs.slice(-500);
    }
    
    // Emit to dashboard
    io.emit('logUpdate', { 
      id: instanceId, 
      log: { level: 'info', message: message } 
    });
  });

  // Enhanced stderr handling
  botProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    console.error(`[${instanceId} STDERR]: ${message}`);
    
    // Add to instance logs
    instance.logs.push({
      level: 'error',
      message: message,
      timestamp: new Date().toISOString()
    });
    
    // Keep logs manageable
    if (instance.logs.length > 1000) {
      instance.logs = instance.logs.slice(-500);
    }
    
    // Emit to dashboard
    io.emit('logUpdate', { 
      id: instanceId, 
      log: { level: 'error', message: message } 
    });
  });

  // Handle process exit
  botProcess.on('exit', (code, signal) => {
    logger.info(`[${instanceId} EXIT]: Code ${code}, Signal ${signal}`);
    
    instance.running = false;
    instance.process = null;
    processes.delete(instanceId);
    
    // Add exit log
    const exitMessage = `Process exited with code ${code}` + (signal ? `, signal ${signal}` : '');
    instance.logs.push({
      level: 'info',
      message: exitMessage,
      timestamp: new Date().toISOString()
    });
    
    // Emit status update
    io.emit('instanceUpdate', { id: instanceId, running: false });
    io.emit('logUpdate', { 
      id: instanceId, 
      log: { level: 'error', message: `Process exited (code: ${code})` } 
    });
  });

  botProcess.on('error', (error) => {
    console.error(`[${instanceId} PROCESS ERROR]: ${error.message}`);
    
    instance.running = false;
    instance.process = null;
    processes.delete(instanceId);
    
    // Emit status update
    io.emit('instanceUpdate', { id: instanceId, running: false });
    io.emit('logUpdate', { 
      id: instanceId, 
      log: { level: 'error', message: `Process error: ${error.message}` } 
    });
  });

  logger.info(`✅ Started instance ${instanceId}`);
  return botProcess;
}

function stopBotInstance(instanceId) {
  const instance = instances.get(instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  const botProcess = processes.get(instanceId);
  if (!botProcess) {
    // If not running, just update the status and return success
    instance.running = false;
    logger.info(`Instance ${instanceId} was already stopped`);
    
    // Emit status update to ensure dashboard is in sync
    io.emit('instanceUpdate', { id: instanceId, running: false });
    io.emit('metricsUpdate', { 
      id: instanceId, 
      metrics: { 
        ...instance.metrics, 
        running: false,
        uptime: 0 
      } 
    });
    return;
  }

  // Kill the process
  botProcess.kill('SIGTERM');
  
  // Update status immediately
  instance.running = false;
  instance.process = null;
  processes.delete(instanceId);
  
  // Emit immediate status update
  io.emit('instanceUpdate', { id: instanceId, running: false });
  io.emit('metricsUpdate', { 
    id: instanceId, 
    metrics: { 
      ...instance.metrics, 
      running: false,
      uptime: 0 
    } 
  });
  
  logger.info(`Stopped instance ${instanceId}`);
}

VV    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      INSTANCE_ID: instanceId,
      MONITOR_SERVER: `http://localhost:${PORT}`,
      AGENT_TOKEN: AGENT_TOKEN
    }
  });

  // Store process reference
  processes.set(instanceId, botProcess);
  instance.process = botProcess;
  instance.running = true;

  // Emit immediate status update
  io.emit('instanceUpdate', { id: instanceId, running: true });
  io.emit('metricsUpdate', { 
    id: instanceId, 
    metrics: { 
      ...instance.metrics, 
      running: true,
      uptime: 0 
    } 
  });
  logger.info(`Started instance ${instanceId}`);

}
// Update bot statuses (no longer uses PM2)
const updateBotStatuses = (callback) => {
  // Simply update running status based on our process tracking
  instances.forEach((instance, id) => {
    instance.running = processes.has(id);
    
    // Update uptime if process exists
    if (instance.process && instance.metrics) {
      // For simplicity, we'll track uptime from when the process started
      // In a real implementation, you might want more precise uptime tracking
      instance.metrics.running = true;
    }
  });
  
  callback(Array.from(instances.values()));
};


const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: [
        "'self'",
        'cdn.jsdelivr.net',
        'cdn.tailwindcss.com',
        "'unsafe-inline'", 
      ],
      styleSrc: [
        "'self'",
        'cdn.tailwindcss.com',
        "'unsafe-inline'",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      defaultSrc: ["'self'"], 
      connectSrc: ["'self'", 'ws://*', 'https://cdn.jsdelivr.net', 'https://cdn.tailwindcss.com'],
    },
  },
}));
app.use(cors({
  origin: true,           // allow any origin (ngrok, localhost, etc.)
  credentials: true
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public/monitor')));

// Replace the current limiter with this:
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (reduced from 15 minutes)
  max: 1000, // Increased from 100 to 1000 requests per minute
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);


// General API rate limiting (more permissive)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute for API
  message: { error: 'Too many API requests' }
});

// Stricter limits for login attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 login attempts per 15 minutes
  message: { error: 'Too many login attempts' }
});

// Apply rate limits specifically
app.use('/api/login', authLimiter);
app.use('/api/', apiLimiter); // Apply to all API routes

// Authentication setup
const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
users['admin'] = { password: hashedPassword };

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Get all instances
app.get('/api/instances', authenticateToken, (req, res) => {
  updateBotStatuses((instancesList) => {
    const instanceList = Array.from(instances.values()).map(instance => ({
      id: instance.id,
      folder: instance.folder,
      metrics: instance.metrics,
      uptime: instance.metrics?.uptime || 0,
      dbPath: instance.dbPath,
      scriptPath: instance.scriptPath,
      running: instance.running
    }));
    res.json(instanceList);
  });
});

// Start instance - UPDATED
app.post('/api/start/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  try {
    startBotInstance(id);
    res.json({ message: `${id} started successfully` });
  } catch (error) {
    logger.error(`Start failed for ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to start ${id}: ${error.message}` });
  }
});

// Stop instance - UPDATED with better error handling
app.post('/api/stop/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  try {
    stopBotInstance(id);
    res.json({ message: `${id} stopped successfully` });
  } catch (error) {
    // If the instance doesn't exist, return 404
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    logger.error(`Stop failed for ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to stop ${id}: ${error.message}` });
  }
});

// Restart instance - UPDATED
app.post('/api/restart/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  try {
    restartBotInstance(id);
    res.json({ message: `${id} restarted successfully` });
  } catch (error) {
    logger.error(`Restart failed for ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to restart ${id}: ${error.message}` });
  }
});

// Delete instance (stop and remove from tracking) - UPDATED
app.post('/api/delete/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  try {
    // Stop if running
    if (processes.has(id)) {
      stopBotInstance(id);
    }
    
    // Remove from instances
    instances.delete(id);
    
    logger.info(`Deleted instance ${id}`);
    res.json({ message: `${id} deleted successfully` });
  } catch (error) {
    logger.error(`Delete failed for ${id}: ${error.message}`);
    res.status(500).json({ error: `Failed to delete ${id}: ${error.message}` });
  }
});

// Get logs for instance
app.get('/api/logs/:id', authenticateToken, (req, res) => {
  const instance = instances.get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  // Return last 100 logs
  const recentLogs = instance.logs.slice(-100);
  res.json(recentLogs);
});

// DB Management endpoints (unchanged)
app.get('/api/db/:id', authenticateToken, (req, res) => {
  const instance = instances.get(req.params.id);
  if (!instance || !instance.dbPath) {
    return res.status(404).json({ error: 'DB not found' });
  }

  try {
    if (!fs.existsSync(instance.dbPath)) {
      return res.status(404).json({ error: 'DB file not found' });
    }

    const encrypted = fs.readFileSync(instance.dbPath, 'utf8');
    
    if (!ENCRYPTION_KEY) {
      return res.status(500).json({ 
        error: 'Encryption key not configured on server' 
      });
    }

    if (ENCRYPTION_KEY.length !== 32) {
      return res.status(500).json({ 
        error: `Encryption key must be 32 characters long. Current length: ${ENCRYPTION_KEY.length}` 
      });
    }

    // Check if file is actually encrypted (starts with hex iv)
    if (encrypted.length < 32 || !/^[0-9a-f]{32}/.test(encrypted)) {
      return res.status(400).json({ 
        error: 'Database file is not properly encrypted' 
      });
    }

    const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
    const data = encrypted.slice(32);
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    res.json(JSON.parse(decrypted));
  } catch (err) {
    logger.error(`DB read error for ${req.params.id}: ${err.message}`);
    
    if (err.message.includes('bad decrypt')) {
      return res.status(500).json({ 
        error: 'Decryption failed. Check if encryption key matches the one used to encrypt the database.' 
      });
    }
    
    res.status(500).json({ error: `Failed to read DB: ${err.message}` });
  }
});

app.post('/api/db/:id', authenticateToken, (req, res) => {
  const instance = instances.get(req.params.id);
  if (!instance || !instance.dbPath) {
    return res.status(404).json({ error: 'DB not found' });
  }

  try {
    if (!ENCRYPTION_KEY) {
      return res.status(500).json({ 
        error: 'Encryption key not configured on server' 
      });
    }

    if (ENCRYPTION_KEY.length !== 32) {
      return res.status(500).json({ 
        error: `Encryption key must be 32 characters long. Current length: ${ENCRYPTION_KEY.length}` 
      });
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(JSON.stringify(req.body, null, 2), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const encryptedData = iv.toString('hex') + encrypted;
    fs.writeFileSync(instance.dbPath, encryptedData);
    
    res.json({ message: 'Database updated successfully' });
  } catch (err) {
    logger.error(`DB write error for ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: `Failed to write DB: ${err.message}` });
  }
});

// Reload bot list
app.post('/api/reload-bots', authenticateToken, (req, res) => {
  loadBotsFromList();
  res.json({ message: 'Bot list reloaded successfully' });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  logger.info(`New connection: ${socket.id}`);

  socket.on('authenticate', (agentToken) => {
    if (agentToken === AGENT_TOKEN) {
      socket.isAgent = true;
      logger.info(`Agent authenticated: ${socket.id}`);
    } else {
      logger.info(`Dashboard client connected: ${socket.id}`);
    }
  });

  // Add this after your socket.io setup
io.use((socket, next) => {
  // Simple rate limiting for socket connections
  const now = Date.now();
  const lastConnection = socket.handshake.auth.lastConnection || 0;
  
  if (now - lastConnection < 1000) { // 1 second between connections
    return next(new Error('Connection rate limit exceeded'));
  }
  
  next();
});

  socket.on('register', ({ id, dbPath }) => {
    if (!instances.has(id)) {
      instances.set(id, { 
        id, 
        metrics: {}, 
        logs: [], 
        dbPath,
        running: false,
        process: null
      });
      logger.info(`Dynamic instance registered: ${id}`);
    }
    socket.instanceId = id;
  });

  socket.on('metrics', (metrics) => {
    const instance = instances.get(socket.instanceId);
    if (instance) {
      instance.metrics = { ...instance.metrics, ...metrics };
      io.emit('metricsUpdate', { id: socket.instanceId, metrics: instance.metrics });
    }
  });

  socket.on('log', (logEntry) => {
    const instance = instances.get(socket.instanceId);
    if (instance) {
      instance.logs.push({
        ...logEntry,
        timestamp: new Date().toISOString()
      });
      if (instance.logs.length > 1000) instance.logs.shift();
      io.emit('logUpdate', { id: socket.instanceId, log: logEntry });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Disconnected: ${socket.id}`);
  });
});

// Dashboard route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/monitor', 'dashboard.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down monitor server...');
  
  // Stop all running instances
  processes.forEach((process, instanceId) => {
    logger.info(`Stopping instance ${instanceId}`);
    process.kill('SIGTERM');
  });
  
  setTimeout(() => {
    processes.forEach((process, instanceId) => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 1000);
});

// Start server
// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Monitoring server running on port ${PORT}`);
  logger.info(`Bots folder: ${BOTS_FOLDER}`);
  logger.info(`Bot list file: ${BOT_LIST_FILE}`);
  logger.info('Process management: Direct Node.js process control (No PM2)');
  
  // Initial status update
  updateBotStatuses(() => {
    logger.info('Initial bot status check completed');
    setInterval(syncInstanceStatus, 1000);
  });

});




