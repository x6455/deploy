// Load environment variables
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
const { exec } = require('child_process');
const morgan = require('morgan');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// ===== Environment variables =====
const PORT = process.env.MONITOR_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'admin123';
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// ===== Logger =====
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

// ===== Load bots dynamically from folder specified in bots.json =====
let BOTS_LIST = [];
try {
  const configPath = path.join(__dirname, 'bots.json');
  if (!fs.existsSync(configPath)) {
    logger.warn("⚠️ bots.json not found. Creating a default one...");
    fs.writeFileSync(configPath, JSON.stringify({ botsFolder: "bots" }, null, 2));
  }

  const { botsFolder } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const botsDir = path.join(__dirname, botsFolder || 'bots');

  if (!fs.existsSync(botsDir)) {
    fs.mkdirSync(botsDir, { recursive: true });
    logger.warn(`⚠️ Bots folder '${botsDir}' created (currently empty). Add bot folders inside it.`);
  }

  // Auto-detect bots from subfolders
  const subfolders = fs.readdirSync(botsDir).filter(f => fs.lstatSync(path.join(botsDir, f)).isDirectory());

  BOTS_LIST = subfolders.map(folder => {
    // Try to find main file (index.js or bot.js)
    const folderPath = path.join(botsDir, folder);
    const possibleFiles = ['index.js', 'main.js', 'bot.js'];
    const file = possibleFiles.find(f => fs.existsSync(path.join(folderPath, f)));

    if (!file) {
      logger.warn(`⚠️ No main script found for ${folder}. Expected index.js, main.js, or bot.js`);
      return null;
    }

    return {
      name: folder,
      file: path.join(botsFolder, folder, file)
    };
  }).filter(Boolean);

  logger.info(`✅ Loaded ${BOTS_LIST.length} bot(s) from ${botsDir}`);
} catch (err) {
  logger.error(`❌ Failed to load bots dynamically: ${err.message}`);
}


// ===== PM2 process fetcher =====
const getPm2Processes = (callback) => {
  exec('pm2 jlist', (err, stdout) => {
    if (err) return callback([]);
    try {
      const list = JSON.parse(stdout);
      callback(list);
    } catch (e) {
      logger.error(`Failed to parse PM2 list: ${e.message}`);
      callback([]);
    }
  });
};

// ===== Express app setup =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", 'cdn.jsdelivr.net', 'cdn.tailwindcss.com', "'unsafe-inline'"],
      styleSrc: ["'self'", 'cdn.tailwindcss.com', "'unsafe-inline'"],
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws://*']
    }
  }
}));
app.use(cors());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public/monitor')));

// ===== Rate limiter =====
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// ===== Auth setup =====
let users = { admin: { password: bcrypt.hashSync(ADMIN_PASSWORD, 10) } };

const authenticateToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ===== Instances (memory map) =====
let instances = new Map(
  BOTS_LIST.map(bot => [
    bot.name,
    {
      metrics: {},
      logs: [],
      dbPath: path.join(__dirname, `${bot.name}-db.json`),
      file: bot.file
    }
  ])
);

// ===== Login route =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// ===== API: List all bots =====
app.get('/api/instances', authenticateToken, (req, res) => {
  getPm2Processes((pm2List) => {
    const list = BOTS_LIST.map(bot => {
      const pm2proc = pm2List.find(p => p.name === bot.name);
      const instance = instances.get(bot.name);
      return {
        id: bot.name,
        script: bot.file,
        metrics: instance?.metrics || {},
        uptime: instance?.metrics?.uptime || null,
        running: !!pm2proc && pm2proc.pm2_env.status === 'online'
      };
    });
    res.json(list);
  });
});

// ===== API: Start bot =====
app.post('/api/start/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const bot = BOTS_LIST.find(b => b.name === id);
  if (!bot) return res.status(404).json({ error: `Bot ${id} not found` });

  exec(`pm2 start "${path.join(__dirname, bot.file)}" --name "${id}"`, (err) => {
    if (err) {
      logger.error(`Failed to start ${id}: ${err.message}`);
      return res.status(500).json({ error: `Failed to start ${id}` });
    }
    logger.info(`Started bot ${id}`);
    res.json({ message: `${id} started successfully` });
  });
});

// ===== API: Stop bot =====
app.post('/api/stop/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  getPm2Processes((pm2List) => {
    const pm2proc = pm2List.find(p => p.name === id);
    if (!pm2proc || pm2proc.pm2_env.status !== 'online') {
      return res.json({ message: `${id} is not running` });
    }
    exec(`pm2 delete "${id}"`, (err) => {
      if (err) {
        logger.error(`Failed to stop ${id}: ${err.message}`);
        return res.status(500).json({ error: `Failed to stop ${id}` });
      }
      logger.info(`Stopped bot ${id}`);
      res.json({ message: `${id} stopped successfully` });
    });
  });
});

// ===== API: Restart bot =====
app.post('/api/restart/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const bot = BOTS_LIST.find(b => b.name === id);
  if (!bot) return res.status(404).json({ error: `Bot ${id} not found` });

  getPm2Processes((pm2List) => {
    const pm2proc = pm2List.find(p => p.name === id);
    if (pm2proc && pm2proc.pm2_env.status === 'online') {
      exec(`pm2 restart "${id}"`, (err) => {
        if (err) {
          logger.error(`Restart failed for ${id}: ${err.message}`);
          return res.status(500).json({ error: `Failed to restart ${id}` });
        }
        logger.info(`Restarted ${id}`);
        res.json({ message: `${id} restarted successfully` });
      });
    } else {
      exec(`pm2 start "${path.join(__dirname, bot.file)}" --name "${id}"`, (err) => {
        if (err) {
          logger.error(`Failed to start ${id}: ${err.message}`);
          return res.status(500).json({ error: `Failed to start ${id}` });
        }
        logger.info(`Started ${id} (was stopped)`);
        res.json({ message: `${id} started successfully` });
      });
    }
  });
});

// ===== Socket.io setup =====
io.on('connection', (socket) => {
  logger.info(`New connection: ${socket.id}`);

  socket.on('authenticate', (token) => {
    if (token === AGENT_TOKEN) {
      socket.isAgent = true;
      logger.info(`Agent authenticated: ${socket.id}`);
    } else {
      logger.info(`Dashboard connection: ${socket.id}`);
    }
  });

  socket.on('metrics', (data) => {
    const instance = instances.get(socket.instanceId);
    if (instance) {
      instance.metrics = data;
      io.emit('metricsUpdate', { id: socket.instanceId, metrics: data });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Disconnected: ${socket.id}`);
  });
});

// ===== Dashboard route =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/monitor', 'dashboard.html'));
});

// ===== Optional: Auto-start bots on startup =====
getPm2Processes((pm2List) => {
  BOTS_LIST.forEach(bot => {
    const pm2proc = pm2List.find(p => p.name === bot.name);
    if (!pm2proc || pm2proc.pm2_env.status !== 'online') {
      exec(`pm2 start "${path.join(__dirname, bot.file)}" --name "${bot.name}"`, (err) => {
        if (err) logger.error(`Auto-start failed for ${bot.name}: ${err.message}`);
        else logger.info(`Auto-started ${bot.name}`);
      });
    }
  });
});

// ===== Start server =====
server.listen(PORT, () => {
  logger.info(`🟢 Monitoring server running on port ${PORT}`);
});
